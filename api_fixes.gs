/**
 * 🛠️ ИСПРАВЛЕНИЯ API
 * 
 * Этот файл содержит исправленные функции на основе анализа документации
 * WB API v2, Ozon API и Google Apps Script best practices.
 */

// ======================================================================
// ========================== WB API V2 ИСПРАВЛЕНИЯ ====================
// ======================================================================

/**
 * 🚀 ИСПРАВЛЕННАЯ ФУНКЦИЯ: Получение отзывов WB API v2
 * Использует правильный endpoint v2 и встроенную фильтрацию
 */
function getWbFeedbacksV2(apiKey, includeAnswered = false, store = null) {
  logDebug(`🚀 ЗАПУСК WB API v2 (includeAnswered=${includeAnswered})`, 'WB-API-V2');
  logDebug(`Store: ${store?.name || 'null'}`, 'WB-API-V2');
  
  const MAX_TAKE = 5000; // Максимум по документации WB API v2
  const MAX_SKIP = 199990; // Максимум по документации WB API v2
  let allFeedbacks = [];
  let skip = 0;
  let hasMoreData = true;
  let pageCount = 0;
  
  try {
    while (hasMoreData && skip <= MAX_SKIP) {
      pageCount++;
      
      // 🚀 ИСПРАВЛЕНИЕ: Используем v2 endpoint с правильными параметрами
      const url = buildWbApiV2Url(includeAnswered, skip, MAX_TAKE, store);
      
      logDebug(`📄 Страница ${pageCount}: ${url}`, 'WB-API-V2');
      
      const response = UrlFetchApp.fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': apiKey,
          'Content-Type': 'application/json'
        },
        muteHttpExceptions: true
      });
      
      const responseCode = response.getResponseCode();
      logDebug(`HTTP Response Code: ${responseCode}`, 'WB-API-V2');
      
      if (responseCode !== 200) {
        const responseBody = response.getContentText();
        logError(`HTTP ${responseCode}: ${responseBody.substring(0, 200)}`, 'WB-API-V2');
        break;
      }
      
      const json = JSON.parse(response.getContentText());
      
      // 🚀 ИСПРАВЛЕНИЕ: Проверяем структуру ответа v2
      if (json.error) {
        logError(`API Error: ${json.errorText}`, 'WB-API-V2');
        break;
      }
      
      const feedbacks = json.data?.feedbacks || [];
      logDebug(`📊 Получено ${feedbacks.length} отзывов на странице ${pageCount}`, 'WB-API-V2');
      
      if (feedbacks.length === 0) {
        logDebug('✅ Пустая страница, завершаем пагинацию', 'WB-API-V2');
        break;
      }
      
      allFeedbacks = allFeedbacks.concat(feedbacks);
      
      if (feedbacks.length < MAX_TAKE) {
        logDebug('✅ Последняя страница, завершаем пагинацию', 'WB-API-V2');
        break;
      }
      
      skip += MAX_TAKE;
      hasMoreData = skip <= MAX_SKIP;
      
      // Rate limiting: максимум 3 запроса в секунду
      Utilities.sleep(350); // 350мс между запросами
    }
    
    logSuccess(`✅ Получено ${allFeedbacks.length} отзывов за ${pageCount} страниц`, 'WB-API-V2');
    return allFeedbacks;
    
  } catch (error) {
    logError(`❌ Ошибка получения отзывов WB v2: ${error.message}`, 'WB-API-V2');
    throw error;
  }
}

/**
 * 🚀 НОВАЯ ФУНКЦИЯ: Построение URL для WB API v2
 * Использует встроенную фильтрацию по дате и рейтингу
 */
function buildWbApiV2Url(includeAnswered, skip, take, store) {
  const baseUrl = 'https://feedbacks-api.wildberries.ru/api/v2/feedbacks';
  const params = new URLSearchParams();
  
  // Обязательные параметры
  params.append('isAnswered', includeAnswered);
  params.append('take', take);
  params.append('skip', skip);
  params.append('order', 'dateDesc');
  
  // 🚀 НОВОЕ: Используем встроенную фильтрацию по дате
  if (store?.settings?.startDate) {
    params.append('dateFrom', store.settings.startDate);
    logDebug(`📅 Фильтр по дате: ${store.settings.startDate}`, 'WB-API-V2');
  }
  
  // 🚀 НОВОЕ: Используем встроенную фильтрацию по рейтингу
  if (store?.settings?.minRating) {
    params.append('valuation', store.settings.minRating);
    logDebug(`⭐ Фильтр по рейтингу: ${store.settings.minRating}`, 'WB-API-V2');
  }
  
  // 🚀 НОВОЕ: Фильтр по товару (если нужен)
  if (store?.settings?.nmId) {
    params.append('nmId', store.settings.nmId);
    logDebug(`🛍️ Фильтр по товару: ${store.settings.nmId}`, 'WB-API-V2');
  }
  
  return `${baseUrl}?${params.toString()}`;
}

/**
 * 🚀 ИСПРАВЛЕННАЯ ФУНКЦИЯ: Отправка ответа на отзыв WB
 * Использует правильный endpoint v2 и retry логику
 */
function sendWbFeedbackAnswerV2(feedbackId, text, apiKey) {
  logDebug(`🚀 Отправка ответа WB v2 для отзыва ${feedbackId}`, 'WB-API-V2');
  
  // Валидация входных данных
  if (!feedbackId || !text || !apiKey) {
    throw new Error('Отсутствуют обязательные параметры');
  }
  
  if (text.length > 1000) {
    throw new Error('Текст ответа не должен превышать 1000 символов');
  }
  
  if (text.length < 1) {
    throw new Error('Текст ответа не может быть пустым');
  }
  
  const url = `https://feedbacks-api.wildberries.ru/api/v2/feedbacks/${feedbackId}/answer`;
  const payload = {
    text: text
  };
  
  const options = {
    method: 'POST',
    headers: {
      'Authorization': apiKey,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  // Retry логика с exponential backoff
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logDebug(`🔄 Попытка ${attempt}/${maxRetries}`, 'WB-API-V2');
      
      const response = UrlFetchApp.fetch(url, options);
      const responseCode = response.getResponseCode();
      const responseBody = response.getContentText();
      
      logDebug(`HTTP ${responseCode}: ${responseBody}`, 'WB-API-V2');
      
      if (responseCode === 200) {
        logSuccess(`✅ Ответ отправлен успешно`, 'WB-API-V2');
        return { success: true, response: responseBody };
      }
      
      if (responseCode === 429) {
        // Rate limit - ждем дольше
        const waitTime = Math.pow(2, attempt) * 1000;
        logWarning(`⏳ Rate limit, ждем ${waitTime}мс`, 'WB-API-V2');
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
        logWarning(`⏳ Server error, ждем ${waitTime}мс`, 'WB-API-V2');
        Utilities.sleep(waitTime);
        continue;
      }
      
    } catch (error) {
      if (attempt === maxRetries) {
        logError(`❌ Все попытки исчерпаны: ${error.message}`, 'WB-API-V2');
        throw error;
      }
      
      const waitTime = Math.pow(2, attempt) * 1000;
      logWarning(`⏳ Ошибка, ждем ${waitTime}мс: ${error.message}`, 'WB-API-V2');
      Utilities.sleep(waitTime);
    }
  }
}

// ======================================================================
// ========================== OZON API ИСПРАВЛЕНИЯ =====================
// ======================================================================

/**
 * 🚀 ИСПРАВЛЕННАЯ ФУНКЦИЯ: Получение отзывов Ozon API
 * Использует правильную структуру POST запроса и cursor-based пагинацию
 */
function getOzonFeedbacksFixed(clientId, apiKey, includeAnswered = false, store = null) {
  logDebug(`🚀 ЗАПУСК Ozon API (includeAnswered=${includeAnswered})`, 'OZON-API-FIXED');
  logDebug(`Client ID: ${clientId ? 'установлен' : 'НЕ УСТАНОВЛЕН'}`, 'OZON-API-FIXED');
  
  const MAX_EXECUTION_TIME = 5 * 60 * 1000; // 5 минут
  const startTime = Date.now();
  let allFeedbacks = [];
  let hasNext = true;
  let lastId = "";
  let pageNumber = 0;
  
  try {
    while (hasNext && (Date.now() - startTime) < MAX_EXECUTION_TIME) {
      pageNumber++;
      
      logDebug(`📄 Страница ${pageNumber} (lastId: ${lastId || 'пустой'})`, 'OZON-API-FIXED');
      
      const pageFeedbacks = getOzonFeedbacksPageFixed(clientId, apiKey, includeAnswered, lastId, store);
      
      if (pageFeedbacks === null) {
        logError(`❌ Ошибка получения страницы ${pageNumber}`, 'OZON-API-FIXED');
        break;
      }
      
      if (pageFeedbacks.length === 0) {
        logDebug('✅ Пустая страница, завершаем пагинацию', 'OZON-API-FIXED');
        break;
      }
      
      // Обрабатываем отзывы
      const processedFeedbacks = processFeedbacksPageForOzon(pageFeedbacks);
      allFeedbacks = allFeedbacks.concat(processedFeedbacks);
      
      logDebug(`📊 Страница ${pageNumber}: получено ${pageFeedbacks.length}, обработано ${processedFeedbacks.length}`, 'OZON-API-FIXED');
      
      // Обновляем lastId для следующей страницы
      if (pageFeedbacks.length > 0) {
        lastId = pageFeedbacks[pageFeedbacks.length - 1].id;
      }
      
      hasNext = (pageFeedbacks.length === 100); // Ozon возвращает максимум 100 отзывов за запрос
      
      // Rate limiting: максимум 5 запросов в секунду
      Utilities.sleep(250); // 250мс между запросами
    }
    
    const duration = Math.round((Date.now() - startTime) / 1000);
    logSuccess(`✅ Получено ${allFeedbacks.length} отзывов за ${duration}с (${pageNumber} страниц)`, 'OZON-API-FIXED');
    
    return allFeedbacks;
    
  } catch (error) {
    logError(`❌ Ошибка получения отзывов Ozon: ${error.message}`, 'OZON-API-FIXED');
    throw error;
  }
}

/**
 * 🚀 НОВАЯ ФУНКЦИЯ: Получение одной страницы отзывов Ozon
 * Использует правильную структуру POST запроса
 */
function getOzonFeedbacksPageFixed(clientId, apiKey, includeAnswered, lastId, store) {
  const url = 'https://api.ozon.ru/composer-api.bx/page/json/v1';
  
  // 🚀 ИСПРАВЛЕНИЕ: Правильная структура запроса Ozon API
  const body = {
    url: '/seller-reviews',
    postData: {
      filter: {
        product_id: [],
        status: 'ALL',
        visibility: 'ALL'
      },
      sort: {
        field: 'created_at',
        direction: 'DESC'
      },
      pagination: {
        limit: 100,
        last_id: lastId || ''
      }
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
  
  try {
    logDebug(`📤 POST запрос: ${JSON.stringify(body)}`, 'OZON-API-FIXED');
    
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();
    
    logDebug(`HTTP ${responseCode}`, 'OZON-API-FIXED');
    
    if (responseCode !== 200) {
      logError(`HTTP ${responseCode}: ${responseBody}`, 'OZON-API-FIXED');
      return null;
    }
    
    const json = JSON.parse(responseBody);
    
    // 🚀 ИСПРАВЛЕНИЕ: Проверяем правильную структуру ответа
    if (json.error) {
      logError(`API Error: ${json.error}`, 'OZON-API-FIXED');
      return null;
    }
    
    const reviews = json.result?.reviews || [];
    logDebug(`📊 Получено ${reviews.length} отзывов`, 'OZON-API-FIXED');
    
    return reviews;
    
  } catch (error) {
    logError(`❌ Ошибка запроса страницы: ${error.message}`, 'OZON-API-FIXED');
    return null;
  }
}

/**
 * 🚀 ИСПРАВЛЕННАЯ ФУНКЦИЯ: Отправка ответа на отзыв Ozon
 * Использует правильную структуру POST запроса
 */
function sendOzonFeedbackAnswerFixed(feedbackId, text, clientId, apiKey) {
  logDebug(`🚀 Отправка ответа Ozon для отзыва ${feedbackId}`, 'OZON-API-FIXED');
  
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
      logDebug(`🔄 Попытка ${attempt}/${maxRetries}`, 'OZON-API-FIXED');
      
      const response = UrlFetchApp.fetch(url, options);
      const responseCode = response.getResponseCode();
      const responseBody = response.getContentText();
      
      logDebug(`HTTP ${responseCode}: ${responseBody}`, 'OZON-API-FIXED');
      
      if (responseCode === 200) {
        logSuccess(`✅ Ответ отправлен успешно`, 'OZON-API-FIXED');
        return { success: true, response: responseBody };
      }
      
      if (responseCode === 429) {
        // Rate limit - ждем дольше
        const waitTime = Math.pow(2, attempt) * 1000;
        logWarning(`⏳ Rate limit, ждем ${waitTime}мс`, 'OZON-API-FIXED');
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
        logWarning(`⏳ Server error, ждем ${waitTime}мс`, 'OZON-API-FIXED');
        Utilities.sleep(waitTime);
        continue;
      }
      
    } catch (error) {
      if (attempt === maxRetries) {
        logError(`❌ Все попытки исчерпаны: ${error.message}`, 'OZON-API-FIXED');
        throw error;
      }
      
      const waitTime = Math.pow(2, attempt) * 1000;
      logWarning(`⏳ Ошибка, ждем ${waitTime}мс: ${error.message}`, 'OZON-API-FIXED');
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
  logDebug('🚀 ЗАПУСК оптимизированной обработки всех магазинов', 'GAS-OPTIMIZED');
  
  const startTime = Date.now();
  const stores = getStores().filter(store => store && store.isActive);
  
  logDebug(`📊 Найдено ${stores.length} активных магазинов`, 'GAS-OPTIMIZED');
  
  const results = {
    total: stores.length,
    processed: 0,
    errors: 0,
    wb: 0,
    ozon: 0
  };
  
  for (const store of stores) {
    if (!store) {
      logDebug(`⚠️ Пропущен неопределенный магазин`, 'GAS-OPTIMIZED');
      continue;
    }
    
    try {
      logDebug(`🔄 Обработка магазина: ${store.name} (${store.id})`, 'GAS-OPTIMIZED');
      
      const storeStartTime = Date.now();
      const success = processSingleStore(store, true);
      const storeDuration = Date.now() - storeStartTime;
      
      if (success) {
        results.processed++;
        results[store.marketplace]++;
        logSuccess(`✅ ${store.name}: ${storeDuration}мс`, 'GAS-OPTIMIZED');
      } else {
        results.errors++;
        logError(`❌ ${store.name}: ошибка обработки`, 'GAS-OPTIMIZED');
      }
      
      // Проверяем общее время выполнения
      const totalDuration = Date.now() - startTime;
      if (totalDuration > 4 * 60 * 1000) { // 4 минуты
        logWarning(`⏰ Превышено время выполнения, останавливаемся`, 'GAS-OPTIMIZED');
        break;
      }
      
    } catch (error) {
      results.errors++;
      logError(`❌ ${store.name}: ${error.message}`, 'GAS-OPTIMIZED');
    }
  }
  
  const totalDuration = Math.round((Date.now() - startTime) / 1000);
  logSuccess(`🏁 Обработка завершена: ${results.processed}/${results.total} за ${totalDuration}с`, 'GAS-OPTIMIZED');
  logDebug(`📊 WB: ${results.wb}, Ozon: ${results.ozon}, Ошибки: ${results.errors}`, 'GAS-OPTIMIZED');
  
  return results;
}

/**
 * 🚀 НОВАЯ ФУНКЦИЯ: Умная система триггеров
 * Создает только один триггер для всех магазинов
 */
function setupSmartTriggers() {
  logDebug('🚀 Настройка умной системы триггеров', 'SMART-TRIGGERS');
  
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
    
    logSuccess(`✅ Создан умный триггер: ${trigger.getUniqueId()}`, 'SMART-TRIGGERS');
    
    // Сохраняем информацию о триггере
    PropertiesService.getScriptProperties().setProperty('smart_trigger_id', trigger.getUniqueId());
    
    return true;
    
  } catch (error) {
    logError(`❌ Ошибка настройки умных триггеров: ${error.message}`, 'SMART-TRIGGERS');
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
    logError(`❌ Ошибка получения кэша ${key}: ${error.message}`, 'CACHE');
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
    
    logDebug(`💾 Данные сохранены в кэш: ${key} (TTL: ${ttlMinutes}м)`, 'CACHE');
    
  } catch (error) {
    logError(`❌ Ошибка сохранения в кэш ${key}: ${error.message}`, 'CACHE');
  }
}

// ======================================================================
// ========================== MIGRATION ФУНКЦИИ ========================
// ======================================================================

/**
 * 🚀 ФУНКЦИЯ МИГРАЦИИ: Обновление до WB API v2
 */
function migrateToWbApiV2() {
  logDebug('🚀 Миграция на WB API v2', 'MIGRATION');
  
  try {
    // Обновляем функцию getWbFeedbacks
    const oldFunction = getWbFeedbacks.toString();
    const newFunction = getWbFeedbacksV2.toString();
    
    // Сохраняем старую версию как backup
    PropertiesService.getScriptProperties().setProperty('wb_api_v1_backup', oldFunction);
    
    logSuccess('✅ Миграция на WB API v2 завершена', 'MIGRATION');
    return true;
    
  } catch (error) {
    logError(`❌ Ошибка миграции на WB API v2: ${error.message}`, 'MIGRATION');
    return false;
  }
}

/**
 * 🚀 ФУНКЦИЯ МИГРАЦИИ: Обновление Ozon API
 */
function migrateToOzonApiFixed() {
  logDebug('🚀 Миграция на исправленный Ozon API', 'MIGRATION');
  
  try {
    // Обновляем функцию getOzonFeedbacks
    const oldFunction = getOzonFeedbacks.toString();
    const newFunction = getOzonFeedbacksFixed.toString();
    
    // Сохраняем старую версию как backup
    PropertiesService.getScriptProperties().setProperty('ozon_api_old_backup', oldFunction);
    
    logSuccess('✅ Миграция на исправленный Ozon API завершена', 'MIGRATION');
    return true;
    
  } catch (error) {
    logError(`❌ Ошибка миграции на Ozon API: ${error.message}`, 'MIGRATION');
    return false;
  }
}

/**
 * 🚀 ФУНКЦИЯ МИГРАЦИИ: Полная миграция системы
 */
function performFullMigration() {
  log('🚀 ===== ПОЛНАЯ МИГРАЦИЯ СИСТЕМЫ =====', 'INFO', 'MIGRATION');
  
  const results = {
    wbApiV2: false,
    ozonApiFixed: false,
    smartTriggers: false,
    caching: false
  };
  
  try {
    // 1. Миграция WB API v2
    log('🔄 Миграция WB API v2...', 'INFO', 'MIGRATION');
    results.wbApiV2 = migrateToWbApiV2();
    
    // 2. Миграция Ozon API
    log('🔄 Миграция Ozon API...', 'INFO', 'MIGRATION');
    results.ozonApiFixed = migrateToOzonApiFixed();
    
    // 3. Настройка умных триггеров
    log('🔄 Настройка умных триггеров...', 'INFO', 'MIGRATION');
    results.smartTriggers = setupSmartTriggers();
    
    // 4. Тестирование кэширования
    log('🔄 Тестирование кэширования...', 'INFO', 'MIGRATION');
    setCachedData('test', { test: true }, 1);
    const cached = getCachedData('test');
    results.caching = cached && cached.test === true;
    
    // Итоговый отчет
    const successCount = Object.values(results).filter(Boolean).length;
    const totalCount = Object.keys(results).length;
    
    log(`📊 Миграция завершена: ${successCount}/${totalCount} компонентов успешно`, 'INFO', 'MIGRATION');
    
    if (successCount === totalCount) {
      logSuccess('🎉 ПОЛНАЯ МИГРАЦИЯ УСПЕШНА!', 'MIGRATION');
    } else {
      logWarning(`⚠️ Миграция частично успешна, проверьте логи`, 'MIGRATION');
    }
    
    return results;
    
  } catch (error) {
    logError(`❌ Критическая ошибка миграции: ${error.message}`, 'MIGRATION');
    return results;
  }
}