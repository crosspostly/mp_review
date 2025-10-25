/**
 * @file triggers.gs
 * @description 3-триггерная система для автоматической обработки отзывов
 * @version 2.0
 * @date 2025-10-24
 * 
 * АРХИТЕКТУРА:
 * - ТРИГГЕР 1: Сбор отзывов (каждый час) - парсит Ozon/WB API, проверяет дубликаты
 * - ТРИГГЕР 2: Подбор ответов (каждый час) - NEW → PENDING с выбором шаблона
 * - ТРИГГЕР 3: Отправка ответов (каждый час) - PENDING → SENT через API
 * 
 * ХРАНИЛИЩЕ:
 * - ScriptProperties: кеш ID отзывов (10K последних, быстрая фильтрация)
 * - Google Sheets: все отзывы + статусы + история
 */

// ============ CONSTANTS ============
const TRIGGER_CONFIG = {
  INTERVAL_MINUTES: 60,           // Интервал запуска триггеров (1 час)
  CACHE_SIZE: 10000,              // Макс количество ID в кеше
  BATCH_SIZE_COLLECT: 100,        // Макс отзывов за один сбор
  BATCH_SIZE_PREPARE: 50,         // Макс отзывов за один подбор
  BATCH_SIZE_SEND: 30,            // Макс отзывов за одну отправку
  MAX_EXECUTION_TIME: 4.5 * 60 * 1000, // 4.5 минуты (безопасный запас)
  PROPERTIES_KEY: 'REVIEW_IDS_CACHE'
};

// ============ ТРИГГЕР 1: СБОР ОТЗЫВОВ ============
/**
 * 🔄 ТРИГГЕР 1: Сбор отзывов с маркетплейсов
 * 
 * Что делает:
 * 1. Парсит Ozon API (до 20 страниц макс)
 * 2. Парсит WB API (за последние 24 часа)
 * 3. Проверяет ID в ScriptProperties кеше (быстро!)
 * 4. Новые → сохраняет в Sheets со статусом NEW
 * 5. Обновляет Properties кеш
 * 
 * Время: ~3-4 минуты
 * Запуск: каждый час (триггер)
 */
function trigger1_collectReviews() {
  const startTime = Date.now();
  log('[ТРИГГЕР 1] 🚀 Начало сбора отзывов');
  
  try {
    // Проверяем время выполнения
    if (!hasTimeRemaining(startTime)) {
      log('[ТРИГГЕР 1] ⏱️ Недостаточно времени для выполнения');
      return;
    }
    
    // Получаем активные магазины
    const stores = getStores().filter(s => s.isActive);
    if (stores.length === 0) {
      log('[ТРИГГЕР 1] ℹ️ Нет активных магазинов');
      return;
    }
    
    log(`[ТРИГГЕР 1] 📊 Найдено ${stores.length} активных магазинов`);
    
    // Получаем кеш ID из Properties
    const cachedIds = getCachedReviewIds();
    const cachedSet = new Set(cachedIds);
    log(`[ТРИГГЕР 1] 💾 Загружено ${cachedSet.size} ID из кеша`);
    
    let totalNew = 0;
    let totalProcessed = 0;
    
    // Обрабатываем каждый магазин
    for (const store of stores) {
      if (!hasTimeRemaining(startTime)) {
        log(`[ТРИГГЕР 1] ⏱️ Время истекло после ${totalProcessed} магазинов`);
        break;
      }
      
      log(`[ТРИГГЕР 1] 📦 Обработка: ${store.name} [${store.marketplace}]`);
      
      try {
        // Получаем отзывы с маркетплейса
        const reviews = fetchReviewsForStore(store);
        log(`[ТРИГГЕР 1] 📥 Получено ${reviews.length} отзывов от ${store.marketplace}`);
        
        // Фильтруем новые (не в кеше)
        const newReviews = reviews.filter(r => !cachedSet.has(r.id));
        log(`[ТРИГГЕР 1] 🆕 Новых отзывов: ${newReviews.length}`);
        
        if (newReviews.length > 0) {
          // Сохраняем в Sheets
          saveReviewsToSheet(store, newReviews);
          
          // Добавляем в кеш
          newReviews.forEach(r => cachedSet.add(r.id));
          totalNew += newReviews.length;
        }
        
        totalProcessed++;
        
      } catch (e) {
        log(`[ТРИГГЕР 1] ❌ Ошибка обработки ${store.name}: ${e.message}`);
      }
      
      // Rate limiting между магазинами
      Utilities.sleep(500);
    }
    
    // Обновляем кеш в Properties
    saveCachedReviewIds(Array.from(cachedSet));
    
    const duration = Math.round((Date.now() - startTime) / 1000);
    log(`[ТРИГГЕР 1] ✅ Завершено: ${totalNew} новых отзывов, ${totalProcessed} магазинов, ${duration}с`);
    
  } catch (e) {
    log(`[ТРИГГЕР 1] ❌ КРИТИЧЕСКАЯ ОШИБКА: ${e.message}`);
    log(`[ТРИГГЕР 1] 🔍 Stack: ${e.stack}`);
  }
}

// ============ ТРИГГЕР 2: ПОДБОР ОТВЕТОВ ============
/**
 * 🤖 ТРИГГЕР 2: Подбор ответов для отзывов
 * 
 * Что делает:
 * 1. Находит отзывы со статусом NEW (из всех листов магазинов)
 * 2. Для каждого выбирает шаблон по рейтингу (из листа "Шаблоны ответов")
 * 3. Кастомизирует ответ по ключевым словам в тексте отзыва
 * 4. Обновляет статус NEW → PENDING
 * 5. Сохраняет подобранный ответ в лист
 * 
 * Время: ~1-2 минуты
 * Запуск: каждый час (триггер)
 */
function trigger2_prepareAnswers() {
  const startTime = Date.now();
  log('[ТРИГГЕР 2] 🚀 Начало подбора ответов');
  
  try {
    // Проверяем время выполнения
    if (!hasTimeRemaining(startTime)) {
      log('[ТРИГГЕР 2] ⏱️ Недостаточно времени для выполнения');
      return;
    }
    
    // Находим все отзывы со статусом NEW
    const newReviews = findReviewsByStatus(CONFIG.STATUS.NEW, TRIGGER_CONFIG.BATCH_SIZE_PREPARE);
    
    if (newReviews.length === 0) {
      log('[ТРИГГЕР 2] ℹ️ Новых отзывов для обработки нет');
      return;
    }
    
    log(`[ТРИГГЕР 2] 📊 Найдено ${newReviews.length} отзывов для подбора ответов`);
    
    // Получаем шаблоны
    const templates = getTemplates();
    if (!templates || templates.length === 0) {
      log('[ТРИГГЕР 2] ❌ Шаблоны ответов не найдены');
      return;
    }
    
    let processedCount = 0;
    const updates = [];
    
    // Обрабатываем каждый отзыв
    for (const review of newReviews) {
      if (!hasTimeRemaining(startTime)) {
        log(`[ТРИГГЕР 2] ⏱️ Время истекло после ${processedCount} отзывов`);
        break;
      }
      
      try {
        // Выбираем шаблон по рейтингу
        const template = selectTemplateForReview(review, templates);
        
        if (!template) {
          log(`[ТРИГГЕР 2] ⚠️ Нет шаблона для отзыва ${review.id} (рейтинг ${review.rating})`);
          // Помечаем как ERROR
          updates.push({
            ...review,
            status: CONFIG.STATUS.ERROR,
            errorMsg: `Нет шаблона для рейтинга ${review.rating}`
          });
          continue;
        }
        
        // Кастомизируем ответ по ключевым словам
        const customizedAnswer = customizeAnswer(template, review);
        
        // Добавляем в список обновлений
        updates.push({
          ...review,
          answer: customizedAnswer,
          status: CONFIG.STATUS.PENDING,
          processedDate: new Date()
        });
        
        processedCount++;
        
      } catch (e) {
        log(`[ТРИГГЕР 2] ❌ Ошибка обработки отзыва ${review.id}: ${e.message}`);
        updates.push({
          ...review,
          status: CONFIG.STATUS.ERROR,
          errorMsg: e.message
        });
      }
    }
    
    // Сохраняем все обновления в Sheets
    if (updates.length > 0) {
      batchUpdateReviewsInSheets(updates);
      log(`[ТРИГГЕР 2] ✅ Обновлено ${updates.length} отзывов`);
    }
    
    const duration = Math.round((Date.now() - startTime) / 1000);
    log(`[ТРИГГЕР 2] ✅ Завершено: обработано ${processedCount}, обновлено ${updates.length}, ${duration}с`);
    
  } catch (e) {
    log(`[ТРИГГЕР 2] ❌ КРИТИЧЕСКАЯ ОШИБКА: ${e.message}`);
    log(`[ТРИГГЕР 2] 🔍 Stack: ${e.stack}`);
  }
}

// ============ ТРИГГЕР 3: ОТПРАВКА ОТВЕТОВ ============
/**
 * 📤 ТРИГГЕР 3: Отправка ответов на маркетплейсы
 * 
 * Что делает:
 * 1. Находит отзывы со статусом PENDING (готовые к отправке)
 * 2. Для каждого отправляет ответ через Ozon/WB API
 * 3. Rate limiting (500ms для Ozon, 333ms для WB)
 * 4. Обновляет статус PENDING → SENT (успех) или ERROR (ошибка)
 * 5. Сохраняет результат в лист
 * 
 * Время: ~1-2 минуты
 * Запуск: каждый час (триггер)
 */
function trigger3_sendAnswers() {
  const startTime = Date.now();
  log('[ТРИГГЕР 3] 🚀 Начало отправки ответов');
  
  try {
    // Проверяем время выполнения
    if (!hasTimeRemaining(startTime)) {
      log('[ТРИГГЕР 3] ⏱️ Недостаточно времени для выполнения');
      return;
    }
    
    // Находим все отзывы со статусом PENDING
    const pendingReviews = findReviewsByStatus(CONFIG.STATUS.PENDING, TRIGGER_CONFIG.BATCH_SIZE_SEND);
    
    if (pendingReviews.length === 0) {
      log('[ТРИГГЕР 3] ℹ️ Нет отзывов для отправки');
      return;
    }
    
    log(`[ТРИГГЕР 3] 📊 Найдено ${pendingReviews.length} отзывов для отправки`);
    
    let sentCount = 0;
    let errorCount = 0;
    const updates = [];
    
    // Обрабатываем каждый отзыв
    for (const review of pendingReviews) {
      if (!hasTimeRemaining(startTime)) {
        log(`[ТРИГГЕР 3] ⏱️ Время истекло после ${sentCount + errorCount} отзывов`);
        break;
      }
      
      try {
        // Определяем магазин по sheetName
        const marketplace = getMarketplaceFromSheetName(review.sheetName);
        
        if (!marketplace) {
          log(`[ТРИГГЕР 3] ⚠️ Не удалось определить маркетплейс для ${review.sheetName}`);
          updates.push({
            ...review,
            status: CONFIG.STATUS.ERROR,
            errorMsg: 'Неизвестный маркетплейс'
          });
          errorCount++;
          continue;
        }
        
        // Отправляем ответ
        let success = false;
        let errorMsg = '';
        
        if (marketplace === 'Ozon') {
          const result = sendAnswerToOzon(review);
          success = result.success;
          errorMsg = result.error || '';
          // Rate limit для Ozon
          Utilities.sleep(500);
        } else if (marketplace === 'Wildberries') {
          const result = sendAnswerToWB(review);
          success = result.success;
          errorMsg = result.error || '';
          // Rate limit для WB
          Utilities.sleep(333);
        }
        
        // Добавляем результат в обновления
        if (success) {
          updates.push({
            ...review,
            status: CONFIG.STATUS.SENT,
            sentDate: new Date(),
            errorMsg: ''
          });
          sentCount++;
          log(`[ТРИГГЕР 3] ✅ Отправлено: ${review.id}`);
        } else {
          updates.push({
            ...review,
            status: CONFIG.STATUS.ERROR,
            errorMsg: errorMsg
          });
          errorCount++;
          log(`[ТРИГГЕР 3] ❌ Ошибка: ${review.id} - ${errorMsg}`);
        }
        
      } catch (e) {
        log(`[ТРИГГЕР 3] ❌ Ошибка отправки ${review.id}: ${e.message}`);
        updates.push({
          ...review,
          status: CONFIG.STATUS.ERROR,
          errorMsg: e.message
        });
        errorCount++;
      }
    }
    
    // Сохраняем все обновления в Sheets
    if (updates.length > 0) {
      batchUpdateReviewsInSheets(updates);
    }
    
    const duration = Math.round((Date.now() - startTime) / 1000);
    log(`[ТРИГГЕР 3] ✅ Завершено: отправлено ${sentCount}, ошибок ${errorCount}, ${duration}с`);
    
  } catch (e) {
    log(`[ТРИГГЕР 3] ❌ КРИТИЧЕСКАЯ ОШИБКА: ${e.message}`);
    log(`[ТРИГГЕР 3] 🔍 Stack: ${e.stack}`);
  }
}

// ============ HELPER FUNCTIONS ============

/**
 * Проверяет, достаточно ли времени для продолжения
 * @param {number} startTime - Время начала выполнения
 * @returns {boolean} true если достаточно времени
 */
function hasTimeRemaining(startTime) {
  const elapsed = Date.now() - startTime;
  const remaining = TRIGGER_CONFIG.MAX_EXECUTION_TIME - elapsed;
  return remaining > 30000; // Минимум 30 секунд запаса
}

/**
 * Получает кешированные ID отзывов из ScriptProperties
 * @returns {Array} Массив ID отзывов
 */
function getCachedReviewIds() {
  try {
    const props = PropertiesService.getScriptProperties();
    const cached = props.getProperty(TRIGGER_CONFIG.PROPERTIES_KEY);
    if (!cached) return [];
    
    const ids = JSON.parse(cached);
    return Array.isArray(ids) ? ids : [];
  } catch (e) {
    log(`[CACHE] ❌ Ошибка загрузки кеша: ${e.message}`);
    return [];
  }
}

/**
 * Сохраняет кешированные ID отзывов в ScriptProperties
 * @param {Array} ids - Массив ID отзывов
 */
function saveCachedReviewIds(ids) {
  try {
    const props = PropertiesService.getScriptProperties();
    // Ограничиваем кеш до CACHE_SIZE последних ID
    const trimmed = ids.slice(-TRIGGER_CONFIG.CACHE_SIZE);
    props.setProperty(TRIGGER_CONFIG.PROPERTIES_KEY, JSON.stringify(trimmed));
    log(`[CACHE] 💾 Сохранено ${trimmed.length} ID в кеш`);
  } catch (e) {
    log(`[CACHE] ❌ Ошибка сохранения кеша: ${e.message}`);
  }
}

/**
 * Получает отзывы для магазина с API
 * @param {Object} store - Объект магазина
 * @returns {Array} Массив отзывов
 */
function fetchReviewsForStore(store) {
  const reviews = [];
  
  try {
    if (store.marketplace === 'Wildberries') {
      // WB API - получаем за последние 24 часа
      const apiKey = store.credentials?.apiKey;
      if (!apiKey) {
        log(`[FETCH] ❌ Нет API ключа для ${store.name}`);
        return [];
      }
      
      // Используем исправленную функцию из api_fixes.gs или стандартную
      if (typeof getWbFeedbacksV2 === 'function') {
        return getWbFeedbacksV2(apiKey, false, store);
      } else if (typeof getWbFeedbacks === 'function') {
        return getWbFeedbacks(apiKey, false, store);
      }
    } else if (store.marketplace === 'Ozon') {
      // Ozon API - получаем до 20 страниц
      const clientId = store.credentials?.clientId;
      const apiKey = store.credentials?.apiKey;
      if (!clientId || !apiKey) {
        log(`[FETCH] ❌ Нет credentials для ${store.name}`);
        return [];
      }
      
      // Используем исправленную функцию из api_fixes.gs или стандартную
      if (typeof getOzonFeedbacksFixed === 'function') {
        return getOzonFeedbacksFixed(clientId, apiKey, false, store);
      } else if (typeof getOzonFeedbacks === 'function') {
        return getOzonFeedbacks(clientId, apiKey, false, store);
      }
    }
  } catch (e) {
    log(`[FETCH] ❌ Ошибка получения отзывов для ${store.name}: ${e.message}`);
  }
  
  return reviews;
}

/**
 * Сохраняет отзывы в лист магазина
 * @param {Object} store - Объект магазина
 * @param {Array} reviews - Массив отзывов
 */
function saveReviewsToSheet(store, reviews) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = `${store.marketplace}_${store.id}`;
    let sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      // Создаем новый лист
      sheet = ss.insertSheet(sheetName);
      // Добавляем заголовки
      const headers = ['ID', 'Дата', 'Рейтинг', 'Текст', 'Товар', 'Статус', 'Дата обработки', 'Ответ', 'Ошибка'];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
    
    // Подготавливаем данные для вставки
    const rows = reviews.map(r => [
      r.id,
      r.createdDate || new Date(),
      r.rating || 0,
      r.text || '',
      r.product?.name || '',
      CONFIG.STATUS.NEW,
      new Date(),
      '',
      ''
    ]);
    
    if (rows.length > 0) {
      const lastRow = sheet.getLastRow();
      sheet.getRange(lastRow + 1, 1, rows.length, rows[0].length).setValues(rows);
      log(`[SAVE] ✅ Сохранено ${rows.length} отзывов в ${sheetName}`);
    }
  } catch (e) {
    log(`[SAVE] ❌ Ошибка сохранения: ${e.message}`);
  }
}

/**
 * Находит все отзывы по статусу из всех листов
 * @param {string} status - Статус для поиска
 * @param {number} limit - Максимальное количество отзывов
 * @returns {Array} Массив объектов отзывов
 */
function findReviewsByStatus(status, limit) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  const reviews = [];
  
  for (const sheet of sheets) {
    if (reviews.length >= limit) break;
    
    const sheetName = sheet.getName();
    // Пропускаем служебные листы
    if (sheetName === 'Stores' || sheetName === CONFIG.LOG_SHEET_NAME || sheetName === CONFIG.SHEETS.TEMPLATES) {
      continue;
    }
    
    const data = sheet.getDataRange().getValues();
    
    // Пропускаем заголовок
    for (let i = 1; i < data.length && reviews.length < limit; i++) {
      const row = data[i];
      
      if (row[5] === status) { // Статус в колонке F (индекс 5)
        reviews.push({
          sheetName: sheetName,
          rowIndex: i + 1,
          id: row[0],
          createdDate: row[1],
          rating: row[2],
          text: row[3],
          product: row[4],
          status: row[5],
          processedDate: row[6],
          answer: row[7],
          errorMsg: row[8]
        });
      }
    }
  }
  
  return reviews;
}

/**
 * Получает шаблоны ответов из листа
 * @returns {Array} Массив шаблонов
 */
function getTemplates() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEETS.TEMPLATES);
    
    if (!sheet) {
      log('[TEMPLATES] ⚠️ Лист шаблонов не найден');
      return [];
    }
    
    const data = sheet.getDataRange().getValues();
    const templates = [];
    
    // Предполагаем структуру: Рейтинг | Текст шаблона
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[0] && row[1]) {
        templates.push({
          rating: row[0],
          text: row[1]
        });
      }
    }
    
    log(`[TEMPLATES] 📋 Загружено ${templates.length} шаблонов`);
    return templates;
  } catch (e) {
    log(`[TEMPLATES] ❌ Ошибка загрузки шаблонов: ${e.message}`);
    return [];
  }
}

/**
 * Выбирает подходящий шаблон для отзыва
 * @param {Object} review - Объект отзыва
 * @param {Array} templates - Массив шаблонов
 * @returns {string|null} Текст шаблона или null
 */
function selectTemplateForReview(review, templates) {
  // Ищем шаблон для конкретного рейтинга
  const template = templates.find(t => t.rating === review.rating);
  
  if (template) {
    return template.text;
  }
  
  // Fallback: используем универсальный шаблон (рейтинг 0 или null)
  const fallback = templates.find(t => t.rating === 0 || t.rating === null);
  return fallback ? fallback.text : null;
}

/**
 * Кастомизирует ответ по ключевым словам
 * @param {string} template - Базовый шаблон
 * @param {Object} review - Объект отзыва
 * @returns {string} Кастомизированный ответ
 */
function customizeAnswer(template, review) {
  let answer = template;
  
  // Если текст отзыва содержит ключевые слова, добавляем соответствующие фразы
  if (review.text) {
    const text = review.text.toLowerCase();
    
    if (text.includes('доставка') || text.includes('доставили')) {
      answer += '\n\n💌 Мы работаем над улучшением сервиса доставки.';
    }
    
    if (text.includes('качество') || text.includes('брак')) {
      answer += '\n\n🔧 Свяжитесь с нашей поддержкой для решения вопроса с качеством.';
    }
    
    if (text.includes('размер')) {
      answer += '\n\n📏 Рекомендуем внимательно ознакомиться с таблицей размеров перед заказом.';
    }
  }
  
  return answer;
}

/**
 * Пакетное обновление отзывов в Sheets
 * @param {Array} updates - Массив обновлений
 */
function batchUpdateReviewsInSheets(updates) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Группируем по листам
    const bySheet = {};
    updates.forEach(update => {
      if (!bySheet[update.sheetName]) {
        bySheet[update.sheetName] = [];
      }
      bySheet[update.sheetName].push(update);
    });
    
    // Обновляем каждый лист
    Object.entries(bySheet).forEach(([sheetName, sheetUpdates]) => {
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        log(`[BATCH] ⚠️ Лист ${sheetName} не найден`);
        return;
      }
      
      sheetUpdates.forEach(update => {
        // Обновляем колонки F-I (статус, дата, ответ, ошибка)
        sheet.getRange(update.rowIndex, 6, 1, 4).setValues([[
          update.status,
          update.processedDate || new Date(),
          update.answer || '',
          update.errorMsg || ''
        ]]);
      });
      
      log(`[BATCH] ✅ Обновлено ${sheetUpdates.length} строк в ${sheetName}`);
    });
  } catch (e) {
    log(`[BATCH] ❌ Ошибка пакетного обновления: ${e.message}`);
  }
}

/**
 * Определяет маркетплейс по имени листа
 * @param {string} sheetName - Имя листа
 * @returns {string|null} Название маркетплейса
 */
function getMarketplaceFromSheetName(sheetName) {
  if (sheetName.startsWith('Ozon')) return 'Ozon';
  if (sheetName.startsWith('Wildberries') || sheetName.startsWith('WB')) return 'Wildberries';
  return null;
}

/**
 * Отправляет ответ на отзыв Ozon
 * @param {Object} review - Объект отзыва
 * @returns {Object} {success: boolean, error: string}
 */
function sendAnswerToOzon(review) {
  try {
    // Получаем credentials магазина из имени листа
    const stores = getStores();
    const store = stores.find(s => `${s.marketplace}_${s.id}` === review.sheetName);
    
    if (!store || !store.credentials) {
      return { success: false, error: 'Store not found' };
    }
    
    const clientId = store.credentials.clientId;
    const apiKey = store.credentials.apiKey;
    
    // Используем исправленную функцию если доступна
    if (typeof sendOzonFeedbackAnswerFixed === 'function') {
      const result = sendOzonFeedbackAnswerFixed(review.id, review.answer, clientId, apiKey);
      return { success: result.success, error: result.error || '' };
    } else if (typeof sendOzonFeedbackAnswer === 'function') {
      const result = sendOzonFeedbackAnswer(review.id, review.answer, clientId, apiKey);
      return { success: result.success, error: result.error || '' };
    }
    
    return { success: false, error: 'Send function not found' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Отправляет ответ на отзыв WB
 * @param {Object} review - Объект отзыва
 * @returns {Object} {success: boolean, error: string}
 */
function sendAnswerToWB(review) {
  try {
    // Получаем credentials магазина из имени листа
    const stores = getStores();
    const store = stores.find(s => `${s.marketplace}_${s.id}` === review.sheetName);
    
    if (!store || !store.credentials) {
      return { success: false, error: 'Store not found' };
    }
    
    const apiKey = store.credentials.apiKey;
    
    // Используем исправленную функцию если доступна
    if (typeof sendWbFeedbackAnswerV2 === 'function') {
      const result = sendWbFeedbackAnswerV2(review.id, review.answer, apiKey);
      return { success: result.success, error: result.error || '' };
    } else if (typeof sendWbFeedbackAnswer === 'function') {
      const result = sendWbFeedbackAnswer(review.id, review.answer, apiKey);
      return { success: result.success, error: result.error || '' };
    }
    
    return { success: false, error: 'Send function not found' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
