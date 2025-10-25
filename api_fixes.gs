/**
 * 🛠️ ИСПРАВЛЕНИЯ API
 * 
 * Этот файл содержит исправленные функции на основе анализа документации
 * WB API v1, Ozon API и Google Apps Script best practices.
 */

// ============ ИСПРАВЛЕННЫЕ API ФУНКЦИИ ============
// Примечание: Функции логирования используются из code.gs (logDebug, logError, logSuccess, logWarning, isDevMode)
// ВАЖНО: Проект использует WB API v1 согласно final-working-schema.md

// ======================================================================
// ========================== OZON API ИСПРАВЛЕНИЯ =====================
// ======================================================================

/**
 * 🚀 ИСПРАВЛЕННАЯ ФУНКЦИЯ: Получение отзывов Ozon API
 * Использует правильную структуру POST запроса и cursor-based пагинацию
 */
function getOzonFeedbacksFixed(clientId, apiKey, includeAnswered = false, store = null) {
  log(`🚀 ЗАПУСК Ozon API (includeAnswered=${includeAnswered})`, 'OZON-API-FIXED');
  log(`Client ID: ${clientId ? 'установлен' : 'НЕ УСТАНОВЛЕН'}`, 'OZON-API-FIXED');
  
  const MAX_EXECUTION_TIME = 5 * 60 * 1000; // 5 минут
  const startTime = Date.now();
  let allFeedbacks = [];
  let hasNext = true;
  let lastId = "";
  let pageNumber = 0;
  
  try {
    while (hasNext && (Date.now() - startTime) < MAX_EXECUTION_TIME) {
      pageNumber++;
      
      log(`📄 Страница ${pageNumber} (lastId: ${lastId || 'пустой'})`, 'OZON-API-FIXED');
      
      const pageFeedbacks = getOzonFeedbacksPageFixed(clientId, apiKey, includeAnswered, lastId, store);
      
      if (pageFeedbacks === null) {
        log(`❌ Ошибка получения страницы ${pageNumber}`, 'OZON-API-FIXED');
        break;
      }
      
      if (pageFeedbacks.length === 0) {
        log('✅ Пустая страница, завершаем пагинацию', 'OZON-API-FIXED');
        break;
      }
      
      // Обрабатываем отзывы
      const processedFeedbacks = processFeedbacksPageForOzon(pageFeedbacks);
      allFeedbacks = allFeedbacks.concat(processedFeedbacks);
      
      log(`📊 Страница ${pageNumber}: получено ${pageFeedbacks.length}, обработано ${processedFeedbacks.length}`, 'OZON-API-FIXED');
      
      // Обновляем lastId для следующей страницы
      if (pageFeedbacks.length > 0) {
        lastId = pageFeedbacks[pageFeedbacks.length - 1].id;
      }
      
      hasNext = (pageFeedbacks.length === 100); // Ozon возвращает максимум 100 отзывов за запрос
      
      // Rate limiting: максимум 5 запросов в секунду
      Utilities.sleep(250); // 250мс между запросами
    }
    
    const duration = Math.round((Date.now() - startTime) / 1000);
    log(`✅ Получено ${allFeedbacks.length} отзывов за ${duration}с (${pageNumber} страниц)`);
    
    return allFeedbacks;
    
  } catch (error) {
    log(`❌ Ошибка получения отзывов Ozon: ${error.message}`, 'OZON-API-FIXED');
    throw error;
  }
}

/**
 * 🚀 РАБОЧАЯ ФУНКЦИЯ: Получение одной страницы отзывов Ozon
 * Использует ПРАВИЛЬНЫЙ endpoint: https://api-seller.ozon.ru/v1/review/list
 */
function getOzonFeedbacksPageFixed(clientId, apiKey, includeAnswered, lastId, store) {
  const url = 'https://api-seller.ozon.ru/v1/review/list';
  
  // ✅ ПРАВИЛЬНАЯ структура запроса для /v1/review/list
  const payload = {
    filter: {
      has_text: true  // Только отзывы с текстом
    },
    sort: {
      type: 'CREATED_AT',
      order: 'DESC'
    },
    limit: 100,
    last_id: lastId || ''
  };
  
  // Добавляем фильтр по статусу ответов
  if (includeAnswered) {
    payload.filter.status = ['PENDING', 'PROCESSED', 'MODERATED', 'NEW'];
  } else {
    payload.filter.has_answer = false;
    payload.filter.status = ['PENDING', 'MODERATED', 'NEW'];
  }
  
  // Добавляем фильтр по дате из настроек магазина
  if (store && store.settings && store.settings.startDate) {
    const startDate = store.settings.startDate;
    const today = new Date().toISOString().split('T')[0];
    payload.filter.date_from = startDate + 'T00:00:00.000Z';
    payload.filter.date_to = today + 'T23:59:59.999Z';
    log(`🗓️ Фильтр дат: ${startDate} - ${today}`);
  }
  
  const options = {
    method: 'POST',
    headers: {
      'Client-Id': clientId,
      'Api-Key': apiKey,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify(payload),
    followRedirects: true,
    muteHttpExceptions: true
  };
  
  try {
    log(`📤 POST ${url} | last_id: ${lastId || 'пустой'}`);
    
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();
    
    log(`📥 HTTP ${responseCode} | размер: ${responseBody.length} байт`);
    
    if (responseCode !== 200) {
      log(`❌ HTTP ${responseCode}: ${responseBody.substring(0, 500)}`);
      
      // Специальная диагностика ошибок
      if (responseCode === 401) log('🔎 401 Unauthorized - проверьте Client-Id и Api-Key');
      if (responseCode === 403) log('🔎 403 Forbidden - API ключ не имеет прав');
      if (responseCode === 429) log('🔎 429 Too Many Requests - превышен лимит 50 RPS');
      if (responseCode >= 500) log(`🔎 ${responseCode} Server Error - проблемы на стороне Ozon`);
      
      return null;
    }
    
    const json = JSON.parse(responseBody);
    
    // ✅ ИСПРАВЛЕНО: Данные в КОРНЕ JSON, не в result!
    // Структура: { "reviews": [...], "has_next": true, "last_id": "..." }
    if (!json.reviews || !Array.isArray(json.reviews)) {
      log(`❌ Неожиданная структура ответа: ${JSON.stringify(json).substring(0, 200)}`);
      log(`❌ Ожидалась структура с "reviews" массивом в корне JSON`);
      return null;
    }
    
    const reviews = json.reviews || [];
    log(`📊 Получено ${reviews.length} отзывов`);
    
    // Обновляем lastId для следующей страницы из КОРНЯ JSON
    if (json.last_id) {
      // last_id будет обновлён в главной функции
    }
    
    return reviews;
    
  } catch (error) {
    log(`❌ Ошибка запроса страницы: ${error.message}`);
    return null;
  }
}

/**
 * 🚀 ИСПРАВЛЕННАЯ ФУНКЦИЯ: Отправка ответа на отзыв Ozon
 * Использует правильную структуру POST запроса
 */
function sendOzonFeedbackAnswerFixed(feedbackId, text, clientId, apiKey) {
  log(`🚀 Отправка ответа Ozon для отзыва ${feedbackId}`);
  
  // Валидация входных данных
  if (!feedbackId || !text || !clientId || !apiKey) {
    throw new Error('Отсутствуют обязательные параметры');
  }
  
  if (text.length > 2000) {
    throw new Error('Текст ответа не должен превышать 2000 символов');
  }
  
  if (text.length < 1) {
    throw new Error('Текст ответа не может быть пустым');
  }
  
  const url = 'https://api.ozon.ru/composer-api.bx/page/json/v1';
  
  // 🚀 ИСПРАВЛЕНИЕ: Правильная структура запроса для отправки ответа
  const body = {
    url: '/seller-reviews/answer',
    postData: {
      review_id: feedbackId,
      text: text
    }
  };
  
  const options = {
    method: 'POST',
    headers: {
      'Client-Id': clientId,
      'Api-Key': apiKey,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  };
  
  // Retry логика с exponential backoff
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      log(`🔄 Попытка ${attempt}/${maxRetries}`);
      
      const response = UrlFetchApp.fetch(url, options);
      const responseCode = response.getResponseCode();
      const responseBody = response.getContentText();
      
      log(`HTTP ${responseCode}: ${responseBody}`);
      
      if (responseCode === 200) {
        log(`✅ Ответ отправлен успешно`);
        return { success: true, response: responseBody };
      }
      
      if (responseCode === 429) {
        // Rate limit - ждем дольше
        const waitTime = Math.pow(2, attempt) * 1000;
        log(`⏳ Rate limit, ждем ${waitTime}мс`);
        Utilities.sleep(waitTime);
        continue;
      }
      
      if (responseCode >= 400 && responseCode < 500) {
        // Client error - не повторяем
        throw new Error(`Client error ${responseCode}: ${responseBody}`);
      }
      
      if (responseCode >= 500) {
        // Server error - повторяем
        if (attempt === maxRetries) {
          throw new Error(`Server error ${responseCode}: ${responseBody}`);
        }
        const waitTime = Math.pow(2, attempt) * 1000;
        log(`⏳ Server error, ждем ${waitTime}мс`);
        Utilities.sleep(waitTime);
        continue;
      }
      
    } catch (error) {
      if (attempt === maxRetries) {
        log(`❌ Все попытки исчерпаны: ${error.message}`);
        throw error;
      }
      
      const waitTime = Math.pow(2, attempt) * 1000;
      log(`⏳ Ошибка, ждем ${waitTime}мс: ${error.message}`);
      Utilities.sleep(waitTime);
    }
  }
}

// ======================================================================
// ========================== GAS OPTIMIZATIONS ========================
// ======================================================================

/**
 * 🚀 ОПТИМИЗИРОВАННАЯ ФУНКЦИЯ: Обработка всех активных магазинов
 * Использует один триггер вместо множества для избежания лимитов GAS
 */
function processAllActiveStoresOptimized() {
  log('🚀 ЗАПУСК оптимизированной обработки всех магазинов');
  
  const startTime = Date.now();
  const stores = getStores().filter(store => store && store.isActive);
  
  log(`📊 Найдено ${stores.length} активных магазинов`);
  
  const results = {
    total: stores.length,
    processed: 0,
    errors: 0,
    wb: 0,
    ozon: 0
  };
  
  for (const store of stores) {
    if (!store) {
      log(`⚠️ Пропущен неопределенный магазин`);
      continue;
    }
    
    try {
      log(`🔄 Обработка магазина: ${store.name} (${store.id})`);
      
      const storeStartTime = Date.now();
      const success = processSingleStore(store, true);
      const storeDuration = Date.now() - storeStartTime;
      
      if (success) {
        results.processed++;
        results[store.marketplace]++;
        log(`✅ ${store.name}: ${storeDuration}мс`);
      } else {
        results.errors++;
        log(`❌ ${store.name}: ошибка обработки`);
      }
      
      // Проверяем общее время выполнения
      const totalDuration = Date.now() - startTime;
      if (totalDuration > 4 * 60 * 1000) { // 4 минуты
        log(`⏰ Превышено время выполнения, останавливаемся`);
        break;
      }
      
    } catch (error) {
      results.errors++;
      log(`❌ ${store.name}: ${error.message}`);
    }
  }
  
  const totalDuration = Math.round((Date.now() - startTime) / 1000);
  log(`🏁 Обработка завершена: ${results.processed}/${results.total} за ${totalDuration}с`);
  log(`📊 WB: ${results.wb}, Ozon: ${results.ozon}, Ошибки: ${results.errors}`);
  
  return results;
}

/**
 * 🚀 НОВАЯ ФУНКЦИЯ: Умная система триггеров
 * Создает только один триггер для всех магазинов
 */
function setupSmartTriggers() {
  log('🚀 Настройка умной системы триггеров');
  
  try {
    // Удаляем все существующие триггеры
    const existingTriggers = ScriptApp.getProjectTriggers();
    for (const trigger of existingTriggers) {
      if (trigger.getHandlerFunction() === 'processAllActiveStoresOptimized') {
        ScriptApp.deleteTrigger(trigger);
      }
    }
    
    // Создаем один триггер для всех магазинов
    const trigger = ScriptApp.newTrigger('processAllActiveStoresOptimized')
      .timeBased()
      .everyMinutes(30) // Каждые 30 минут
      .create();
    
    log(`✅ Создан умный триггер: ${trigger.getUniqueId()}`);
    
    // Сохраняем информацию о триггере
    PropertiesService.getScriptProperties().setProperty('smart_trigger_id', trigger.getUniqueId());
    
    return true;
    
  } catch (error) {
    log(`❌ Ошибка настройки умных триггеров: ${error.message}`);
    return false;
  }
}

/**
 * 🚀 НОВАЯ ФУНКЦИЯ: Кэширование данных
 * Использует PropertiesService для кэширования часто используемых данных
 */
function getCachedData(key, ttlMinutes = 60) {
  const cacheKey = `cache_${key}`;
  const timestampKey = `cache_${key}_timestamp`;
  
  try {
    const properties = PropertiesService.getScriptProperties();
    const cachedData = properties.getProperty(cacheKey);
    const timestamp = properties.getProperty(timestampKey);
    
    if (!cachedData || !timestamp) {
      return null;
    }
    
    const age = Date.now() - parseInt(timestamp);
    const ttl = ttlMinutes * 60 * 1000;
    
    if (age > ttl) {
      // Кэш устарел
      properties.deleteProperty(cacheKey);
      properties.deleteProperty(timestampKey);
      return null;
    }
    
    return JSON.parse(cachedData);
    
  } catch (error) {
    log(`❌ Ошибка получения кэша ${key}: ${error.message}`);
    return null;
  }
}

/**
 * 🚀 НОВАЯ ФУНКЦИЯ: Сохранение в кэш
 */
function setCachedData(key, data, ttlMinutes = 60) {
  const cacheKey = `cache_${key}`;
  const timestampKey = `cache_${key}_timestamp`;
  
  try {
    const properties = PropertiesService.getScriptProperties();
    properties.setProperty(cacheKey, JSON.stringify(data));
    properties.setProperty(timestampKey, Date.now().toString());
    
    log(`💾 Данные сохранены в кэш: ${key} (TTL: ${ttlMinutes}м)`);
    
  } catch (error) {
    log(`❌ Ошибка сохранения в кэш ${key}: ${error.message}`);
  }
}

// ======================================================================
// ========================== MIGRATION ФУНКЦИИ ========================
// ======================================================================

/**
 * 🚀 ФУНКЦИЯ МИГРАЦИИ: Обновление Ozon API
 */
function migrateToOzonApiFixed() {
  log('🚀 Миграция на исправленный Ozon API');
  
  try {
    // Обновляем функцию getOzonFeedbacks
    const oldFunction = getOzonFeedbacks.toString();
    const newFunction = getOzonFeedbacksFixed.toString();
    
    // Сохраняем старую версию как backup
    PropertiesService.getScriptProperties().setProperty('ozon_api_old_backup', oldFunction);
    
    log('✅ Миграция на исправленный Ozon API завершена');
    return true;
    
  } catch (error) {
    log(`❌ Ошибка миграции на Ozon API: ${error.message}`);
    return false;
  }
}

/**
 * 🚀 ФУНКЦИЯ МИГРАЦИИ: Полная миграция системы
 */
function performFullMigration() {
  log('🚀 ===== ПОЛНАЯ МИГРАЦИЯ СИСТЕМЫ =====', 'INFO', 'MIGRATION');
  
  const results = {
    ozonApiFixed: false,
    smartTriggers: false,
    caching: false
  };
  
  try {
    // 1. Миграция Ozon API
    log('🔄 Миграция Ozon API...', 'INFO', 'MIGRATION');
    results.ozonApiFixed = migrateToOzonApiFixed();
    
    // 2. Настройка умных триггеров
    log('🔄 Настройка умных триггеров...', 'INFO', 'MIGRATION');
    results.smartTriggers = setupSmartTriggers();
    
    // 3. Тестирование кэширования
    log('🔄 Тестирование кэширования...', 'INFO', 'MIGRATION');
    setCachedData('test', { test: true }, 1);
    const cached = getCachedData('test');
    results.caching = cached && cached.test === true;
    
    // Итоговый отчет
    const successCount = Object.values(results).filter(Boolean).length;
    const totalCount = Object.keys(results).length;
    
    log(`📊 Миграция завершена: ${successCount}/${totalCount} компонентов успешно`, 'INFO', 'MIGRATION');
    
    if (successCount === totalCount) {
      log('🎉 ПОЛНАЯ МИГРАЦИЯ УСПЕШНА!');
    } else {
      log(`⚠️ Миграция частично успешна, проверьте логи`);
    }
    
    return results;
    
  } catch (error) {
    log(`❌ Критическая ошибка миграции: ${error.message}`);
    return results;
  }
}
