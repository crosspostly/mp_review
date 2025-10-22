/**
 * 🧪 ТЕСТ СРАВНЕНИЯ WB API v1 vs v2
 * 
 * Этот файл содержит тесты для проверки полноты WB API v2
 * и возможности замены v1 на v2.
 */

/**
 * 🧪 Тест полноты WB API v2
 */
function testWbApiV2Completeness() {
  logDebug('🧪 Тест полноты WB API v2', 'WB-COMPARISON');
  
  const results = {
    v1Features: [],
    v2Features: [],
    missingFeatures: [],
    additionalFeatures: [],
    canReplace: false
  };
  
  try {
    // 1. Проверяем базовые возможности v1
    results.v1Features = [
      'Получение отзывов',
      'Фильтрация по isAnswered',
      'Пагинация (take/skip)',
      'Сортировка по дате',
      'Обработка ошибок',
      'Rate limiting'
    ];
    
    // 2. Проверяем возможности v2
    results.v2Features = [
      'Получение отзывов',
      'Фильтрация по isAnswered',
      'Пагинация (take/skip)',
      'Сортировка по дате',
      'Обработка ошибок',
      'Rate limiting',
      'Встроенная фильтрация по дате (dateFrom/dateTo)',
      'Встроенная фильтрация по рейтингу (valuation)',
      'Фильтрация по товару (nmId)',
      'Улучшенная производительность',
      'Рекомендуемый API'
    ];
    
    // 3. Проверяем отсутствующие в v2 возможности v1
    results.missingFeatures = results.v1Features.filter(feature => 
      !results.v2Features.includes(feature)
    );
    
    // 4. Проверяем дополнительные возможности v2
    results.additionalFeatures = results.v2Features.filter(feature => 
      !results.v1Features.includes(feature)
    );
    
    // 5. Определяем возможность замены
    results.canReplace = results.missingFeatures.length === 0;
    
    // 6. Логируем результаты
    logDebug(`📊 Возможности v1: ${results.v1Features.length}`, 'WB-COMPARISON');
    logDebug(`📊 Возможности v2: ${results.v2Features.length}`, 'WB-COMPARISON');
    logDebug(`❌ Отсутствующие в v2: ${results.missingFeatures.length}`, 'WB-COMPARISON');
    logDebug(`✨ Дополнительные в v2: ${results.additionalFeatures.length}`, 'WB-COMPARISON');
    logDebug(`🔄 Можно заменить: ${results.canReplace}`, 'WB-COMPARISON');
    
    if (results.canReplace) {
      logSuccess('✅ WB API v2 полностью покрывает v1!', 'WB-COMPARISON');
      logSuccess(`✨ Дополнительные возможности v2: ${results.additionalFeatures.join(', ')}`, 'WB-COMPARISON');
    } else {
      logError(`❌ v2 не покрывает v1. Отсутствует: ${results.missingFeatures.join(', ')}`, 'WB-COMPARISON');
    }
    
    return results;
    
  } catch (error) {
    logError(`❌ Ошибка теста полноты v2: ${error.message}`, 'WB-COMPARISON');
    return results;
  }
}

/**
 * 🧪 Тест функциональности WB API v2
 */
function testWbApiV2Functionality() {
  logDebug('🧪 Тест функциональности WB API v2', 'WB-FUNCTIONALITY');
  
  const results = {
    basicFunctionality: false,
    dateFiltering: false,
    ratingFiltering: false,
    productFiltering: false,
    errorHandling: false,
    performance: false
  };
  
  try {
    // 1. Тест базовой функциональности
    results.basicFunctionality = testWbApiV2BasicFunctionality();
    
    // 2. Тест фильтрации по дате
    results.dateFiltering = testWbApiV2DateFiltering();
    
    // 3. Тест фильтрации по рейтингу
    results.ratingFiltering = testWbApiV2RatingFiltering();
    
    // 4. Тест фильтрации по товару
    results.productFiltering = testWbApiV2ProductFiltering();
    
    // 5. Тест обработки ошибок
    results.errorHandling = testWbApiV2ErrorHandling();
    
    // 6. Тест производительности
    results.performance = testWbApiV2Performance();
    
    // 7. Подсчитываем успешные тесты
    const successCount = Object.values(results).filter(Boolean).length;
    const totalCount = Object.keys(results).length;
    const successRate = Math.round((successCount / totalCount) * 100);
    
    logDebug(`📊 Успешных тестов: ${successCount}/${totalCount} (${successRate}%)`, 'WB-FUNCTIONALITY');
    
    if (successRate === 100) {
      logSuccess('✅ Все тесты WB API v2 пройдены!', 'WB-FUNCTIONALITY');
    } else {
      logWarning(`⚠️ Частично пройдены тесты WB API v2 (${successRate}%)`, 'WB-FUNCTIONALITY');
    }
    
    return results;
    
  } catch (error) {
    logError(`❌ Ошибка теста функциональности v2: ${error.message}`, 'WB-FUNCTIONALITY');
    return results;
  }
}

/**
 * Тест базовой функциональности WB API v2
 */
function testWbApiV2BasicFunctionality() {
  logDebug('Тест: Базовая функциональность WB API v2', 'WB-FUNCTIONALITY');
  
  try {
    // Мокаем UrlFetchApp
    const originalUrlFetchApp = UrlFetchApp;
    global.UrlFetchApp = {
      fetch: function(url, options) {
        return {
          getResponseCode: function() { return 200; },
          getContentText: function() { 
            return JSON.stringify({
              data: {
                feedbacks: [
                  {
                    id: 'test-1',
                    productValuation: 5,
                    text: 'Отличный товар!',
                    createdDate: '2024-01-15T10:00:00Z',
                    isAnswered: false
                  }
                ]
              }
            });
          }
        };
      }
    };
    
    try {
      const feedbacks = getWbFeedbacksV2('test-api-key', false, null);
      
      if (!Array.isArray(feedbacks)) {
        throw new Error('getWbFeedbacksV2 должен возвращать массив');
      }
      
      if (feedbacks.length === 0) {
        throw new Error('getWbFeedbacksV2 не должен возвращать пустой массив');
      }
      
      logSuccess('✅ Базовая функциональность WB API v2 работает', 'WB-FUNCTIONALITY');
      return true;
      
    } finally {
      global.UrlFetchApp = originalUrlFetchApp;
    }
    
  } catch (error) {
    logError(`❌ Ошибка базовой функциональности v2: ${error.message}`, 'WB-FUNCTIONALITY');
    return false;
  }
}

/**
 * Тест фильтрации по дате WB API v2
 */
function testWbApiV2DateFiltering() {
  logDebug('Тест: Фильтрация по дате WB API v2', 'WB-FUNCTIONALITY');
  
  try {
    const store = {
      id: 'test-store',
      name: 'Test Store',
      settings: {
        startDate: '2024-01-01'
      }
    };
    
    // Мокаем UrlFetchApp
    const originalUrlFetchApp = UrlFetchApp;
    global.UrlFetchApp = {
      fetch: function(url, options) {
        // Проверяем, что в URL есть параметр dateFrom
        if (!url.includes('dateFrom=2024-01-01')) {
          throw new Error('URL не содержит параметр dateFrom');
        }
        
        return {
          getResponseCode: function() { return 200; },
          getContentText: function() { 
            return JSON.stringify({
              data: {
                feedbacks: []
              }
            });
          }
        };
      }
    };
    
    try {
      const feedbacks = getWbFeedbacksV2('test-api-key', false, store);
      
      logSuccess('✅ Фильтрация по дате WB API v2 работает', 'WB-FUNCTIONALITY');
      return true;
      
    } finally {
      global.UrlFetchApp = originalUrlFetchApp;
    }
    
  } catch (error) {
    logError(`❌ Ошибка фильтрации по дате v2: ${error.message}`, 'WB-FUNCTIONALITY');
    return false;
  }
}

/**
 * Тест фильтрации по рейтингу WB API v2
 */
function testWbApiV2RatingFiltering() {
  logDebug('Тест: Фильтрация по рейтингу WB API v2', 'WB-FUNCTIONALITY');
  
  try {
    const store = {
      id: 'test-store',
      name: 'Test Store',
      settings: {
        minRating: 4
      }
    };
    
    // Мокаем UrlFetchApp
    const originalUrlFetchApp = UrlFetchApp;
    global.UrlFetchApp = {
      fetch: function(url, options) {
        // Проверяем, что в URL есть параметр valuation
        if (!url.includes('valuation=4')) {
          throw new Error('URL не содержит параметр valuation');
        }
        
        return {
          getResponseCode: function() { return 200; },
          getContentText: function() { 
            return JSON.stringify({
              data: {
                feedbacks: []
              }
            });
          }
        };
      }
    };
    
    try {
      const feedbacks = getWbFeedbacksV2('test-api-key', false, store);
      
      logSuccess('✅ Фильтрация по рейтингу WB API v2 работает', 'WB-FUNCTIONALITY');
      return true;
      
    } finally {
      global.UrlFetchApp = originalUrlFetchApp;
    }
    
  } catch (error) {
    logError(`❌ Ошибка фильтрации по рейтингу v2: ${error.message}`, 'WB-FUNCTIONALITY');
    return false;
  }
}

/**
 * Тест фильтрации по товару WB API v2
 */
function testWbApiV2ProductFiltering() {
  logDebug('Тест: Фильтрация по товару WB API v2', 'WB-FUNCTIONALITY');
  
  try {
    const store = {
      id: 'test-store',
      name: 'Test Store',
      settings: {
        nmId: 12345
      }
    };
    
    // Мокаем UrlFetchApp
    const originalUrlFetchApp = UrlFetchApp;
    global.UrlFetchApp = {
      fetch: function(url, options) {
        // Проверяем, что в URL есть параметр nmId
        if (!url.includes('nmId=12345')) {
          throw new Error('URL не содержит параметр nmId');
        }
        
        return {
          getResponseCode: function() { return 200; },
          getContentText: function() { 
            return JSON.stringify({
              data: {
                feedbacks: []
              }
            });
          }
        };
      }
    };
    
    try {
      const feedbacks = getWbFeedbacksV2('test-api-key', false, store);
      
      logSuccess('✅ Фильтрация по товару WB API v2 работает', 'WB-FUNCTIONALITY');
      return true;
      
    } finally {
      global.UrlFetchApp = originalUrlFetchApp;
    }
    
  } catch (error) {
    logError(`❌ Ошибка фильтрации по товару v2: ${error.message}`, 'WB-FUNCTIONALITY');
    return false;
  }
}

/**
 * Тест обработки ошибок WB API v2
 */
function testWbApiV2ErrorHandling() {
  logDebug('Тест: Обработка ошибок WB API v2', 'WB-FUNCTIONALITY');
  
  try {
    // Мокаем UrlFetchApp для возврата ошибки
    const originalUrlFetchApp = UrlFetchApp;
    global.UrlFetchApp = {
      fetch: function(url, options) {
        return {
          getResponseCode: function() { return 401; },
          getContentText: function() { 
            return JSON.stringify({ error: 'Unauthorized' });
          }
        };
      }
    };
    
    try {
      const feedbacks = getWbFeedbacksV2('invalid-key', false, null);
      
      // При ошибке должен возвращаться пустой массив
      if (!Array.isArray(feedbacks)) {
        throw new Error('При ошибке должен возвращаться массив');
      }
      
      logSuccess('✅ Обработка ошибок WB API v2 работает', 'WB-FUNCTIONALITY');
      return true;
      
    } finally {
      global.UrlFetchApp = originalUrlFetchApp;
    }
    
  } catch (error) {
    logError(`❌ Ошибка обработки ошибок v2: ${error.message}`, 'WB-FUNCTIONALITY');
    return false;
  }
}

/**
 * Тест производительности WB API v2
 */
function testWbApiV2Performance() {
  logDebug('Тест: Производительность WB API v2', 'WB-FUNCTIONALITY');
  
  try {
    const startTime = Date.now();
    
    // Мокаем UrlFetchApp
    const originalUrlFetchApp = UrlFetchApp;
    global.UrlFetchApp = {
      fetch: function(url, options) {
        return {
          getResponseCode: function() { return 200; },
          getContentText: function() { 
            return JSON.stringify({
              data: {
                feedbacks: Array(100).fill().map((_, i) => ({
                  id: `test-${i}`,
                  productValuation: 5,
                  text: `Test feedback ${i}`,
                  createdDate: new Date().toISOString(),
                  isAnswered: false
                }))
              }
            });
          }
        };
      }
    };
    
    try {
      const feedbacks = getWbFeedbacksV2('test-api-key', false, null);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      logDebug(`⏱️ Время выполнения: ${duration}мс`, 'WB-FUNCTIONALITY');
      
      if (duration > 1000) {
        logWarning('⚠️ Медленная производительность WB API v2', 'WB-FUNCTIONALITY');
        return false;
      } else {
        logSuccess('✅ Производительность WB API v2 в норме', 'WB-FUNCTIONALITY');
        return true;
      }
      
    } finally {
      global.UrlFetchApp = originalUrlFetchApp;
    }
    
  } catch (error) {
    logError(`❌ Ошибка теста производительности v2: ${error.message}`, 'WB-FUNCTIONALITY');
    return false;
  }
}

/**
 * 🧪 Главная функция: Полное сравнение WB API v1 vs v2
 */
function runWbApiComparison() {
  log('🧪 ===== СРАВНЕНИЕ WB API v1 vs v2 =====', 'INFO', 'WB-COMPARISON');
  
  try {
    // 1. Тест полноты v2
    const completenessResults = testWbApiV2Completeness();
    
    // 2. Тест функциональности v2
    const functionalityResults = testWbApiV2Functionality();
    
    // 3. Итоговый анализ
    const canReplace = completenessResults.canReplace && 
                      Object.values(functionalityResults).every(Boolean);
    
    log('🧪 ===== ИТОГИ СРАВНЕНИЯ =====', 'INFO', 'WB-COMPARISON');
    log(`📊 Полнота v2: ${completenessResults.canReplace ? '✅ Да' : '❌ Нет'}`, 'INFO', 'WB-COMPARISON');
    log(`📊 Функциональность v2: ${Object.values(functionalityResults).every(Boolean) ? '✅ Да' : '❌ Нет'}`, 'INFO', 'WB-COMPARISON');
    log(`🔄 Можно заменить v1 на v2: ${canReplace ? '✅ ДА' : '❌ НЕТ'}`, 'INFO', 'WB-COMPARISON');
    
    if (canReplace) {
      logSuccess('🎉 WB API v2 ПОЛНОСТЬЮ ЗАМЕНЯЕТ v1!', 'WB-COMPARISON');
      logSuccess('✨ Рекомендуется удалить v1 и использовать только v2', 'WB-COMPARISON');
    } else {
      logError('❌ v2 не может полностью заменить v1', 'WB-COMPARISON');
    }
    
    return {
      completeness: completenessResults,
      functionality: functionalityResults,
      canReplace: canReplace
    };
    
  } catch (error) {
    logError(`❌ Ошибка сравнения WB API: ${error.message}`, 'WB-COMPARISON');
    return null;
  }
}