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
// (остальные функции: hasTimeRemaining, getCachedReviewIds, save..., fetch..., и т.д.)
// Код слишком большой для одного сообщения, продолжу в следующем файле
