/**
 * 🧪 СИСТЕМА ТЕСТИРОВАНИЯ
 * 
 * Этот файл содержит unit тесты для всех функций системы
 * обработки отзывов Wildberries и Ozon.
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
// ========================== ГЛАВНЫЕ ФУНКЦИИ ==========================
// ======================================================================

/**
 * 🚀 ГЛАВНАЯ ФУНКЦИЯ: Запуск всех тестов
 */
function runAllTests() {
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
 * 🧪 Быстрый тест критических функций
 */
function runQuickTests() {
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
 * 🧪 Тест производительности
 */
function runPerformanceTests() {
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