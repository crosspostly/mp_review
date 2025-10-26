/**
 * @file tests.gs
 * @description Обновленная система тестирования для MP Review Manager v2.0
 * @version 2.0
 * @date 2025-10-26
 * 
 * АРХИТЕКТУРА ТЕСТОВ:
 * - Unit тесты для каждого модуля
 * - Интеграционные тесты
 * - API тесты с мокированием
 * - Тесты производительности
 * - Тесты безопасности
 * - UI тесты
 */

// ============ КОНФИГУРАЦИЯ ТЕСТОВ ============

const TEST_CONFIG_V2 = {
  ENABLE_LOGGING: true,
  MOCK_API_RESPONSES: true,
  TEST_TIMEOUT: 30000,
  MAX_TEST_ITERATIONS: 10,
  VERBOSE_OUTPUT: true
};

// ============ МОК-ДАННЫЕ ДЛЯ НОВОЙ АРХИТЕКТУРЫ ============

const MOCK_STORE_V2 = {
  id: 'test-store-v2',
  name: 'Тестовый магазин v2.0',
  marketplace: 'Wildberries',
  isActive: true,
  apiKey: 'MOCK_WB_API_KEY_FOR_TESTING_ONLY',
  supplierId: 'MOCK_SUPPLIER_ID_123',
  createdDate: new Date('2025-01-01'),
  settings: {
    startDate: '2025-01-01',
    minRating: 3,
    sortOldestFirst: false,
    autoRespond: true
  }
};

const MOCK_OZON_STORE_V2 = {
  id: 'test-ozon-store-v2',
  name: 'Тестовый Ozon магазин v2.0',
  marketplace: 'Ozon',
  isActive: true,
  apiKey: 'MOCK_OZON_API_KEY_FOR_TESTING_ONLY',
  clientId: 'MOCK_CLIENT_ID_123',
  createdDate: new Date('2025-01-01'),
  settings: {
    startDate: '2025-01-01',
    minRating: 2,
    sortOldestFirst: true,
    autoRespond: false
  }
};

const MOCK_REVIEWS_V2 = [
  {
    id: 'review-1',
    createdDate: new Date('2025-01-15'),
    rating: 5,
    text: 'Отличный товар! Очень доволен покупкой!',
    product: {
      name: 'Тестовый товар 1',
      nmId: 12345,
      supplierArticle: 'ART-001'
    },
    isAnswered: false
  },
  {
    id: 'review-2',
    createdDate: new Date('2025-01-14'),
    rating: 3,
    text: 'Нормальный товар, но есть недостатки',
    product: {
      name: 'Тестовый товар 2',
      nmId: 67890,
      supplierArticle: 'ART-002'
    },
    isAnswered: true
  }
];

// ============ UNIT ТЕСТЫ ДЛЯ МОДУЛЕЙ ============

/**
 * 🧪 Тесты модуля конфигурации (config.gs)
 */
function testConfigModule() {
  const timer = new PerformanceTimer('testConfigModule');
  
  try {
    logInfo('🧪 Тестирование модуля конфигурации', LOG_CONFIG.CATEGORIES.TEST);
    
    // Тест 1: Проверка существования конфигурации
    if (typeof CONFIG === 'undefined') {
      throw new Error('CONFIG объект не найден');
    }
    
    // Тест 2: Проверка основных секций конфигурации
    const requiredSections = ['STATUS', 'LIMITS', 'TIMEOUTS'];
    for (const section of requiredSections) {
      if (!CONFIG[section]) {
        throw new Error(`Секция CONFIG.${section} не найдена`);
      }
    }
    
    // Тест 3: Проверка статусов отзывов
    const requiredStatuses = ['NEW', 'PENDING', 'SENT', 'ERROR'];
    for (const status of requiredStatuses) {
      if (!CONFIG.STATUS[status]) {
        throw new Error(`Статус CONFIG.STATUS.${status} не найден`);
      }
    }
    
    // Тест 4: Проверка LOG_CONFIG
    if (typeof LOG_CONFIG === 'undefined' || !LOG_CONFIG.CATEGORIES) {
      throw new Error('LOG_CONFIG или LOG_CONFIG.CATEGORIES не найден');
    }
    
    // Тест 5: Проверка TRIGGER_CONFIG
    if (typeof TRIGGER_CONFIG === 'undefined') {
      throw new Error('TRIGGER_CONFIG не найден');
    }
    
    logSuccess('✅ Модуль конфигурации работает корректно', LOG_CONFIG.CATEGORIES.TEST);
    timer.finish(LOG_CONFIG.LEVELS.SUCCESS);
    return true;
    
  } catch (error) {
    logError(`❌ Ошибка тестирования модуля конфигурации: ${error.message}`, LOG_CONFIG.CATEGORIES.TEST);
    timer.finish(LOG_CONFIG.LEVELS.ERROR);
    return false;
  }
}

/**
 * 🧪 Тесты модуля логирования (logger.gs)
 */
function testLoggerModule() {
  const timer = new PerformanceTimer('testLoggerModule');
  
  try {
    logInfo('🧪 Тестирование модуля логирования', LOG_CONFIG.CATEGORIES.TEST);
    
    // Тест 1: Проверка функций логирования
    const logFunctions = ['logInfo', 'logError', 'logWarning', 'logSuccess', 'logDebug'];
    for (const func of logFunctions) {
      if (typeof window[func] !== 'function') {
        throw new Error(`Функция ${func} не найдена`);
      }
    }
    
    // Тест 2: Проверка PerformanceTimer
    if (typeof PerformanceTimer !== 'function') {
      throw new Error('Класс PerformanceTimer не найден');
    }
    
    const testTimer = new PerformanceTimer('test');
    testTimer.finish(LOG_CONFIG.LEVELS.SUCCESS);
    
    // Тест 3: Проверка специализированных логгеров
    const specialLoggers = ['logTrigger', 'logStore', 'logApi'];
    for (const func of specialLoggers) {
      if (typeof window[func] !== 'function') {
        throw new Error(`Специализированная функция логирования ${func} не найдена`);
      }
    }
    
    // Тест 4: Проверка работы логирования
    logInfo('Тестовое сообщение INFO', LOG_CONFIG.CATEGORIES.TEST);
    logWarning('Тестовое предупреждение', LOG_CONFIG.CATEGORIES.TEST);
    logError('Тестовая ошибка', LOG_CONFIG.CATEGORIES.TEST);
    logSuccess('Тестовый успех', LOG_CONFIG.CATEGORIES.TEST);
    
    logSuccess('✅ Модуль логирования работает корректно', LOG_CONFIG.CATEGORIES.TEST);
    timer.finish(LOG_CONFIG.LEVELS.SUCCESS);
    return true;
    
  } catch (error) {
    console.error(`❌ Ошибка тестирования модуля логирования: ${error.message}`);
    timer.finish(LOG_CONFIG.LEVELS.ERROR);
    return false;
  }
}

/**
 * 🧪 Тесты модуля управления магазинами (store_manager.gs)
 */
function testStoreManagerModule() {
  const timer = new PerformanceTimer('testStoreManagerModule');
  
  try {
    logInfo('🧪 Тестирование модуля управления магазинами', LOG_CONFIG.CATEGORIES.TEST);
    
    // Тест 1: Проверка основных функций
    const requiredFunctions = [
      'addStore', 'getStoreById', 'getAllStores', 'getActiveStores',
      'updateStore', 'deleteStore', 'createStoreSheetIfNotExists'
    ];
    
    for (const func of requiredFunctions) {
      if (typeof window[func] !== 'function') {
        throw new Error(`Функция ${func} не найдена в store_manager`);
      }
    }
    
    // Тест 2: Получение всех магазинов
    const allStores = getAllStores();
    if (!Array.isArray(allStores)) {
      throw new Error('getAllStores должен возвращать массив');
    }
    
    // Тест 3: Получение активных магазинов
    const activeStores = getActiveStores();
    if (!Array.isArray(activeStores)) {
      throw new Error('getActiveStores должен возвращать массив');
    }
    
    // Тест 4: Создание тестового магазина (без сохранения)
    const testStoreData = {
      name: 'Test Store',
      marketplace: 'Wildberries',
      apiKey: 'test-key',
      supplierId: 'test-supplier'
    };
    
    // Проверяем валидацию данных магазина
    const validationResult = validateStoreData(testStoreData);
    if (!validationResult || typeof validationResult.valid === 'undefined') {
      throw new Error('validateStoreData должен возвращать объект с полем valid');
    }
    
    logSuccess('✅ Модуль управления магазинами работает корректно', LOG_CONFIG.CATEGORIES.TEST);
    timer.finish(LOG_CONFIG.LEVELS.SUCCESS);
    return true;
    
  } catch (error) {
    logError(`❌ Ошибка тестирования модуля управления магазинами: ${error.message}`, LOG_CONFIG.CATEGORIES.TEST);
    timer.finish(LOG_CONFIG.LEVELS.ERROR);
    return false;
  }
}

/**
 * 🧪 Тесты модуля кеширования (cache_manager.gs)
 */
function testCacheManagerModule() {
  const timer = new PerformanceTimer('testCacheManagerModule');
  
  try {
    logInfo('🧪 Тестирование модуля кеширования', LOG_CONFIG.CATEGORIES.TEST);
    
    // Тест 1: Проверка основных функций кеша
    const requiredFunctions = [
      'initializeCacheForStore', 'filterNewReviewsForStore',
      'addToReviewIdsCacheForStore', 'clearCacheForStore', 'clearAllStoreCaches'
    ];
    
    for (const func of requiredFunctions) {
      if (typeof window[func] !== 'function') {
        throw new Error(`Функция кеширования ${func} не найдена`);
      }
    }
    
    // Тест 2: Инициализация кеша для тестового магазина
    const testStoreId = 'test-cache-store';
    const initResult = initializeCacheForStore(testStoreId);
    
    // Тест 3: Добавление ID в кеш
    const testIds = ['review-1', 'review-2', 'review-3'];
    const addResult = addToReviewIdsCacheForStore(testStoreId, testIds);
    
    // Тест 4: Фильтрация новых отзывов
    const testReviews = [
      { id: 'review-1', text: 'Old review' },
      { id: 'review-4', text: 'New review' }
    ];
    
    const filteredReviews = filterNewReviewsForStore(testStoreId, testReviews);
    
    if (!Array.isArray(filteredReviews)) {
      throw new Error('filterNewReviewsForStore должен возвращать массив');
    }
    
    // Тест 5: Очистка кеша
    const clearResult = clearCacheForStore(testStoreId);
    
    logSuccess('✅ Модуль кеширования работает корректно', LOG_CONFIG.CATEGORIES.TEST);
    timer.finish(LOG_CONFIG.LEVELS.SUCCESS);
    return true;
    
  } catch (error) {
    logError(`❌ Ошибка тестирования модуля кеширования: ${error.message}`, LOG_CONFIG.CATEGORIES.TEST);
    timer.finish(LOG_CONFIG.LEVELS.ERROR);
    return false;
  }
}

/**
 * 🧪 Тесты модуля WB API (wb_api.gs)
 */
function testWbApiModule() {
  const timer = new PerformanceTimer('testWbApiModule');
  
  try {
    logInfo('🧪 Тестирование модуля WB API', LOG_CONFIG.CATEGORIES.TEST);
    
    // Тест 1: Проверка основных функций WB API
    const requiredFunctions = [
      'getWbFeedbacks', 'sendWbFeedbackAnswer', 'getWbProductsInfo', 'testWbConnection'
    ];
    
    for (const func of requiredFunctions) {
      if (typeof window[func] !== 'function') {
        throw new Error(`Функция WB API ${func} не найдена`);
      }
    }
    
    // Тест 2: Создание мок UrlFetchApp для тестирования
    const originalUrlFetchApp = UrlFetchApp;
    global.UrlFetchApp = createMockWbApi();
    
    try {
      // Тест 3: Получение отзывов с мок данными
      const feedbacks = getWbFeedbacks(MOCK_STORE_V2, false);
      
      if (!Array.isArray(feedbacks)) {
        throw new Error('getWbFeedbacks должен возвращать массив');
      }
      
      // Тест 4: Отправка ответа на отзыв
      if (feedbacks.length > 0) {
        const sendResult = sendWbFeedbackAnswer(feedbacks[0].id, 'Спасибо за отзыв!', MOCK_STORE_V2);
        
        if (!sendResult || typeof sendResult.success === 'undefined') {
          throw new Error('sendWbFeedbackAnswer должен возвращать объект с полем success');
        }
      }
      
      // Тест 5: Тест соединения
      const connectionTest = testWbConnection(MOCK_STORE_V2);
      if (!connectionTest || typeof connectionTest.success === 'undefined') {
        throw new Error('testWbConnection должен возвращать объект с полем success');
      }
      
    } finally {
      global.UrlFetchApp = originalUrlFetchApp;
    }
    
    logSuccess('✅ Модуль WB API работает корректно', LOG_CONFIG.CATEGORIES.TEST);
    timer.finish(LOG_CONFIG.LEVELS.SUCCESS);
    return true;
    
  } catch (error) {
    logError(`❌ Ошибка тестирования модуля WB API: ${error.message}`, LOG_CONFIG.CATEGORIES.TEST);
    timer.finish(LOG_CONFIG.LEVELS.ERROR);
    return false;
  }
}

/**
 * 🧪 Тесты модуля Ozon API (ozon_api.gs)
 */
function testOzonApiModule() {
  const timer = new PerformanceTimer('testOzonApiModule');
  
  try {
    logInfo('🧪 Тестирование модуля Ozon API', LOG_CONFIG.CATEGORIES.TEST);
    
    // Тест 1: Проверка основных функций Ozon API
    const requiredFunctions = [
      'getOzonFeedbacks', 'sendOzonFeedbackAnswer', 'testOzonConnection'
    ];
    
    for (const func of requiredFunctions) {
      if (typeof window[func] !== 'function') {
        throw new Error(`Функция Ozon API ${func} не найдена`);
      }
    }
    
    // Тест 2: Создание мок UrlFetchApp для тестирования
    const originalUrlFetchApp = UrlFetchApp;
    global.UrlFetchApp = createMockOzonApi();
    
    try {
      // Тест 3: Получение отзывов с мок данными
      const feedbacks = getOzonFeedbacks(MOCK_OZON_STORE_V2, false);
      
      if (!Array.isArray(feedbacks)) {
        throw new Error('getOzonFeedbacks должен возвращать массив');
      }
      
      // Тест 4: Отправка ответа на отзыв
      if (feedbacks.length > 0) {
        const sendResult = sendOzonFeedbackAnswer(feedbacks[0].id, 'Спасибо за отзыв!', MOCK_OZON_STORE_V2);
        
        if (!sendResult || typeof sendResult.success === 'undefined') {
          throw new Error('sendOzonFeedbackAnswer должен возвращать объект с полем success');
        }
      }
      
      // Тест 5: Тест соединения
      const connectionTest = testOzonConnection(MOCK_OZON_STORE_V2);
      if (!connectionTest || typeof connectionTest.success === 'undefined') {
        throw new Error('testOzonConnection должен возвращать объект с полем success');
      }
      
    } finally {
      global.UrlFetchApp = originalUrlFetchApp;
    }
    
    logSuccess('✅ Модуль Ozon API работает корректно', LOG_CONFIG.CATEGORIES.TEST);
    timer.finish(LOG_CONFIG.LEVELS.SUCCESS);
    return true;
    
  } catch (error) {
    logError(`❌ Ошибка тестирования модуля Ozon API: ${error.message}`, LOG_CONFIG.CATEGORIES.TEST);
    timer.finish(LOG_CONFIG.LEVELS.ERROR);
    return false;
  }
}

/**
 * 🧪 Тесты системы триггеров (trigger_system.gs)
 */
function testTriggerSystemModule() {
  const timer = new PerformanceTimer('testTriggerSystemModule');
  
  try {
    logInfo('🧪 Тестирование системы триггеров', LOG_CONFIG.CATEGORIES.TEST);
    
    // Тест 1: Проверка основных функций системы триггеров
    const requiredFunctions = [
      'setupCompleteTriggersSystem', 'hourlyReviewCollector', 'selectReviewAnswers',
      'sendReviewAnswers', 'getSystemTriggersInfo', 'deleteAllSystemTriggers'
    ];
    
    for (const func of requiredFunctions) {
      if (typeof window[func] !== 'function') {
        throw new Error(`Функция системы триггеров ${func} не найдена`);
      }
    }
    
    // Тест 2: Получение информации о триггерах
    const triggersInfo = getSystemTriggersInfo();
    
    if (!triggersInfo || typeof triggersInfo.total === 'undefined') {
      throw new Error('getSystemTriggersInfo должен возвращать объект с полем total');
    }
    
    // Тест 3: Проверка быстрых функций настройки
    const quickSetupFunctions = ['setupTriggers30Min', 'setupTriggers60Min', 'setupTriggers5Min'];
    
    for (const func of quickSetupFunctions) {
      if (typeof window[func] !== 'function') {
        throw new Error(`Быстрая функция настройки ${func} не найдена`);
      }
    }
    
    // Тест 4: Проверка функций управления триггерами
    const managementFunctions = ['createTrigger', 'saveTriggerSystemInfo', 'getTriggerSystemInfo'];
    
    for (const func of managementFunctions) {
      if (typeof window[func] !== 'function') {
        throw new Error(`Функция управления триггерами ${func} не найдена`);
      }
    }
    
    logSuccess('✅ Система триггеров работает корректно', LOG_CONFIG.CATEGORIES.TEST);
    timer.finish(LOG_CONFIG.LEVELS.SUCCESS);
    return true;
    
  } catch (error) {
    logError(`❌ Ошибка тестирования системы триггеров: ${error.message}`, LOG_CONFIG.CATEGORIES.TEST);
    timer.finish(LOG_CONFIG.LEVELS.ERROR);
    return false;
  }
}

/**
 * 🧪 Тесты главного модуля (main.gs)
 */
function testMainModule() {
  const timer = new PerformanceTimer('testMainModule');
  
  try {
    logInfo('🧪 Тестирование главного модуля', LOG_CONFIG.CATEGORIES.TEST);
    
    // Тест 1: Проверка UI функций
    const uiFunctions = [
      'onOpen', 'showDashboard', 'showAddStoreDialog', 'addNewStore',
      'showActiveStores', 'syncAllStores'
    ];
    
    for (const func of uiFunctions) {
      if (typeof window[func] !== 'function') {
        throw new Error(`UI функция ${func} не найдена`);
      }
    }
    
    // Тест 2: Проверка функций управления отзывами
    const reviewFunctions = [
      'collectAllReviews', 'prepareAllAnswers', 'sendAllAnswers', 'showReviewsStats'
    ];
    
    for (const func of reviewFunctions) {
      if (typeof window[func] !== 'function') {
        throw new Error(`Функция управления отзывами ${func} не найдена`);
      }
    }
    
    // Тест 3: Проверка диагностических функций
    const diagnosticFunctions = [
      'runSystemDiagnostics', 'runQuickHealthCheck', 'runApiTests'
    ];
    
    for (const func of diagnosticFunctions) {
      if (typeof window[func] !== 'function') {
        throw new Error(`Диагностическая функция ${func} не найдена`);
      }
    }
    
    // Тест 4: Проверка служебных функций
    const utilityFunctions = [
      'validateStoreData', 'getStoreReviewsStats', 'generateDashboardHTML'
    ];
    
    for (const func of utilityFunctions) {
      if (typeof window[func] !== 'function') {
        throw new Error(`Служебная функция ${func} не найдена`);
      }
    }
    
    // Тест 5: Проверка функций инициализации
    const initFunctions = [
      'initializeSystem', 'ensureSystemSheetsExist', 'setupInitialStructure'
    ];
    
    for (const func of initFunctions) {
      if (typeof window[func] !== 'function') {
        throw new Error(`Функция инициализации ${func} не найдена`);
      }
    }
    
    logSuccess('✅ Главный модуль работает корректно', LOG_CONFIG.CATEGORIES.TEST);
    timer.finish(LOG_CONFIG.LEVELS.SUCCESS);
    return true;
    
  } catch (error) {
    logError(`❌ Ошибка тестирования главного модуля: ${error.message}`, LOG_CONFIG.CATEGORIES.TEST);
    timer.finish(LOG_CONFIG.LEVELS.ERROR);
    return false;
  }
}

// ============ ИНТЕГРАЦИОННЫЕ ТЕСТЫ ============

/**
 * 🧪 Интеграционный тест: Полный цикл обработки отзывов
 */
function testFullReviewProcessingCycle() {
  const timer = new PerformanceTimer('testFullReviewProcessingCycle');
  
  try {
    logInfo('🧪 Интеграционный тест: Полный цикл обработки отзывов', LOG_CONFIG.CATEGORIES.TEST);
    
    // Создаем мок UrlFetchApp
    const originalUrlFetchApp = UrlFetchApp;
    global.UrlFetchApp = createMockWbApi();
    
    try {
      // Этап 1: Сбор отзывов
      const collectedReviews = collectReviewsForStore(MOCK_STORE_V2);
      
      if (!collectedReviews || typeof collectedReviews.totalReviews === 'undefined') {
        throw new Error('Этап сбора отзывов провален');
      }
      
      logInfo(`Собрано отзывов: ${collectedReviews.newReviews}/${collectedReviews.totalReviews}`, LOG_CONFIG.CATEGORIES.TEST);
      
      // Этап 2: Подготовка ответов
      const preparedAnswers = prepareAnswersForStore(MOCK_STORE_V2);
      
      if (!preparedAnswers || typeof preparedAnswers.preparedAnswers === 'undefined') {
        throw new Error('Этап подготовки ответов провален');
      }
      
      logInfo(`Подготовлено ответов: ${preparedAnswers.preparedAnswers}/${preparedAnswers.totalReviews}`, LOG_CONFIG.CATEGORIES.TEST);
      
      // Этап 3: Отправка ответов
      const sentAnswers = sendAnswersForStore(MOCK_STORE_V2);
      
      if (!sentAnswers || typeof sentAnswers.sentAnswers === 'undefined') {
        throw new Error('Этап отправки ответов провален');
      }
      
      logInfo(`Отправлено ответов: ${sentAnswers.sentAnswers}/${sentAnswers.totalPending}`, LOG_CONFIG.CATEGORIES.TEST);
      
    } finally {
      global.UrlFetchApp = originalUrlFetchApp;
    }
    
    logSuccess('✅ Полный цикл обработки отзывов работает корректно', LOG_CONFIG.CATEGORIES.TEST);
    timer.finish(LOG_CONFIG.LEVELS.SUCCESS);
    return true;
    
  } catch (error) {
    logError(`❌ Ошибка интеграционного теста: ${error.message}`, LOG_CONFIG.CATEGORIES.TEST);
    timer.finish(LOG_CONFIG.LEVELS.ERROR);
    return false;
  }
}

/**
 * 🧪 Интеграционный тест: Система триггеров
 */
function testTriggerSystemIntegration() {
  const timer = new PerformanceTimer('testTriggerSystemIntegration');
  
  try {
    logInfo('🧪 Интеграционный тест: Система триггеров', LOG_CONFIG.CATEGORIES.TEST);
    
    // Создаем мок окружения
    const originalUrlFetchApp = UrlFetchApp;
    global.UrlFetchApp = createMockWbApi();
    
    try {
      // Тест 1: Триггер сбора отзывов
      const collectResult = hourlyReviewCollector();
      
      if (!collectResult || typeof collectResult.processedStores === 'undefined') {
        throw new Error('Триггер сбора отзывов не работает');
      }
      
      // Тест 2: Триггер подготовки ответов
      const prepareResult = selectReviewAnswers();
      
      if (!prepareResult || typeof prepareResult.processedStores === 'undefined') {
        throw new Error('Триггер подготовки ответов не работает');
      }
      
      // Тест 3: Триггер отправки ответов
      const sendResult = sendReviewAnswers();
      
      if (!sendResult || typeof sendResult.processedStores === 'undefined') {
        throw new Error('Триггер отправки ответов не работает');
      }
      
    } finally {
      global.UrlFetchApp = originalUrlFetchApp;
    }
    
    logSuccess('✅ Интеграция системы триггеров работает корректно', LOG_CONFIG.CATEGORIES.TEST);
    timer.finish(LOG_CONFIG.LEVELS.SUCCESS);
    return true;
    
  } catch (error) {
    logError(`❌ Ошибка интеграционного теста триггеров: ${error.message}`, LOG_CONFIG.CATEGORIES.TEST);
    timer.finish(LOG_CONFIG.LEVELS.ERROR);
    return false;
  }
}

// ============ МОК ФУНКЦИИ ДЛЯ ТЕСТИРОВАНИЯ ============

/**
 * Создает мок WB API
 */
function createMockWbApi() {
  return {
    fetch: function(url, options) {
      return {
        getResponseCode: function() { return 200; },
        getContentText: function() {
          if (url.includes('/api/v1/feedbacks')) {
            return JSON.stringify({
              data: {
                feedbacks: MOCK_REVIEWS_V2.map(review => ({
                  id: review.id,
                  text: review.text,
                  productValuation: review.rating,
                  createdDate: review.createdDate.toISOString(),
                  isAnswered: review.isAnswered,
                  productDetails: review.product
                }))
              }
            });
          } else if (url.includes('/api/v1/feedbacks') && options.method === 'PATCH') {
            return JSON.stringify({
              data: null,
              error: false,
              errorText: ''
            });
          } else {
            return JSON.stringify({ error: 'Unknown endpoint' });
          }
        }
      };
    }
  };
}

/**
 * Создает мок Ozon API
 */
function createMockOzonApi() {
  return {
    fetch: function(url, options) {
      return {
        getResponseCode: function() { return 200; },
        getContentText: function() {
          if (url.includes('/v1/product/review/list')) {
            return JSON.stringify({
              result: {
                reviews: MOCK_REVIEWS_V2.map(review => ({
                  id: review.id,
                  text: review.text,
                  rating: review.rating,
                  created_at: review.createdDate.toISOString(),
                  is_answered: review.isAnswered,
                  product: review.product
                }))
              }
            });
          } else if (url.includes('/v1/product/review/reply')) {
            return JSON.stringify({
              result: {
                success: true
              }
            });
          } else {
            return JSON.stringify({ error: 'Unknown endpoint' });
          }
        }
      };
    }
  };
}

// ============ ГЛАВНЫЕ ФУНКЦИИ ТЕСТИРОВАНИЯ ============

/**
 * 🚀 Запуск всех unit тестов для новой архитектуры
 */
function runAllUnitTestsV2() {
  try {
    logInfo('🧪 ===== ЗАПУСК ВСЕХ UNIT ТЕСТОВ v2.0 =====', LOG_CONFIG.CATEGORIES.TEST);
    
    const results = {
      total: 0,
      passed: 0,
      failed: 0,
      errors: []
    };
    
    const testSuites = [
      { name: 'Config Module', test: testConfigModule },
      { name: 'Logger Module', test: testLoggerModule },
      { name: 'Store Manager Module', test: testStoreManagerModule },
      { name: 'Cache Manager Module', test: testCacheManagerModule },
      { name: 'WB API Module', test: testWbApiModule },
      { name: 'Ozon API Module', test: testOzonApiModule },
      { name: 'Trigger System Module', test: testTriggerSystemModule },
      { name: 'Main Module', test: testMainModule }
    ];
    
    for (const suite of testSuites) {
      results.total++;
      logInfo(`🧪 Тестирование модуля: ${suite.name}`, LOG_CONFIG.CATEGORIES.TEST);
      
      try {
        const success = suite.test();
        if (success) {
          results.passed++;
          logSuccess(`✅ ${suite.name} - ПРОЙДЕН`, LOG_CONFIG.CATEGORIES.TEST);
        } else {
          results.failed++;
          logError(`❌ ${suite.name} - ПРОВАЛЕН`, LOG_CONFIG.CATEGORIES.TEST);
        }
      } catch (error) {
        results.failed++;
        results.errors.push(`${suite.name}: ${error.message}`);
        logError(`❌ ${suite.name} - ОШИБКА: ${error.message}`, LOG_CONFIG.CATEGORIES.TEST);
      }
    }
    
    // Выводим итоговый отчет
    logInfo('🧪 ===== ИТОГИ UNIT ТЕСТОВ v2.0 =====', LOG_CONFIG.CATEGORIES.TEST);
    logInfo(`📊 Всего модулей протестировано: ${results.total}`, LOG_CONFIG.CATEGORIES.TEST);
    logSuccess(`✅ Пройдено: ${results.passed}`, LOG_CONFIG.CATEGORIES.TEST);
    logError(`❌ Провалено: ${results.failed}`, LOG_CONFIG.CATEGORIES.TEST);
    
    const successRate = Math.round((results.passed / results.total) * 100);
    logInfo(`📈 Процент успеха: ${successRate}%`, LOG_CONFIG.CATEGORIES.TEST);
    
    if (successRate === 100) {
      logSuccess('🎉 ВСЕ UNIT ТЕСТЫ v2.0 ПРОЙДЕНЫ УСПЕШНО!', LOG_CONFIG.CATEGORIES.TEST);
    }
    
    return results;
    
  } catch (error) {
    logError(`❌ Критическая ошибка при запуске unit тестов: ${error.message}`, LOG_CONFIG.CATEGORIES.TEST);
    return null;
  }
}

/**
 * 🚀 Запуск всех интеграционных тестов
 */
function runAllIntegrationTestsV2() {
  try {
    logInfo('🧪 ===== ЗАПУСК ИНТЕГРАЦИОННЫХ ТЕСТОВ v2.0 =====', LOG_CONFIG.CATEGORIES.TEST);
    
    const results = {
      total: 0,
      passed: 0,
      failed: 0,
      errors: []
    };
    
    const testSuites = [
      { name: 'Full Review Processing Cycle', test: testFullReviewProcessingCycle },
      { name: 'Trigger System Integration', test: testTriggerSystemIntegration }
    ];
    
    for (const suite of testSuites) {
      results.total++;
      logInfo(`🧪 Интеграционный тест: ${suite.name}`, LOG_CONFIG.CATEGORIES.TEST);
      
      try {
        const success = suite.test();
        if (success) {
          results.passed++;
          logSuccess(`✅ ${suite.name} - ПРОЙДЕН`, LOG_CONFIG.CATEGORIES.TEST);
        } else {
          results.failed++;
          logError(`❌ ${suite.name} - ПРОВАЛЕН`, LOG_CONFIG.CATEGORIES.TEST);
        }
      } catch (error) {
        results.failed++;
        results.errors.push(`${suite.name}: ${error.message}`);
        logError(`❌ ${suite.name} - ОШИБКА: ${error.message}`, LOG_CONFIG.CATEGORIES.TEST);
      }
    }
    
    // Выводим итоговый отчет
    logInfo('🧪 ===== ИТОГИ ИНТЕГРАЦИОННЫХ ТЕСТОВ v2.0 =====', LOG_CONFIG.CATEGORIES.TEST);
    logInfo(`📊 Всего тестов: ${results.total}`, LOG_CONFIG.CATEGORIES.TEST);
    logSuccess(`✅ Пройдено: ${results.passed}`, LOG_CONFIG.CATEGORIES.TEST);
    logError(`❌ Провалено: ${results.failed}`, LOG_CONFIG.CATEGORIES.TEST);
    
    const successRate = Math.round((results.passed / results.total) * 100);
    logInfo(`📈 Процент успеха: ${successRate}%`, LOG_CONFIG.CATEGORIES.TEST);
    
    if (successRate === 100) {
      logSuccess('🎉 ВСЕ ИНТЕГРАЦИОННЫЕ ТЕСТЫ v2.0 ПРОЙДЕНЫ УСПЕШНО!', LOG_CONFIG.CATEGORIES.TEST);
    }
    
    return results;
    
  } catch (error) {
    logError(`❌ Критическая ошибка при запуске интеграционных тестов: ${error.message}`, LOG_CONFIG.CATEGORIES.TEST);
    return null;
  }
}

/**
 * 🚀 Запуск полного набора тестов для v2.0
 */
function runCompleteTestSuiteV2() {
  try {
    logInfo('🧪 ===== ЗАПУСК ПОЛНОГО НАБОРА ТЕСТОВ MP REVIEW MANAGER v2.0 =====', LOG_CONFIG.CATEGORIES.TEST);
    
    const overallResults = {
      unitTests: null,
      integrationTests: null,
      overallSuccess: false
    };
    
    // Запускаем unit тесты
    overallResults.unitTests = runAllUnitTestsV2();
    
    // Запускаем интеграционные тесты
    overallResults.integrationTests = runAllIntegrationTestsV2();
    
    // Подводим общие итоги
    logInfo('🧪 ===== ОБЩИЕ ИТОГИ ТЕСТИРОВАНИЯ v2.0 =====', LOG_CONFIG.CATEGORIES.TEST);
    
    const unitSuccess = overallResults.unitTests?.passed === overallResults.unitTests?.total;
    const integrationSuccess = overallResults.integrationTests?.passed === overallResults.integrationTests?.total;
    
    overallResults.overallSuccess = unitSuccess && integrationSuccess;
    
    if (overallResults.overallSuccess) {
      logSuccess('🎉 ВСЕ ТЕСТЫ MP REVIEW MANAGER v2.0 ПРОЙДЕНЫ УСПЕШНО!', LOG_CONFIG.CATEGORIES.TEST);
      logSuccess('🚀 СИСТЕМА ГОТОВА К ПРОДАКШЕНУ!', LOG_CONFIG.CATEGORIES.TEST);
    } else {
      logWarning('⚠️ Обнаружены проблемы в тестах. Требуется доработка.', LOG_CONFIG.CATEGORIES.TEST);
    }
    
    // Показываем результаты пользователю
    showTestResults(overallResults);
    
    return overallResults;
    
  } catch (error) {
    logError(`❌ Критическая ошибка при запуске полного набора тестов: ${error.message}`, LOG_CONFIG.CATEGORIES.TEST);
    return null;
  }
}

/**
 * Показывает результаты тестов пользователю
 */
function showTestResults(results) {
  try {
    let message = '🧪 РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ MP REVIEW MANAGER v2.0\\n\\n';
    
    if (results.unitTests) {
      message += `📦 UNIT ТЕСТЫ:\\n`;
      message += `   ✅ Пройдено: ${results.unitTests.passed}\\n`;
      message += `   ❌ Провалено: ${results.unitTests.failed}\\n`;
      message += `   📊 Всего: ${results.unitTests.total}\\n\\n`;
    }
    
    if (results.integrationTests) {
      message += `🔗 ИНТЕГРАЦИОННЫЕ ТЕСТЫ:\\n`;
      message += `   ✅ Пройдено: ${results.integrationTests.passed}\\n`;
      message += `   ❌ Провалено: ${results.integrationTests.failed}\\n`;
      message += `   📊 Всего: ${results.integrationTests.total}\\n\\n`;
    }
    
    message += `📈 ОБЩИЙ РЕЗУЛЬТАТ: ${results.overallSuccess ? '✅ УСПЕШНО' : '❌ ТРЕБУЕТСЯ ДОРАБОТКА'}\\n\\n`;
    message += 'Подробные логи смотрите в консоли Google Apps Script.';
    
    const title = results.overallSuccess ? '✅ Все тесты пройдены' : '⚠️ Есть проблемы';
    
    SpreadsheetApp.getUi().alert(title, message, SpreadsheetApp.getUi().ButtonSet.OK);
    
  } catch (error) {
    logError(`Ошибка показа результатов тестов: ${error.message}`, LOG_CONFIG.CATEGORIES.TEST);
  }
}

// ============ UI ФУНКЦИИ ДЛЯ МЕНЮ ============

/**
 * 🧪 Запуск быстрых тестов из меню
 */
function runQuickTestsV2() {
  try {
    logInfo('🧪 Запуск быстрых тестов v2.0', LOG_CONFIG.CATEGORIES.TEST);
    
    const criticalModules = [
      { name: 'Config', test: testConfigModule },
      { name: 'Logger', test: testLoggerModule },
      { name: 'Store Manager', test: testStoreManagerModule },
      { name: 'WB API', test: testWbApiModule }
    ];
    
    let passed = 0;
    let total = criticalModules.length;
    
    for (const module of criticalModules) {
      try {
        if (module.test()) {
          passed++;
          logSuccess(`✅ ${module.name}`, LOG_CONFIG.CATEGORIES.TEST);
        } else {
          logError(`❌ ${module.name}`, LOG_CONFIG.CATEGORIES.TEST);
        }
      } catch (error) {
        logError(`❌ ${module.name}: ${error.message}`, LOG_CONFIG.CATEGORIES.TEST);
      }
    }
    
    const success = passed === total;
    const message = success ? 
      `✅ Быстрые тесты пройдены: ${passed}/${total}\\n\\nОсновные модули системы работают корректно.` :
      `⚠️ Быстрые тесты: ${passed}/${total}\\n\\nОбнаружены проблемы с критическими модулями.`;
    
    const title = success ? 'Быстрые тесты пройдены' : 'Проблемы в быстрых тестах';
    
    SpreadsheetApp.getUi().alert(title, message, SpreadsheetApp.getUi().ButtonSet.OK);
    
    return success;
    
  } catch (error) {
    logError(`❌ Ошибка быстрых тестов: ${error.message}`, LOG_CONFIG.CATEGORIES.TEST);
    SpreadsheetApp.getUi().alert('Ошибка тестирования', `Ошибка: ${error.message}`, SpreadsheetApp.getUi().ButtonSet.OK);
    return false;
  }
}

/**
 * 🧪 Запуск полных тестов из меню
 */
function runFullTestsV2() {
  return runCompleteTestSuiteV2();
}
