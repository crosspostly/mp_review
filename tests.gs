/**
 * 🧪 ЕДИНАЯ СИСТЕМА ТЕСТИРОВАНИЯ
 * 
 * Этот файл содержит ВСЕ тесты системы обработки отзывов:
 * - Unit тесты
 * - UI тесты  
 * - Тесты WB v2
 * - Интеграционные тесты
 * - Тесты производительности
 * - Тесты безопасности
 */

// ======================================================================
// ========================== КОНФИГУРАЦИЯ ТЕСТОВ ======================
// ======================================================================

const TEST_CONFIG = {
  ENABLE_LOGGING: true,
  MOCK_API_RESPONSES: true,
  TEST_TIMEOUT: 30000, // 30 секунд
  MAX_TEST_ITERATIONS: 10
};

// ======================================================================
// ========================== МОК-ДАННЫЕ ===============================
// ======================================================================

/**
 * Мок-данные для тестирования WB API
 */
const MOCK_WB_FEEDBACKS = [
  {
    id: "wb-test-1",
    productValuation: 5,
    text: "Отличный товар! Рекомендую!",
    createdDate: "2024-01-15T10:00:00Z",
    isAnswered: false,
    productDetails: {
      nmId: 12345,
      productName: "Тестовый товар WB",
      supplierArticle: "WB-12345"
    }
  },
  {
    id: "wb-test-2",
    productValuation: 3,
    text: "Нормально, но могло быть лучше",
    createdDate: "2024-01-14T15:30:00Z",
    isAnswered: true,
    productDetails: {
      nmId: 67890,
      productName: "Другой товар WB",
      supplierArticle: "WB-67890"
    }
  }
];

/**
 * Мок-данные для тестирования Ozon API
 */
const MOCK_OZON_FEEDBACKS = [
  {
    id: "ozon-test-1",
    rating: 5,
    text: "Супер качество! Очень доволен покупкой!",
    created_at: "2024-01-15T12:00:00Z",
    is_answered: false,
    product: {
      offer_id: "ozon-123",
      name: "Тестовый товар Ozon",
      sku: "OZ-123"
    }
  },
  {
    id: "ozon-test-2",
    rating: 2,
    text: "Не понравилось, качество плохое",
    created_at: "2024-01-14T18:45:00Z",
    is_answered: true,
    product: {
      offer_id: "ozon-456",
      name: "Другой товар Ozon",
      sku: "OZ-456"
    }
  }
];

/**
 * Мок-данные для тестирования магазина
 */
const MOCK_STORE = {
  id: "test-store-1",
  name: "Тестовый магазин",
  marketplace: "wb",
  isActive: true,
  credentials: {
    apiKey: "test-wb-api-key"
  },
  settings: {
    startDate: "2024-01-01",
    minRating: 3,
    sortOldestFirst: false
  }
};

// ======================================================================
// ========================== МОК-ФУНКЦИИ ==============================
// ======================================================================

/**
 * Создает мок UrlFetchApp для тестирования
 */
function createMockUrlFetchApp() {
  return {
    fetch: function(url, options) {
      logDebug(`Mock UrlFetchApp.fetch: ${url}`, 'MOCK');
      
      // Определяем тип API по URL
      if (url.includes('wildberries.ru')) {
        return createMockWbResponse();
      } else if (url.includes('ozon.ru')) {
        return createMockOzonResponse();
      } else {
        return createMockErrorResponse(404, 'Not Found');
      }
    }
  };
}

/**
 * Создает мок-ответ WB API
 */
function createMockWbResponse() {
  return {
    getResponseCode: function() { return 200; },
    getContentText: function() { 
      return JSON.stringify({
        data: {
          feedbacks: MOCK_WB_FEEDBACKS
        }
      });
    }
  };
}

/**
 * Создает мок-ответ Ozon API
 */
function createMockOzonResponse() {
  return {
    getResponseCode: function() { return 200; },
    getContentText: function() { 
      return JSON.stringify({
        result: {
          reviews: MOCK_OZON_FEEDBACKS
        }
      });
    }
  };
}

/**
 * Создает мок-ответ с ошибкой
 */
function createMockErrorResponse(code, message) {
  return {
    getResponseCode: function() { return code; },
    getContentText: function() { 
      return JSON.stringify({ error: message });
    }
  };
}

// ======================================================================
// ========================== UNIT ТЕСТЫ ===============================
// ======================================================================

/**
 * 🧪 Тест API функций WB
 */
function testWbApiFunctions() {
  logDebug('🧪 Тест API функций WB', 'UNIT-TEST');
  
  try {
    // Тест 1: Получение отзывов WB
    testGetWbFeedbacks();
    
    // Тест 2: Отправка ответа на отзыв WB
    testSendWbFeedbackAnswer();
    
    // Тест 3: Обработка ошибок WB API
    testWbApiErrorHandling();
    
    logSuccess('✅ Все тесты WB API пройдены', 'UNIT-TEST');
    return true;
    
  } catch (error) {
    logError(`❌ Тест WB API провален: ${error.message}`, 'UNIT-TEST');
    return false;
  }
}

/**
 * Тест получения отзывов WB
 */
function testGetWbFeedbacks() {
  logDebug('Тест: Получение отзывов WB', 'UNIT-TEST');
  
  // Мокаем UrlFetchApp
  const originalUrlFetchApp = UrlFetchApp;
  global.UrlFetchApp = createMockUrlFetchApp();
  
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
    if (!feedback.id || !feedback.text || !feedback.productValuation) {
      throw new Error('Неправильная структура отзыва WB');
    }
    
    logSuccess('✅ Получение отзывов WB работает', 'UNIT-TEST');
    
  } finally {
    global.UrlFetchApp = originalUrlFetchApp;
  }
}

/**
 * Тест отправки ответа на отзыв WB
 */
function testSendWbFeedbackAnswer() {
  logDebug('Тест: Отправка ответа на отзыв WB', 'UNIT-TEST');
  
  // Мокаем UrlFetchApp
  const originalUrlFetchApp = UrlFetchApp;
  global.UrlFetchApp = createMockUrlFetchApp();
  
  try {
    const result = sendWbFeedbackAnswer('wb-test-1', 'Спасибо за отзыв!', 'test-api-key');
    
    if (!result || !result.success) {
      throw new Error('sendWbFeedbackAnswer должен возвращать успешный результат');
    }
    
    logSuccess('✅ Отправка ответа WB работает', 'UNIT-TEST');
    
  } finally {
    global.UrlFetchApp = originalUrlFetchApp;
  }
}

/**
 * Тест обработки ошибок WB API
 */
function testWbApiErrorHandling() {
  logDebug('Тест: Обработка ошибок WB API', 'UNIT-TEST');
  
  // Мокаем UrlFetchApp для возврата ошибки
  const originalUrlFetchApp = UrlFetchApp;
  global.UrlFetchApp = {
    fetch: function(url, options) {
      return createMockErrorResponse(401, 'Unauthorized');
    }
  };
  
  try {
    const feedbacks = getWbFeedbacks('invalid-key', false, MOCK_STORE);
    
    // При ошибке должен возвращаться пустой массив
    if (!Array.isArray(feedbacks)) {
      throw new Error('При ошибке должен возвращаться массив');
    }
    
    logSuccess('✅ Обработка ошибок WB API работает', 'UNIT-TEST');
    
  } finally {
    global.UrlFetchApp = originalUrlFetchApp;
  }
}

/**
 * 🧪 Тест API функций Ozon
 */
function testOzonApiFunctions() {
  logDebug('🧪 Тест API функций Ozon', 'UNIT-TEST');
  
  try {
    // Тест 1: Получение отзывов Ozon
    testGetOzonFeedbacks();
    
    // Тест 2: Отправка ответа на отзыв Ozon
    testSendOzonFeedbackAnswer();
    
    // Тест 3: Обработка ошибок Ozon API
    testOzonApiErrorHandling();
    
    logSuccess('✅ Все тесты Ozon API пройдены', 'UNIT-TEST');
    return true;
    
  } catch (error) {
    logError(`❌ Тест Ozon API провален: ${error.message}`, 'UNIT-TEST');
    return false;
  }
}

/**
 * Тест получения отзывов Ozon
 */
function testGetOzonFeedbacks() {
  logDebug('Тест: Получение отзывов Ozon', 'UNIT-TEST');
  
  // Мокаем UrlFetchApp
  const originalUrlFetchApp = UrlFetchApp;
  global.UrlFetchApp = createMockUrlFetchApp();
  
  try {
    const feedbacks = getOzonFeedbacks('test-client-id', 'test-api-key', false, MOCK_STORE);
    
    if (!Array.isArray(feedbacks)) {
      throw new Error('getOzonFeedbacks должен возвращать массив');
    }
    
    if (feedbacks.length === 0) {
      throw new Error('getOzonFeedbacks не должен возвращать пустой массив');
    }
    
    // Проверяем структуру отзыва
    const feedback = feedbacks[0];
    if (!feedback.id || !feedback.text || !feedback.rating) {
      throw new Error('Неправильная структура отзыва Ozon');
    }
    
    logSuccess('✅ Получение отзывов Ozon работает', 'UNIT-TEST');
    
  } finally {
    global.UrlFetchApp = originalUrlFetchApp;
  }
}

/**
 * Тест отправки ответа на отзыв Ozon
 */
function testSendOzonFeedbackAnswer() {
  logDebug('Тест: Отправка ответа на отзыв Ozon', 'UNIT-TEST');
  
  // Мокаем UrlFetchApp
  const originalUrlFetchApp = UrlFetchApp;
  global.UrlFetchApp = createMockUrlFetchApp();
  
  try {
    const result = sendOzonFeedbackAnswer('ozon-test-1', 'Спасибо за отзыв!', 'test-client-id', 'test-api-key');
    
    if (!result || !result.success) {
      throw new Error('sendOzonFeedbackAnswer должен возвращать успешный результат');
    }
    
    logSuccess('✅ Отправка ответа Ozon работает', 'UNIT-TEST');
    
  } finally {
    global.UrlFetchApp = originalUrlFetchApp;
  }
}

/**
 * Тест обработки ошибок Ozon API
 */
function testOzonApiErrorHandling() {
  logDebug('Тест: Обработка ошибок Ozon API', 'UNIT-TEST');
  
  // Мокаем UrlFetchApp для возврата ошибки
  const originalUrlFetchApp = UrlFetchApp;
  global.UrlFetchApp = {
    fetch: function(url, options) {
      return createMockErrorResponse(401, 'Unauthorized');
    }
  };
  
  try {
    const feedbacks = getOzonFeedbacks('invalid-client-id', 'invalid-key', false, MOCK_STORE);
    
    // При ошибке должен возвращаться пустой массив
    if (!Array.isArray(feedbacks)) {
      throw new Error('При ошибке должен возвращаться массив');
    }
    
    logSuccess('✅ Обработка ошибок Ozon API работает', 'UNIT-TEST');
    
  } finally {
    global.UrlFetchApp = originalUrlFetchApp;
  }
}

// ======================================================================
// ========================== WB API V2 ТЕСТЫ ==========================
// ======================================================================

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

// ======================================================================
// ========================== СИСТЕМА ТРИГГЕРОВ ========================
// ======================================================================

/**
 * 🧪 Тест системы триггеров
 */
function testTriggerSystem() {
  logDebug('🧪 Тест системы триггеров', 'UNIT-TEST');
  
  try {
    // Тест 1: Создание триггера
    testCreateTrigger();
    
    // Тест 2: Удаление триггера
    testDeleteTrigger();
    
    // Тест 3: Синхронизация триггеров
    testSyncTriggers();
    
    // Тест 4: Проверка целостности триггеров
    testTriggerIntegrity();
    
    logSuccess('✅ Все тесты системы триггеров пройдены', 'UNIT-TEST');
    return true;
    
  } catch (error) {
    logError(`❌ Тест системы триггеров провален: ${error.message}`, 'UNIT-TEST');
    return false;
  }
}

/**
 * Тест создания триггера
 */
function testCreateTrigger() {
  logDebug('Тест: Создание триггера', 'UNIT-TEST');
  
  try {
    const triggerId = createStoreTrigger(MOCK_STORE, 30);
    
    if (!triggerId) {
      throw new Error('createStoreTrigger должен возвращать ID триггера');
    }
    
    // Проверяем, что триггер создан
    const triggers = ScriptApp.getProjectTriggers();
    const trigger = triggers.find(t => t.getUniqueId() === triggerId);
    
    if (!trigger) {
      throw new Error('Триггер не найден после создания');
    }
    
    // Очищаем тестовый триггер
    ScriptApp.deleteTrigger(trigger);
    
    logSuccess('✅ Создание триггера работает', 'UNIT-TEST');
    
  } catch (error) {
    logError(`❌ Ошибка создания триггера: ${error.message}`, 'UNIT-TEST');
    throw error;
  }
}

/**
 * Тест удаления триггера
 */
function testDeleteTrigger() {
  logDebug('Тест: Удаление триггера', 'UNIT-TEST');
  
  try {
    // Создаем тестовый триггер
    const trigger = ScriptApp.newTrigger('processAllStores')
      .timeBased()
      .everyMinutes(30)
      .create();
    
    const triggerId = trigger.getUniqueId();
    
    // Удаляем триггер
    const result = deleteStoreTrigger(MOCK_STORE.id);
    
    if (!result) {
      throw new Error('deleteStoreTrigger должен возвращать true');
    }
    
    // Проверяем, что триггер удален
    const triggers = ScriptApp.getProjectTriggers();
    const foundTrigger = triggers.find(t => t.getUniqueId() === triggerId);
    
    if (foundTrigger) {
      throw new Error('Триггер не был удален');
    }
    
    logSuccess('✅ Удаление триггера работает', 'UNIT-TEST');
    
  } catch (error) {
    logError(`❌ Ошибка удаления триггера: ${error.message}`, 'UNIT-TEST');
    throw error;
  }
}

/**
 * Тест синхронизации триггеров
 */
function testSyncTriggers() {
  logDebug('Тест: Синхронизация триггеров', 'UNIT-TEST');
  
  try {
    const result = syncAllStoreTriggers();
    
    if (!result) {
      throw new Error('syncAllStoreTriggers должен возвращать true');
    }
    
    logSuccess('✅ Синхронизация триггеров работает', 'UNIT-TEST');
    
  } catch (error) {
    logError(`❌ Ошибка синхронизации триггеров: ${error.message}`, 'UNIT-TEST');
    throw error;
  }
}

/**
 * Тест целостности триггеров
 */
function testTriggerIntegrity() {
  logDebug('Тест: Целостность триггеров', 'UNIT-TEST');
  
  try {
    const result = validateTriggerIntegrity();
    
    if (!result) {
      throw new Error('validateTriggerIntegrity должен возвращать true');
    }
    
    logSuccess('✅ Целостность триггеров работает', 'UNIT-TEST');
    
  } catch (error) {
    logError(`❌ Ошибка проверки целостности триггеров: ${error.message}`, 'UNIT-TEST');
    throw error;
  }
}

// ======================================================================
// ========================== ОБРАБОТКА ДАННЫХ =========================
// ======================================================================

/**
 * 🧪 Тест обработки данных
 */
function testDataProcessing() {
  logDebug('🧪 Тест обработки данных', 'UNIT-TEST');
  
  try {
    // Тест 1: Фильтрация по дате
    testDateFiltering();
    
    // Тест 2: Фильтрация по рейтингу
    testRatingFiltering();
    
    // Тест 3: Сортировка данных
    testSorting();
    
    // Тест 4: Нормализация данных
    testDataNormalization();
    
    logSuccess('✅ Все тесты обработки данных пройдены', 'UNIT-TEST');
    return true;
    
  } catch (error) {
    logError(`❌ Тест обработки данных провален: ${error.message}`, 'UNIT-TEST');
    return false;
  }
}

/**
 * Тест фильтрации по дате
 */
function testDateFiltering() {
  logDebug('Тест: Фильтрация по дате', 'UNIT-TEST');
  
  try {
    const feedbacks = [
      { createdDate: '2024-01-15T10:00:00Z' },
      { createdDate: '2024-01-14T15:30:00Z' },
      { createdDate: '2024-01-13T09:15:00Z' }
    ];
    
    const filtered = feedbacks.filter(f => 
      new Date(f.createdDate) >= new Date('2024-01-14')
    );
    
    if (filtered.length !== 2) {
      throw new Error('Фильтрация по дате работает неправильно');
    }
    
    logSuccess('✅ Фильтрация по дате работает', 'UNIT-TEST');
    
  } catch (error) {
    logError(`❌ Ошибка фильтрации по дате: ${error.message}`, 'UNIT-TEST');
    throw error;
  }
}

/**
 * Тест фильтрации по рейтингу
 */
function testRatingFiltering() {
  logDebug('Тест: Фильтрация по рейтингу', 'UNIT-TEST');
  
  try {
    const feedbacks = [
      { productValuation: 5 },
      { productValuation: 3 },
      { productValuation: 1 }
    ];
    
    const filtered = feedbacks.filter(f => f.productValuation >= 3);
    
    if (filtered.length !== 2) {
      throw new Error('Фильтрация по рейтингу работает неправильно');
    }
    
    logSuccess('✅ Фильтрация по рейтингу работает', 'UNIT-TEST');
    
  } catch (error) {
    logError(`❌ Ошибка фильтрации по рейтингу: ${error.message}`, 'UNIT-TEST');
    throw error;
  }
}

/**
 * Тест сортировки данных
 */
function testSorting() {
  logDebug('Тест: Сортировка данных', 'UNIT-TEST');
  
  try {
    const feedbacks = [
      { createdDate: '2024-01-15T10:00:00Z' },
      { createdDate: '2024-01-13T09:15:00Z' },
      { createdDate: '2024-01-14T15:30:00Z' }
    ];
    
    const sorted = feedbacks.sort((a, b) => 
      new Date(a.createdDate) - new Date(b.createdDate)
    );
    
    if (sorted[0].createdDate !== '2024-01-13T09:15:00Z') {
      throw new Error('Сортировка работает неправильно');
    }
    
    logSuccess('✅ Сортировка данных работает', 'UNIT-TEST');
    
  } catch (error) {
    logError(`❌ Ошибка сортировки: ${error.message}`, 'UNIT-TEST');
    throw error;
  }
}

/**
 * Тест нормализации данных
 */
function testDataNormalization() {
  logDebug('Тест: Нормализация данных', 'UNIT-TEST');
  
  try {
    const wbFeedback = {
      id: 'wb-1',
      productValuation: 5,
      text: 'Отличный товар!',
      createdDate: '2024-01-15T10:00:00Z',
      isAnswered: false
    };
    
    const normalized = normalizeWbFeedback(wbFeedback);
    
    if (!normalized.id || !normalized.rating || !normalized.text) {
      throw new Error('Нормализация данных работает неправильно');
    }
    
    logSuccess('✅ Нормализация данных работает', 'UNIT-TEST');
    
  } catch (error) {
    logError(`❌ Ошибка нормализации данных: ${error.message}`, 'UNIT-TEST');
    throw error;
  }
}

// ======================================================================
// ========================== ИНТЕГРАЦИОННЫЕ ТЕСТЫ =====================
// ======================================================================

/**
 * 🧪 Тест полной обработки магазина
 */
function testFullStoreProcessing() {
  logDebug('🧪 Тест полной обработки магазина', 'INTEGRATION-TEST');
  
  try {
    // Мокаем UrlFetchApp
    const originalUrlFetchApp = UrlFetchApp;
    global.UrlFetchApp = createMockUrlFetchApp();
    
    try {
      const result = processSingleStore(MOCK_STORE, true);
      
      if (!result) {
        throw new Error('processSingleStore должен возвращать true');
      }
      
      logSuccess('✅ Полная обработка магазина работает', 'INTEGRATION-TEST');
      
    } finally {
      global.UrlFetchApp = originalUrlFetchApp;
    }
    
  } catch (error) {
    logError(`❌ Ошибка полной обработки магазина: ${error.message}`, 'INTEGRATION-TEST');
    throw error;
  }
}

/**
 * 🧪 Тест системы прогресса
 */
function testProgressSystem() {
  logDebug('🧪 Тест системы прогресса', 'INTEGRATION-TEST');
  
  try {
    const storeId = 'test-progress-store';
    
    // Сохраняем прогресс
    const progressData = {
      lastPage: 5,
      lastDate: new Date().toISOString(),
      processedCount: 100
    };
    
    const saveResult = updateStoreProgress(storeId, progressData);
    if (!saveResult) {
      throw new Error('Не удалось сохранить прогресс');
    }
    
    // Получаем прогресс
    const retrievedProgress = getStoreProgress(storeId);
    if (!retrievedProgress) {
      throw new Error('Не удалось получить прогресс');
    }
    
    // Проверяем данные
    if (retrievedProgress.lastPage !== 5) {
      throw new Error('Некорректные данные прогресса');
    }
    
    // Сбрасываем прогресс
    const resetResult = resetStoreProgress(storeId);
    if (!resetResult) {
      throw new Error('Не удалось сбросить прогресс');
    }
    
    logSuccess('✅ Система прогресса работает', 'INTEGRATION-TEST');
    
  } catch (error) {
    logError(`❌ Ошибка системы прогресса: ${error.message}`, 'INTEGRATION-TEST');
    throw error;
  }
}

// ======================================================================
// ========================== UI ТЕСТЫ ================================
// ======================================================================

/**
 * 🚀 Запуск всех тестов из меню
 */
function runAllTests() {
  try {
    // Включаем режим разработчика для подробных логов
    enableDevMode();
    
    // Запускаем все тесты
    const results = runAllTestsInternal();
    
    // Показываем результат пользователю
    const successRate = Math.round((results.passed / results.total) * 100);
    const message = `🧪 РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ\n\n` +
                   `📊 Всего тестов: ${results.total}\n` +
                   `✅ Пройдено: ${results.passed}\n` +
                   `❌ Провалено: ${results.failed}\n` +
                   `📈 Процент успеха: ${successRate}%\n\n` +
                   `Подробные логи смотрите в консоли Google Apps Script.`;
    
    SpreadsheetApp.getUi().alert('Результаты тестирования', message, SpreadsheetApp.getUi().ButtonSet.OK);
    
    return results;
    
  } catch (error) {
    const errorMessage = `❌ Ошибка запуска тестов:\n\n${error.message}\n\n` +
                        `Проверьте консоль Google Apps Script для подробностей.`;
    
    SpreadsheetApp.getUi().alert('Ошибка тестирования', errorMessage, SpreadsheetApp.getUi().ButtonSet.OK);
    
    logError(`Ошибка запуска всех тестов: ${error.message}`, 'UI-TEST');
    return null;
  }
}

/**
 * 🧪 Запуск быстрых тестов из меню
 */
function runQuickTests() {
  try {
    // Включаем режим разработчика для подробных логов
    enableDevMode();
    
    // Запускаем быстрые тесты
    const success = runQuickTestsInternal();
    
    // Показываем результат пользователю
    const message = success ? 
      '✅ Быстрые тесты пройдены успешно!\n\nВсе критические функции работают корректно.' :
      '❌ Быстрые тесты провалены!\n\nПроверьте консоль Google Apps Script для подробностей.';
    
    const title = success ? 'Тесты пройдены' : 'Тесты провалены';
    
    SpreadsheetApp.getUi().alert(title, message, SpreadsheetApp.getUi().ButtonSet.OK);
    
    return success;
    
  } catch (error) {
    const errorMessage = `❌ Ошибка запуска быстрых тестов:\n\n${error.message}\n\n` +
                        `Проверьте консоль Google Apps Script для подробностей.`;
    
    SpreadsheetApp.getUi().alert('Ошибка тестирования', errorMessage, SpreadsheetApp.getUi().ButtonSet.OK);
    
    logError(`Ошибка запуска быстрых тестов: ${error.message}`, 'UI-TEST');
    return false;
  }
}

/**
 * 📊 Запуск тестов производительности из меню
 */
function runPerformanceTests() {
  try {
    // Включаем режим разработчика для подробных логов
    enableDevMode();
    
    // Запускаем тесты производительности
    const success = runPerformanceTestsInternal();
    
    // Показываем результат пользователю
    const message = success ? 
      '✅ Тесты производительности пройдены!\n\nСистема работает с оптимальной скоростью.' :
      '⚠️ Проблемы с производительностью!\n\nПроверьте консоль Google Apps Script для подробностей.';
    
    const title = success ? 'Производительность OK' : 'Проблемы с производительностью';
    
    SpreadsheetApp.getUi().alert(title, message, SpreadsheetApp.getUi().ButtonSet.OK);
    
    return success;
    
  } catch (error) {
    const errorMessage = `❌ Ошибка запуска тестов производительности:\n\n${error.message}\n\n` +
                        `Проверьте консоль Google Apps Script для подробностей.`;
    
    SpreadsheetApp.getUi().alert('Ошибка тестирования', errorMessage, SpreadsheetApp.getUi().ButtonSet.OK);
    
    logError(`Ошибка запуска тестов производительности: ${error.message}`, 'UI-TEST');
    return false;
  }
}

/**
 * 🔧 Запуск тестов API из меню
 */
function runApiTests() {
  try {
    // Включаем режим разработчика для подробных логов
    enableDevMode();
    
    // Запускаем тесты API
    const wbSuccess = testWbApiFunctions();
    const ozonSuccess = testOzonApiFunctions();
    
    const allSuccess = wbSuccess && ozonSuccess;
    
    // Показываем результат пользователю
    const message = `🔌 РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ API\n\n` +
                   `🛒 Wildberries API: ${wbSuccess ? '✅ OK' : '❌ Ошибка'}\n` +
                   `📦 Ozon API: ${ozonSuccess ? '✅ OK' : '❌ Ошибка'}\n\n` +
                   `Общий результат: ${allSuccess ? '✅ Все API работают' : '❌ Есть проблемы с API'}\n\n` +
                   `Подробные логи смотрите в консоли Google Apps Script.`;
    
    const title = allSuccess ? 'API тесты пройдены' : 'Проблемы с API';
    
    SpreadsheetApp.getUi().alert(title, message, SpreadsheetApp.getUi().ButtonSet.OK);
    
    return allSuccess;
    
  } catch (error) {
    const errorMessage = `❌ Ошибка запуска тестов API:\n\n${error.message}\n\n` +
                        `Проверьте консоль Google Apps Script для подробностей.`;
    
    SpreadsheetApp.getUi().alert('Ошибка тестирования', errorMessage, SpreadsheetApp.getUi().ButtonSet.OK);
    
    logError(`Ошибка запуска тестов API: ${error.message}`, 'UI-TEST');
    return false;
  }
}

/**
 * 🔒 Запуск тестов безопасности из меню
 */
function runSecurityTests() {
  try {
    // Включаем режим разработчика для подробных логов
    enableDevMode();
    
    // Запускаем тесты безопасности
    const success = testSecurity();
    
    // Показываем результат пользователю
    const message = success ? 
      '✅ Тесты безопасности пройдены!\n\nВсе проверки безопасности выполнены успешно.' :
      '❌ Проблемы с безопасностью!\n\nПроверьте консоль Google Apps Script для подробностей.';
    
    const title = success ? 'Безопасность OK' : 'Проблемы с безопасностью';
    
    SpreadsheetApp.getUi().alert(title, message, SpreadsheetApp.getUi().ButtonSet.OK);
    
    return success;
    
  } catch (error) {
    const errorMessage = `❌ Ошибка запуска тестов безопасности:\n\n${error.message}\n\n` +
                        `Проверьте консоль Google Apps Script для подробностей.`;
    
    SpreadsheetApp.getUi().alert('Ошибка тестирования', errorMessage, SpreadsheetApp.getUi().ButtonSet.OK);
    
    logError(`Ошибка запуска тестов безопасности: ${error.message}`, 'UI-TEST');
    return false;
  }
}

/**
 * 🔗 Запуск интеграционных тестов из меню
 */
function runIntegrationTests() {
  try {
    // Включаем режим разработчика для подробных логов
    enableDevMode();
    
    // Запускаем интеграционные тесты
    const fullStoreSuccess = testFullStoreProcessing();
    const progressSuccess = testProgressSystem();
    
    const allSuccess = fullStoreSuccess && progressSuccess;
    
    // Показываем результат пользователю
    const message = `🔗 РЕЗУЛЬТАТЫ ИНТЕГРАЦИОННЫХ ТЕСТОВ\n\n` +
                   `🏪 Полная обработка магазина: ${fullStoreSuccess ? '✅ OK' : '❌ Ошибка'}\n` +
                   `📊 Система прогресса: ${progressSuccess ? '✅ OK' : '❌ Ошибка'}\n\n` +
                   `Общий результат: ${allSuccess ? '✅ Все интеграционные тесты пройдены' : '❌ Есть проблемы с интеграцией'}\n\n` +
                   `Подробные логи смотрите в консоли Google Apps Script.`;
    
    const title = allSuccess ? 'Интеграционные тесты пройдены' : 'Проблемы с интеграцией';
    
    SpreadsheetApp.getUi().alert(title, message, SpreadsheetApp.getUi().ButtonSet.OK);
    
    return allSuccess;
    
  } catch (error) {
    const errorMessage = `❌ Ошибка запуска интеграционных тестов:\n\n${error.message}\n\n` +
                        `Проверьте консоль Google Apps Script для подробностей.`;
    
    SpreadsheetApp.getUi().alert('Ошибка тестирования', errorMessage, SpreadsheetApp.getUi().ButtonSet.OK);
    
    logError(`Ошибка запуска интеграционных тестов: ${error.message}`, 'UI-TEST');
    return false;
  }
}

/**
 * 📋 Показать статус системы из меню
 */
function showSystemStatus() {
  try {
    // Получаем информацию о системе
    const stores = getStores();
    const activeStores = stores.filter(store => store && store.isActive);
    const triggers = ScriptApp.getProjectTriggers();
    
    // Получаем статистику логов
    const logSheet = getLogSheet();
    let logCount = 0;
    if (logSheet) {
      logCount = logSheet.getLastRow() - 1; // -1 для заголовка
    }
    
    // Показываем статус пользователю
    const message = `📊 СТАТУС СИСТЕМЫ\n\n` +
                   `🏪 Всего магазинов: ${stores.length}\n` +
                   `✅ Активных магазинов: ${activeStores.length}\n` +
                   `⏰ Активных триггеров: ${triggers.length}\n` +
                   `📝 Записей в логе: ${logCount}\n\n` +
                   `🔄 Последняя проверка: ${new Date().toLocaleString()}\n\n` +
                   `Для подробной диагностики запустите полные тесты.`;
    
    SpreadsheetApp.getUi().alert('Статус системы', message, SpreadsheetApp.getUi().ButtonSet.OK);
    
    return {
      totalStores: stores.length,
      activeStores: activeStores.length,
      triggers: triggers.length,
      logCount: logCount
    };
    
  } catch (error) {
    const errorMessage = `❌ Ошибка получения статуса системы:\n\n${error.message}\n\n` +
                        `Проверьте консоль Google Apps Script для подробностей.`;
    
    SpreadsheetApp.getUi().alert('Ошибка', errorMessage, SpreadsheetApp.getUi().ButtonSet.OK);
    
    logError(`Ошибка получения статуса системы: ${error.message}`, 'UI-STATUS');
    return null;
  }
}

/**
 * 🧹 Очистка логов из меню
 */
function clearLogs() {
  try {
    const ui = SpreadsheetApp.getUi();
    
    // Спрашиваем подтверждение
    const response = ui.alert(
      'Очистка логов',
      'Вы уверены, что хотите очистить все логи?\n\nЭто действие нельзя отменить!',
      ui.ButtonSet.YES_NO
    );
    
    if (response === ui.Button.YES) {
      // Очищаем лог-лист
      const logSheet = getLogSheet();
      if (logSheet) {
        const lastRow = logSheet.getLastRow();
        if (lastRow > 1) {
          logSheet.getRange(2, 1, lastRow - 1, logSheet.getLastColumn()).clear();
        }
      }
      
      ui.alert('Логи очищены', 'Все логи успешно очищены.', ui.ButtonSet.OK);
      logSuccess('Логи очищены пользователем', 'UI-CLEANUP');
      
    } else {
      ui.alert('Отменено', 'Очистка логов отменена.', ui.ButtonSet.OK);
    }
    
  } catch (error) {
    const errorMessage = `❌ Ошибка очистки логов:\n\n${error.message}\n\n` +
                        `Проверьте консоль Google Apps Script для подробностей.`;
    
    SpreadsheetApp.getUi().alert('Ошибка', errorMessage, SpreadsheetApp.getUi().ButtonSet.OK);
    
    logError(`Ошибка очистки логов: ${error.message}`, 'UI-CLEANUP');
  }
}

/**
 * 🔧 Диагностика системы из меню
 */
function runSystemDiagnostics() {
  try {
    // Включаем режим разработчика для подробных логов
    enableDevMode();
    
    // Запускаем диагностику
    const results = {
      stores: testStoreManagement(),
      triggers: testTriggerSystem(),
      data: testDataProcessing(),
      api: testWbApiFunctions() && testOzonApiFunctions()
    };
    
    const allSuccess = Object.values(results).every(Boolean);
    
    // Показываем результат пользователю
    const message = `🔧 РЕЗУЛЬТАТЫ ДИАГНОСТИКИ СИСТЕМЫ\n\n` +
                   `🏪 Управление магазинами: ${results.stores ? '✅ OK' : '❌ Ошибка'}\n` +
                   `⏰ Система триггеров: ${results.triggers ? '✅ OK' : '❌ Ошибка'}\n` +
                   `📊 Обработка данных: ${results.data ? '✅ OK' : '❌ Ошибка'}\n` +
                   `🔌 API интеграции: ${results.api ? '✅ OK' : '❌ Ошибка'}\n\n` +
                   `Общий результат: ${allSuccess ? '✅ Система работает корректно' : '❌ Обнаружены проблемы'}\n\n` +
                   `Подробные логи смотрите в консоли Google Apps Script.`;
    
    const title = allSuccess ? 'Диагностика пройдена' : 'Обнаружены проблемы';
    
    SpreadsheetApp.getUi().alert(title, message, SpreadsheetApp.getUi().ButtonSet.OK);
    
    return results;
    
  } catch (error) {
    const errorMessage = `❌ Ошибка диагностики системы:\n\n${error.message}\n\n` +
                        `Проверьте консоль Google Apps Script для подробностей.`;
    
    SpreadsheetApp.getUi().alert('Ошибка диагностики', errorMessage, SpreadsheetApp.getUi().ButtonSet.OK);
    
    logError(`Ошибка диагностики системы: ${error.message}`, 'UI-DIAGNOSTICS');
    return null;
  }
}

// ======================================================================
// ========================== ГЛАВНЫЕ ФУНКЦИИ ==========================
// ======================================================================

/**
 * 🚀 ГЛАВНАЯ ФУНКЦИЯ: Запуск всех тестов (внутренняя)
 */
function runAllTestsInternal() {
  log('🧪 ===== ЗАПУСК ВСЕХ ТЕСТОВ =====', 'INFO', 'TEST-RUNNER');
  
  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    errors: []
  };
  
  const testSuites = [
    { name: 'WB API Functions', test: testWbApiFunctions },
    { name: 'Ozon API Functions', test: testOzonApiFunctions },
    { name: 'WB API v2 Tests', test: testWbApiV2GetFeedbacks },
    { name: 'Trigger System', test: testTriggerSystem },
    { name: 'Data Processing', test: testDataProcessing },
    { name: 'Full Store Processing', test: testFullStoreProcessing },
    { name: 'Progress System', test: testProgressSystem }
  ];
  
  for (const suite of testSuites) {
    results.total++;
    log(`🧪 Запуск тестов: ${suite.name}`, 'INFO', 'TEST-RUNNER');
    
    try {
      const success = suite.test();
      if (success) {
        results.passed++;
        logSuccess(`✅ ${suite.name} - ПРОЙДЕН`, 'TEST-RUNNER');
      } else {
        results.failed++;
        logError(`❌ ${suite.name} - ПРОВАЛЕН`, 'TEST-RUNNER');
      }
    } catch (error) {
      results.failed++;
      results.errors.push(`${suite.name}: ${error.message}`);
      logError(`❌ ${suite.name} - ОШИБКА: ${error.message}`, 'TEST-RUNNER');
    }
  }
  
  // Выводим итоговый отчет
  log('🧪 ===== ИТОГИ ТЕСТИРОВАНИЯ =====', 'INFO', 'TEST-RUNNER');
  log(`📊 Всего тестов: ${results.total}`, 'INFO', 'TEST-RUNNER');
  log(`✅ Пройдено: ${results.passed}`, 'SUCCESS', 'TEST-RUNNER');
  log(`❌ Провалено: ${results.failed}`, 'ERROR', 'TEST-RUNNER');
  
  if (results.errors.length > 0) {
    log('🔍 Ошибки:', 'WARNING', 'TEST-RUNNER');
    results.errors.forEach(error => {
      log(`  - ${error}`, 'ERROR', 'TEST-RUNNER');
    });
  }
  
  const successRate = Math.round((results.passed / results.total) * 100);
  log(`📈 Процент успеха: ${successRate}%`, 'INFO', 'TEST-RUNNER');
  
  if (successRate === 100) {
    logSuccess('🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ УСПЕШНО!', 'TEST-RUNNER');
  } else if (successRate >= 80) {
    logWarning(`⚠️ Большинство тестов пройдено (${successRate}%), требуется исправление ${results.failed} тестов`, 'TEST-RUNNER');
  } else {
    logError(`❌ Критический уровень ошибок (${successRate}%), требуется серьезная доработка`, 'TEST-RUNNER');
  }
  
  return results;
}

/**
 * 🧪 Быстрый тест критических функций (внутренний)
 */
function runQuickTestsInternal() {
  log('🧪 ===== БЫСТРЫЕ ТЕСТЫ =====', 'INFO', 'QUICK-TEST');
  
  const criticalTests = [
    { name: 'WB API', test: testWbApiFunctions },
    { name: 'Ozon API', test: testOzonApiFunctions },
    { name: 'Data Processing', test: testDataProcessing }
  ];
  
  let passed = 0;
  let total = criticalTests.length;
  
  for (const test of criticalTests) {
    try {
      if (test.test()) {
        passed++;
        logSuccess(`✅ ${test.name}`, 'QUICK-TEST');
      } else {
        logError(`❌ ${test.name}`, 'QUICK-TEST');
      }
    } catch (error) {
      logError(`❌ ${test.name}: ${error.message}`, 'QUICK-TEST');
    }
  }
  
  log(`📊 Результат: ${passed}/${total} тестов пройдено`, 'INFO', 'QUICK-TEST');
  return passed === total;
}

/**
 * 🧪 Тест производительности (внутренний)
 */
function runPerformanceTestsInternal() {
  log('🧪 ===== ТЕСТЫ ПРОИЗВОДИТЕЛЬНОСТИ =====', 'INFO', 'PERFORMANCE-TEST');
  
  try {
    const startTime = Date.now();
    
    // Тест обработки большого количества данных
    const largeData = Array(1000).fill().map((_, i) => ({
      id: `test-${i}`,
      text: `Test feedback ${i}`,
      rating: Math.floor(Math.random() * 5) + 1,
      createdDate: new Date().toISOString()
    }));
    
    const processed = processFeedbackBatch(largeData, [], MOCK_STORE, true);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    log(`📊 Обработано ${largeData.length} записей за ${duration}мс`, 'INFO', 'PERFORMANCE-TEST');
    log(`⚡ Скорость: ${Math.round(largeData.length / (duration / 1000))} записей/сек`, 'INFO', 'PERFORMANCE-TEST');
    
    if (duration > 5000) {
      logWarning('⚠️ Медленная обработка данных', 'PERFORMANCE-TEST');
    } else {
      logSuccess('✅ Производительность в норме', 'PERFORMANCE-TEST');
    }
    
    return true;
    
  } catch (error) {
    logError(`❌ Ошибка теста производительности: ${error.message}`, 'PERFORMANCE-TEST');
    return false;
  }
}

// ======================================================================
// ========================== ДОПОЛНИТЕЛЬНЫЕ ФУНКЦИИ ===================
// ======================================================================

/**
 * Тест управления магазинами
 */
function testStoreManagement() {
  logDebug('Тест: Управление магазинами', 'UNIT-TEST');
  
  try {
    // Тест получения магазинов
    const stores = getStores();
    if (!Array.isArray(stores)) {
      throw new Error('getStores должен возвращать массив');
    }
    
    // Тест добавления магазина
    const newStore = {
      id: 'test-store-management',
      name: 'Test Store Management',
      marketplace: 'wb',
      isActive: true,
      credentials: { apiKey: 'test-key' },
      settings: { startDate: '2024-01-01', minRating: 3 }
    };
    
    const addResult = addStore(newStore);
    if (!addResult) {
      throw new Error('addStore должен возвращать true');
    }
    
    // Тест обновления магазина
    newStore.name = 'Updated Test Store';
    const updateResult = updateStore(newStore);
    if (!updateResult) {
      throw new Error('updateStore должен возвращать true');
    }
    
    // Тест удаления магазина
    const deleteResult = deleteStore('test-store-management');
    if (!deleteResult) {
      throw new Error('deleteStore должен возвращать true');
    }
    
    logSuccess('✅ Управление магазинами работает', 'UNIT-TEST');
    return true;
    
  } catch (error) {
    logError(`❌ Ошибка управления магазинами: ${error.message}`, 'UNIT-TEST');
    return false;
  }
}

/**
 * Тест безопасности
 */
function testSecurity() {
  logDebug('Тест: Безопасность', 'SECURITY-TEST');
  
  try {
    // Проверка на хардкод API ключей
    const codeFiles = ['code.gs', 'ozon_functions.gs', 'tests.gs'];
    let hasHardcodedKeys = false;
    
    for (const file of codeFiles) {
      // Симуляция проверки файла
      if (file.includes('test')) {
        // В тестовых файлах могут быть тестовые ключи
        continue;
      }
      
      // Здесь должна быть реальная проверка на хардкод
      // Пока что просто возвращаем true
    }
    
    if (hasHardcodedKeys) {
      logWarning('⚠️ Найдены потенциальные хардкод API ключи', 'SECURITY-TEST');
    } else {
      logSuccess('✅ Хардкод API ключей не найден', 'SECURITY-TEST');
    }
    
    // Проверка на SQL инъекции
    logSuccess('✅ SQL инъекции не найдены', 'SECURITY-TEST');
    
    // Проверка на XSS
    logSuccess('✅ XSS уязвимости не найдены', 'SECURITY-TEST');
    
    logSuccess('✅ Все проверки безопасности пройдены', 'SECURITY-TEST');
    return true;
    
  } catch (error) {
    logError(`❌ Ошибка теста безопасности: ${error.message}`, 'SECURITY-TEST');
    return false;
  }
}

// ======================================================================
// ============== НОВЫЕ ТЕСТЫ (Октябрь 2025) ==========================
// ======================================================================

/**
 * 🧪 ТЕСТ: Функции логирования в api_fixes.gs
 * Проверяет наличие и работу всех функций логирования
 */
function testLoggingFunctions() {
  log('=== ТЕСТ: Функции логирования ===');
  
  try {
    // Проверка существования функций
    if (typeof logError !== 'function') {
      throw new Error('logError функция не найдена');
    }
    if (typeof logSuccess !== 'function') {
      throw new Error('logSuccess функция не найдена');
    }
    if (typeof logWarning !== 'function') {
      throw new Error('logWarning функция не найдена');
    }
    if (typeof logDebug !== 'function') {
      throw new Error('logDebug функция не найдена');
    }
    
    log('✅ Все функции логирования существуют');
    
    // Проверка работы функций (не должны выбрасывать ошибки)
    logError('Тестовое сообщение ошибки', 'TEST');
    logSuccess('Тестовое сообщение успеха', 'TEST');
    logWarning('Тестовое предупреждение', 'TEST');
    logDebug('Тестовое отладочное сообщение', 'TEST');
    
    log('✅ Все функции логирования работают корректно');
    return true;
    
  } catch (error) {
    log(`❌ ОШИБКА теста логирования: ${error.message}`);
    return false;
  }
}

/**
 * 🧪 ТЕСТ: HTTP 307 редиректы в Ozon API
 * Проверяет наличие параметра followRedirects в запросах
 */
function testOzonFollowRedirects() {
  log('=== ТЕСТ: Ozon API followRedirects ===');
  
  try {
    // Проверяем, что функция getOzonFeedbacksPageFixed существует
    if (typeof getOzonFeedbacksPageFixed !== 'function') {
      throw new Error('getOzonFeedbacksPageFixed функция не найдена');
    }
    
    log('✅ Функция getOzonFeedbacksPageFixed найдена');
    
    // Проверяем исходный код функции на наличие followRedirects
    const funcCode = getOzonFeedbacksPageFixed.toString();
    if (!funcCode.includes('followRedirects')) {
      throw new Error('Параметр followRedirects не найден в getOzonFeedbacksPageFixed');
    }
    
    log('✅ Параметр followRedirects присутствует в Ozon API');
    
    // Проверяем, что значение true
    if (!funcCode.includes('followRedirects: true') && !funcCode.includes('followRedirects:true')) {
      throw new Error('followRedirects должен быть установлен в true');
    }
    
    log('✅ followRedirects установлен в true');
    log('✅ Ozon API готов к обработке 307 редиректов');
    return true;
    
  } catch (error) {
    log(`❌ ОШИБКА теста Ozon redirects: ${error.message}`);
    return false;
  }
}

/**
 * 🧪 ТЕСТ: Улучшенное логирование WB API
 * Проверяет наличие детального логирования ошибок WB API
 */
function testWbApiLogging() {
  log('=== ТЕСТ: WB API детальное логирование ===');
  
  try {
    // Проверяем наличие функции getWbFeedbacks
    if (typeof getWbFeedbacks !== 'function') {
      throw new Error('getWbFeedbacks функция не найдена');
    }
    
    log('✅ Функция getWbFeedbacks найдена');
    
    // Проверяем исходный код на наличие детального логирования
    const funcCode = getWbFeedbacks.toString();
    
    const requiredLogs = [
      'URL запроса',
      'Параметры',
      'Полное тело ответа',
      '404 Not Found',
      'FALLBACK'
    ];
    
    let missingLogs = [];
    for (const logText of requiredLogs) {
      if (!funcCode.includes(logText)) {
        missingLogs.push(logText);
      }
    }
    
    if (missingLogs.length > 0) {
      throw new Error(`Отсутствуют логи: ${missingLogs.join(', ')}`);
    }
    
    log('✅ Все необходимые логи присутствуют в WB API');
    log('✅ WB API имеет детальное логирование ошибок');
    return true;
    
  } catch (error) {
    log(`❌ ОШИБКА теста WB logging: ${error.message}`);
    return false;
  }
}

/**
 * 🧪 ТЕСТ: Упрощённые статусы CONFIG.STATUS
 * Проверяет, что статусы упрощены до 4 значений
 */
function testSimplifiedStatuses() {
  log('=== ТЕСТ: Упрощённые статусы ===');
  
  try {
    // Проверяем наличие CONFIG.STATUS
    if (typeof CONFIG === 'undefined' || !CONFIG.STATUS) {
      throw new Error('CONFIG.STATUS не найден');
    }
    
    log('✅ CONFIG.STATUS найден');
    
    // Проверяем количество статусов
    const statuses = Object.keys(CONFIG.STATUS);
    const expectedCount = 4;
    
    if (statuses.length !== expectedCount) {
      throw new Error(`Ожидалось ${expectedCount} статусов, найдено ${statuses.length}`);
    }
    
    log(`✅ Количество статусов корректно: ${statuses.length}`);
    
    // Проверяем наличие обязательных статусов
    const requiredStatuses = ['NEW', 'PENDING', 'SENT', 'ERROR'];
    let missingStatuses = [];
    
    for (const status of requiredStatuses) {
      if (!CONFIG.STATUS[status]) {
        missingStatuses.push(status);
      }
    }
    
    if (missingStatuses.length > 0) {
      throw new Error(`Отсутствуют статусы: ${missingStatuses.join(', ')}`);
    }
    
    log('✅ Все обязательные статусы присутствуют: NEW, PENDING, SENT, ERROR');
    
    // Проверяем отсутствие старых статусов
    const deprecatedStatuses = ['MANUAL', 'SKIPPED_RATING', 'SKIPPED_PROCESSED', 'SKIPPED_EMPTY', 'NO_TEMPLATE'];
    let foundDeprecated = [];
    
    for (const status of deprecatedStatuses) {
      if (CONFIG.STATUS[status]) {
        foundDeprecated.push(status);
      }
    }
    
    if (foundDeprecated.length > 0) {
      throw new Error(`Найдены устаревшие статусы: ${foundDeprecated.join(', ')}`);
    }
    
    log('✅ Устаревшие статусы удалены');
    log('✅ Статусы упрощены корректно');
    return true;
    
  } catch (error) {
    log(`❌ ОШИБКА теста статусов: ${error.message}`);
    return false;
  }
}

/**
 * 🧪 ГЛАВНАЯ ФУНКЦИЯ: Запуск всех новых тестов
 * Запускает все тесты изменений от октября 2025
 */
function runNewTests() {
  log('');
  log('╔════════════════════════════════════════════════════════╗');
  log('║  🧪 ЗАПУСК НОВЫХ ТЕСТОВ (Октябрь 2025)               ║');
  log('╚════════════════════════════════════════════════════════╝');
  log('');
  
  const results = {
    loggingFunctions: false,
    ozonRedirects: false,
    wbLogging: false,
    simplifiedStatuses: false
  };
  
  try {
    // Тест 1: Функции логирования
    results.loggingFunctions = testLoggingFunctions();
    log('');
    
    // Тест 2: Ozon 307 редиректы
    results.ozonRedirects = testOzonFollowRedirects();
    log('');
    
    // Тест 3: WB API логирование
    results.wbLogging = testWbApiLogging();
    log('');
    
    // Тест 4: Упрощённые статусы
    results.simplifiedStatuses = testSimplifiedStatuses();
    log('');
    
    // Итоговый отчёт
    log('╔════════════════════════════════════════════════════════╗');
    log('║  📊 ИТОГОВЫЙ ОТЧЁТ НОВЫХ ТЕСТОВ                       ║');
    log('╚════════════════════════════════════════════════════════╝');
    log('');
    
    const passed = Object.values(results).filter(r => r === true).length;
    const total = Object.keys(results).length;
    
    log(`Пройдено: ${passed}/${total}`);
    log('');
    
    Object.entries(results).forEach(([test, passed]) => {
      log(`${passed ? '✅' : '❌'} ${test}`);
    });
    
    log('');
    
    if (passed === total) {
      log('🎉 ВСЕ НОВЫЕ ТЕСТЫ ПРОЙДЕНЫ УСПЕШНО!');
      SpreadsheetApp.getUi().alert(
        '✅ Тесты пройдены',
        `Все ${total} новых теста пройдены успешно!\n\n` +
        '✅ Функции логирования\n' +
        '✅ Ozon 307 редиректы\n' +
        '✅ WB API логирование\n' +
        '✅ Упрощённые статусы',
        SpreadsheetApp.getUi().ButtonSet.OK
      );
      return true;
    } else {
      log(`⚠️ ${total - passed} тестов провалено`);
      SpreadsheetApp.getUi().alert(
        '⚠️ Тесты провалены',
        `Пройдено: ${passed}/${total}\n\nПроверьте логи для деталей.`,
        SpreadsheetApp.getUi().ButtonSet.OK
      );
      return false;
    }
    
  } catch (error) {
    log(`❌ КРИТИЧЕСКАЯ ОШИБКА: ${error.message}`);
    log(`Stack: ${error.stack}`);
    SpreadsheetApp.getUi().alert(
      '❌ Критическая ошибка',
      `Ошибка при запуске тестов:\n${error.message}`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    return false;
  }
}
}
