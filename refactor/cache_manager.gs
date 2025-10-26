/**
 * @file cache-manager.gs
 * @description Система управления кешами для MP Review Manager
 * @version 2.0
 * @date 2025-10-26
 * 
 * АРХИТЕКТУРА:
 * - Независимые кеши для каждого магазина
 * - Система полосок для больших магазинов  
 * - Автоматическая очистка и ротация кешей
 * - Отслеживание прогресса обработки
 */

/**
 * Получает кеш ID отзывов для магазина
 * @param {string} storeId - ID магазина
 * @returns {Set} Set с ID отзывов
 */
function getReviewIdsCacheForStore(storeId) {
  const timer = new PerformanceTimer(`getReviewIdsCacheForStore-${storeId}`);
  
  try {
    if (!storeId) {
      logWarning('getReviewIdsCacheForStore: не указан ID магазина', LOG_CONFIG.CATEGORIES.CACHE);
      timer.finish(LOG_CONFIG.LEVELS.WARNING);
      return new Set();
    }
    
    const props = PropertiesService.getScriptProperties();
    const cacheKey = `${CACHE_CONFIG.PREFIX_REVIEW_IDS}${storeId}`;
    const cachedData = props.getProperty(cacheKey);
    
    if (!cachedData) {
      logDebug(`Кеш для магазина ${storeId} пуст`, LOG_CONFIG.CATEGORIES.CACHE);
      timer.finish();
      return new Set();
    }
    
    const reviewIds = JSON.parse(cachedData);
    const cacheSet = new Set(reviewIds);
    
    logCache('GET', storeId, `Загружено ${cacheSet.size} ID из кеша`);
    timer.finish();
    
    return cacheSet;
    
  } catch (error) {
    logError(`Ошибка получения кеша для магазина ${storeId}: ${error.message}`, LOG_CONFIG.CATEGORIES.CACHE);
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
  const timer = new PerformanceTimer(`saveReviewIdsCacheForStore-${storeId}`);
  
  try {
    if (!storeId) {
      logError('saveReviewIdsCacheForStore: не указан ID магазина', LOG_CONFIG.CATEGORIES.CACHE);
      timer.finish(LOG_CONFIG.LEVELS.ERROR);
      return false;
    }
    
    // Конвертируем Set в Array для сериализации
    const idsArray = Array.isArray(reviewIds) ? reviewIds : Array.from(reviewIds);
    
    // Проверяем размер кеша и очищаем если нужно
    if (idsArray.length > CACHE_CONFIG.CLEANUP_THRESHOLD) {
      // Оставляем только последние MAX_CACHE_SIZE записей
      const cleanedIds = idsArray.slice(-CACHE_CONFIG.MAX_CACHE_SIZE);
      logCache('CLEANUP', storeId, `Очищен кеш: ${idsArray.length} → ${cleanedIds.length} ID`);
      idsArray.splice(0, idsArray.length, ...cleanedIds);
    }
    
    const props = PropertiesService.getScriptProperties();
    const cacheKey = `${CACHE_CONFIG.PREFIX_REVIEW_IDS}${storeId}`;
    
    props.setProperty(cacheKey, JSON.stringify(idsArray));
    
    logCache('SAVE', storeId, `Сохранено ${idsArray.length} ID в кеш`);
    timer.finish(LOG_CONFIG.LEVELS.SUCCESS);
    
    return true;
    
  } catch (error) {
    logError(`Ошибка сохранения кеша для магазина ${storeId}: ${error.message}`, LOG_CONFIG.CATEGORIES.CACHE);
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
  const timer = new PerformanceTimer(`addToReviewIdsCacheForStore-${storeId}`);
  
  try {
    if (!storeId || !newReviewIds || newReviewIds.length === 0) {
      timer.finish();
      return 0;
    }
    
    // Получаем существующий кеш
    const existingCache = getReviewIdsCacheForStore(storeId);
    
    // Добавляем новые ID (дубликаты автоматически исключаются Set-ом)
    let addedCount = 0;
    newReviewIds.forEach(id => {
      if (!existingCache.has(id)) {
        existingCache.add(id);
        addedCount++;
      }
    });
    
    if (addedCount > 0) {
      // Сохраняем обновленный кеш
      saveReviewIdsCacheForStore(storeId, existingCache);
      logCache('ADD', storeId, `Добавлено ${addedCount} новых ID (было ${existingCache.size - addedCount})`);\n    } else {\n      logCache('ADD', storeId, 'Новых ID не добавлено (все дубликаты)');\n    }
    
    timer.finish(addedCount > 0 ? LOG_CONFIG.LEVELS.SUCCESS : LOG_CONFIG.LEVELS.INFO);
    return addedCount;
    
  } catch (error) {
    logError(`Ошибка добавления в кеш магазина ${storeId}: ${error.message}`, LOG_CONFIG.CATEGORIES.CACHE);
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
  const timer = new PerformanceTimer(`filterNewReviewsForStore-${storeId}`);
  
  try {
    if (!storeId || !reviews || reviews.length === 0) {
      timer.finish();
      return [];
    }
    
    const cachedIds = getReviewIdsCacheForStore(storeId);
    const newReviews = reviews.filter(review => !cachedIds.has(review.id));
    
    logCache('FILTER', storeId, `Новых отзывов: ${newReviews.length} из ${reviews.length}`);
    timer.finish();
    
    return newReviews;
    
  } catch (error) {
    logError(`Ошибка фильтрации отзывов для магазина ${storeId}: ${error.message}`, LOG_CONFIG.CATEGORIES.CACHE);
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
    
    const props = PropertiesService.getScriptProperties();
    const stripeKey = `${CACHE_CONFIG.PREFIX_STRIPE_POSITION}${storeId}`;
    const position = parseInt(props.getProperty(stripeKey) || '0');
    
    logDebug(`Текущая полоска для магазина ${storeId}: ${position}`, LOG_CONFIG.CATEGORIES.CACHE);
    return Math.max(0, Math.min(position, CACHE_CONFIG.MAX_STRIPES - 1));
    
  } catch (error) {
    logError(`Ошибка получения позиции полоски для ${storeId}: ${error.message}`, LOG_CONFIG.CATEGORIES.CACHE);
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
    
    const currentPosition = getStripePositionForStore(storeId);
    const nextPosition = (currentPosition + 1) % CACHE_CONFIG.MAX_STRIPES;
    
    const props = PropertiesService.getScriptProperties();
    const stripeKey = `${CACHE_CONFIG.PREFIX_STRIPE_POSITION}${storeId}`;
    props.setProperty(stripeKey, nextPosition.toString());
    
    logCache('STRIPE', storeId, `Переключено на полоску: ${currentPosition} → ${nextPosition}`);
    return nextPosition;
    
  } catch (error) {
    logError(`Ошибка переключения полоски для ${storeId}: ${error.message}`, LOG_CONFIG.CATEGORIES.CACHE);
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
    const stripePosition = getStripePositionForStore(storeId);
    const startPage = stripePosition * CACHE_CONFIG.STRIPE_PAGES_COUNT + 1;
    const endPage = (stripePosition + 1) * CACHE_CONFIG.STRIPE_PAGES_COUNT;
    
    logDebug(`Полоска ${stripePosition} для ${storeId}: страницы ${startPage}-${endPage}`, LOG_CONFIG.CATEGORIES.CACHE);
    
    return { startPage, endPage };
    
  } catch (error) {
    logError(`Ошибка вычисления диапазона страниц для ${storeId}: ${error.message}`, LOG_CONFIG.CATEGORIES.CACHE);
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
    
    const props = PropertiesService.getScriptProperties();
    const progressKey = `${CACHE_CONFIG.PREFIX_STORE_PROGRESS}${storeId}_${processType}`;
    const progressData = props.getProperty(progressKey);
    
    if (!progressData) {
      return null;
    }
    
    const progress = JSON.parse(progressData);
    
    // Проверяем не устарел ли прогресс
    const now = Date.now();
    const age = now - progress.lastUpdated;
    const maxAge = CACHE_CONFIG.PROGRESS_TTL_HOURS * 60 * 60 * 1000;
    
    if (age > maxAge) {
      logCache('PROGRESS', storeId, `Прогресс устарел (${Math.round(age / (60 * 60 * 1000))} часов), сброс`);
      clearStoreProgress(storeId, processType);
      return null;
    }
    
    logDebug(`Прогресс ${processType} для ${storeId}:`, LOG_CONFIG.CATEGORIES.CACHE, progress);
    return progress;
    
  } catch (error) {
    logError(`Ошибка получения прогресса ${processType} для ${storeId}: ${error.message}`, LOG_CONFIG.CATEGORIES.CACHE);
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
    const progress = {
      ...progressData,
      lastUpdated: Date.now()
    };
    
    const props = PropertiesService.getScriptProperties();
    const progressKey = `${CACHE_CONFIG.PREFIX_STORE_PROGRESS}${storeId}_${processType}`;
    
    props.setProperty(progressKey, JSON.stringify(progress));
    
    logCache('PROGRESS', storeId, `Сохранен прогресс ${processType}`, LOG_CONFIG.LEVELS.DEBUG, progress);
    return true;
    
  } catch (error) {
    logError(`Ошибка сохранения прогресса ${processType} для ${storeId}: ${error.message}`, LOG_CONFIG.CATEGORIES.CACHE);
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
    
    const props = PropertiesService.getScriptProperties();
    
    if (processType) {
      // Очищаем конкретный тип прогресса
      const progressKey = `${CACHE_CONFIG.PREFIX_STORE_PROGRESS}${storeId}_${processType}`;
      props.deleteProperty(progressKey);
      logCache('PROGRESS', storeId, `Очищен прогресс ${processType}`);
    } else {
      // Очищаем все типы прогресса для магазина
      const processTypes = ['collect', 'prepare', 'send'];
      processTypes.forEach(type => {
        const progressKey = `${CACHE_CONFIG.PREFIX_STORE_PROGRESS}${storeId}_${type}`;
        props.deleteProperty(progressKey);
      });
      logCache('PROGRESS', storeId, 'Очищен весь прогресс');
    }
    
    return true;
    
  } catch (error) {
    logError(`Ошибка очистки прогресса для ${storeId}: ${error.message}`, LOG_CONFIG.CATEGORIES.CACHE);
    return false;
  }
}

// ============ УТИЛИТЫ УПРАВЛЕНИЯ КЕШЕМ ============

/**
 * Получает статистику кеша для всех магазинов
 * @returns {Object} Статистика кешей
 */
function getCacheStatistics() {
  const timer = new PerformanceTimer('getCacheStatistics');
  
  try {
    const stores = getActiveStores();
    const stats = {
      stores: {},
      totals: {
        totalReviewIds: 0,
        totalStores: stores.length,
        cacheUsage: 0
      }
    };
    
    stores.forEach(store => {
      const cacheSize = getReviewIdsCacheForStore(store.id).size;
      const stripePosition = getStripePositionForStore(store.id);
      
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
    logError(`Ошибка получения статистики кешей: ${error.message}`, LOG_CONFIG.CATEGORIES.CACHE);
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
  const timer = new PerformanceTimer(`clearAllCachesForStore-${storeId}`);
  
  try {
    if (!storeId) {
      timer.finish(LOG_CONFIG.LEVELS.ERROR);
      return false;
    }
    
    const props = PropertiesService.getScriptProperties();
    
    // Очищаем кеш ID отзывов
    const cacheKey = `${CACHE_CONFIG.PREFIX_REVIEW_IDS}${storeId}`;
    props.deleteProperty(cacheKey);
    
    // Сбрасываем позицию полоски
    const stripeKey = `${CACHE_CONFIG.PREFIX_STRIPE_POSITION}${storeId}`;
    props.deleteProperty(stripeKey);
    
    // Очищаем весь прогресс
    clearStoreProgress(storeId);
    
    logCache('CLEAR', storeId, 'Все кеши очищены', LOG_CONFIG.LEVELS.SUCCESS);
    timer.finish(LOG_CONFIG.LEVELS.SUCCESS);
    
    return true;
    
  } catch (error) {
    logError(`Ошибка очистки кешей для магазина ${storeId}: ${error.message}`, LOG_CONFIG.CATEGORIES.CACHE);
    timer.finish(LOG_CONFIG.LEVELS.ERROR);
    return false;
  }
}

/**
 * Очищает устаревшие кеши всех магазинов
 * @returns {Object} Результат очистки
 */
function cleanupOldCaches() {
  const timer = new PerformanceTimer('cleanupOldCaches');
  
  try {
    const stores = getStores();
    let cleanedStores = 0;
    let errors = 0;
    
    stores.forEach(store => {
      try {
        const cacheSize = getReviewIdsCacheForStore(store.id).size;
        
        // Очищаем если кеш слишком большой
        if (cacheSize > CACHE_CONFIG.CLEANUP_THRESHOLD) {
          const cache = getReviewIdsCacheForStore(store.id);
          const cleanedCache = Array.from(cache).slice(-CACHE_CONFIG.MAX_CACHE_SIZE);
          saveReviewIdsCacheForStore(store.id, cleanedCache);
          cleanedStores++;
          
          logCache('CLEANUP', store.id, `Очищен большой кеш: ${cacheSize} → ${cleanedCache.length}`);
        }
        
        // Очищаем устаревший прогресс
        ['collect', 'prepare', 'send'].forEach(processType => {
          const progress = getStoreProgress(store.id, processType);
          if (progress) {
            const age = Date.now() - progress.lastUpdated;
            const maxAge = CACHE_CONFIG.PROGRESS_TTL_HOURS * 60 * 60 * 1000;
            
            if (age > maxAge) {
              clearStoreProgress(store.id, processType);
              logCache('CLEANUP', store.id, `Очищен устаревший прогресс ${processType}`);
            }
          }
        });
        
      } catch (error) {
        logError(`Ошибка очистки кеша для магазина ${store.id}: ${error.message}`, LOG_CONFIG.CATEGORIES.CACHE);
        errors++;
      }
    });
    
    const result = {
      totalStores: stores.length,
      cleanedStores: cleanedStores,
      errors: errors,
      success: errors === 0
    };
    
    logInfo(`Очистка кешей завершена: обработано ${result.totalStores}, очищено ${result.cleanedStores}, ошибок ${result.errors}`, LOG_CONFIG.CATEGORIES.CACHE);
    timer.finish(result.success ? LOG_CONFIG.LEVELS.SUCCESS : LOG_CONFIG.LEVELS.WARNING);
    
    return result;
    
  } catch (error) {
    logError(`Ошибка массовой очистки кешей: ${error.message}`, LOG_CONFIG.CATEGORIES.CACHE);
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
    const stats = getCacheStatistics();
    let report = `MP Review Manager - Отчет по кешам\n`;
    report += `Дата: ${Utilities.formatDate(new Date(), LOG_CONFIG.TIMEZONE, LOG_CONFIG.DATE_FORMAT)}\n`;
    report += '='.repeat(60) + '\n\n';
    
    report += `ОБЩАЯ СТАТИСТИКА:\n`;
    report += `├─ Всего магазинов: ${stats.totals.totalStores}\n`;
    report += `├─ Всего ID отзывов в кешах: ${stats.totals.totalReviewIds}\n`;
    report += `└─ Использование памяти: ~${stats.totals.cacheUsage} KB\n\n`;
    
    report += `ДЕТАЛИЗАЦИЯ ПО МАГАЗИНАМ:\n`;
    
    Object.keys(stats.stores).forEach((storeId, index) => {
      const store = stats.stores[storeId];
      const isLast = index === Object.keys(stats.stores).length - 1;
      const prefix = isLast ? '└─' : '├─';
      
      report += `${prefix} ${store.name} (${store.marketplace})\n`;
      report += `   ├─ ID магазина: ${storeId}\n`;
      report += `   ├─ Кеш ID отзывов: ${store.cacheSize}\n`;
      report += `   └─ Позиция полоски: ${store.stripePosition}\n`;
      
      if (!isLast) report += `\n`;
    });
    
    return report;
    
  } catch (error) {
    return `Ошибка генерации отчета по кешам: ${error.message}`;
  }
}
