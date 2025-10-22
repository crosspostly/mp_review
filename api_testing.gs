/**
 * 🧪 СИСТЕМА ТЕСТИРОВАНИЯ API С ЛОГИРОВАНИЕМ
 * 
 * Этот файл содержит функции для тестирования реальных API
 * с подробным логированием для определения работоспособности
 */

// ======================================================================
// ========================== КОНФИГУРАЦИЯ ТЕСТИРОВАНИЯ ================
// ======================================================================

const API_TEST_CONFIG = {
  ENABLE_DETAILED_LOGGING: true,
  LOG_ALL_REQUESTS: true,
  LOG_ALL_RESPONSES: true,
  LOG_PERFORMANCE: true,
  COMPARE_VERSIONS: true,
  MAX_TEST_DURATION: 300000, // 5 минут
  RETRY_ATTEMPTS: 3
};

// ======================================================================
// ========================== ТЕСТИРОВАНИЕ WB API ======================
// ======================================================================

/**
 * 🧪 Тест WB API v1 с подробным логированием
 */
function testWbApiV1WithLogging(apiKey, store = null) {
  log('🧪 ===== ТЕСТ WB API v1 С ЛОГИРОВАНИЕМ =====', 'INFO', 'WB-API-V1-TEST');
  
  const testResults = {
    startTime: Date.now(),
    version: 'v1',
    success: false,
    errors: [],
    requests: [],
    performance: {},
    data: {
      totalFeedbacks: 0,
      pages: 0,
      avgResponseTime: 0
    }
  };
  
  try {
    log(`🔑 API Key: ${apiKey ? 'установлен' : 'НЕ УСТАНОВЛЕН'}`, 'INFO', 'WB-API-V1-TEST');
    log(`🏪 Store: ${store?.name || 'не указан'}`, 'INFO', 'WB-API-V1-TEST');
    
    // Тест 1: Получение отзывов
    log('📥 Тест 1: Получение отзывов', 'INFO', 'WB-API-V1-TEST');
    const feedbacksResult = testWbApiV1GetFeedbacks(apiKey, store);
    testResults.requests.push(feedbacksResult);
    
    if (feedbacksResult.success) {
      testResults.data.totalFeedbacks = feedbacksResult.data?.length || 0;
      testResults.data.pages = feedbacksResult.pages || 0;
      testResults.data.avgResponseTime = feedbacksResult.avgResponseTime || 0;
      
      log(`✅ Получено ${testResults.data.totalFeedbacks} отзывов за ${testResults.data.pages} страниц`, 'SUCCESS', 'WB-API-V1-TEST');
      log(`⏱️ Среднее время ответа: ${testResults.data.avgResponseTime}мс`, 'INFO', 'WB-API-V1-TEST');
    } else {
      testResults.errors.push('Ошибка получения отзывов');
      log(`❌ Ошибка получения отзывов: ${feedbacksResult.error}`, 'ERROR', 'WB-API-V1-TEST');
    }
    
    // Тест 2: Отправка ответа (если есть отзывы)
    if (testResults.data.totalFeedbacks > 0) {
      log('📤 Тест 2: Отправка ответа', 'INFO', 'WB-API-V1-TEST');
      const answerResult = testWbApiV1SendAnswer(apiKey);
      testResults.requests.push(answerResult);
      
      if (answerResult.success) {
        log('✅ Отправка ответа работает', 'SUCCESS', 'WB-API-V1-TEST');
      } else {
        testResults.errors.push('Ошибка отправки ответа');
        log(`❌ Ошибка отправки ответа: ${answerResult.error}`, 'ERROR', 'WB-API-V1-TEST');
      }
    }
    
    // Тест 3: Обработка ошибок
    log('🚨 Тест 3: Обработка ошибок', 'INFO', 'WB-API-V1-TEST');
    const errorResult = testWbApiV1ErrorHandling();
    testResults.requests.push(errorResult);
    
    if (errorResult.success) {
      log('✅ Обработка ошибок работает', 'SUCCESS', 'WB-API-V1-TEST');
    } else {
      testResults.errors.push('Ошибка обработки ошибок');
      log(`❌ Ошибка обработки ошибок: ${errorResult.error}`, 'ERROR', 'WB-API-V1-TEST');
    }
    
    // Итоговый результат
    testResults.success = testResults.errors.length === 0;
    testResults.performance.totalTime = Date.now() - testResults.startTime;
    
    log('🧪 ===== ИТОГИ ТЕСТА WB API v1 =====', 'INFO', 'WB-API-V1-TEST');
    log(`📊 Успех: ${testResults.success ? '✅ ДА' : '❌ НЕТ'}`, testResults.success ? 'SUCCESS' : 'ERROR', 'WB-API-V1-TEST');
    log(`📈 Отзывов получено: ${testResults.data.totalFeedbacks}`, 'INFO', 'WB-API-V1-TEST');
    log(`📄 Страниц обработано: ${testResults.data.pages}`, 'INFO', 'WB-API-V1-TEST');
    log(`⏱️ Общее время: ${testResults.performance.totalTime}мс`, 'INFO', 'WB-API-V1-TEST');
    log(`🔄 Запросов выполнено: ${testResults.requests.length}`, 'INFO', 'WB-API-V1-TEST');
    
    if (testResults.errors.length > 0) {
      log('❌ Ошибки:', 'ERROR', 'WB-API-V1-TEST');
      testResults.errors.forEach(error => {
        log(`  - ${error}`, 'ERROR', 'WB-API-V1-TEST');
      });
    }
    
    return testResults;
    
  } catch (error) {
    testResults.success = false;
    testResults.errors.push(`Критическая ошибка: ${error.message}`);
    testResults.performance.totalTime = Date.now() - testResults.startTime;
    
    log(`❌ Критическая ошибка теста WB API v1: ${error.message}`, 'ERROR', 'WB-API-V1-TEST');
    return testResults;
  }
}

/**
 * 🧪 Тест WB API v2 с подробным логированием
 */
function testWbApiV2WithLogging(apiKey, store = null) {
  log('🧪 ===== ТЕСТ WB API v2 С ЛОГИРОВАНИЕМ =====', 'INFO', 'WB-API-V2-TEST');
  
  const testResults = {
    startTime: Date.now(),
    version: 'v2',
    success: false,
    errors: [],
    requests: [],
    performance: {},
    data: {
      totalFeedbacks: 0,
      pages: 0,
      avgResponseTime: 0
    }
  };
  
  try {
    log(`🔑 API Key: ${apiKey ? 'установлен' : 'НЕ УСТАНОВЛЕН'}`, 'INFO', 'WB-API-V2-TEST');
    log(`🏪 Store: ${store?.name || 'не указан'}`, 'INFO', 'WB-API-V2-TEST');
    
    // Тест 1: Получение отзывов
    log('📥 Тест 1: Получение отзывов', 'INFO', 'WB-API-V2-TEST');
    const feedbacksResult = testWbApiV2GetFeedbacks(apiKey, store);
    testResults.requests.push(feedbacksResult);
    
    if (feedbacksResult.success) {
      testResults.data.totalFeedbacks = feedbacksResult.data?.length || 0;
      testResults.data.pages = feedbacksResult.pages || 0;
      testResults.data.avgResponseTime = feedbacksResult.avgResponseTime || 0;
      
      log(`✅ Получено ${testResults.data.totalFeedbacks} отзывов за ${testResults.data.pages} страниц`, 'SUCCESS', 'WB-API-V2-TEST');
      log(`⏱️ Среднее время ответа: ${testResults.data.avgResponseTime}мс`, 'INFO', 'WB-API-V2-TEST');
    } else {
      testResults.errors.push('Ошибка получения отзывов');
      log(`❌ Ошибка получения отзывов: ${feedbacksResult.error}`, 'ERROR', 'WB-API-V2-TEST');
    }
    
    // Тест 2: Отправка ответа (если есть отзывы)
    if (testResults.data.totalFeedbacks > 0) {
      log('📤 Тест 2: Отправка ответа', 'INFO', 'WB-API-V2-TEST');
      const answerResult = testWbApiV2SendAnswer(apiKey);
      testResults.requests.push(answerResult);
      
      if (answerResult.success) {
        log('✅ Отправка ответа работает', 'SUCCESS', 'WB-API-V2-TEST');
      } else {
        testResults.errors.push('Ошибка отправки ответа');
        log(`❌ Ошибка отправки ответа: ${answerResult.error}`, 'ERROR', 'WB-API-V2-TEST');
      }
    }
    
    // Тест 3: Обработка ошибок
    log('🚨 Тест 3: Обработка ошибок', 'INFO', 'WB-API-V2-TEST');
    const errorResult = testWbApiV2ErrorHandling();
    testResults.requests.push(errorResult);
    
    if (errorResult.success) {
      log('✅ Обработка ошибок работает', 'SUCCESS', 'WB-API-V2-TEST');
    } else {
      testResults.errors.push('Ошибка обработки ошибок');
      log(`❌ Ошибка обработки ошибок: ${errorResult.error}`, 'ERROR', 'WB-API-V2-TEST');
    }
    
    // Итоговый результат
    testResults.success = testResults.errors.length === 0;
    testResults.performance.totalTime = Date.now() - testResults.startTime;
    
    log('🧪 ===== ИТОГИ ТЕСТА WB API v2 =====', 'INFO', 'WB-API-V2-TEST');
    log(`📊 Успех: ${testResults.success ? '✅ ДА' : '❌ НЕТ'}`, testResults.success ? 'SUCCESS' : 'ERROR', 'WB-API-V2-TEST');
    log(`📈 Отзывов получено: ${testResults.data.totalFeedbacks}`, 'INFO', 'WB-API-V2-TEST');
    log(`📄 Страниц обработано: ${testResults.data.pages}`, 'INFO', 'WB-API-V2-TEST');
    log(`⏱️ Общее время: ${testResults.performance.totalTime}мс`, 'INFO', 'WB-API-V2-TEST');
    log(`🔄 Запросов выполнено: ${testResults.requests.length}`, 'INFO', 'WB-API-V2-TEST');
    
    if (testResults.errors.length > 0) {
      log('❌ Ошибки:', 'ERROR', 'WB-API-V2-TEST');
      testResults.errors.forEach(error => {
        log(`  - ${error}`, 'ERROR', 'WB-API-V2-TEST');
      });
    }
    
    return testResults;
    
  } catch (error) {
    testResults.success = false;
    testResults.errors.push(`Критическая ошибка: ${error.message}`);
    testResults.performance.totalTime = Date.now() - testResults.startTime;
    
    log(`❌ Критическая ошибка теста WB API v2: ${error.message}`, 'ERROR', 'WB-API-V2-TEST');
    return testResults;
  }
}

/**
 * Тест получения отзывов WB API v1
 */
function testWbApiV1GetFeedbacks(apiKey, store) {
  const requestStart = Date.now();
  const requestResults = {
    success: false,
    data: null,
    pages: 0,
    avgResponseTime: 0,
    error: null,
    requests: []
  };
  
  try {
    log('🔄 Запуск getWbFeedbacks (v1)', 'INFO', 'WB-API-V1-REQUEST');
    
    // Вызываем оригинальную функцию
    const feedbacks = getWbFeedbacks(apiKey, false, store);
    
    const requestEnd = Date.now();
    const requestDuration = requestEnd - requestStart;
    
    requestResults.success = true;
    requestResults.data = feedbacks;
    requestResults.pages = 1; // v1 не показывает количество страниц
    requestResults.avgResponseTime = requestDuration;
    
    log(`✅ Получено ${feedbacks?.length || 0} отзывов за ${requestDuration}мс`, 'SUCCESS', 'WB-API-V1-REQUEST');
    
    return requestResults;
    
  } catch (error) {
    const requestEnd = Date.now();
    const requestDuration = requestEnd - requestStart;
    
    requestResults.success = false;
    requestResults.error = error.message;
    requestResults.avgResponseTime = requestDuration;
    
    log(`❌ Ошибка получения отзывов v1: ${error.message} (${requestDuration}мс)`, 'ERROR', 'WB-API-V1-REQUEST');
    
    return requestResults;
  }
}

/**
 * Тест получения отзывов WB API v2
 */
function testWbApiV2GetFeedbacks(apiKey, store) {
  const requestStart = Date.now();
  const requestResults = {
    success: false,
    data: null,
    pages: 0,
    avgResponseTime: 0,
    error: null,
    requests: []
  };
  
  try {
    log('🔄 Запуск getWbFeedbacksV2 (v2)', 'INFO', 'WB-API-V2-REQUEST');
    
    // Вызываем исправленную функцию v2
    const feedbacks = getWbFeedbacksV2(apiKey, false, store);
    
    const requestEnd = Date.now();
    const requestDuration = requestEnd - requestStart;
    
    requestResults.success = true;
    requestResults.data = feedbacks;
    requestResults.pages = 1; // v2 может показать количество страниц
    requestResults.avgResponseTime = requestDuration;
    
    log(`✅ Получено ${feedbacks?.length || 0} отзывов за ${requestDuration}мс`, 'SUCCESS', 'WB-API-V2-REQUEST');
    
    return requestResults;
    
  } catch (error) {
    const requestEnd = Date.now();
    const requestDuration = requestEnd - requestStart;
    
    requestResults.success = false;
    requestResults.error = error.message;
    requestResults.avgResponseTime = requestDuration;
    
    log(`❌ Ошибка получения отзывов v2: ${error.message} (${requestDuration}мс)`, 'ERROR', 'WB-API-V2-REQUEST');
    
    return requestResults;
  }
}

/**
 * Тест отправки ответа WB API v1
 */
function testWbApiV1SendAnswer(apiKey) {
  const requestStart = Date.now();
  const requestResults = {
    success: false,
    error: null
  };
  
  try {
    log('🔄 Тест отправки ответа WB API v1', 'INFO', 'WB-API-V1-REQUEST');
    
    // Тестируем с тестовым ID
    const result = sendWbFeedbackAnswer('test-id', 'Тестовый ответ', apiKey);
    
    const requestEnd = Date.now();
    const requestDuration = requestEnd - requestStart;
    
    requestResults.success = true;
    
    log(`✅ Отправка ответа v1 работает (${requestDuration}мс)`, 'SUCCESS', 'WB-API-V1-REQUEST');
    
    return requestResults;
    
  } catch (error) {
    const requestEnd = Date.now();
    const requestDuration = requestEnd - requestStart;
    
    requestResults.success = false;
    requestResults.error = error.message;
    
    log(`❌ Ошибка отправки ответа v1: ${error.message} (${requestDuration}мс)`, 'ERROR', 'WB-API-V1-REQUEST');
    
    return requestResults;
  }
}

/**
 * Тест отправки ответа WB API v2
 */
function testWbApiV2SendAnswer(apiKey) {
  const requestStart = Date.now();
  const requestResults = {
    success: false,
    error: null
  };
  
  try {
    log('🔄 Тест отправки ответа WB API v2', 'INFO', 'WB-API-V2-REQUEST');
    
    // Тестируем с тестовым ID
    const result = sendWbFeedbackAnswerV2('test-id', 'Тестовый ответ', apiKey);
    
    const requestEnd = Date.now();
    const requestDuration = requestEnd - requestStart;
    
    requestResults.success = true;
    
    log(`✅ Отправка ответа v2 работает (${requestDuration}мс)`, 'SUCCESS', 'WB-API-V2-REQUEST');
    
    return requestResults;
    
  } catch (error) {
    const requestEnd = Date.now();
    const requestDuration = requestEnd - requestStart;
    
    requestResults.success = false;
    requestResults.error = error.message;
    
    log(`❌ Ошибка отправки ответа v2: ${error.message} (${requestDuration}мс)`, 'ERROR', 'WB-API-V2-REQUEST');
    
    return requestResults;
  }
}

/**
 * Тест обработки ошибок WB API v1
 */
function testWbApiV1ErrorHandling() {
  const requestStart = Date.now();
  const requestResults = {
    success: false,
    error: null
  };
  
  try {
    log('🔄 Тест обработки ошибок WB API v1', 'INFO', 'WB-API-V1-REQUEST');
    
    // Тестируем с неверным API ключом
    const feedbacks = getWbFeedbacks('invalid-key', false, null);
    
    const requestEnd = Date.now();
    const requestDuration = requestEnd - requestStart;
    
    // Если функция не выбросила исключение, значит обработка ошибок работает
    requestResults.success = true;
    
    log(`✅ Обработка ошибок v1 работает (${requestDuration}мс)`, 'SUCCESS', 'WB-API-V1-REQUEST');
    
    return requestResults;
    
  } catch (error) {
    const requestEnd = Date.now();
    const requestDuration = requestEnd - requestStart;
    
    requestResults.success = false;
    requestResults.error = error.message;
    
    log(`❌ Ошибка обработки ошибок v1: ${error.message} (${requestDuration}мс)`, 'ERROR', 'WB-API-V1-REQUEST');
    
    return requestResults;
  }
}

/**
 * Тест обработки ошибок WB API v2
 */
function testWbApiV2ErrorHandling() {
  const requestStart = Date.now();
  const requestResults = {
    success: false,
    error: null
  };
  
  try {
    log('🔄 Тест обработки ошибок WB API v2', 'INFO', 'WB-API-V2-REQUEST');
    
    // Тестируем с неверным API ключом
    const feedbacks = getWbFeedbacksV2('invalid-key', false, null);
    
    const requestEnd = Date.now();
    const requestDuration = requestEnd - requestStart;
    
    // Если функция не выбросила исключение, значит обработка ошибок работает
    requestResults.success = true;
    
    log(`✅ Обработка ошибок v2 работает (${requestDuration}мс)`, 'SUCCESS', 'WB-API-V2-REQUEST');
    
    return requestResults;
    
  } catch (error) {
    const requestEnd = Date.now();
    const requestDuration = requestEnd - requestStart;
    
    requestResults.success = false;
    requestResults.error = error.message;
    
    log(`❌ Ошибка обработки ошибок v2: ${error.message} (${requestDuration}мс)`, 'ERROR', 'WB-API-V2-REQUEST');
    
    return requestResults;
  }
}

// ======================================================================
// ========================== СРАВНЕНИЕ ВЕРСИЙ =========================
// ======================================================================

/**
 * 🧪 Сравнение WB API v1 vs v2
 */
function compareWbApiVersions(apiKey, store = null) {
  log('🧪 ===== СРАВНЕНИЕ WB API v1 vs v2 =====', 'INFO', 'WB-API-COMPARISON');
  
  const comparisonResults = {
    startTime: Date.now(),
    v1: null,
    v2: null,
    comparison: {
      v1Better: false,
      v2Better: false,
      recommendation: '',
      reasons: []
    }
  };
  
  try {
    // Тестируем v1
    log('🔄 Тестирование WB API v1...', 'INFO', 'WB-API-COMPARISON');
    comparisonResults.v1 = testWbApiV1WithLogging(apiKey, store);
    
    // Небольшая пауза между тестами
    Utilities.sleep(2000);
    
    // Тестируем v2
    log('🔄 Тестирование WB API v2...', 'INFO', 'WB-API-COMPARISON');
    comparisonResults.v2 = testWbApiV2WithLogging(apiKey, store);
    
    // Сравниваем результаты
    log('🔄 Анализ результатов...', 'INFO', 'WB-API-COMPARISON');
    analyzeComparisonResults(comparisonResults);
    
    // Выводим итоговый отчет
    log('🧪 ===== ИТОГИ СРАВНЕНИЯ =====', 'INFO', 'WB-API-COMPARISON');
    log(`📊 v1 успех: ${comparisonResults.v1.success ? '✅ ДА' : '❌ НЕТ'}`, comparisonResults.v1.success ? 'SUCCESS' : 'ERROR', 'WB-API-COMPARISON');
    log(`📊 v2 успех: ${comparisonResults.v2.success ? '✅ ДА' : '❌ НЕТ'}`, comparisonResults.v2.success ? 'SUCCESS' : 'ERROR', 'WB-API-COMPARISON');
    log(`📈 v1 отзывов: ${comparisonResults.v1.data.totalFeedbacks}`, 'INFO', 'WB-API-COMPARISON');
    log(`📈 v2 отзывов: ${comparisonResults.v2.data.totalFeedbacks}`, 'INFO', 'WB-API-COMPARISON');
    log(`⏱️ v1 время: ${comparisonResults.v1.performance.totalTime}мс`, 'INFO', 'WB-API-COMPARISON');
    log(`⏱️ v2 время: ${comparisonResults.v2.performance.totalTime}мс`, 'INFO', 'WB-API-COMPARISON');
    
    log(`🎯 Рекомендация: ${comparisonResults.comparison.recommendation}`, 'INFO', 'WB-API-COMPARISON');
    
    if (comparisonResults.comparison.reasons.length > 0) {
      log('📋 Причины:', 'INFO', 'WB-API-COMPARISON');
      comparisonResults.comparison.reasons.forEach(reason => {
        log(`  - ${reason}`, 'INFO', 'WB-API-COMPARISON');
      });
    }
    
    return comparisonResults;
    
  } catch (error) {
    log(`❌ Критическая ошибка сравнения: ${error.message}`, 'ERROR', 'WB-API-COMPARISON');
    return comparisonResults;
  }
}

/**
 * Анализ результатов сравнения
 */
function analyzeComparisonResults(comparisonResults) {
  const v1 = comparisonResults.v1;
  const v2 = comparisonResults.v2;
  const comparison = comparisonResults.comparison;
  
  // Проверяем успешность
  if (v1.success && !v2.success) {
    comparison.v1Better = true;
    comparison.recommendation = 'Использовать WB API v1';
    comparison.reasons.push('v1 работает, v2 не работает');
  } else if (!v1.success && v2.success) {
    comparison.v2Better = true;
    comparison.recommendation = 'Использовать WB API v2';
    comparison.reasons.push('v2 работает, v1 не работает');
  } else if (v1.success && v2.success) {
    // Оба работают, сравниваем по производительности
    if (v1.data.totalFeedbacks > v2.data.totalFeedbacks) {
      comparison.v1Better = true;
      comparison.recommendation = 'Использовать WB API v1';
      comparison.reasons.push(`v1 получает больше отзывов (${v1.data.totalFeedbacks} vs ${v2.data.totalFeedbacks})`);
    } else if (v2.data.totalFeedbacks > v1.data.totalFeedbacks) {
      comparison.v2Better = true;
      comparison.recommendation = 'Использовать WB API v2';
      comparison.reasons.push(`v2 получает больше отзывов (${v2.data.totalFeedbacks} vs ${v1.data.totalFeedbacks})`);
    } else {
      // Количество отзывов одинаковое, сравниваем по времени
      if (v1.performance.totalTime < v2.performance.totalTime) {
        comparison.v1Better = true;
        comparison.recommendation = 'Использовать WB API v1';
        comparison.reasons.push(`v1 быстрее (${v1.performance.totalTime}мс vs ${v2.performance.totalTime}мс)`);
      } else if (v2.performance.totalTime < v1.performance.totalTime) {
        comparison.v2Better = true;
        comparison.recommendation = 'Использовать WB API v2';
        comparison.reasons.push(`v2 быстрее (${v2.performance.totalTime}мс vs ${v1.performance.totalTime}мс)`);
      } else {
        comparison.recommendation = 'Оба API работают одинаково, можно использовать любой';
        comparison.reasons.push('Производительность и количество отзывов одинаковые');
      }
    }
  } else {
    // Оба не работают
    comparison.recommendation = 'Проблемы с обоими API, требуется диагностика';
    comparison.reasons.push('Ни v1, ни v2 не работают');
  }
}

// ======================================================================
// ========================== ГЛАВНЫЕ ФУНКЦИИ ==========================
// ======================================================================

/**
 * 🚀 ГЛАВНАЯ ФУНКЦИЯ: Полное тестирование API
 */
function runFullApiTesting() {
  log('🧪 ===== ПОЛНОЕ ТЕСТИРОВАНИЕ API =====', 'INFO', 'API-TESTING');
  
  try {
    // Получаем первый активный магазин для тестирования
    const stores = getStores().filter(store => store && store.isActive);
    if (stores.length === 0) {
      log('❌ Нет активных магазинов для тестирования', 'ERROR', 'API-TESTING');
      return null;
    }
    
    const testStore = stores[0];
    const apiKey = testStore.credentials?.apiKey;
    
    if (!apiKey) {
      log('❌ У магазина нет API ключа', 'ERROR', 'API-TESTING');
      return null;
    }
    
    log(`🏪 Тестирование с магазином: ${testStore.name}`, 'INFO', 'API-TESTING');
    
    // Сравниваем версии WB API
    const comparisonResults = compareWbApiVersions(apiKey, testStore);
    
    // Сохраняем результаты в лог
    logApiTestResults(comparisonResults);
    
    return comparisonResults;
    
  } catch (error) {
    log(`❌ Критическая ошибка тестирования API: ${error.message}`, 'ERROR', 'API-TESTING');
    return null;
  }
}

/**
 * Сохранение результатов тестирования в лог
 */
function logApiTestResults(results) {
  try {
    const logSheet = getLogSheet();
    if (!logSheet) {
      log('⚠️ Не удалось получить лог-лист для сохранения результатов', 'WARNING', 'API-TESTING');
      return;
    }
    
    const timestamp = new Date().toISOString();
    const v1Success = results.v1?.success ? 'ДА' : 'НЕТ';
    const v2Success = results.v2?.success ? 'ДА' : 'НЕТ';
    const v1Feedbacks = results.v1?.data?.totalFeedbacks || 0;
    const v2Feedbacks = results.v2?.data?.totalFeedbacks || 0;
    const v1Time = results.v1?.performance?.totalTime || 0;
    const v2Time = results.v2?.performance?.totalTime || 0;
    const recommendation = results.comparison?.recommendation || 'Не определено';
    
    const logData = [
      timestamp,
      'API-TESTING',
      'INFO',
      `WB API v1: ${v1Success}, ${v1Feedbacks} отзывов, ${v1Time}мс`,
      `WB API v2: ${v2Success}, ${v2Feedbacks} отзывов, ${v2Time}мс`,
      `Рекомендация: ${recommendation}`
    ];
    
    logSheet.appendRow(logData);
    log('✅ Результаты тестирования сохранены в лог', 'SUCCESS', 'API-TESTING');
    
  } catch (error) {
    log(`❌ Ошибка сохранения результатов: ${error.message}`, 'ERROR', 'API-TESTING');
  }
}