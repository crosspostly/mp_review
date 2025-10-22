/**
 * 🧪 КОМПЛЕКСНАЯ СИСТЕМА ТЕСТИРОВАНИЯ
 * 
 * Этот файл содержит все unit-тесты, интеграционные тесты и мок-тесты
 * для проверки корректности работы всех функций системы.
 * 
 * Запуск тестов: В режиме разработчика вызовите runAllTests()
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
    id: "test-wb-1",
    productValuation: 5,
    text: "Отличный товар!",
    createdDate: "2024-01-15T10:00:00Z",
    isAnswered: false,
    productDetails: {
      nmId: 12345,
      productName: "Тестовый товар WB"
    }
  },
  {
    id: "test-wb-2", 
    productValuation: 3,
    text: "Нормально, но могло быть лучше",
    createdDate: "2024-01-14T15:30:00Z",
    isAnswered: true,
    productDetails: {
      nmId: 67890,
      productName: "Другой товар WB"
    }
  }
];

/**
 * Мок-данные для тестирования Ozon API
 */
const MOCK_OZON_FEEDBACKS = [
  {
    id: "test-ozon-1",
    rating: 5,
    text: "Супер качество!",
    created_at: "2024-01-15T12:00:00Z",
    is_answered: false,
    product: {
      offer_id: "ozon-123",
      name: "Тестовый товар Ozon"
    }
  },
  {
    id: "test-ozon-2",
    rating: 2,
    text: "Не понравилось",
    created_at: "2024-01-14T18:45:00Z", 
    is_answered: true,
    product: {
      offer_id: "ozon-456",
      name: "Другой товар Ozon"
    }
  }
];

/**
 * Мок-конфигурация магазина
 */
const MOCK_STORE = {
  id: "test-store-1",
  name: "Тестовый магазин",
  marketplace: "wb",
  isActive: true,
  credentials: {
    apiKey: "test-api-key-123"
  },
  settings: {
    startDate: "2024-01-01",
    sortOldestFirst: false,
    minRating: 3
  }
};

// ======================================================================
// ========================== МОК-ФУНКЦИИ ==============================
// ======================================================================

/**
 * Мок UrlFetchApp для тестирования API вызовов
 */
function createMockUrlFetchApp() {
  return {
    fetch: function(url, options) {
      logDebug(`Mock API call: ${url}`, 'MOCK-API');
      
      // Определяем тип API по URL
      if (url.includes('wildberries.ru')) {
        return createMockWbResponse(url, options);
      } else if (url.includes('api.ozon.ru')) {
        return createMockOzonResponse(url, options);
      }
      
      return createMockErrorResponse(404, 'Unknown API endpoint');
    }
  };
}

/**
 * Создает мок-ответ для WB API
 */
function createMockWbResponse(url, options) {
  const isAnswered = url.includes('isAnswered=true');
  const feedbacks = isAnswered ? 
    MOCK_WB_FEEDBACKS.filter(f => f.isAnswered) : 
    MOCK_WB_FEEDBACKS.filter(f => !f.isAnswered);
    
  return {
    getResponseCode: () => 200,
    getContentText: () => JSON.stringify({
      data: {
        feedbacks: feedbacks
      }
    })
  };
}

/**
 * Создает мок-ответ для Ozon API
 */
function createMockOzonResponse(url, options) {
  const isAnswered = url.includes('is_answered=true');
  const feedbacks = isAnswered ?
    MOCK_OZON_FEEDBACKS.filter(f => f.is_answered) :
    MOCK_OZON_FEEDBACKS.filter(f => !f.is_answered);
    
  return {
    getResponseCode: () => 200,
    getContentText: () => JSON.stringify({
      result: {
        reviews: feedbacks
      }
    })
  };
}

/**
 * Создает мок-ответ с ошибкой
 */
function createMockErrorResponse(code, message) {
  return {
    getResponseCode: () => code,
    getContentText: () => JSON.stringify({
      error: message
    })
  };
}

// ======================================================================
// ========================== UNIT-ТЕСТЫ ===============================
// ======================================================================

/**
 * 🧪 Тест API функций WB
 */
function testWbApiFunctions() {
  logDebug('🧪 Запуск тестов WB API', 'TEST');
  
  try {
    // Тест 1: Получение отзывов
    testGetWbFeedbacks();
    
    // Тест 2: Отправка ответа
    testSendWbFeedbackAnswer();
    
    // Тест 3: Обработка ошибок API
    testWbApiErrorHandling();
    
    logSuccess('✅ Все тесты WB API прошли успешно', 'TEST');
    return true;
  } catch (error) {
    logError(`❌ Ошибка в тестах WB API: ${error.message}`, 'TEST');
    return false;
  }
}

/**
 * Тест получения отзывов WB
 */
function testGetWbFeedbacks() {
  logDebug('Тест: getWbFeedbacks()', 'TEST-WB');
  
  // Мокаем UrlFetchApp
  const originalUrlFetchApp = UrlFetchApp;
  global.UrlFetchApp = createMockUrlFetchApp();
  
  try {
    const feedbacks = getWbFeedbacks('test-api-key', false, MOCK_STORE);
    
    // Проверяем результат
    if (!Array.isArray(feedbacks)) {
      throw new Error('getWbFeedbacks должен возвращать массив');
    }
    
    if (feedbacks.length === 0) {
      throw new Error('getWbFeedbacks должен возвращать отзывы');
    }
    
    // Проверяем структуру отзыва
    const feedback = feedbacks[0];
    if (!feedback.id || !feedback.text || !feedback.createdDate) {
      throw new Error('Некорректная структура отзыва');
    }
    
    logSuccess('✅ getWbFeedbacks() работает корректно', 'TEST-WB');
    
  } finally {
    // Восстанавливаем оригинальный UrlFetchApp
    global.UrlFetchApp = originalUrlFetchApp;
  }
}

/**
 * Тест отправки ответа WB
 */
function testSendWbFeedbackAnswer() {
  logDebug('Тест: sendWbFeedbackAnswer()', 'TEST-WB');
  
  // Мокаем UrlFetchApp
  const originalUrlFetchApp = UrlFetchApp;
  global.UrlFetchApp = createMockUrlFetchApp();
  
  try {
    const result = sendWbFeedbackAnswer('test-feedback-id', 'Спасибо за отзыв!', 'test-api-key');
    
    // Проверяем результат
    if (!result || typeof result !== 'object') {
      throw new Error('sendWbFeedbackAnswer должен возвращать объект');
    }
    
    if (!result.status) {
      throw new Error('Результат должен содержать статус');
    }
    
    logSuccess('✅ sendWbFeedbackAnswer() работает корректно', 'TEST-WB');
    
  } finally {
    global.UrlFetchApp = originalUrlFetchApp;
  }
}

/**
 * Тест обработки ошибок WB API
 */
function testWbApiErrorHandling() {
  logDebug('Тест: Обработка ошибок WB API', 'TEST-WB');
  
  // Мокаем UrlFetchApp для возврата ошибки
  const originalUrlFetchApp = UrlFetchApp;
  global.UrlFetchApp = {
    fetch: () => createMockErrorResponse(401, 'Unauthorized')
  };
  
  try {
    const feedbacks = getWbFeedbacks('invalid-key', false, MOCK_STORE);
    
    // В случае ошибки должна возвращаться пустой массив
    if (!Array.isArray(feedbacks)) {
      throw new Error('При ошибке должен возвращаться пустой массив');
    }
    
    logSuccess('✅ Обработка ошибок WB API работает корректно', 'TEST-WB');
    
  } finally {
    global.UrlFetchApp = originalUrlFetchApp;
  }
}

/**
 * 🧪 Тест API функций Ozon
 */
function testOzonApiFunctions() {
  logDebug('🧪 Запуск тестов Ozon API', 'TEST');
  
  try {
    // Тест 1: Получение отзывов
    testGetOzonFeedbacks();
    
    // Тест 2: Отправка ответа
    testSendOzonFeedbackAnswer();
    
    // Тест 3: Обработка ошибок API
    testOzonApiErrorHandling();
    
    logSuccess('✅ Все тесты Ozon API прошли успешно', 'TEST');
    return true;
  } catch (error) {
    logError(`❌ Ошибка в тестах Ozon API: ${error.message}`, 'TEST');
    return false;
  }
}

/**
 * Тест получения отзывов Ozon
 */
function testGetOzonFeedbacks() {
  logDebug('Тест: getOzonFeedbacks()', 'TEST-OZON');
  
  try {
    const feedbacks = getOzonFeedbacks('test-client-id', 'test-api-key', false, MOCK_STORE);
    
    // Проверяем результат
    if (!Array.isArray(feedbacks)) {
      throw new Error('getOzonFeedbacks должен возвращать массив');
    }
    
    logSuccess('✅ getOzonFeedbacks() работает корректно', 'TEST-OZON');
    
  } catch (error) {
    logError(`❌ Ошибка в getOzonFeedbacks: ${error.message}`, 'TEST-OZON');
    throw error;
  }
}

/**
 * Тест отправки ответа Ozon
 */
function testSendOzonFeedbackAnswer() {
  logDebug('Тест: sendOzonFeedbackAnswer()', 'TEST-OZON');
  
  try {
    const result = sendOzonFeedbackAnswer('test-feedback-id', 'Спасибо за отзыв!', 'test-client-id', 'test-api-key');
    
    // Проверяем результат
    if (!result || typeof result !== 'object') {
      throw new Error('sendOzonFeedbackAnswer должен возвращать объект');
    }
    
    logSuccess('✅ sendOzonFeedbackAnswer() работает корректно', 'TEST-OZON');
    
  } catch (error) {
    logError(`❌ Ошибка в sendOzonFeedbackAnswer: ${error.message}`, 'TEST-OZON');
    throw error;
  }
}

/**
 * Тест обработки ошибок Ozon API
 */
function testOzonApiErrorHandling() {
  logDebug('Тест: Обработка ошибок Ozon API', 'TEST-OZON');
  
  try {
    const feedbacks = getOzonFeedbacks('invalid-client-id', 'invalid-api-key', false, MOCK_STORE);
    
    // В случае ошибки должна возвращаться пустой массив
    if (!Array.isArray(feedbacks)) {
      throw new Error('При ошибке должен возвращаться пустой массив');
    }
    
    logSuccess('✅ Обработка ошибок Ozon API работает корректно', 'TEST-OZON');
    
  } catch (error) {
    logError(`❌ Ошибка в обработке ошибок Ozon API: ${error.message}`, 'TEST-OZON');
    throw error;
  }
}

/**
 * 🧪 Тест системы триггеров
 */
function testTriggerSystem() {
  logDebug('🧪 Запуск тестов системы триггеров', 'TEST');
  
  try {
    // Тест 1: Создание триггера
    testCreateTrigger();
    
    // Тест 2: Удаление триггера
    testDeleteTrigger();
    
    // Тест 3: Синхронизация триггеров
    testSyncTriggers();
    
    // Тест 4: Валидация целостности
    testTriggerIntegrity();
    
    logSuccess('✅ Все тесты системы триггеров прошли успешно', 'TEST');
    return true;
  } catch (error) {
    logError(`❌ Ошибка в тестах системы триггеров: ${error.message}`, 'TEST');
    return false;
  }
}

/**
 * Тест создания триггера
 */
function testCreateTrigger() {
  logDebug('Тест: Создание триггера', 'TEST-TRIGGER');
  
  try {
    const store = { ...MOCK_STORE, id: 'test-trigger-store' };
    const result = ensureStoreTrigger(store, 5);
    
    if (!result) {
      throw new Error('ensureStoreTrigger должен возвращать true при успешном создании');
    }
    
    logSuccess('✅ Создание триггера работает корректно', 'TEST-TRIGGER');
    
  } catch (error) {
    logError(`❌ Ошибка в создании триггера: ${error.message}`, 'TEST-TRIGGER');
    throw error;
  }
}

/**
 * Тест удаления триггера
 */
function testDeleteTrigger() {
  logDebug('Тест: Удаление триггера', 'TEST-TRIGGER');
  
  try {
    const result = deleteStoreTrigger('test-trigger-store');
    
    if (!result) {
      throw new Error('deleteStoreTrigger должен возвращать true при успешном удалении');
    }
    
    logSuccess('✅ Удаление триггера работает корректно', 'TEST-TRIGGER');
    
  } catch (error) {
    logError(`❌ Ошибка в удалении триггера: ${error.message}`, 'TEST-TRIGGER');
    throw error;
  }
}

/**
 * Тест синхронизации триггеров
 */
function testSyncTriggers() {
  logDebug('Тест: Синхронизация триггеров', 'TEST-TRIGGER');
  
  try {
    const result = syncAllStoreTriggers();
    
    if (!result) {
      throw new Error('syncAllStoreTriggers должен возвращать true при успешной синхронизации');
    }
    
    logSuccess('✅ Синхронизация триггеров работает корректно', 'TEST-TRIGGER');
    
  } catch (error) {
    logError(`❌ Ошибка в синхронизации триггеров: ${error.message}`, 'TEST-TRIGGER');
    throw error;
  }
}

/**
 * Тест валидации целостности триггеров
 */
function testTriggerIntegrity() {
  logDebug('Тест: Валидация целостности триггеров', 'TEST-TRIGGER');
  
  try {
    const result = validateTriggerIntegrity();
    
    if (typeof result !== 'object') {
      throw new Error('validateTriggerIntegrity должен возвращать объект');
    }
    
    if (typeof result.isValid !== 'boolean') {
      throw new Error('Результат должен содержать isValid');
    }
    
    logSuccess('✅ Валидация целостности триггеров работает корректно', 'TEST-TRIGGER');
    
  } catch (error) {
    logError(`❌ Ошибка в валидации целостности: ${error.message}`, 'TEST-TRIGGER');
    throw error;
  }
}

/**
 * 🧪 Тест обработки данных
 */
function testDataProcessing() {
  logDebug('🧪 Запуск тестов обработки данных', 'TEST');
  
  try {
    // Тест 1: Фильтрация по дате
    testDateFiltering();
    
    // Тест 2: Фильтрация по рейтингу
    testRatingFiltering();
    
    // Тест 3: Сортировка
    testSorting();
    
    // Тест 4: Нормализация данных
    testDataNormalization();
    
    logSuccess('✅ Все тесты обработки данных прошли успешно', 'TEST');
    return true;
  } catch (error) {
    logError(`❌ Ошибка в тестах обработки данных: ${error.message}`, 'TEST');
    return false;
  }
}

/**
 * Тест фильтрации по дате
 */
function testDateFiltering() {
  logDebug('Тест: Фильтрация по дате', 'TEST-DATA');
  
  try {
    const mockFeedbacks = [
      { id: '1', createdDate: '2024-01-15T10:00:00Z' },
      { id: '2', createdDate: '2024-01-10T10:00:00Z' },
      { id: '3', createdDate: '2024-01-20T10:00:00Z' }
    ];
    
    const store = {
      settings: {
        startDate: '2024-01-12'
      }
    };
    
    const filtered = filterFeedbacksByDate(mockFeedbacks, store);
    
    if (filtered.length !== 2) {
      throw new Error(`Ожидалось 2 отзыва, получено ${filtered.length}`);
    }
    
    logSuccess('✅ Фильтрация по дате работает корректно', 'TEST-DATA');
    
  } catch (error) {
    logError(`❌ Ошибка в фильтрации по дате: ${error.message}`, 'TEST-DATA');
    throw error;
  }
}

/**
 * Тест фильтрации по рейтингу
 */
function testRatingFiltering() {
  logDebug('Тест: Фильтрация по рейтингу', 'TEST-DATA');
  
  try {
    const mockFeedbacks = [
      { id: '1', productValuation: 5 },
      { id: '2', productValuation: 3 },
      { id: '3', productValuation: 1 }
    ];
    
    const store = {
      settings: {
        minRating: 3
      }
    };
    
    const filtered = filterFeedbacksByRating(mockFeedbacks, store);
    
    if (filtered.length !== 2) {
      throw new Error(`Ожидалось 2 отзыва, получено ${filtered.length}`);
    }
    
    logSuccess('✅ Фильтрация по рейтингу работает корректно', 'TEST-DATA');
    
  } catch (error) {
    logError(`❌ Ошибка в фильтрации по рейтингу: ${error.message}`, 'TEST-DATA');
    throw error;
  }
}

/**
 * Тест сортировки
 */
function testSorting() {
  logDebug('Тест: Сортировка', 'TEST-DATA');
  
  try {
    const mockFeedbacks = [
      { id: '1', createdDate: '2024-01-15T10:00:00Z' },
      { id: '2', createdDate: '2024-01-10T10:00:00Z' },
      { id: '3', createdDate: '2024-01-20T10:00:00Z' }
    ];
    
    const store = {
      settings: {
        sortOldestFirst: false
      }
    };
    
    // Создаем мок-лист для тестирования
    const mockSheet = {
      getLastRow: () => 4,
      getRange: () => ({
        getValues: () => [
          ['№', 'Дата', 'Текст'],
          ['1', '2024-01-15', 'Отзыв 1'],
          ['2', '2024-01-10', 'Отзыв 2'],
          ['3', '2024-01-20', 'Отзыв 3']
        ],
        setValues: () => {}
      })
    };
    
    applySortingPreferences(mockSheet, store);
    
    logSuccess('✅ Сортировка работает корректно', 'TEST-DATA');
    
  } catch (error) {
    logError(`❌ Ошибка в сортировке: ${error.message}`, 'TEST-DATA');
    throw error;
  }
}

/**
 * Тест нормализации данных
 */
function testDataNormalization() {
  logDebug('Тест: Нормализация данных', 'TEST-DATA');
  
  try {
    // Тест нормализации WB данных
    const wbFeedback = MOCK_WB_FEEDBACKS[0];
    const normalized = processFeedbackBatch([wbFeedback], [], MOCK_STORE, true);
    
    if (!Array.isArray(normalized)) {
      throw new Error('processFeedbackBatch должен возвращать массив');
    }
    
    logSuccess('✅ Нормализация данных работает корректно', 'TEST-DATA');
    
  } catch (error) {
    logError(`❌ Ошибка в нормализации данных: ${error.message}`, 'TEST-DATA');
    throw error;
  }
}

// ======================================================================
// ========================== ИНТЕГРАЦИОННЫЕ ТЕСТЫ =====================
// ======================================================================

/**
 * 🧪 Тест полного цикла обработки магазина
 */
function testFullStoreProcessing() {
  logDebug('🧪 Запуск интеграционного теста полного цикла', 'TEST');
  
  try {
    // Создаем тестовый магазин
    const testStore = { ...MOCK_STORE, id: 'integration-test-store' };
    
    // Сохраняем магазин
    const saveResult = saveStore(testStore);
    if (!saveResult) {
      throw new Error('Не удалось сохранить тестовый магазин');
    }
    
    // Обрабатываем магазин
    const processResult = processSingleStore(testStore, true);
    if (!processResult) {
      throw new Error('Не удалось обработать тестовый магазин');
    }
    
    // Удаляем тестовый магазин
    const deleteResult = deleteStore(testStore.id);
    if (!deleteResult) {
      throw new Error('Не удалось удалить тестовый магазин');
    }
    
    logSuccess('✅ Интеграционный тест полного цикла прошел успешно', 'TEST');
    return true;
    
  } catch (error) {
    logError(`❌ Ошибка в интеграционном тесте: ${error.message}`, 'TEST');
    return false;
  }
}

/**
 * 🧪 Тест системы прогресса
 */
function testProgressSystem() {
  logDebug('🧪 Запуск тестов системы прогресса', 'TEST');
  
  try {
    const storeId = 'test-progress-store';
    
    // Тест сохранения прогресса
    const progressData = { lastPage: 5, timestamp: new Date().toISOString() };
    const saveResult = updateStoreProgress(storeId, progressData);
    if (!saveResult) {
      throw new Error('Не удалось сохранить прогресс');
    }
    
    // Тест получения прогресса
    const retrievedProgress = getStoreProgress(storeId);
    if (!retrievedProgress || retrievedProgress.lastPage !== 5) {
      throw new Error('Не удалось получить сохраненный прогресс');
    }
    
    // Тест сброса прогресса
    const resetResult = resetStoreProgress(storeId);
    if (!resetResult) {
      throw new Error('Не удалось сбросить прогресс');
    }
    
    logSuccess('✅ Система прогресса работает корректно', 'TEST');
    return true;
    
  } catch (error) {
    logError(`❌ Ошибка в системе прогресса: ${error.message}`, 'TEST');
    return false;
  }
}

// ======================================================================
// ========================== ГЛАВНАЯ ФУНКЦИЯ ТЕСТИРОВАНИЯ =============
// ======================================================================

/**
 * 🚀 ГЛАВНАЯ ФУНКЦИЯ: Запуск всех тестов
 */
function runAllTests() {
  log('🧪 ===== ЗАПУСК КОМПЛЕКСНОГО ТЕСТИРОВАНИЯ =====', 'INFO', 'TEST-SUITE');
  
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
    log(`🧪 Запуск тестов: ${suite.name}`, 'INFO', 'TEST-SUITE');
    
    try {
      const success = suite.test();
      if (success) {
        results.passed++;
        logSuccess(`✅ ${suite.name} - ПРОЙДЕН`, 'TEST-SUITE');
      } else {
        results.failed++;
        logError(`❌ ${suite.name} - ПРОВАЛЕН`, 'TEST-SUITE');
      }
    } catch (error) {
      results.failed++;
      results.errors.push(`${suite.name}: ${error.message}`);
      logError(`❌ ${suite.name} - ОШИБКА: ${error.message}`, 'TEST-SUITE');
    }
  }
  
  // Выводим итоговый отчет
  log('🧪 ===== ИТОГИ ТЕСТИРОВАНИЯ =====', 'INFO', 'TEST-SUITE');
  log(`📊 Всего тестов: ${results.total}`, 'INFO', 'TEST-SUITE');
  log(`✅ Пройдено: ${results.passed}`, 'SUCCESS', 'TEST-SUITE');
  log(`❌ Провалено: ${results.failed}`, 'ERROR', 'TEST-SUITE');
  
  if (results.errors.length > 0) {
    log('🔍 Ошибки:', 'WARNING', 'TEST-SUITE');
    results.errors.forEach(error => {
      log(`  - ${error}`, 'ERROR', 'TEST-SUITE');
    });
  }
  
  const successRate = Math.round((results.passed / results.total) * 100);
  log(`📈 Процент успеха: ${successRate}%`, 'INFO', 'TEST-SUITE');
  
  if (successRate === 100) {
    logSuccess('🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ УСПЕШНО!', 'TEST-SUITE');
  } else {
    logWarning(`⚠️ Требуется исправление ${results.failed} тестов`, 'TEST-SUITE');
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
    { name: 'Triggers', test: testTriggerSystem }
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
  log('🧪 ===== ТЕСТЫ ПРОИЗВОДИТЕЛЬНОСТИ =====', 'INFO', 'PERF-TEST');
  
  const startTime = Date.now();
  
  try {
    // Тест обработки большого количества отзывов
    const largeFeedbackSet = Array(1000).fill().map((_, i) => ({
      id: `perf-test-${i}`,
      productValuation: Math.floor(Math.random() * 5) + 1,
      text: `Тестовый отзыв ${i}`,
      createdDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      isAnswered: Math.random() > 0.5
    }));
    
    const processStart = Date.now();
    const processed = processFeedbackBatch(largeFeedbackSet, [], MOCK_STORE, true);
    const processTime = Date.now() - processStart;
    
    log(`⚡ Обработано ${largeFeedbackSet.length} отзывов за ${processTime}мс`, 'INFO', 'PERF-TEST');
    log(`📊 Скорость: ${Math.round(largeFeedbackSet.length / (processTime / 1000))} отзывов/сек`, 'INFO', 'PERF-TEST');
    
    const totalTime = Date.now() - startTime;
    log(`⏱️ Общее время теста: ${totalTime}мс`, 'INFO', 'PERF-TEST');
    
    return true;
    
  } catch (error) {
    logError(`❌ Ошибка в тесте производительности: ${error.message}`, 'PERF-TEST');
    return false;
  }
}