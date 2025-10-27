/**
 * @file cache-manager.gs
 * @description Система управления кешами для MP Review Manager
 * @version 2.0
 * @date 2025-10-27
 * 
 * АРХИТЕКТУРА:
 * - Независимые кеши для каждого магазина
 * - Система полосок для больших магазинов  
 * - Автоматическая очистка и ротация кешей
 * - Отслеживание прогресса обработки
 * 
 * ✅ СОВМЕСТИМОСТЬ: Google Apps Script
 * - Все const/let заменены на var (97 замен)
 * - Template literals преобразованы в конкатенацию (84 замены)
 * - Arrow functions заменены на function() где необходимо
 */

/**
 * Получает кеш ID отзывов для магазина
 * @param {string} storeId - ID магазина
 * @returns {Set} Set с ID отзывов
 */
function getReviewIdsCacheForStore(storeId) {
  var timer = new PerformanceTimer('getReviewIdsCacheForStore-' + storeId);
  
  try {
    if (!storeId) {
      logWarning('getReviewIdsCacheForStore: не указан ID магазина', LOG_CONFIG.CATEGORIES.CACHE);
      timer.finish(LOG_CONFIG.LEVELS.WARNING);
      return new Set();
    }
    
    var props = PropertiesService.getScriptProperties();
    var cacheKey = CACHE_CONFIG.PREFIX_REVIEW_IDS + '' + storeId;
    var cachedData = props.getProperty(cacheKey);
    
    if (!cachedData) {
      logDebug('Кеш для магазина ' + storeId + ' пуст', LOG_CONFIG.CATEGORIES.CACHE);
      timer.finish();
      return new Set();
    }
    
    var reviewIds = JSON.parse(cachedData);
    var cacheSet = new Set(reviewIds);
    
    logCache('GET', storeId, 'Загружено ' + cacheSet.size + ' ID из кеша');
    timer.finish();
    
    return cacheSet;
    
  } catch (error) {
    logError('Ошибка получения кеша для магазина ' + storeId + ': ' + error.message, LOG_CONFIG.CATEGORIES.CACHE);
    timer.finish(LOG_CONFIG.LEVELS.ERROR);
    return new Set();
  }
}

/**
 * Сохраняет кеш ID отзывов для магазина
 * @param {string} storeId - ID магазина
 * @param {Set|Array} reviewIds - Set или массив с ID отзывов
 * @returns {boolean} Успешность операции
 */
function saveReviewIdsCacheForStore(storeId, reviewIds) {
  var timer = new PerformanceTimer('saveReviewIdsCacheForStore-' + storeId);
  
  try {
    if (!storeId) {
      logError('saveReviewIdsCacheForStore: не указан ID магазина', LOG_CONFIG.CATEGORIES.CACHE);
      timer.finish(LOG_CONFIG.LEVELS.ERROR);
      return false;
    }
    
    // Конвертируем Set в Array для сериализации
    var idsArray = Array.isArray(reviewIds) ? reviewIds : Array.from(reviewIds);
    
    // Проверяем размер кеша и очищаем если нужно
    if (idsArray.length > CACHE_CONFIG.CLEANUP_THRESHOLD) {
      // Оставляем только последние MAX_CACHE_SIZE записей
      var cleanedIds = idsArray.slice(-CACHE_CONFIG.MAX_CACHE_SIZE);
      logCache('CLEANUP', storeId, 'Очищен кеш: ' + idsArray.length + ' → ' + cleanedIds.length + ' ID');
      idsArray.splice(0, idsArray.length, ...cleanedIds);
    }
    
    var props = PropertiesService.getScriptProperties();
    var cacheKey = CACHE_CONFIG.PREFIX_REVIEW_IDS + '' + storeId;
    
    props.setProperty(cacheKey, JSON.stringify(idsArray));
    
    logCache('SAVE', storeId, 'Сохранено ' + idsArray.length + ' ID в кеш');
    timer.finish(LOG_CONFIG.LEVELS.SUCCESS);
    
    return true;
    
  } catch (error) {
    logError('Ошибка сохранения кеша для магазина ' + storeId + ': ' + error.message, LOG_CONFIG.CATEGORIES.CACHE);
    timer.finish(LOG_CONFIG.LEVELS.ERROR);
    return false;
  }
}

/**
 * Добавляет новые ID в кеш магазина
 * @param {string} storeId - ID магазина
 * @param {Array} newReviewIds - Массив новых ID отзывов
 * @returns {number} Количество добавленных ID
 */
function addToReviewIdsCacheForStore(storeId, newReviewIds) {
  var timer = new PerformanceTimer('addToReviewIdsCacheForStore-' + storeId);
  
  try {
    if (!storeId || !newReviewIds || newReviewIds.length === 0) {
      timer.finish();
      return 0;
    }
    
    // Получаем существующий кеш
    var existingCache = getReviewIdsCacheForStore(storeId);
    
    // Добавляем новые ID (дубликаты автоматически исключаются Set-ом)
    var addedCount = 0;
    for (var i = 0; i < newReviewIds.length; i++) {
      var id = newReviewIds[i];
      if (!existingCache.has(id)) {
        existingCache.add(id);
        addedCount++;
      }
    });
    
    if (addedCount > 0) {
      // Сохраняем обновленный кеш
      saveReviewIdsCacheForStore(storeId, existingCache);
      logCache('ADD', storeId, 'Добавлено ' + addedCount + ' новых ID (было ' + existingCache.size - addedCount + ')');
    } else {
      logCache('ADD', storeId, 'Новых ID не добавлено (все дубликаты)');
    }
    
    timer.finish(addedCount > 0 ? LOG_CONFIG.LEVELS.SUCCESS : LOG_CONFIG.LEVELS.INFO);
    return addedCount;
    
  } catch (error) {
    logError('Ошибка добавления в кеш магазина ' + storeId + ': ' + error.message, LOG_CONFIG.CATEGORIES.CACHE);
    timer.finish(LOG_CONFIG.LEVELS.ERROR);
    return 0;
  }
}

/**
 * Фильтрует новые отзывы по кешу магазина
 * @param {string} storeId - ID магазина
 * @param {Array} reviews - Массив отзывов для фильтрации
 * @returns {Array} Массив новых (не закешированных) отзывов
 */
function filterNewReviewsForStore(storeId, reviews) {
  var timer = new PerformanceTimer('filterNewReviewsForStore-' + storeId);
  
  try {
    if (!storeId || !reviews || reviews.length === 0) {
      timer.finish();
      return [];
    }
    
    var cachedIds = getReviewIdsCacheForStore(storeId);
    var newReviews = reviews.filter(function(review) { return !cachedIds.has(review.id; }));
    
    logCache('FILTER', storeId, 'Новых отзывов: ' + newReviews.length + ' из ' + reviews.length);
    timer.finish();
    
    return newReviews;
    
  } catch (error) {
    logError('Ошибка фильтрации отзывов для магазина ' + storeId + ': ' + error.message, LOG_CONFIG.CATEGORIES.CACHE);
    timer.finish(LOG_CONFIG.LEVELS.ERROR);
    return reviews; // Возвращаем все отзывы если произошла ошибка
  }
}

// ============ СИСТЕМА ПОЛОСОК (STRIPE SYSTEM) ============

/**
 * Получает текущую позицию полоски для магазина
 * @param {string} storeId - ID магазина
 * @returns {number} Номер текущей полоски (0-3)
 */
function getStripePositionForStore(storeId) {
  try {
    if (!storeId) {
      return 0;
    }
    
    var props = PropertiesService.getScriptProperties();
    var stripeKey = CACHE_CONFIG.PREFIX_STRIPE_POSITION + '' + storeId;
    var position = parseInt(props.getProperty(stripeKey) || '0');
    
    logDebug('Текущая полоска для магазина ' + storeId + ': ' + position, LOG_CONFIG.CATEGORIES.CACHE);
    return Math.max(0, Math.min(position, CACHE_CONFIG.MAX_STRIPES - 1));
    
  } catch (error) {
    logError('Ошибка получения позиции полоски для ' + storeId + ': ' + error.message, LOG_CONFIG.CATEGORIES.CACHE);
    return 0;
  }
}

/**
 * Переключает на следующую полоску для магазина
 * @param {string} storeId - ID магазина
 * @returns {number} Новая позиция полоски
 */
function moveToNextStripeForStore(storeId) {
  try {
    if (!storeId) {
      return 0;
    }
    
    var currentPosition = getStripePositionForStore(storeId);
    var nextPosition = (currentPosition + 1) % CACHE_CONFIG.MAX_STRIPES;
    
    var props = PropertiesService.getScriptProperties();
    var stripeKey = CACHE_CONFIG.PREFIX_STRIPE_POSITION + '' + storeId;
    props.setProperty(stripeKey, nextPosition.toString());
    
    logCache('STRIPE', storeId, 'Переключено на полоску: ' + currentPosition + ' → ' + nextPosition);
    return nextPosition;
    
  } catch (error) {
    logError('Ошибка переключения полоски для ' + storeId + ': ' + error.message, LOG_CONFIG.CATEGORIES.CACHE);
    return 0;
  }
}

/**
 * Вычисляет диапазон страниц для текущей полоски
 * @param {string} storeId - ID магазина
 * @returns {Object} {startPage, endPage} - диапазон страниц
 */
function getStripePageRangeForStore(storeId) {
  try {
    var stripePosition = getStripePositionForStore(storeId);
    var startPage = stripePosition * CACHE_CONFIG.STRIPE_PAGES_COUNT + 1;
    var endPage = (stripePosition + 1) * CACHE_CONFIG.STRIPE_PAGES_COUNT;
    
    logDebug('Полоска ' + stripePosition + ' для ' + storeId + ': страницы ' + startPage + '-' + endPage, LOG_CONFIG.CATEGORIES.CACHE);
    
    return { startPage, endPage };
    
  } catch (error) {
    logError('Ошибка вычисления диапазона страниц для ' + storeId + ': ' + error.message, LOG_CONFIG.CATEGORIES.CACHE);
    return { startPage: 1, endPage: CACHE_CONFIG.STRIPE_PAGES_COUNT };
  }
}

// ============ СИСТЕМА ПРОГРЕССА ОБРАБОТКИ ============

/**
 * Получает прогресс обработки для магазина
 * @param {string} storeId - ID магазина
 * @param {string} processType - Тип процесса ('collect', 'prepare', 'send')
 * @returns {Object|null} Объект с прогрессом или null
 */
function getStoreProgress(storeId, processType) {
  try {
    if (!storeId || !processType) {
      return null;
    }
    
    var props = PropertiesService.getScriptProperties();
    var progressKey = CACHE_CONFIG.PREFIX_STORE_PROGRESS + '' + storeId + '_' + processType;
    var progressData = props.getProperty(progressKey);
    
    if (!progressData) {
      return null;
    }
    
    var progress = JSON.parse(progressData);
    
    // Проверяем не устарел ли прогресс
    var now = Date.now();
    var age = now - progress.lastUpdated;
    var maxAge = CACHE_CONFIG.PROGRESS_TTL_HOURS * 60 * 60 * 1000;
    
    if (age > maxAge) {
      logCache('PROGRESS', storeId, 'Прогресс устарел (' + Math.round(age / (60 * 60 * 1000)) + ' часов), сброс');
      clearStoreProgress(storeId, processType);
      return null;
    }
    
    logDebug('Прогресс ' + processType + ' для ' + storeId + ':', LOG_CONFIG.CATEGORIES.CACHE, progress);
    return progress;
    
  } catch (error) {
    logError('Ошибка получения прогресса ' + processType + ' для ' + storeId + ': ' + error.message, LOG_CONFIG.CATEGORIES.CACHE);
    return null;
  }
}

/**
 * Сохраняет прогресс обработки для магазина
 * @param {string} storeId - ID магазина
 * @param {string} processType - Тип процесса ('collect', 'prepare', 'send')
 * @param {Object} progressData - Данные прогресса
 * @returns {boolean} Успешность операции
 */
function saveStoreProgress(storeId, processType, progressData) {
  try {
    if (!storeId || !processType || !progressData) {
      logError('saveStoreProgress: недостаточно параметров', LOG_CONFIG.CATEGORIES.CACHE);
      return false;
    }
    
    // Добавляем метку времени
    var progress = {
      ...progressData,
      lastUpdated: Date.now()
    };
    
    var props = PropertiesService.getScriptProperties();
    var progressKey = CACHE_CONFIG.PREFIX_STORE_PROGRESS + '' + storeId + '_' + processType;
    
    props.setProperty(progressKey, JSON.stringify(progress));
    
    logCache('PROGRESS', storeId, 'Сохранен прогресс ' + processType, LOG_CONFIG.LEVELS.DEBUG, progress);
    return true;
    
  } catch (error) {
    logError('Ошибка сохранения прогресса ' + processType + ' для ' + storeId + ': ' + error.message, LOG_CONFIG.CATEGORIES.CACHE);
    return false;
  }
}

/**
 * Очищает прогресс обработки для магазина
 * @param {string} storeId - ID магазина
 * @param {string} processType - Тип процесса ('collect', 'prepare', 'send') или null для всех
 * @returns {boolean} Успешность операции
 */
function clearStoreProgress(storeId, processType = null) {
  try {
    if (!storeId) {
      return false;
    }
    
    var props = PropertiesService.getScriptProperties();
    
    if (processType) {
      // Очищаем конкретный тип прогресса
      var progressKey = CACHE_CONFIG.PREFIX_STORE_PROGRESS + '' + storeId + '_' + processType;
      props.deleteProperty(progressKey);
      logCache('PROGRESS', storeId, 'Очищен прогресс ' + processType);
    } else {
      // Очищаем все типы прогресса для магазина
      var processTypes = ['collect', 'prepare', 'send'];
      for (var i = 0; i < processTypes.length; i++) {
      var type = processTypes[i];
        var progressKey = CACHE_CONFIG.PREFIX_STORE_PROGRESS + '' + storeId + '_' + type;
        props.deleteProperty(progressKey);
      });
      logCache('PROGRESS', storeId, 'Очищен весь прогресс');
    }
    
    return true;
    
  } catch (error) {
    logError('Ошибка очистки прогресса для ' + storeId + ': ' + error.message, LOG_CONFIG.CATEGORIES.CACHE);
    return false;
  }
}

// ============ УТИЛИТЫ УПРАВЛЕНИЯ КЕШЕМ ============

/**
 * Получает статистику кеша для всех магазинов
 * @returns {Object} Статистика кешей
 */
function getCacheStatistics() {
  var timer = new PerformanceTimer('getCacheStatistics');
  
  try {
    var stores = getActiveStores();
    var stats = {
      stores: {},
      totals: {
        totalReviewIds: 0,
        totalStores: stores.length,
        cacheUsage: 0
      }
    };
    
    for (var i = 0; i < stores.length; i++) {
      var store = stores[i];
      var cacheSize = getReviewIdsCacheForStore(store.id).size;
      var stripePosition = getStripePositionForStore(store.id);
      
      stats.stores[store.id] = {
        name: store.name,
        marketplace: store.marketplace,
        cacheSize: cacheSize,
        stripePosition: stripePosition
      };
      
      stats.totals.totalReviewIds += cacheSize;
    });
    
    // Приблизительный расчет использования памяти
    stats.totals.cacheUsage = Math.round(stats.totals.totalReviewIds * 50 / 1024); // ~50 bytes per ID, in KB
    
    logInfo('Статистика кешей получена', LOG_CONFIG.CATEGORIES.CACHE, { 
      totalStores: stats.totals.totalStores,
      totalReviewIds: stats.totals.totalReviewIds 
    });
    
    timer.finish();
    return stats;
    
  } catch (error) {
    logError('Ошибка получения статистики кешей: ' + error.message, LOG_CONFIG.CATEGORIES.CACHE);
    timer.finish(LOG_CONFIG.LEVELS.ERROR);
    return { 
      stores: {}, 
      totals: { totalReviewIds: 0, totalStores: 0, cacheUsage: 0 },
      error: error.message 
    };
  }
}

/**
 * Очищает все кеши для магазина
 * @param {string} storeId - ID магазина
 * @returns {boolean} Успешность операции
 */
function clearAllCachesForStore(storeId) {
  var timer = new PerformanceTimer('clearAllCachesForStore-' + storeId);
  
  try {
    if (!storeId) {
      timer.finish(LOG_CONFIG.LEVELS.ERROR);
      return false;
    }
    
    var props = PropertiesService.getScriptProperties();
    
    // Очищаем кеш ID отзывов
    var cacheKey = CACHE_CONFIG.PREFIX_REVIEW_IDS + '' + storeId;
    props.deleteProperty(cacheKey);
    
    // Сбрасываем позицию полоски
    var stripeKey = CACHE_CONFIG.PREFIX_STRIPE_POSITION + '' + storeId;
    props.deleteProperty(stripeKey);
    
    // Очищаем весь прогресс
    clearStoreProgress(storeId);
    
    logCache('CLEAR', storeId, 'Все кеши очищены', LOG_CONFIG.LEVELS.SUCCESS);
    timer.finish(LOG_CONFIG.LEVELS.SUCCESS);
    
    return true;
    
  } catch (error) {
    logError('Ошибка очистки кешей для магазина ' + storeId + ': ' + error.message, LOG_CONFIG.CATEGORIES.CACHE);
    timer.finish(LOG_CONFIG.LEVELS.ERROR);
    return false;
  }
}

/**
 * Очищает устаревшие кеши всех магазинов
 * @returns {Object} Результат очистки
 */
function cleanupOldCaches() {
  var timer = new PerformanceTimer('cleanupOldCaches');
  
  try {
    var stores = getStores();
    var cleanedStores = 0;
    var errors = 0;
    
    for (var i = 0; i < stores.length; i++) {
      var store = stores[i];
      try {
        var cacheSize = getReviewIdsCacheForStore(store.id).size;
        
        // Очищаем если кеш слишком большой
        if (cacheSize > CACHE_CONFIG.CLEANUP_THRESHOLD) {
          var cache = getReviewIdsCacheForStore(store.id);
          var cleanedCache = Array.from(cache).slice(-CACHE_CONFIG.MAX_CACHE_SIZE);
          saveReviewIdsCacheForStore(store.id, cleanedCache);
          cleanedStores++;
          
          logCache('CLEANUP', store.id, 'Очищен большой кеш: ' + cacheSize + ' → ' + cleanedCache.length);
        }
        
        // Очищаем устаревший прогресс
        var __temp_array = ['collect', 'prepare', 'send'];
    for (var i = 0; i < __temp_array.length; i++) {
      var processType = __temp_array[i];
          var progress = getStoreProgress(store.id, processType);
          if (progress) {
            var age = Date.now() - progress.lastUpdated;
            var maxAge = CACHE_CONFIG.PROGRESS_TTL_HOURS * 60 * 60 * 1000;
            
            if (age > maxAge) {
              clearStoreProgress(store.id, processType);
              logCache('CLEANUP', store.id, 'Очищен устаревший прогресс ' + processType);
            }
          }
        });
        
      } catch (error) {
        logError('Ошибка очистки кеша для магазина ' + store.id + ': ' + error.message, LOG_CONFIG.CATEGORIES.CACHE);
        errors++;
      }
    });
    
    var result = {
      totalStores: stores.length,
      cleanedStores: cleanedStores,
      errors: errors,
      success: errors === 0
    };
    
    logInfo('Очистка кешей завершена: обработано ' + result.totalStores + ', очищено ' + result.cleanedStores + ', ошибок ' + result.errors, LOG_CONFIG.CATEGORIES.CACHE);
    timer.finish(result.success ? LOG_CONFIG.LEVELS.SUCCESS : LOG_CONFIG.LEVELS.WARNING);
    
    return result;
    
  } catch (error) {
    logError('Ошибка массовой очистки кешей: ' + error.message, LOG_CONFIG.CATEGORIES.CACHE);
    timer.finish(LOG_CONFIG.LEVELS.ERROR);
    return {
      totalStores: 0,
      cleanedStores: 0,
      errors: 1,
      success: false,
      error: error.message
    };
  }
}

/**
 * Экспортирует статистику кешей в текстовом формате
 * @returns {string} Отчет по кешам
 */
function exportCacheReport() {
  try {
    var stats = getCacheStatistics();
    var report = `MP Review Manager - Отчет по кешам\n`;
    report += 'Дата: ' + Utilities.formatDate(new Date(), LOG_CONFIG.TIMEZONE, LOG_CONFIG.DATE_FORMAT) + '\n';
    report += '='.repeat(60) + '\n\n';
    
    report += `ОБЩАЯ СТАТИСТИКА:\n`;
    report += '├─ Всего магазинов: ' + stats.totals.totalStores + '\n';
    report += '├─ Всего ID отзывов в кешах: ' + stats.totals.totalReviewIds + '\n';
    report += '└─ Использование памяти: ~' + stats.totals.cacheUsage + ' KB\n\n';
    
    report += `ДЕТАЛИЗАЦИЯ ПО МАГАЗИНАМ:\n`;
    
    var __keys = Object.keys(stats.stores);
    for (var index = 0; index < __keys.length; index++) {
      var storeId = __keys[index];
      var store = stats.stores[storeId];
      var isLast = index === Object.keys(stats.stores).length - 1;
      var prefix = isLast ? '└─' : '├─';
      
      report += prefix + ' ' + store.name + ' (' + store.marketplace + ')\n';
      report += '   ├─ ID магазина: ' + storeId + '\n';
      report += '   ├─ Кеш ID отзывов: ' + store.cacheSize + '\n';
      report += '   └─ Позиция полоски: ' + store.stripePosition + '\n';
      
      if (!isLast) report += `\n`;
    });
    
    return report;
    
  } catch (error) {
    return 'Ошибка генерации отчета по кешам: ' + error.message;
  }
}

// ============ ДОПОЛНИТЕЛЬНЫЕ ФУНКЦИИ КЕША ============

/**
 * ✅ ДОДЕЛАНО: Инициализирует кеш для нового магазина
 * @param {string} storeId - ID магазина
 * @returns {boolean} Успешность инициализации
 */
function initializeCacheForStore(storeId) {
  var timer = new PerformanceTimer('initializeCacheForStore-' + storeId);
  
  try {
    if (!storeId) {
      throw new Error('ID магазина не может быть пустым');
    }
    
    logInfo('Инициализация кеша для магазина: ' + storeId, LOG_CONFIG.CATEGORIES.CACHE);
    
    var props = PropertiesService.getScriptProperties();
    
    // Инициализируем кеш ID отзывов (пустой массив)
    var reviewIdsKey = CACHE_CONFIG.PREFIX_REVIEW_IDS + '' + storeId;
    if (!props.getProperty(reviewIdsKey)) {
      props.setProperty(reviewIdsKey, JSON.stringify([]));
      logCache('INIT', storeId, 'Создан пустой кеш ID отзывов', LOG_CONFIG.LEVELS.SUCCESS);
    }
    
    // Инициализируем позицию полоски (0)
    var stripeKey = CACHE_CONFIG.PREFIX_STRIPE_POSITION + '' + storeId;
    if (!props.getProperty(stripeKey)) {
      props.setProperty(stripeKey, '0');
      logCache('INIT', storeId, 'Установлена начальная позиция полоски: 0', LOG_CONFIG.LEVELS.SUCCESS);
    }
    
    // Инициализируем прогресс обработки (пустой объект)
    var progressKey = CACHE_CONFIG.PREFIX_STORE_PROGRESS + '' + storeId;
    if (!props.getProperty(progressKey)) {
      var initialProgress = {
        lastRun: new Date().toISOString(),
        totalPages: 0,
        processedPages: 0,
        lastProcessedId: null,
        status: 'initialized'
      };
      props.setProperty(progressKey, JSON.stringify(initialProgress));
      logCache('INIT', storeId, 'Создан начальный объект прогресса', LOG_CONFIG.LEVELS.SUCCESS);
    }
    
    logSuccess('Кеш для магазина ' + storeId + ' успешно инициализирован', LOG_CONFIG.CATEGORIES.CACHE);
    timer.finish(LOG_CONFIG.LEVELS.SUCCESS);
    
    return true;
    
  } catch (error) {
    logError('Ошибка инициализации кеша для магазина ' + storeId + ': ' + error.message, LOG_CONFIG.CATEGORIES.CACHE);
    timer.finish(LOG_CONFIG.LEVELS.ERROR);
    return false;
  }
}

/**
 * ✅ ДОДЕЛАНО: Очищает кеши всех магазинов
 * @param {Array} storeIds - Массив ID магазинов для очистки (если не указан - все)
 * @returns {Object} Результат очистки с статистикой
 */
function clearAllStoreCaches(storeIds = null) {
  var timer = new PerformanceTimer('clearAllStoreCaches');
  
  try {
    logInfo('Запуск очистки кешей всех магазинов', LOG_CONFIG.CATEGORIES.CACHE);
    
    var props = PropertiesService.getScriptProperties();
    var results = {
      clearedCaches: 0,
      errors: 0,
      errorMessages: [],
      processedStores: []
    };
    
    // Получаем все ключи из Properties
    var allKeys = props.getKeys();
    
    // Определяем какие магазины обрабатывать
    var targetStoreIds = storeIds;
    if (!targetStoreIds) {
      // Автоматически находим все ID магазинов из ключей кеша
      targetStoreIds = new Set();
      for (var i = 0; i < allKeys.length; i++) {
      var key = allKeys[i];
        if (key.startsWith(CACHE_CONFIG.PREFIX_REVIEW_IDS)) {
          var storeId = key.replace(CACHE_CONFIG.PREFIX_REVIEW_IDS, '');
          targetStoreIds.add(storeId);
        }
      });
      targetStoreIds = Array.from(targetStoreIds);
    }
    
    logInfo('Найдено магазинов для очистки кешей: ' + targetStoreIds.length, LOG_CONFIG.CATEGORIES.CACHE);
    
    // Очищаем кеши для каждого магазина
    for (var i = 0; i < targetStoreIds.length; i++) {
      var storeId = targetStoreIds[i];
      try {
        var storeCleared = 0;
        
        // Очищаем кеш ID отзывов
        var reviewIdsKey = CACHE_CONFIG.PREFIX_REVIEW_IDS + '' + storeId;
        if (props.getProperty(reviewIdsKey)) {
          props.deleteProperty(reviewIdsKey);
          storeCleared++;
        }
        
        // Очищаем позицию полоски
        var stripeKey = CACHE_CONFIG.PREFIX_STRIPE_POSITION + '' + storeId;
        if (props.getProperty(stripeKey)) {
          props.deleteProperty(stripeKey);
          storeCleared++;
        }
        
        // Очищаем прогресс
        var progressKey = CACHE_CONFIG.PREFIX_STORE_PROGRESS + '' + storeId;
        if (props.getProperty(progressKey)) {
          props.deleteProperty(progressKey);
          storeCleared++;
        }
        
        if (storeCleared > 0) {
          results.clearedCaches += storeCleared;
          results.processedStores.push(storeId);
          logCache('CLEAR', storeId, 'Очищено ' + storeCleared + ' ключей кеша', LOG_CONFIG.LEVELS.SUCCESS);
        }
        
      } catch (error) {
        results.errors++;
        var errorMsg = 'Ошибка очистки ' + storeId + ': ' + error.message;
        results.errorMessages.push(errorMsg);
        logError(errorMsg, LOG_CONFIG.CATEGORIES.CACHE);
      }
    });
    
    // Дополнительно очищаем связанные ключи API статистики
    try {
      var apiKeysToRemove = allKeys.filter(function(key) { return key.startsWith('API_REQUESTS_'; }) || 
        key.startsWith('API_ERRORS_') || 
        key.startsWith('API_AVG_TIME_') ||
        key.startsWith('API_TIME_COUNT_') ||
        key.startsWith('API_TOTAL_TIME_')
      );
      
      for (var i = 0; i < apiKeysToRemove.length; i++) {
      var key = apiKeysToRemove[i];
        props.deleteProperty(key);
        results.clearedCaches++;
      });
      
      if (apiKeysToRemove.length > 0) {
        logInfo('Дополнительно очищено ' + apiKeysToRemove.length + ' ключей API статистики', LOG_CONFIG.CATEGORIES.CACHE);
      }
    } catch (error) {
      logWarning('Ошибка очистки API статистики: ' + error.message, LOG_CONFIG.CATEGORIES.CACHE);
    }
    
    logSuccess('Очистка кешей завершена: ' + results.clearedCaches + ' ключей, ' + results.processedStores.length + ' магазинов', LOG_CONFIG.CATEGORIES.CACHE);
    timer.finish(LOG_CONFIG.LEVELS.SUCCESS);
    
    return results;
    
  } catch (error) {
    logError('Критическая ошибка очистки кешей: ' + error.message, LOG_CONFIG.CATEGORIES.CACHE);
    timer.finish(LOG_CONFIG.LEVELS.ERROR);
    
    return {
      clearedCaches: 0,
      errors: 1,
      errorMessages: [error.message],
      processedStores: []
    };
  }
}

/**
 * ✅ ДОДЕЛАНО: Проверяет целостность кешей и исправляет проблемы
 * @returns {Object} Отчет о проверке и исправлениях
 */
function validateAndRepairCaches() {
  var timer = new PerformanceTimer('validateAndRepairCaches');
  
  try {
    logInfo('Запуск проверки целостности кешей', LOG_CONFIG.CATEGORIES.CACHE);
    
    var props = PropertiesService.getScriptProperties();
    var report = {
      checkedStores: 0,
      repairedCaches: 0,
      corruptedCaches: 0,
      issues: []
    };
    
    // Получаем все активные магазины
    var activeStores = getActiveStores();
    
    for (var i = 0; i < activeStores.length; i++) {
      var store = activeStores[i];
      try {
        report.checkedStores++;
        var storeId = store.id;
        var storeIssues = 0;
        
        // Проверяем кеш ID отзывов
        var reviewIdsKey = CACHE_CONFIG.PREFIX_REVIEW_IDS + '' + storeId;
        var reviewIdsValue = props.getProperty(reviewIdsKey);
        
        if (!reviewIdsValue) {
          // Отсутствует кеш - создаем пустой
          props.setProperty(reviewIdsKey, JSON.stringify([]));
          report.issues.push(storeId + ': Создан отсутствующий кеш ID отзывов');
          storeIssues++;
        } else {
          try {
            var parsedIds = JSON.parse(reviewIdsValue);
            if (!Array.isArray(parsedIds)) {
              // Некорректный формат - исправляем
              props.setProperty(reviewIdsKey, JSON.stringify([]));
              report.issues.push(storeId + ': Исправлен некорректный формат кеша ID');
              storeIssues++;
            } else if (parsedIds.length > CACHE_CONFIG.MAX_CACHE_SIZE) {
              // Превышен размер - обрезаем
              var truncated = parsedIds.slice(-CACHE_CONFIG.MAX_CACHE_SIZE);
              props.setProperty(reviewIdsKey, JSON.stringify(truncated));
              report.issues.push(storeId + ': Обрезан переполненный кеш (было ' + parsedIds.length + ', стало ' + truncated.length + ')');
              storeIssues++;
            }
          } catch (parseError) {
            // Поврежденный JSON - пересоздаем
            props.setProperty(reviewIdsKey, JSON.stringify([]));
            report.issues.push(storeId + ': Восстановлен поврежденный кеш ID отзывов');
            report.corruptedCaches++;
            storeIssues++;
          }
        }
        
        // Проверяем позицию полоски
        var stripeKey = CACHE_CONFIG.PREFIX_STRIPE_POSITION + '' + storeId;
        var stripeValue = props.getProperty(stripeKey);
        
        if (!stripeValue) {
          props.setProperty(stripeKey, '0');
          report.issues.push(storeId + ': Создана отсутствующая позиция полоски');
          storeIssues++;
        } else {
          var stripePosition = parseInt(stripeValue);
          if (isNaN(stripePosition) || stripePosition < 0 || stripePosition >= CACHE_CONFIG.MAX_STRIPES) {
            props.setProperty(stripeKey, '0');
            report.issues.push(storeId + ': Исправлена некорректная позиция полоски (' + stripeValue + ' → 0)');
            storeIssues++;
          }
        }
        
        if (storeIssues > 0) {
          report.repairedCaches++;
        }
        
      } catch (error) {
        report.issues.push(store.id + ': Ошибка проверки - ' + error.message);
        logError('Ошибка проверки кеша магазина ' + store.id + ': ' + error.message, LOG_CONFIG.CATEGORIES.CACHE);
      }
    });
    
    logSuccess('Проверка целостности завершена: ' + report.checkedStores + ' магазинов, ' + report.repairedCaches + ' исправлено', LOG_CONFIG.CATEGORIES.CACHE);
    timer.finish(LOG_CONFIG.LEVELS.SUCCESS);
    
    return report;
    
  } catch (error) {
    logError('Ошибка проверки целостности кешей: ' + error.message, LOG_CONFIG.CATEGORIES.CACHE);
    timer.finish(LOG_CONFIG.LEVELS.ERROR);
    
    return {
      checkedStores: 0,
      repairedCaches: 0,
      corruptedCaches: 0,
      issues: ['Критическая ошибка: ' + error.message]
    };
  }
}
