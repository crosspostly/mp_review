/**
 * @file wb_api.gs
 * @description Модуль для работы с Wildberries API
 * @version 2.0
 * @date 2025-10-26
 * 
 * АРХИТЕКТУРА:
 * - Чистые API функции для Wildberries
 * - Единообразная обработка ошибок
 * - Интеграция с системой логирования
 * - Rate limiting и retry логика
 */

/**
 * Получает отзывы с Wildberries API
 * @param {Object} store - Объект магазина с credentials
 * @param {boolean} includeAnswered - Включать отвеченные отзывы
 * @param {Object} options - Дополнительные опции
 * @returns {Promise<Array>} Массив отзывов
 */
function getWbFeedbacks(store, includeAnswered = false, options = {}) {
  const timer = new PerformanceTimer(`getWbFeedbacks-${store.id}`);
  
  try {
    if (!store?.credentials?.apiKey) {
      throw new Error('Не указан API ключ для Wildberries');
    }
    
    logApiRequest('Wildberries', WB_CONFIG.ENDPOINTS.GET_FEEDBACKS, { includeAnswered });
    
    // Строим параметры запроса
    const params = buildWbApiParams(includeAnswered, store.settings, options);
    const url = `${WB_CONFIG.API_BASE_URL}${WB_CONFIG.ENDPOINTS.GET_FEEDBACKS}?${params}`;
    
    logDebug(`WB API URL: ${url}`, LOG_CONFIG.CATEGORIES.WB_API);
    
    // Выполняем запрос с retry логикой
    const response = makeWbApiRequest(url, store.credentials.apiKey, 'GET');
    
    if (!response.success) {
      throw new Error(`WB API Error: ${response.error}`);
    }
    
    // Обрабатываем ответ
    const feedbacks = processWbApiResponse(response.data, store);
    
    logApiResponse('Wildberries', WB_CONFIG.ENDPOINTS.GET_FEEDBACKS, 200, timer.startTime);
    logSuccess(`WB: Получено ${feedbacks.length} отзывов для ${store.name}`, LOG_CONFIG.CATEGORIES.WB_API);
    
    timer.finish(LOG_CONFIG.LEVELS.SUCCESS);
    return feedbacks;
    
  } catch (error) {
    logApiError('Wildberries', WB_CONFIG.ENDPOINTS.GET_FEEDBACKS, error);
    timer.finish(LOG_CONFIG.LEVELS.ERROR);
    throw error;
  }
}

/**
 * Отправляет ответ на отзыв в Wildberries
 * @param {string} feedbackId - ID отзыва
 * @param {string} answerText - Текст ответа
 * @param {Object} store - Объект магазина
 * @returns {Object} Результат отправки
 */
function sendWbFeedbackAnswer(feedbackId, answerText, store) {
  const timer = new PerformanceTimer(`sendWbFeedbackAnswer-${feedbackId}`);
  
  try {
    if (!store?.credentials?.apiKey) {
      throw new Error('Не указан API ключ для Wildberries');
    }
    
    if (!feedbackId || !answerText) {
      throw new Error('Не указан ID отзыва или текст ответа');
    }
    
    // Валидируем длину текста
    if (answerText.length > 1000) {
      throw new Error('Текст ответа превышает лимит 1000 символов');
    }
    
    logApiRequest('Wildberries', 'send_answer', { feedbackId, textLength: answerText.length });
    
    const url = `${WB_CONFIG.API_BASE_URL}${WB_CONFIG.ENDPOINTS.SEND_ANSWER}/${feedbackId}/answer`;
    const payload = { text: answerText };
    
    // Выполняем запрос
    const response = makeWbApiRequest(url, store.credentials.apiKey, 'POST', payload);
    
    if (response.success) {
      logSuccess(`WB: Ответ отправлен на отзыв ${feedbackId}`, LOG_CONFIG.CATEGORIES.WB_API);
      timer.finish(LOG_CONFIG.LEVELS.SUCCESS);
      
      return {
        success: true,
        feedbackId: feedbackId,
        message: 'Ответ успешно отправлен'
      };
    } else {
      throw new Error(response.error);
    }
    
  } catch (error) {
    logApiError('Wildberries', 'send_answer', error);
    timer.finish(LOG_CONFIG.LEVELS.ERROR);
    
    return {
      success: false,
      feedbackId: feedbackId,
      error: error.message
    };
  }
}

/**
 * Получает информацию о товарах через WB Content API
 * @param {Array} productIds - Массив ID товаров (nmId)
 * @param {Object} store - Объект магазина
 * @returns {Object} Объект с информацией о товарах
 */
function getWbProductsInfo(productIds, store) {
  const timer = new PerformanceTimer(`getWbProductsInfo-${store.id}`);
  
  try {
    if (!store?.credentials?.apiKey) {
      throw new Error('Не указан API ключ для Wildberries');
    }
    
    if (!productIds || productIds.length === 0) {
      return {};
    }
    
    // WB Content API поддерживает до 100 товаров за запрос
    const batchSize = 100;
    const productInfo = {};
    
    for (let i = 0; i < productIds.length; i += batchSize) {
      const batch = productIds.slice(i, i + batchSize);
      
      logDebug(`WB Content API: Запрашиваем информацию о ${batch.length} товарах`, LOG_CONFIG.CATEGORIES.WB_API);
      
      const url = `${WB_CONFIG.CONTENT_API.BASE_URL}${WB_CONFIG.CONTENT_API.ENDPOINTS.CARD_LIST}`;
      const payload = { settings: { cursor: { limit: batch.length }, filter: { withPhoto: -1 } } };
      
      const response = makeWbApiRequest(url, store.credentials.apiKey, 'POST', payload);
      
      if (response.success && response.data?.result?.cards) {
        response.data.result.cards.forEach(card => {
          productInfo[card.nmID] = {
            name: card.title || 'Без названия',
            brand: card.brand || '',
            article: card.vendorCode || '',
            url: `https://www.wildberries.ru/catalog/${card.nmID}/detail.aspx`
          };
        });
      }
      
      // Rate limiting между батчами
      if (i + batchSize < productIds.length) {
        Utilities.sleep(getApiDelay('wildberries'));
      }
    }
    
    logSuccess(`WB Content API: Получена информация о ${Object.keys(productInfo).length} товарах`, LOG_CONFIG.CATEGORIES.WB_API);
    timer.finish(LOG_CONFIG.LEVELS.SUCCESS);
    
    return productInfo;
    
  } catch (error) {
    logApiError('Wildberries', 'products_info', error);
    timer.finish(LOG_CONFIG.LEVELS.ERROR);
    return {};
  }
}

// ============ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ============

/**
 * Строит параметры для WB API запроса
 */
function buildWbApiParams(includeAnswered, settings = {}, options = {}) {
  // ИСПРАВЛЕНО: URLSearchParams не поддерживается в Google Apps Script
  const params = [];
  
  // Основные параметры
  params.push(`take=${options.take || WB_CONFIG.API_LIMITS.MAX_TAKE}`);
  params.push(`skip=${options.skip || WB_CONFIG.API_LIMITS.DEFAULT_SKIP}`);
  params.push('order=dateDesc'); // Новые сначала
  
  // Фильтр по отвеченным отзывам
  if (includeAnswered !== undefined) {
    params.push(`hasSupplierFeedback=${includeAnswered ? 'true' : 'false'}`);
  }
  
  // Фильтр по дате (если указан в настройках магазина)
  if (settings?.startDate) {
    try {
      const startDate = new Date(settings.startDate);
      const unixTimestamp = Math.floor(startDate.getTime() / 1000);
      params.push(`dateFrom=${unixTimestamp}`);
      logDebug(`WB API: Фильтр по дате от ${settings.startDate} (${unixTimestamp})`, LOG_CONFIG.CATEGORIES.WB_API);
    } catch (error) {
      logWarning(`WB API: Некорректная дата фильтра: ${settings.startDate}`, LOG_CONFIG.CATEGORIES.WB_API);
    }
  }
  
  return params.join('&');
}

/**
 * Выполняет HTTP запрос к WB API с retry логикой
 */
function makeWbApiRequest(url, apiKey, method = 'GET', payload = null, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const options = {
        method: method,
        headers: {
          'Authorization': apiKey,
          'Content-Type': 'application/json'
        },
        muteHttpExceptions: true,
        followRedirects: true
      };
      
      if (payload && method === 'POST') {
        options.payload = JSON.stringify(payload);
      }
      
      const response = UrlFetchApp.fetch(url, options);
      const responseCode = response.getResponseCode();
      const responseText = response.getContentText();
      
      logDebug(`WB API ${method}: HTTP ${responseCode} (попытка ${attempt})`, LOG_CONFIG.CATEGORIES.WB_API);
      
      if (responseCode >= 200 && responseCode < 300) {
        // Успешный ответ
        let data = null;
        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
          logWarning(`WB API: Не удалось разобрать JSON ответ`, LOG_CONFIG.CATEGORIES.WB_API);
        }
        
        return { success: true, data, responseCode };
      } else if (responseCode === 429) {
        // Rate limit exceeded - увеличиваем задержку
        const retryDelay = Math.pow(2, attempt) * 1000;
        logWarning(`WB API: Rate limit (429), задержка ${retryDelay}мс`, LOG_CONFIG.CATEGORIES.WB_API);
        Utilities.sleep(retryDelay);
        continue;
      } else if (responseCode >= 500 && attempt < maxRetries) {
        // Серверная ошибка - повторяем запрос
        const retryDelay = Math.pow(2, attempt) * 1000;
        logWarning(`WB API: Серверная ошибка ${responseCode}, повтор через ${retryDelay}мс`, LOG_CONFIG.CATEGORIES.WB_API);
        Utilities.sleep(retryDelay);
        continue;
      } else {
        // Клиентская ошибка или исчерпаны попытки
        return {
          success: false,
          error: `HTTP ${responseCode}: ${responseText}`,
          responseCode
        };
      }
    } catch (error) {
      if (attempt === maxRetries) {
        return {
          success: false,
          error: error.message,
          responseCode: 0
        };
      } else {
        const retryDelay = Math.pow(2, attempt) * 1000;
        logWarning(`WB API: Ошибка сети (${error.message}), повтор через ${retryDelay}мс`, LOG_CONFIG.CATEGORIES.WB_API);
        Utilities.sleep(retryDelay);
      }
    }
  }
  
  return {
    success: false,
    error: 'Исчерпаны попытки выполнения запроса',
    responseCode: 0
  };
}

/**
 * Обрабатывает ответ WB API и нормализует данные
 */
function processWbApiResponse(apiResponse, store) {
  try {
    if (!apiResponse || !apiResponse.data || !apiResponse.data.feedbacks) {
      logWarning('WB API: Пустой или некорректный ответ', LOG_CONFIG.CATEGORIES.WB_API);
      return [];
    }
    
    const rawFeedbacks = apiResponse.data.feedbacks;
    const normalizedFeedbacks = [];
    
    rawFeedbacks.forEach(feedback => {
      try {
        // Пропускаем отзывы без текста (только оценки товара)
        if (!feedback.text || feedback.text.trim().length < CONFIG.MIN_REVIEW_TEXT_LENGTH) {
          return;
        }
        
        // Определяем рейтинг (приоритет: rating отзыва, потом productValuation товара)
        const rating = feedback.rating || feedback.productValuation || 0;
        
        // Фильтруем по рейтингу
        if (!CONFIG.RESPOND_TO_RATINGS.includes(rating)) {
          return;
        }
        
        const normalizedFeedback = {
          id: feedback.id,
          createdDate: feedback.createdDate,
          rating: rating,
          text: feedback.text.trim(),
          user: feedback.userName || 'Аноним',
          hasAnswer: !!feedback.answer, // Есть ли уже ответ от магазина
          product: {
            id: feedback.productDetails?.nmId || feedback.nmId,
            name: feedback.productDetails?.productName || 'Требуется загрузка',
            article: feedback.productDetails?.supplierArticle || '',
            url: `https://www.wildberries.ru/catalog/${feedback.productDetails?.nmId || feedback.nmId}/detail.aspx`
          },
          metadata: {
            source: 'wildberries',
            storeId: store.id,
            storeName: store.name,
            processedAt: new Date()
          }
        };
        
        normalizedFeedbacks.push(normalizedFeedback);
        
      } catch (error) {
        logWarning(`WB API: Ошибка обработки отзыва ${feedback.id}: ${error.message}`, LOG_CONFIG.CATEGORIES.WB_API);
      }
    });
    
    logInfo(`WB API: Обработано ${normalizedFeedbacks.length} отзывов из ${rawFeedbacks.length}`, LOG_CONFIG.CATEGORIES.WB_API);
    
    return normalizedFeedbacks;
    
  } catch (error) {
    logError(`WB API: Ошибка обработки ответа: ${error.message}`, LOG_CONFIG.CATEGORIES.WB_API);
    return [];
  }
}

/**
 * Валидирует настройки магазина для WB API
 */
function validateWbStoreSettings(store) {
  const errors = [];
  
  if (!store?.credentials?.apiKey) {
    errors.push('Не указан API ключ');
  } else if (store.credentials.apiKey.length < 10) {
    errors.push('API ключ слишком короткий');
  }
  
  if (store?.settings?.startDate) {
    try {
      const date = new Date(store.settings.startDate);
      if (isNaN(date.getTime())) {
        errors.push('Некорректный формат даты начала');
      }
    } catch (error) {
      errors.push('Ошибка парсинга даты начала');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors: errors
  };
}

/**
 * Тестирует подключение к WB API
 */
function testWbApiConnection(store) {
  const timer = new PerformanceTimer(`testWbApiConnection-${store.id}`);
  
  try {
    logInfo(`Тестирование WB API для магазина ${store.name}`, LOG_CONFIG.CATEGORIES.WB_API);
    
    // Валидируем настройки
    const validation = validateWbStoreSettings(store);
    if (!validation.isValid) {
      return {
        success: false,
        error: `Некорректные настройки: ${validation.errors.join(', ')}`
      };
    }
    
    // Выполняем тестовый запрос (1 отзыв)
    const url = buildWbTestUrl();
    const response = makeWbApiRequest(url, store.credentials.apiKey, 'GET');
    
    timer.finish(response.success ? LOG_CONFIG.LEVELS.SUCCESS : LOG_CONFIG.LEVELS.ERROR);
    
    if (response.success) {
      logSuccess(`WB API: Подключение успешно для магазина ${store.name}`, LOG_CONFIG.CATEGORIES.WB_API);
      return {
        success: true,
        message: 'Подключение к WB API успешно',
        responseCode: response.responseCode
      };
    } else {
      return {
        success: false,
        error: response.error,
        responseCode: response.responseCode
      };
    }
    
  } catch (error) {
    timer.finish(LOG_CONFIG.LEVELS.ERROR);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Строит URL для тестового запроса
 */
function buildWbTestUrl() {
  // ИСПРАВЛЕНО: URLSearchParams не поддерживается в Google Apps Script
  const params = ['take=1', 'skip=0', 'order=dateDesc'];
  
  return `${WB_CONFIG.API_BASE_URL}${WB_CONFIG.ENDPOINTS.GET_FEEDBACKS}?${params.join('&')}`;
}

/**
 * Получает статистику работы с WB API
 */
function getWbApiStatistics(storeId) {
  try {
    // Можно расширить для сбора метрик
    return {
      storeId: storeId,
      apiVersion: 'v1',
      lastTested: null,
      requestsCount: 0, // TODO: Implement counters
      errorsCount: 0,
      averageResponseTime: 0
    };
  } catch (error) {
    logError(`Ошибка получения статистики WB API: ${error.message}`, LOG_CONFIG.CATEGORIES.WB_API);
    return null;
  }
}

// ============ РАСШИРЕННЫЕ ФУНКЦИИ ТЕСТИРОВАНИЯ ============

/**
 * Тестирует соединение с Wildberries API (улучшенная версия)
 */
function testWbConnection(store) {
  const timer = new PerformanceTimer('testWbConnection');
  
  try {
    logInfo(`Тестирование WB API соединения для магазина: ${store.name}`, LOG_CONFIG.CATEGORIES.API);
    
    if (!store.credentials?.apiKey) {
      return {
        success: false,
        message: 'API ключ не найден в настройках магазина'
      };
    }
    
    // Используем существующую функцию testWbApiConnection
    const testResult = testWbApiConnection(store);
    
    if (testResult.success) {
      // Дополнительно пытаемся получить небольшое количество отзывов
      try {
        const feedbacks = getWbFeedbacks(store, false, { take: 1 });
        
        logSuccess(`WB API тест успешен: получено ${feedbacks.length} отзывов`, LOG_CONFIG.CATEGORIES.API);
        timer.finish(LOG_CONFIG.LEVELS.SUCCESS);
        
        return {
          success: true,
          message: `Соединение работает. Доступно отзывов для обработки: ${feedbacks.length}`,
          data: {
            feedbacksCount: feedbacks.length,
            responseTime: timer.getTotalTime()
          }
        };
      } catch (error) {
        return {
          success: true, // API работает, но возможны проблемы с данными
          message: `API доступен, но есть проблемы с получением данных: ${error.message}`,
          warning: true
        };
      }
    } else {
      timer.finish(LOG_CONFIG.LEVELS.ERROR);
      return {
        success: false,
        message: `Ошибка API: ${testResult.error}`,
        error: testResult.error
      };
    }
    
  } catch (error) {
    logError(`Критическая ошибка WB API теста: ${error.message}`, LOG_CONFIG.CATEGORIES.API);
    timer.finish(LOG_CONFIG.LEVELS.ERROR);
    
    return {
      success: false,
      message: `Критическая ошибка: ${error.message}`,
      error: error.message
    };
  }
}
