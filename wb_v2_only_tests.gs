/**
 * 🧪 ТЕСТЫ ТОЛЬКО ДЛЯ WB API v2
 * 
 * Этот файл содержит тесты только для WB API v2,
 * так как v2 полностью заменяет v1.
 */

/**
 * 🧪 Тест WB API v2 - Получение отзывов
 */
function testWbApiV2GetFeedbacks() {
  logDebug('🧪 Тест: Получение отзывов WB API v2', 'WB-V2-TEST');
  
  try {
    // Мокаем UrlFetchApp
    const originalUrlFetchApp = UrlFetchApp;
    global.UrlFetchApp = {
      fetch: function(url, options) {
        // Проверяем, что используется v2 endpoint
        if (!url.includes('/api/v2/feedbacks')) {
          throw new Error('Должен использоваться WB API v2 endpoint');
        }
        
        return {
          getResponseCode: function() { return 200; },
          getContentText: function() { 
            return JSON.stringify({
              data: {
                feedbacks: [
                  {
                    id: 'wb-v2-test-1',
                    productValuation: 5,
                    text: 'Отличный товар! Рекомендую!',
                    createdDate: '2024-01-15T10:00:00Z',
                    isAnswered: false,
                    productDetails: {
                      nmId: 12345,
                      productName: 'Тестовый товар WB v2',
                      supplierArticle: 'WB-12345'
                    }
                  }
                ]
              }
            });
          }
        };
      }
    };
    
    try {
      const feedbacks = getWbFeedbacks('test-api-key', false, MOCK_STORE);
      
      if (!Array.isArray(feedbacks)) {
        throw new Error('getWbFeedbacks должен возвращать массив');
      }
      
      if (feedbacks.length === 0) {
        throw new Error('getWbFeedbacks не должен возвращать пустой массив');
      }
      
      // Проверяем структуру отзыва
      const feedback = feedbacks[0];
      if (!feedback.id || !feedback.text || !feedback.rating) {
        throw new Error('Неправильная структура отзыва WB v2');
      }
      
      logSuccess('✅ Получение отзывов WB API v2 работает', 'WB-V2-TEST');
      return true;
      
    } finally {
      global.UrlFetchApp = originalUrlFetchApp;
    }
    
  } catch (error) {
    logError(`❌ Тест WB API v2 провален: ${error.message}`, 'WB-V2-TEST');
    return false;
  }
}

/**
 * 🧪 Тест WB API v2 - Фильтрация по дате
 */
function testWbApiV2DateFiltering() {
  logDebug('🧪 Тест: Фильтрация по дате WB API v2', 'WB-V2-TEST');
  
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
          throw new Error('URL не содержит параметр dateFrom для фильтрации по дате');
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
      const feedbacks = getWbFeedbacks('test-api-key', false, store);
      
      logSuccess('✅ Фильтрация по дате WB API v2 работает', 'WB-V2-TEST');
      return true;
      
    } finally {
      global.UrlFetchApp = originalUrlFetchApp;
    }
    
  } catch (error) {
    logError(`❌ Тест фильтрации по дате WB API v2 провален: ${error.message}`, 'WB-V2-TEST');
    return false;
  }
}

/**
 * 🧪 Тест WB API v2 - Фильтрация по рейтингу
 */
function testWbApiV2RatingFiltering() {
  logDebug('🧪 Тест: Фильтрация по рейтингу WB API v2', 'WB-V2-TEST');
  
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
          throw new Error('URL не содержит параметр valuation для фильтрации по рейтингу');
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
      const feedbacks = getWbFeedbacks('test-api-key', false, store);
      
      logSuccess('✅ Фильтрация по рейтингу WB API v2 работает', 'WB-V2-TEST');
      return true;
      
    } finally {
      global.UrlFetchApp = originalUrlFetchApp;
    }
    
  } catch (error) {
    logError(`❌ Тест фильтрации по рейтингу WB API v2 провален: ${error.message}`, 'WB-V2-TEST');
    return false;
  }
}

/**
 * 🧪 Тест WB API v2 - Фильтрация по товару
 */
function testWbApiV2ProductFiltering() {
  logDebug('🧪 Тест: Фильтрация по товару WB API v2', 'WB-V2-TEST');
  
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
          throw new Error('URL не содержит параметр nmId для фильтрации по товару');
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
      const feedbacks = getWbFeedbacks('test-api-key', false, store);
      
      logSuccess('✅ Фильтрация по товару WB API v2 работает', 'WB-V2-TEST');
      return true;
      
    } finally {
      global.UrlFetchApp = originalUrlFetchApp;
    }
    
  } catch (error) {
    logError(`❌ Тест фильтрации по товару WB API v2 провален: ${error.message}`, 'WB-V2-TEST');
    return false;
  }
}

/**
 * 🧪 Тест WB API v2 - Обработка ошибок
 */
function testWbApiV2ErrorHandling() {
  logDebug('🧪 Тест: Обработка ошибок WB API v2', 'WB-V2-TEST');
  
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
      const feedbacks = getWbFeedbacks('invalid-key', false, null);
      
      // При ошибке должен возвращаться пустой массив
      if (!Array.isArray(feedbacks)) {
        throw new Error('При ошибке должен возвращаться массив');
      }
      
      logSuccess('✅ Обработка ошибок WB API v2 работает', 'WB-V2-TEST');
      return true;
      
    } finally {
      global.UrlFetchApp = originalUrlFetchApp;
    }
    
  } catch (error) {
    logError(`❌ Тест обработки ошибок WB API v2 провален: ${error.message}`, 'WB-V2-TEST');
    return false;
  }
}

/**
 * 🧪 Тест WB API v2 - Отправка ответа
 */
function testWbApiV2SendAnswer() {
  logDebug('🧪 Тест: Отправка ответа WB API v2', 'WB-V2-TEST');
  
  try {
    // Мокаем UrlFetchApp
    const originalUrlFetchApp = UrlFetchApp;
    global.UrlFetchApp = {
      fetch: function(url, options) {
        // Проверяем, что используется v2 endpoint для отправки ответа
        if (!url.includes('/api/v2/feedbacks/') || !url.includes('/answer')) {
          throw new Error('Должен использоваться WB API v2 endpoint для отправки ответа');
        }
        
        return {
          getResponseCode: function() { return 200; },
          getContentText: function() { 
            return JSON.stringify({ success: true });
          }
        };
      }
    };
    
    try {
      const result = sendWbFeedbackAnswer('wb-test-1', 'Спасибо за отзыв!', 'test-api-key');
      
      if (!result || !result.success) {
        throw new Error('sendWbFeedbackAnswer должен возвращать успешный результат');
      }
      
      logSuccess('✅ Отправка ответа WB API v2 работает', 'WB-V2-TEST');
      return true;
      
    } finally {
      global.UrlFetchApp = originalUrlFetchApp;
    }
    
  } catch (error) {
    logError(`❌ Тест отправки ответа WB API v2 провален: ${error.message}`, 'WB-V2-TEST');
    return false;
  }
}

/**
 * 🧪 Тест WB API v2 - Производительность
 */
function testWbApiV2Performance() {
  logDebug('🧪 Тест: Производительность WB API v2', 'WB-V2-TEST');
  
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
                  id: `wb-v2-test-${i}`,
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
      const feedbacks = getWbFeedbacks('test-api-key', false, null);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      logDebug(`⏱️ Время выполнения: ${duration}мс`, 'WB-V2-TEST');
      
      if (duration > 1000) {
        logWarning('⚠️ Медленная производительность WB API v2', 'WB-V2-TEST');
        return false;
      } else {
        logSuccess('✅ Производительность WB API v2 в норме', 'WB-V2-TEST');
        return true;
      }
      
    } finally {
      global.UrlFetchApp = originalUrlFetchApp;
    }
    
  } catch (error) {
    logError(`❌ Тест производительности WB API v2 провален: ${error.message}`, 'WB-V2-TEST');
    return false;
  }
}

/**
 * 🚀 ГЛАВНАЯ ФУНКЦИЯ: Запуск всех тестов WB API v2
 */
function runWbApiV2Tests() {
  log('🧪 ===== ТЕСТЫ WB API v2 =====', 'INFO', 'WB-V2-TEST-RUNNER');
  
  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    errors: []
  };
  
  const testFunctions = [
    { name: 'Получение отзывов', test: testWbApiV2GetFeedbacks },
    { name: 'Фильтрация по дате', test: testWbApiV2DateFiltering },
    { name: 'Фильтрация по рейтингу', test: testWbApiV2RatingFiltering },
    { name: 'Фильтрация по товару', test: testWbApiV2ProductFiltering },
    { name: 'Обработка ошибок', test: testWbApiV2ErrorHandling },
    { name: 'Отправка ответа', test: testWbApiV2SendAnswer },
    { name: 'Производительность', test: testWbApiV2Performance }
  ];
  
  for (const test of testFunctions) {
    results.total++;
    log(`🧪 Запуск теста: ${test.name}`, 'INFO', 'WB-V2-TEST-RUNNER');
    
    try {
      const success = test.test();
      if (success) {
        results.passed++;
        logSuccess(`✅ ${test.name} - ПРОЙДЕН`, 'WB-V2-TEST-RUNNER');
      } else {
        results.failed++;
        logError(`❌ ${test.name} - ПРОВАЛЕН`, 'WB-V2-TEST-RUNNER');
      }
    } catch (error) {
      results.failed++;
      results.errors.push(`${test.name}: ${error.message}`);
      logError(`❌ ${test.name} - ОШИБКА: ${error.message}`, 'WB-V2-TEST-RUNNER');
    }
  }
  
  // Выводим итоговый отчет
  log('🧪 ===== ИТОГИ ТЕСТИРОВАНИЯ WB API v2 =====', 'INFO', 'WB-V2-TEST-RUNNER');
  log(`📊 Всего тестов: ${results.total}`, 'INFO', 'WB-V2-TEST-RUNNER');
  log(`✅ Пройдено: ${results.passed}`, 'SUCCESS', 'WB-V2-TEST-RUNNER');
  log(`❌ Провалено: ${results.failed}`, 'ERROR', 'WB-V2-TEST-RUNNER');
  
  if (results.errors.length > 0) {
    log('🔍 Ошибки:', 'WARNING', 'WB-V2-TEST-RUNNER');
    results.errors.forEach(error => {
      log(`  - ${error}`, 'ERROR', 'WB-V2-TEST-RUNNER');
    });
  }
  
  const successRate = Math.round((results.passed / results.total) * 100);
  log(`📈 Процент успеха: ${successRate}%`, 'INFO', 'WB-V2-TEST-RUNNER');
  
  if (successRate === 100) {
    logSuccess('🎉 ВСЕ ТЕСТЫ WB API v2 ПРОЙДЕНЫ УСПЕШНО!', 'WB-V2-TEST-RUNNER');
    } else if (successRate >= 80) {
    logWarning(`⚠️ Большинство тестов WB API v2 пройдено (${successRate}%), требуется исправление ${results.failed} тестов`, 'WB-V2-TEST-RUNNER');
    } else {
      logError(`❌ Критический уровень ошибок WB API v2 (${successRate}%), требуется серьезная доработка`, 'WB-V2-TEST-RUNNER');
    }
  
  return results;
}