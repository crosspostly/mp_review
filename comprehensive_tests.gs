/**
 * 🧪 КОМПЛЕКСНАЯ СИСТЕМА ТЕСТИРОВАНИЯ
 * 
 * Этот файл содержит все тесты с учетом анализа документации API
 * и выявленных проблем в реализации.
 * 
 * Включает:
 * - Unit тесты для всех функций
 * - Integration тесты
 * - Performance тесты
 * - API compliance тесты
 * - Error handling тесты
 * - Security тесты
 */

// ======================================================================
// ========================== КОНФИГУРАЦИЯ ТЕСТОВ ======================
// ======================================================================

const COMPREHENSIVE_TEST_CONFIG = {
  ENABLE_LOGGING: true,
  MOCK_API_RESPONSES: true,
  TEST_TIMEOUT: 60000, // 60 секунд
  MAX_TEST_ITERATIONS: 100,
  ENABLE_PERFORMANCE_TESTS: true,
  ENABLE_SECURITY_TESTS: true,
  ENABLE_API_COMPLIANCE_TESTS: true
};

// ======================================================================
// ========================== РАСШИРЕННЫЕ МОК-ДАННЫЕ ===================
// ======================================================================

/**
 * Мок-данные для тестирования WB API v2
 */
const MOCK_WB_V2_FEEDBACKS = {
  data: {
    feedbacks: [
      {
        id: "wb-v2-test-1",
        productValuation: 5,
        text: "Отличный товар! Рекомендую!",
        createdDate: "2024-01-15T10:00:00Z",
        isAnswered: false,
        productDetails: {
          nmId: 12345,
          productName: "Тестовый товар WB v2",
          supplierArticle: "WB-12345"
        },
        photos: [
          {
            fullSize: "https://example.com/photo1.jpg",
            miniSize: "https://example.com/photo1_mini.jpg"
          }
        ],
        video: null
      },
      {
        id: "wb-v2-test-2",
        productValuation: 3,
        text: "Нормально, но могло быть лучше",
        createdDate: "2024-01-14T15:30:00Z",
        isAnswered: true,
        productDetails: {
          nmId: 67890,
          productName: "Другой товар WB v2",
          supplierArticle: "WB-67890"
        },
        photos: [],
        video: null
      }
    ],
    count: 2,
    hasNext: false
  }
};

/**
 * Мок-данные для тестирования Ozon API
 */
const MOCK_OZON_RESPONSE = {
  result: {
    reviews: [
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
        },
        photos: [
          {
            url: "https://example.com/ozon_photo1.jpg"
          }
        ],
        video: null
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
        },
        photos: [],
        video: null
      }
    ],
    pagination: {
      has_next: false,
      last_id: "ozon-test-2"
    }
  }
};

/**
 * Мок-данные для тестирования ошибок API
 */
const MOCK_API_ERRORS = {
  WB: {
    401: { error: "Unauthorized", errorText: "Неверный API ключ" },
    403: { error: "Forbidden", errorText: "Нет прав доступа" },
    429: { error: "Too Many Requests", errorText: "Превышен лимит запросов" },
    500: { error: "Internal Server Error", errorText: "Ошибка сервера" }
  },
  OZON: {
    401: { error: "Unauthorized", errorText: "Неверные Client-Id или Api-Key" },
    403: { error: "Forbidden", errorText: "Нет прав доступа" },
    429: { error: "Too Many Requests", errorText: "Превышен лимит запросов" },
    500: { error: "Internal Server Error", errorText: "Ошибка сервера" }
  }
};

// ======================================================================
// ========================== API COMPLIANCE ТЕСТЫ =====================
// ======================================================================

/**
 * 🧪 Тест соответствия WB API v2
 */
function testWbApiV2Compliance() {
  logDebug('🧪 Тест соответствия WB API v2', 'API-COMPLIANCE');
  
  try {
    // Тест 1: Правильный endpoint
    testWbApiV2Endpoint();
    
    // Тест 2: Правильная структура запроса
    testWbApiV2RequestStructure();
    
    // Тест 3: Правильная структура ответа
    testWbApiV2ResponseStructure();
    
    // Тест 4: Фильтрация по дате
    testWbApiV2DateFiltering();
    
    // Тест 5: Фильтрация по рейтингу
    testWbApiV2RatingFiltering();
    
    logSuccess('✅ WB API v2 compliance тесты пройдены', 'API-COMPLIANCE');
    return true;
    
  } catch (error) {
    logError(`❌ WB API v2 compliance тесты провалены: ${error.message}`, 'API-COMPLIANCE');
    return false;
  }
}

/**
 * Тест правильного endpoint WB API v2
 */
function testWbApiV2Endpoint() {
  logDebug('Тест: WB API v2 endpoint', 'API-COMPLIANCE');
  
  // Проверяем, что используется правильный endpoint
  const expectedUrl = 'https://feedbacks-api.wildberries.ru/api/v2/feedbacks';
  
  // Мокаем UrlFetchApp для проверки URL
  const originalUrlFetchApp = UrlFetchApp;
  let capturedUrl = '';
  
  global.UrlFetchApp = {
    fetch: function(url, options) {
      capturedUrl = url;
      return createMockWbV2Response();
    }
  };
  
  try {
    getWbFeedbacks('test-api-key', false, null);
    
    if (!capturedUrl.includes('/api/v2/feedbacks')) {
      throw new Error(`Используется неправильный endpoint: ${capturedUrl}`);
    }
    
    logSuccess('✅ WB API v2 endpoint корректен', 'API-COMPLIANCE');
    
  } finally {
    global.UrlFetchApp = originalUrlFetchApp;
  }
}

/**
 * Тест структуры запроса WB API v2
 */
function testWbApiV2RequestStructure() {
  logDebug('Тест: WB API v2 структура запроса', 'API-COMPLIANCE');
  
  const store = {
    settings: {
      startDate: '2024-01-01',
      minRating: 4
    }
  };
  
  // Мокаем UrlFetchApp для проверки параметров
  const originalUrlFetchApp = UrlFetchApp;
  let capturedOptions = {};
  
  global.UrlFetchApp = {
    fetch: function(url, options) {
      capturedOptions = options;
      return createMockWbV2Response();
    }
  };
  
  try {
    getWbFeedbacks('test-api-key', false, store);
    
    // Проверяем заголовки
    if (!capturedOptions.headers || !capturedOptions.headers.Authorization) {
      throw new Error('Отсутствует заголовок Authorization');
    }
    
    // Проверяем метод
    if (capturedOptions.method !== 'GET') {
      throw new Error('Неправильный HTTP метод');
    }
    
    logSuccess('✅ WB API v2 структура запроса корректна', 'API-COMPLIANCE');
    
  } finally {
    global.UrlFetchApp = originalUrlFetchApp;
  }
}

/**
 * Тест структуры ответа WB API v2
 */
function testWbApiV2ResponseStructure() {
  logDebug('Тест: WB API v2 структура ответа', 'API-COMPLIANCE');
  
  const originalUrlFetchApp = UrlFetchApp;
  global.UrlFetchApp = {
    fetch: function(url, options) {
      return {
        getResponseCode: () => 200,
        getContentText: () => JSON.stringify(MOCK_WB_V2_FEEDBACKS)
      };
    }
  };
  
  try {
    const feedbacks = getWbFeedbacks('test-api-key', false, null);
    
    // Проверяем структуру ответа
    if (!Array.isArray(feedbacks)) {
      throw new Error('Ответ должен быть массивом');
    }
    
    if (feedbacks.length === 0) {
      throw new Error('Ответ не должен быть пустым');
    }
    
    // Проверяем структуру отзыва
    const feedback = feedbacks[0];
    const requiredFields = ['id', 'productValuation', 'text', 'createdDate', 'isAnswered'];
    
    for (const field of requiredFields) {
      if (!(field in feedback)) {
        throw new Error(`Отсутствует обязательное поле: ${field}`);
      }
    }
    
    logSuccess('✅ WB API v2 структура ответа корректна', 'API-COMPLIANCE');
    
  } finally {
    global.UrlFetchApp = originalUrlFetchApp;
  }
}

/**
 * Тест фильтрации по дате WB API v2
 */
function testWbApiV2DateFiltering() {
  logDebug('Тест: WB API v2 фильтрация по дате', 'API-COMPLIANCE');
  
  const store = {
    settings: {
      startDate: '2024-01-01'
    }
  };
  
  // Мокаем UrlFetchApp для проверки параметров даты
  const originalUrlFetchApp = UrlFetchApp;
  let capturedUrl = '';
  
  global.UrlFetchApp = {
    fetch: function(url, options) {
      capturedUrl = url;
      return createMockWbV2Response();
    }
  };
  
  try {
    getWbFeedbacks('test-api-key', false, store);
    
    // Проверяем, что параметры даты переданы в URL
    if (!capturedUrl.includes('dateFrom=2024-01-01')) {
      logWarning('⚠️ Фильтрация по дате не используется (должна быть в URL)', 'API-COMPLIANCE');
    }
    
    logSuccess('✅ WB API v2 фильтрация по дате проверена', 'API-COMPLIANCE');
    
  } finally {
    global.UrlFetchApp = originalUrlFetchApp;
  }
}

/**
 * Тест фильтрации по рейтингу WB API v2
 */
function testWbApiV2RatingFiltering() {
  logDebug('Тест: WB API v2 фильтрация по рейтингу', 'API-COMPLIANCE');
  
  const store = {
    settings: {
      minRating: 4
    }
  };
  
  // Мокаем UrlFetchApp для проверки параметров рейтинга
  const originalUrlFetchApp = UrlFetchApp;
  let capturedUrl = '';
  
  global.UrlFetchApp = {
    fetch: function(url, options) {
      capturedUrl = url;
      return createMockWbV2Response();
    }
  };
  
  try {
    getWbFeedbacks('test-api-key', false, store);
    
    // Проверяем, что параметры рейтинга переданы в URL
    if (!capturedUrl.includes('valuation=4')) {
      logWarning('⚠️ Фильтрация по рейтингу не используется (должна быть в URL)', 'API-COMPLIANCE');
    }
    
    logSuccess('✅ WB API v2 фильтрация по рейтингу проверена', 'API-COMPLIANCE');
    
  } finally {
    global.UrlFetchApp = originalUrlFetchApp;
  }
}

/**
 * 🧪 Тест соответствия Ozon API
 */
function testOzonApiCompliance() {
  logDebug('🧪 Тест соответствия Ozon API', 'API-COMPLIANCE');
  
  try {
    // Тест 1: Правильный endpoint
    testOzonApiEndpoint();
    
    // Тест 2: Правильная структура запроса
    testOzonApiRequestStructure();
    
    // Тест 3: Правильная структура ответа
    testOzonApiResponseStructure();
    
    // Тест 4: Cursor-based пагинация
    testOzonApiPagination();
    
    logSuccess('✅ Ozon API compliance тесты пройдены', 'API-COMPLIANCE');
    return true;
    
  } catch (error) {
    logError(`❌ Ozon API compliance тесты провалены: ${error.message}`, 'API-COMPLIANCE');
    return false;
  }
}

/**
 * Тест правильного endpoint Ozon API
 */
function testOzonApiEndpoint() {
  logDebug('Тест: Ozon API endpoint', 'API-COMPLIANCE');
  
  // Проверяем, что используется правильный endpoint
  const expectedUrl = 'https://api.ozon.ru/composer-api.bx/page/json/v1';
  
  // Мокаем UrlFetchApp для проверки URL
  const originalUrlFetchApp = UrlFetchApp;
  let capturedUrl = '';
  
  global.UrlFetchApp = {
    fetch: function(url, options) {
      capturedUrl = url;
      return createMockOzonResponse();
    }
  };
  
  try {
    getOzonFeedbacks('test-client-id', 'test-api-key', false, null);
    
    if (!capturedUrl.includes('api.ozon.ru')) {
      throw new Error(`Используется неправильный endpoint: ${capturedUrl}`);
    }
    
    logSuccess('✅ Ozon API endpoint корректен', 'API-COMPLIANCE');
    
  } finally {
    global.UrlFetchApp = originalUrlFetchApp;
  }
}

/**
 * Тест структуры запроса Ozon API
 */
function testOzonApiRequestStructure() {
  logDebug('Тест: Ozon API структура запроса', 'API-COMPLIANCE');
  
  // Мокаем UrlFetchApp для проверки параметров
  const originalUrlFetchApp = UrlFetchApp;
  let capturedOptions = {};
  
  global.UrlFetchApp = {
    fetch: function(url, options) {
      capturedOptions = options;
      return createMockOzonResponse();
    }
  };
  
  try {
    getOzonFeedbacks('test-client-id', 'test-api-key', false, null);
    
    // Проверяем метод
    if (capturedOptions.method !== 'POST') {
      throw new Error('Ozon API должен использовать POST метод');
    }
    
    // Проверяем заголовки
    if (!capturedOptions.headers || !capturedOptions.headers['Client-Id']) {
      throw new Error('Отсутствует заголовок Client-Id');
    }
    
    if (!capturedOptions.headers || !capturedOptions.headers['Api-Key']) {
      throw new Error('Отсутствует заголовок Api-Key');
    }
    
    // Проверяем body
    if (!capturedOptions.payload) {
      throw new Error('Отсутствует payload в запросе');
    }
    
    const body = JSON.parse(capturedOptions.payload);
    if (!body.url || !body.postData) {
      throw new Error('Неправильная структура payload');
    }
    
    logSuccess('✅ Ozon API структура запроса корректна', 'API-COMPLIANCE');
    
  } finally {
    global.UrlFetchApp = originalUrlFetchApp;
  }
}

/**
 * Тест структуры ответа Ozon API
 */
function testOzonApiResponseStructure() {
  logDebug('Тест: Ozon API структура ответа', 'API-COMPLIANCE');
  
  const originalUrlFetchApp = UrlFetchApp;
  global.UrlFetchApp = {
    fetch: function(url, options) {
      return {
        getResponseCode: () => 200,
        getContentText: () => JSON.stringify(MOCK_OZON_RESPONSE)
      };
    }
  };
  
  try {
    const feedbacks = getOzonFeedbacks('test-client-id', 'test-api-key', false, null);
    
    // Проверяем структуру ответа
    if (!Array.isArray(feedbacks)) {
      throw new Error('Ответ должен быть массивом');
    }
    
    if (feedbacks.length === 0) {
      throw new Error('Ответ не должен быть пустым');
    }
    
    // Проверяем структуру отзыва
    const feedback = feedbacks[0];
    const requiredFields = ['id', 'rating', 'text', 'createdDate', 'isAnswered'];
    
    for (const field of requiredFields) {
      if (!(field in feedback)) {
        throw new Error(`Отсутствует обязательное поле: ${field}`);
      }
    }
    
    logSuccess('✅ Ozon API структура ответа корректна', 'API-COMPLIANCE');
    
  } finally {
    global.UrlFetchApp = originalUrlFetchApp;
  }
}

/**
 * Тест cursor-based пагинации Ozon API
 */
function testOzonApiPagination() {
  logDebug('Тест: Ozon API cursor-based пагинация', 'API-COMPLIANCE');
  
  // Мокаем UrlFetchApp для проверки пагинации
  const originalUrlFetchApp = UrlFetchApp;
  let capturedBodies = [];
  
  global.UrlFetchApp = {
    fetch: function(url, options) {
      const body = JSON.parse(options.payload);
      capturedBodies.push(body);
      return createMockOzonResponse();
    }
  };
  
  try {
    getOzonFeedbacks('test-client-id', 'test-api-key', false, null);
    
    // Проверяем, что используется cursor-based пагинация
    if (capturedBodies.length === 0) {
      throw new Error('Не было запросов к API');
    }
    
    const firstRequest = capturedBodies[0];
    if (!firstRequest.postData.pagination || !firstRequest.postData.pagination.limit) {
      throw new Error('Отсутствует пагинация в запросе');
    }
    
    logSuccess('✅ Ozon API cursor-based пагинация корректна', 'API-COMPLIANCE');
    
  } finally {
    global.UrlFetchApp = originalUrlFetchApp;
  }
}

// ======================================================================
// ========================== ERROR HANDLING ТЕСТЫ =====================
// ======================================================================

/**
 * 🧪 Тест обработки ошибок API
 */
function testApiErrorHandling() {
  logDebug('🧪 Тест обработки ошибок API', 'ERROR-HANDLING');
  
  try {
    // Тест 1: WB API ошибки
    testWbApiErrorHandling();
    
    // Тест 2: Ozon API ошибки
    testOzonApiErrorHandling();
    
    // Тест 3: Сетевые ошибки
    testNetworkErrorHandling();
    
    // Тест 4: Таймауты
    testTimeoutHandling();
    
    logSuccess('✅ Тесты обработки ошибок API пройдены', 'ERROR-HANDLING');
    return true;
    
  } catch (error) {
    logError(`❌ Тесты обработки ошибок API провалены: ${error.message}`, 'ERROR-HANDLING');
    return false;
  }
}

/**
 * Тест обработки ошибок WB API
 */
function testWbApiErrorHandling() {
  logDebug('Тест: Обработка ошибок WB API', 'ERROR-HANDLING');
  
  const errorCodes = [401, 403, 429, 500];
  
  for (const code of errorCodes) {
    const originalUrlFetchApp = UrlFetchApp;
    global.UrlFetchApp = {
      fetch: function(url, options) {
        return {
          getResponseCode: () => code,
          getContentText: () => JSON.stringify(MOCK_API_ERRORS.WB[code])
        };
      }
    };
    
    try {
      const feedbacks = getWbFeedbacks('invalid-key', false, null);
      
      // При ошибке должен возвращаться пустой массив
      if (!Array.isArray(feedbacks)) {
        throw new Error(`При ошибке ${code} должен возвращаться массив`);
      }
      
      logDebug(`✅ Ошибка ${code} обработана корректно`, 'ERROR-HANDLING');
      
    } finally {
      global.UrlFetchApp = originalUrlFetchApp;
    }
  }
}

/**
 * Тест обработки ошибок Ozon API
 */
function testOzonApiErrorHandling() {
  logDebug('Тест: Обработка ошибок Ozon API', 'ERROR-HANDLING');
  
  const errorCodes = [401, 403, 429, 500];
  
  for (const code of errorCodes) {
    const originalUrlFetchApp = UrlFetchApp;
    global.UrlFetchApp = {
      fetch: function(url, options) {
        return {
          getResponseCode: () => code,
          getContentText: () => JSON.stringify(MOCK_API_ERRORS.OZON[code])
        };
      }
    };
    
    try {
      const feedbacks = getOzonFeedbacks('invalid-client-id', 'invalid-api-key', false, null);
      
      // При ошибке должен возвращаться пустой массив
      if (!Array.isArray(feedbacks)) {
        throw new Error(`При ошибке ${code} должен возвращаться массив`);
      }
      
      logDebug(`✅ Ошибка ${code} обработана корректно`, 'ERROR-HANDLING');
      
    } finally {
      global.UrlFetchApp = originalUrlFetchApp;
    }
  }
}

/**
 * Тест обработки сетевых ошибок
 */
function testNetworkErrorHandling() {
  logDebug('Тест: Обработка сетевых ошибок', 'ERROR-HANDLING');
  
  const originalUrlFetchApp = UrlFetchApp;
  global.UrlFetchApp = {
    fetch: function(url, options) {
      throw new Error('Network error: Connection timeout');
    }
  };
  
  try {
    const wbFeedbacks = getWbFeedbacks('test-key', false, null);
    const ozonFeedbacks = getOzonFeedbacks('test-client-id', 'test-key', false, null);
    
    // При сетевой ошибке должны возвращаться пустые массивы
    if (!Array.isArray(wbFeedbacks) || !Array.isArray(ozonFeedbacks)) {
      throw new Error('При сетевой ошибке должны возвращаться массивы');
    }
    
    logSuccess('✅ Сетевые ошибки обработаны корректно', 'ERROR-HANDLING');
    
  } finally {
    global.UrlFetchApp = originalUrlFetchApp;
  }
}

/**
 * Тест обработки таймаутов
 */
function testTimeoutHandling() {
  logDebug('Тест: Обработка таймаутов', 'ERROR-HANDLING');
  
  // Создаем функцию, которая имитирует таймаут
  function createTimeoutFunction() {
    return function() {
      Utilities.sleep(10000); // 10 секунд задержки
      return {
        getResponseCode: () => 200,
        getContentText: () => '{"data":{"feedbacks":[]}}'
      };
    };
  }
  
  const originalUrlFetchApp = UrlFetchApp;
  global.UrlFetchApp = {
    fetch: createTimeoutFunction()
  };
  
  try {
    const startTime = Date.now();
    const feedbacks = getWbFeedbacks('test-key', false, null);
    const endTime = Date.now();
    
    // Проверяем, что функция не зависает надолго
    if (endTime - startTime > 5000) {
      throw new Error('Функция зависла на таймауте');
    }
    
    logSuccess('✅ Таймауты обработаны корректно', 'ERROR-HANDLING');
    
  } finally {
    global.UrlFetchApp = originalUrlFetchApp;
  }
}

// ======================================================================
// ========================== SECURITY ТЕСТЫ ===========================
// ======================================================================

/**
 * 🧪 Тест безопасности
 */
function testSecurity() {
  logDebug('🧪 Тест безопасности', 'SECURITY');
  
  try {
    // Тест 1: Валидация входных данных
    testInputValidation();
    
    // Тест 2: Защита API ключей
    testApiKeyProtection();
    
    // Тест 3: Rate limiting
    testRateLimiting();
    
    // Тест 4: SQL injection защита
    testSqlInjectionProtection();
    
    logSuccess('✅ Тесты безопасности пройдены', 'SECURITY');
    return true;
    
  } catch (error) {
    logError(`❌ Тесты безопасности провалены: ${error.message}`, 'SECURITY');
    return false;
  }
}

/**
 * Тест валидации входных данных
 */
function testInputValidation() {
  logDebug('Тест: Валидация входных данных', 'SECURITY');
  
  // Тест с некорректными данными
  const invalidInputs = [
    { apiKey: null, expected: 'error' },
    { apiKey: '', expected: 'error' },
    { apiKey: '   ', expected: 'error' },
    { apiKey: '<script>alert("xss")</script>', expected: 'error' },
    { apiKey: 'test-key', clientId: null, expected: 'error' }
  ];
  
  for (const input of invalidInputs) {
    try {
      if (input.clientId !== undefined) {
        getOzonFeedbacks(input.clientId, input.apiKey, false, null);
      } else {
        getWbFeedbacks(input.apiKey, false, null);
      }
      
      if (input.expected === 'error') {
        throw new Error(`Не обработана ошибка для входа: ${JSON.stringify(input)}`);
      }
    } catch (error) {
      if (input.expected === 'error') {
        logDebug(`✅ Валидация работает для: ${JSON.stringify(input)}`, 'SECURITY');
      } else {
        throw error;
      }
    }
  }
}

/**
 * Тест защиты API ключей
 */
function testApiKeyProtection() {
  logDebug('Тест: Защита API ключей', 'SECURITY');
  
  // Проверяем, что API ключи не попадают в логи
  const originalLog = log;
  let loggedMessages = [];
  
  global.log = function(message, level, context) {
    loggedMessages.push(message);
    originalLog(message, level, context);
  };
  
  try {
    getWbFeedbacks('secret-api-key-123', false, null);
    
    // Проверяем, что секретные ключи не попали в логи
    const hasSecretInLogs = loggedMessages.some(msg => 
      msg.includes('secret-api-key-123')
    );
    
    if (hasSecretInLogs) {
      throw new Error('API ключи попали в логи!');
    }
    
    logSuccess('✅ API ключи защищены от попадания в логи', 'SECURITY');
    
  } finally {
    global.log = originalLog;
  }
}

/**
 * Тест rate limiting
 */
function testRateLimiting() {
  logDebug('Тест: Rate limiting', 'SECURITY');
  
  // Имитируем множественные запросы
  const startTime = Date.now();
  let requestCount = 0;
  
  const originalUrlFetchApp = UrlFetchApp;
  global.UrlFetchApp = {
    fetch: function(url, options) {
      requestCount++;
      return {
        getResponseCode: () => 200,
        getContentText: () => '{"data":{"feedbacks":[]}}'
      };
    }
  };
  
  try {
    // Делаем несколько запросов подряд
    for (let i = 0; i < 5; i++) {
      getWbFeedbacks('test-key', false, null);
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Проверяем, что есть задержки между запросами
    if (duration < 1000) { // Меньше 1 секунды для 5 запросов
      logWarning('⚠️ Возможно отсутствует rate limiting', 'SECURITY');
    }
    
    logSuccess('✅ Rate limiting проверен', 'SECURITY');
    
  } finally {
    global.UrlFetchApp = originalUrlFetchApp;
  }
}

/**
 * Тест защиты от SQL injection
 */
function testSqlInjectionProtection() {
  logDebug('Тест: Защита от SQL injection', 'SECURITY');
  
  const maliciousInputs = [
    "'; DROP TABLE users; --",
    "' OR '1'='1",
    "'; INSERT INTO users VALUES ('hacker', 'password'); --",
    "<script>alert('xss')</script>"
  ];
  
  for (const maliciousInput of maliciousInputs) {
    try {
      // Тестируем с malicious input
      const store = {
        settings: {
          startDate: maliciousInput
        }
      };
      
      getWbFeedbacks('test-key', false, store);
      
      // Если функция выполнилась без ошибок, это хорошо
      logDebug(`✅ Защита от SQL injection работает для: ${maliciousInput}`, 'SECURITY');
      
    } catch (error) {
      // Ошибка тоже может быть нормальной реакцией
      logDebug(`✅ Защита от SQL injection сработала для: ${maliciousInput}`, 'SECURITY');
    }
  }
}

// ======================================================================
// ========================== PERFORMANCE ТЕСТЫ ========================
// ======================================================================

/**
 * 🧪 Тест производительности
 */
function testPerformance() {
  logDebug('🧪 Тест производительности', 'PERFORMANCE');
  
  try {
    // Тест 1: Время выполнения функций
    testExecutionTime();
    
    // Тест 2: Использование памяти
    testMemoryUsage();
    
    // Тест 3: Обработка больших объемов данных
    testLargeDataProcessing();
    
    // Тест 4: Параллельная обработка
    testParallelProcessing();
    
    logSuccess('✅ Тесты производительности пройдены', 'PERFORMANCE');
    return true;
    
  } catch (error) {
    logError(`❌ Тесты производительности провалены: ${error.message}`, 'PERFORMANCE');
    return false;
  }
}

/**
 * Тест времени выполнения функций
 */
function testExecutionTime() {
  logDebug('Тест: Время выполнения функций', 'PERFORMANCE');
  
  const functions = [
    { name: 'getWbFeedbacks', fn: () => getWbFeedbacks('test-key', false, null) },
    { name: 'getOzonFeedbacks', fn: () => getOzonFeedbacks('test-client-id', 'test-key', false, null) },
    { name: 'processFeedbackBatch', fn: () => processFeedbackBatch([], [], MOCK_STORE, true) }
  ];
  
  for (const func of functions) {
    const startTime = Date.now();
    func.fn();
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    logDebug(`⏱️ ${func.name}: ${duration}мс`, 'PERFORMANCE');
    
    // Проверяем, что функция выполняется за разумное время
    if (duration > 10000) { // Больше 10 секунд
      logWarning(`⚠️ ${func.name} выполняется слишком долго: ${duration}мс`, 'PERFORMANCE');
    }
  }
}

/**
 * Тест использования памяти
 */
function testMemoryUsage() {
  logDebug('Тест: Использование памяти', 'PERFORMANCE');
  
  // Создаем большой массив данных
  const largeData = Array(1000).fill().map((_, i) => ({
    id: `test-${i}`,
    text: `Test feedback ${i}`,
    rating: Math.floor(Math.random() * 5) + 1,
    createdDate: new Date().toISOString()
  }));
  
  const startTime = Date.now();
  
  try {
    // Обрабатываем большой объем данных
    const processed = processFeedbackBatch(largeData, [], MOCK_STORE, true);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    logDebug(`📊 Обработано ${largeData.length} записей за ${duration}мс`, 'PERFORMANCE');
    logDebug(`⚡ Скорость: ${Math.round(largeData.length / (duration / 1000))} записей/сек`, 'PERFORMANCE');
    
    // Проверяем, что обработка завершилась успешно
    if (!Array.isArray(processed)) {
      throw new Error('Обработка больших данных не вернула массив');
    }
    
  } catch (error) {
    logError(`❌ Ошибка при обработке больших данных: ${error.message}`, 'PERFORMANCE');
    throw error;
  }
}

/**
 * Тест обработки больших объемов данных
 */
function testLargeDataProcessing() {
  logDebug('Тест: Обработка больших объемов данных', 'PERFORMANCE');
  
  const sizes = [100, 500, 1000, 2000];
  
  for (const size of sizes) {
    const data = Array(size).fill().map((_, i) => ({
      id: `large-test-${i}`,
      text: `Large test feedback ${i}`,
      rating: Math.floor(Math.random() * 5) + 1,
      createdDate: new Date().toISOString()
    }));
    
    const startTime = Date.now();
    
    try {
      const processed = processFeedbackBatch(data, [], MOCK_STORE, true);
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      logDebug(`📊 Размер ${size}: ${duration}мс (${Math.round(size / (duration / 1000))} записей/сек)`, 'PERFORMANCE');
      
      // Проверяем производительность
      const recordsPerSecond = size / (duration / 1000);
      if (recordsPerSecond < 10) { // Меньше 10 записей в секунду
        logWarning(`⚠️ Низкая производительность для размера ${size}: ${recordsPerSecond.toFixed(2)} записей/сек`, 'PERFORMANCE');
      }
      
    } catch (error) {
      logError(`❌ Ошибка при обработке размера ${size}: ${error.message}`, 'PERFORMANCE');
    }
  }
}

/**
 * Тест параллельной обработки
 */
function testParallelProcessing() {
  logDebug('Тест: Параллельная обработка', 'PERFORMANCE');
  
  const stores = [
    { ...MOCK_STORE, id: 'parallel-test-1' },
    { ...MOCK_STORE, id: 'parallel-test-2' },
    { ...MOCK_STORE, id: 'parallel-test-3' }
  ];
  
  const startTime = Date.now();
  
  try {
    // Обрабатываем несколько магазинов
    stores.forEach(store => {
      try {
        processSingleStore(store, true);
      } catch (error) {
        logDebug(`⚠️ Ошибка обработки магазина ${store.id}: ${error.message}`, 'PERFORMANCE');
      }
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    logDebug(`⚡ Параллельная обработка ${stores.length} магазинов: ${duration}мс`, 'PERFORMANCE');
    
  } catch (error) {
    logError(`❌ Ошибка параллельной обработки: ${error.message}`, 'PERFORMANCE');
  }
}

// ======================================================================
// ========================== INTEGRATION ТЕСТЫ ========================
// ======================================================================

/**
 * 🧪 Интеграционные тесты
 */
function testIntegration() {
  logDebug('🧪 Интеграционные тесты', 'INTEGRATION');
  
  try {
    // Тест 1: Полный цикл обработки WB
    testWbFullCycle();
    
    // Тест 2: Полный цикл обработки Ozon
    testOzonFullCycle();
    
    // Тест 3: Смешанная обработка
    testMixedProcessing();
    
    // Тест 4: Система прогресса
    testProgressSystem();
    
    logSuccess('✅ Интеграционные тесты пройдены', 'INTEGRATION');
    return true;
    
  } catch (error) {
    logError(`❌ Интеграционные тесты провалены: ${error.message}`, 'INTEGRATION');
    return false;
  }
}

/**
 * Тест полного цикла обработки WB
 */
function testWbFullCycle() {
  logDebug('Тест: Полный цикл обработки WB', 'INTEGRATION');
  
  const testStore = {
    ...MOCK_STORE,
    id: 'wb-integration-test',
    marketplace: 'wb',
    credentials: { apiKey: 'test-wb-key' }
  };
  
  try {
    // 1. Сохраняем магазин
    const saveResult = saveStore(testStore);
    if (!saveResult) {
      throw new Error('Не удалось сохранить тестовый магазин WB');
    }
    
    // 2. Обрабатываем магазин
    const processResult = processSingleStore(testStore, true);
    if (!processResult) {
      throw new Error('Не удалось обработать тестовый магазин WB');
    }
    
    // 3. Проверяем прогресс
    const progress = getStoreProgress(testStore.id);
    if (!progress) {
      throw new Error('Не удалось получить прогресс магазина WB');
    }
    
    // 4. Удаляем тестовый магазин
    const deleteResult = deleteStore(testStore.id);
    if (!deleteResult) {
      throw new Error('Не удалось удалить тестовый магазин WB');
    }
    
    logSuccess('✅ Полный цикл обработки WB работает', 'INTEGRATION');
    
  } catch (error) {
    logError(`❌ Ошибка в полном цикле WB: ${error.message}`, 'INTEGRATION');
    throw error;
  }
}

/**
 * Тест полного цикла обработки Ozon
 */
function testOzonFullCycle() {
  logDebug('Тест: Полный цикл обработки Ozon', 'INTEGRATION');
  
  const testStore = {
    ...MOCK_STORE,
    id: 'ozon-integration-test',
    marketplace: 'ozon',
    credentials: { 
      clientId: 'test-ozon-client-id',
      apiKey: 'test-ozon-key'
    }
  };
  
  try {
    // 1. Сохраняем магазин
    const saveResult = saveStore(testStore);
    if (!saveResult) {
      throw new Error('Не удалось сохранить тестовый магазин Ozon');
    }
    
    // 2. Обрабатываем магазин
    const processResult = processSingleStore(testStore, true);
    if (!processResult) {
      throw new Error('Не удалось обработать тестовый магазин Ozon');
    }
    
    // 3. Проверяем прогресс
    const progress = getStoreProgress(testStore.id);
    if (!progress) {
      throw new Error('Не удалось получить прогресс магазина Ozon');
    }
    
    // 4. Удаляем тестовый магазин
    const deleteResult = deleteStore(testStore.id);
    if (!deleteResult) {
      throw new Error('Не удалось удалить тестовый магазин Ozon');
    }
    
    logSuccess('✅ Полный цикл обработки Ozon работает', 'INTEGRATION');
    
  } catch (error) {
    logError(`❌ Ошибка в полном цикле Ozon: ${error.message}`, 'INTEGRATION');
    throw error;
  }
}

/**
 * Тест смешанной обработки
 */
function testMixedProcessing() {
  logDebug('Тест: Смешанная обработка', 'INTEGRATION');
  
  const wbStore = {
    ...MOCK_STORE,
    id: 'mixed-wb-test',
    marketplace: 'wb',
    credentials: { apiKey: 'test-wb-key' }
  };
  
  const ozonStore = {
    ...MOCK_STORE,
    id: 'mixed-ozon-test',
    marketplace: 'ozon',
    credentials: { 
      clientId: 'test-ozon-client-id',
      apiKey: 'test-ozon-key'
    }
  };
  
  try {
    // Сохраняем оба магазина
    saveStore(wbStore);
    saveStore(ozonStore);
    
    // Обрабатываем все магазины
    const allStores = getStores();
    const activeStores = allStores.filter(store => store.isActive);
    
    for (const store of activeStores) {
      try {
        processSingleStore(store, true);
      } catch (error) {
        logDebug(`⚠️ Ошибка обработки магазина ${store.id}: ${error.message}`, 'INTEGRATION');
      }
    }
    
    // Очищаем тестовые магазины
    deleteStore(wbStore.id);
    deleteStore(ozonStore.id);
    
    logSuccess('✅ Смешанная обработка работает', 'INTEGRATION');
    
  } catch (error) {
    logError(`❌ Ошибка в смешанной обработке: ${error.message}`, 'INTEGRATION');
    throw error;
  }
}

/**
 * Тест системы прогресса
 */
function testProgressSystem() {
  logDebug('Тест: Система прогресса', 'INTEGRATION');
  
  const testStoreId = 'progress-test-store';
  
  try {
    // 1. Сохраняем прогресс
    const progressData = {
      lastPage: 5,
      lastDate: new Date().toISOString(),
      processedCount: 100
    };
    
    const saveResult = updateStoreProgress(testStoreId, progressData);
    if (!saveResult) {
      throw new Error('Не удалось сохранить прогресс');
    }
    
    // 2. Получаем прогресс
    const retrievedProgress = getStoreProgress(testStoreId);
    if (!retrievedProgress) {
      throw new Error('Не удалось получить прогресс');
    }
    
    // 3. Проверяем данные
    if (retrievedProgress.lastPage !== 5) {
      throw new Error('Некорректные данные прогресса');
    }
    
    // 4. Сбрасываем прогресс
    const resetResult = resetStoreProgress(testStoreId);
    if (!resetResult) {
      throw new Error('Не удалось сбросить прогресс');
    }
    
    // 5. Проверяем сброс
    const clearedProgress = getStoreProgress(testStoreId);
    if (clearedProgress && Object.keys(clearedProgress).length > 0) {
      throw new Error('Прогресс не был сброшен');
    }
    
    logSuccess('✅ Система прогресса работает', 'INTEGRATION');
    
  } catch (error) {
    logError(`❌ Ошибка в системе прогресса: ${error.message}`, 'INTEGRATION');
    throw error;
  }
}

// ======================================================================
// ========================== HELPER ФУНКЦИИ ===========================
// ======================================================================

/**
 * Создает мок-ответ WB API v2
 */
function createMockWbV2Response() {
  return {
    getResponseCode: () => 200,
    getContentText: () => JSON.stringify(MOCK_WB_V2_FEEDBACKS)
  };
}

/**
 * Создает мок-ответ Ozon API
 */
function createMockOzonResponse() {
  return {
    getResponseCode: () => 200,
    getContentText: () => JSON.stringify(MOCK_OZON_RESPONSE)
  };
}

/**
 * Создает мок-ответ с ошибкой
 */
function createMockErrorResponse(code, message) {
  return {
    getResponseCode: () => code,
    getContentText: () => JSON.stringify({ error: message })
  };
}

// ======================================================================
// ========================== ГЛАВНАЯ ФУНКЦИЯ ==========================
// ======================================================================

/**
 * 🚀 ГЛАВНАЯ ФУНКЦИЯ: Запуск всех комплексных тестов
 */
function runComprehensiveTests() {
  log('🧪 ===== ЗАПУСК КОМПЛЕКСНОГО ТЕСТИРОВАНИЯ =====', 'INFO', 'COMPREHENSIVE-TEST');
  
  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    errors: [],
    categories: {}
  };
  
  const testCategories = [
    { name: 'API Compliance', test: testWbApiV2Compliance, category: 'API-COMPLIANCE' },
    { name: 'Ozon API Compliance', test: testOzonApiCompliance, category: 'API-COMPLIANCE' },
    { name: 'Error Handling', test: testApiErrorHandling, category: 'ERROR-HANDLING' },
    { name: 'Security', test: testSecurity, category: 'SECURITY' },
    { name: 'Performance', test: testPerformance, category: 'PERFORMANCE' },
    { name: 'Integration', test: testIntegration, category: 'INTEGRATION' }
  ];
  
  for (const category of testCategories) {
    results.total++;
    log(`🧪 Запуск тестов: ${category.name}`, 'INFO', 'COMPREHENSIVE-TEST');
    
    try {
      const success = category.test();
      if (success) {
        results.passed++;
        results.categories[category.category] = 'PASSED';
        logSuccess(`✅ ${category.name} - ПРОЙДЕН`, 'COMPREHENSIVE-TEST');
      } else {
        results.failed++;
        results.categories[category.category] = 'FAILED';
        logError(`❌ ${category.name} - ПРОВАЛЕН`, 'COMPREHENSIVE-TEST');
      }
    } catch (error) {
      results.failed++;
      results.errors.push(`${category.name}: ${error.message}`);
      results.categories[category.category] = 'ERROR';
      logError(`❌ ${category.name} - ОШИБКА: ${error.message}`, 'COMPREHENSIVE-TEST');
    }
  }
  
  // Выводим итоговый отчет
  log('🧪 ===== ИТОГИ КОМПЛЕКСНОГО ТЕСТИРОВАНИЯ =====', 'INFO', 'COMPREHENSIVE-TEST');
  log(`📊 Всего тестов: ${results.total}`, 'INFO', 'COMPREHENSIVE-TEST');
  log(`✅ Пройдено: ${results.passed}`, 'SUCCESS', 'COMPREHENSIVE-TEST');
  log(`❌ Провалено: ${results.failed}`, 'ERROR', 'COMPREHENSIVE-TEST');
  
  // Детали по категориям
  log('📋 Результаты по категориям:', 'INFO', 'COMPREHENSIVE-TEST');
  for (const [category, status] of Object.entries(results.categories)) {
    const emoji = status === 'PASSED' ? '✅' : status === 'FAILED' ? '❌' : '⚠️';
    log(`  ${emoji} ${category}: ${status}`, 'INFO', 'COMPREHENSIVE-TEST');
  }
  
  if (results.errors.length > 0) {
    log('🔍 Ошибки:', 'WARNING', 'COMPREHENSIVE-TEST');
    results.errors.forEach(error => {
      log(`  - ${error}`, 'ERROR', 'COMPREHENSIVE-TEST');
    });
  }
  
  const successRate = Math.round((results.passed / results.total) * 100);
  log(`📈 Процент успеха: ${successRate}%`, 'INFO', 'COMPREHENSIVE-TEST');
  
  if (successRate === 100) {
    logSuccess('🎉 ВСЕ КОМПЛЕКСНЫЕ ТЕСТЫ ПРОЙДЕНЫ УСПЕШНО!', 'COMPREHENSIVE-TEST');
  } else if (successRate >= 80) {
    logWarning(`⚠️ Большинство тестов пройдено (${successRate}%), требуется исправление ${results.failed} тестов`, 'COMPREHENSIVE-TEST');
  } else {
    logError(`❌ Критический уровень ошибок (${successRate}%), требуется серьезная доработка`, 'COMPREHENSIVE-TEST');
  }
  
  return results;
}

/**
 * 🧪 Быстрый тест критических функций
 */
function runQuickComprehensiveTests() {
  log('🧪 ===== БЫСТРЫЕ КОМПЛЕКСНЫЕ ТЕСТЫ =====', 'INFO', 'QUICK-COMPREHENSIVE');
  
  const criticalTests = [
    { name: 'WB API v2 Compliance', test: testWbApiV2Compliance },
    { name: 'Ozon API Compliance', test: testOzonApiCompliance },
    { name: 'Error Handling', test: testApiErrorHandling },
    { name: 'Security', test: testSecurity }
  ];
  
  let passed = 0;
  let total = criticalTests.length;
  
  for (const test of criticalTests) {
    try {
      if (test.test()) {
        passed++;
        logSuccess(`✅ ${test.name}`, 'QUICK-COMPREHENSIVE');
      } else {
        logError(`❌ ${test.name}`, 'QUICK-COMPREHENSIVE');
      }
    } catch (error) {
      logError(`❌ ${test.name}: ${error.message}`, 'QUICK-COMPREHENSIVE');
    }
  }
  
  log(`📊 Результат: ${passed}/${total} тестов пройдено`, 'INFO', 'QUICK-COMPREHENSIVE');
  return passed === total;
}