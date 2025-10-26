/**
 * @file ozon_api_fixed.gs
 * @description Модуль для работы с Ozon API - исправленная версия
 * @version 2.1
 * @date 2025-10-26
 * 
 * АРХИТЕКТУРА:
 * - Чистые API функции для Ozon
 * - Cursor-based пагинация
 * - Система полосок для больших магазинов
 * - Интеграция с кеш-менеджером
 * - ✅ ДОДЕЛАНО: Полная статистика с счетчиками
 */

/**
 * Получает отзывы с Ozon API с поддержкой пагинации
 * @param {Object} store - Объект магазина с credentials
 * @param {boolean} includeAnswered - Включать отвеченные отзывы
 * @param {Object} options - Дополнительные опции
 * @returns {Array} Массив отзывов
 */
function getOzonFeedbacks(store, includeAnswered = false, options = {}) {
  const timer = new PerformanceTimer(`getOzonFeedbacks-${store.id}`);
  
  try {
    if (!store?.credentials?.clientId || !store?.credentials?.apiKey) {
      throw new Error('Не указаны Client ID или API Key для Ozon');
    }
    
    logApiRequest('Ozon', OZON_CONFIG.ENDPOINTS.GET_FEEDBACKS, { includeAnswered });
    
    // Определяем стратегию пагинации
    const useAdaptivePagination = store?.settings?.startDate;
    
    let feedbacks = [];
    if (useAdaptivePagination) {
      logInfo(`Ozon: Используем адаптивную пагинацию для ${store.name}`, LOG_CONFIG.CATEGORIES.OZON_API);
      feedbacks = getOzonFeedbacksWithAdaptivePagination(store, includeAnswered, options);
    } else {
      logInfo(`Ozon: Используем стандартную пагинацию для ${store.name}`, LOG_CONFIG.CATEGORIES.OZON_API);
      feedbacks = getOzonFeedbacksWithStandardPagination(store, includeAnswered, options);
    }
    
    logSuccess(`Ozon: Получено ${feedbacks.length} отзывов для ${store.name}`, LOG_CONFIG.CATEGORIES.OZON_API);
    timer.finish(LOG_CONFIG.LEVELS.SUCCESS);
    
    return feedbacks;
    
  } catch (error) {
    logApiError('Ozon', OZON_CONFIG.ENDPOINTS.GET_FEEDBACKS, error);
    timer.finish(LOG_CONFIG.LEVELS.ERROR);
    throw error;
  }
}

/**
 * Стандартная пагинация для Ozon API
 */
function getOzonFeedbacksWithStandardPagination(store, includeAnswered, options = {}) {
  const timer = new PerformanceTimer(`getOzonFeedbacksStandard-${store.id}`);
  
  try {
    const allFeedbacks = [];
    const maxPages = options.maxPages || OZON_CONFIG.API_LIMITS.MAX_PAGES_STANDARD;
    const limit = options.limit || OZON_CONFIG.API_LIMITS.DEFAULT_LIMIT;
    
    let lastId = '';
    let hasNext = true;
    let pageNumber = 0;
    
    // Получаем прогресс из кеша если есть
    const progress = getStoreProgress(store.id, 'collect');
    if (progress?.lastId) {
      lastId = progress.lastId;
      pageNumber = progress.pageNumber || 0;
      logInfo(`Ozon: Продолжаем с lastId=${lastId}, страница ${pageNumber}`, LOG_CONFIG.CATEGORIES.OZON_API);
    }
    
    while (hasNext && pageNumber < maxPages) {
      const startTime = Date.now();
      
      logDebug(`Ozon: Запрашиваем страницу ${pageNumber + 1} (lastId: ${lastId})`, LOG_CONFIG.CATEGORIES.OZON_API);
      
      const pageResponse = getOzonFeedbacksPage(store, includeAnswered, lastId, limit);
      
      if (!pageResponse.success) {
        logError(`Ozon: Ошибка получения страницы ${pageNumber + 1}: ${pageResponse.error}`, LOG_CONFIG.CATEGORIES.OZON_API);
        break;
      }
      
      const pageFeedbacks = pageResponse.feedbacks;
      const pageLastId = pageResponse.lastId;
      
      if (!pageFeedbacks || pageFeedbacks.length === 0) {
        logInfo(`Ozon: Страница ${pageNumber + 1} пуста, завершаем пагинацию`, LOG_CONFIG.CATEGORIES.OZON_API);
        hasNext = false;
        break;
      }
      
      // Фильтруем новые отзывы через кеш
      const newFeedbacks = filterNewReviewsForStore(store.id, pageFeedbacks);
      allFeedbacks.push(...newFeedbacks);
      
      // Добавляем ID в кеш
      const reviewIds = pageFeedbacks.map(f => f.id);
      addToReviewIdsCacheForStore(store.id, reviewIds);
      
      logInfo(`Ozon: Страница ${pageNumber + 1}: ${pageFeedbacks.length} отзывов, ${newFeedbacks.length} новых`, LOG_CONFIG.CATEGORIES.OZON_API);
      
      // Сохраняем прогресс
      saveStoreProgress(store.id, 'collect', {
        lastId: pageLastId,
        pageNumber: pageNumber + 1,
        totalProcessed: allFeedbacks.length
      });
      
      // Обновляем данные для следующей итерации
      lastId = pageLastId;
      pageNumber++;
      hasNext = pageFeedbacks.length >= limit;
      
      // Rate limiting
      const responseTime = Date.now() - startTime;
      const delay = getApiDelay('ozon');
      if (responseTime < delay) {
        Utilities.sleep(delay - responseTime);
      }
    }
    
    // Очищаем прогресс при завершении
    if (!hasNext) {
      clearStoreProgress(store.id, 'collect');
    }
    
    timer.finish(LOG_CONFIG.LEVELS.SUCCESS);
    return allFeedbacks;
    
  } catch (error) {
    logError(`Ozon Standard: Ошибка пагинации для ${store.id}: ${error.message}`, LOG_CONFIG.CATEGORIES.OZON_API);
    timer.finish(LOG_CONFIG.LEVELS.ERROR);
    throw error;
  }
}

/**
 * Адаптивная пагинация для поиска отзывов по дате
 */
function getOzonFeedbacksWithAdaptivePagination(store, includeAnswered, options = {}) {
  const timer = new PerformanceTimer(`getOzonFeedbacksAdaptive-${store.id}`);
  
  try {
    if (!store.settings?.startDate) {
      logWarning('Ozon: Нет даты для адаптивной пагинации, переключаемся на стандартную', LOG_CONFIG.CATEGORIES.OZON_API);
      return getOzonFeedbacksWithStandardPagination(store, includeAnswered, options);
    }
    
    const targetDate = new Date(store.settings.startDate);
    const maxPages = options.maxPages || OZON_CONFIG.API_LIMITS.MAX_PAGES_ADAPTIVE;
    const limit = options.limit || OZON_CONFIG.API_LIMITS.DEFAULT_LIMIT;
    
    logInfo(`Ozon Adaptive: Ищем отзывы от ${targetDate.toISOString()} для ${store.name}`, LOG_CONFIG.CATEGORIES.OZON_API);
    
    const allFeedbacks = [];
    let lastId = '';
    let hasNext = true;
    let pageNumber = 0;
    let skipMultiplier = 1; // Коэффициент пропуска страниц
    let foundTargetPeriod = false;
    
    // Получаем прогресс из системы памяти
    const progress = getStoreProgress(store.id, 'collect_adaptive');
    if (progress) {
      lastId = progress.lastId || '';
      pageNumber = progress.pageNumber || 0;
      skipMultiplier = progress.skipMultiplier || 1;
      foundTargetPeriod = progress.foundTargetPeriod || false;
      
      logInfo(`Ozon Adaptive: Продолжаем с страницы ${pageNumber}, skip=${skipMultiplier}`, LOG_CONFIG.CATEGORIES.OZON_API);
    }
    
    while (hasNext && pageNumber < maxPages) {
      const startTime = Date.now();
      
      logDebug(`Ozon Adaptive: Страница ${pageNumber + 1}, skip=${skipMultiplier}, lastId=${lastId}`, LOG_CONFIG.CATEGORIES.OZON_API);
      
      const pageResponse = getOzonFeedbacksPage(store, includeAnswered, lastId, limit);
      
      if (!pageResponse.success) {
        logError(`Ozon Adaptive: Ошибка страницы ${pageNumber + 1}: ${pageResponse.error}`, LOG_CONFIG.CATEGORIES.OZON_API);
        break;
      }
      
      const pageFeedbacks = pageResponse.feedbacks;
      if (!pageFeedbacks || pageFeedbacks.length === 0) {
        logInfo(`Ozon Adaptive: Страница ${pageNumber + 1} пуста, завершаем`, LOG_CONFIG.CATEGORIES.OZON_API);
        break;
      }
      
      // Анализируем даты на странице
      const pageReviewsInRange = pageFeedbacks.filter(review => {
        const reviewDate = new Date(review.createdDate);
        return reviewDate >= targetDate;
      });
      
      const newestOnPage = pageFeedbacks.reduce((newest, review) => {
        const reviewDate = new Date(review.createdDate);
        return reviewDate > newest ? reviewDate : newest;
      }, new Date(0));
      
      logDebug(`Ozon Adaptive: Страница ${pageNumber + 1}, новейший отзыв: ${newestOnPage.toISOString()}`, LOG_CONFIG.CATEGORIES.OZON_API);
      
      if (!foundTargetPeriod && newestOnPage > targetDate) {
        // Еще не дошли до целевого периода - ускоряемся
        skipMultiplier = Math.min(skipMultiplier * 2, 10); // Максимум x10
        
        // Пропускаем страницы
        for (let skip = 0; skip < skipMultiplier - 1; skip++) {
          if (!pageResponse.lastId) break;
          
          const skipResponse = getOzonFeedbacksPage(store, includeAnswered, pageResponse.lastId, limit);
          if (!skipResponse.success || !skipResponse.feedbacks || skipResponse.feedbacks.length === 0) {
            break;
          }
          
          lastId = skipResponse.lastId;
          pageNumber++;
          
          // Небольшая задержка при пропуске
          Utilities.sleep(100);
        }
        
        logInfo(`Ozon Adaptive: Пропущено ${skipMultiplier - 1} страниц, новая позиция: ${pageNumber}`, LOG_CONFIG.CATEGORIES.OZON_API);
      } else {
        // Дошли до целевого периода или уже в нем
        if (!foundTargetPeriod) {
          foundTargetPeriod = true;
          skipMultiplier = 1;
          logInfo(`Ozon Adaptive: Достигли целевого периода на странице ${pageNumber + 1}`, LOG_CONFIG.CATEGORIES.OZON_API);
        }
        
        // Фильтруем отзывы по дате и кешу
        const newReviewsInRange = filterNewReviewsForStore(store.id, pageReviewsInRange);
        allFeedbacks.push(...newReviewsInRange);
        
        // Добавляем все ID в кеш
        const allPageIds = pageFeedbacks.map(f => f.id);
        addToReviewIdsCacheForStore(store.id, allPageIds);
        
        logInfo(`Ozon Adaptive: Найдено ${pageReviewsInRange.length} отзывов в диапазоне, ${newReviewsInRange.length} новых`, LOG_CONFIG.CATEGORIES.OZON_API);
      }
      
      // Сохраняем прогресс
      saveStoreProgress(store.id, 'collect_adaptive', {
        lastId: pageResponse.lastId,
        pageNumber: pageNumber + 1,
        skipMultiplier: skipMultiplier,
        foundTargetPeriod: foundTargetPeriod,
        totalProcessed: allFeedbacks.length
      });
      
      // Подготавливаем к следующей итерации
      lastId = pageResponse.lastId;
      pageNumber++;
      hasNext = pageFeedbacks.length >= limit && !!pageResponse.lastId;
      
      // Rate limiting
      const responseTime = Date.now() - startTime;
      const delay = getApiDelay('ozon');
      if (responseTime < delay) {
        Utilities.sleep(delay - responseTime);
      }
      
      // Дополнительная пауза каждые 10 страниц
      if (pageNumber % 10 === 0) {
        logDebug('Ozon Adaptive: Пауза каждые 10 страниц', LOG_CONFIG.CATEGORIES.OZON_API);
        Utilities.sleep(OZON_CONFIG.RATE_LIMITS.PAUSE_DURATION);
      }
    }
    
    // Очищаем прогресс при завершении
    if (!hasNext) {
      clearStoreProgress(store.id, 'collect_adaptive');
    }
    
    logSuccess(`Ozon Adaptive: Найдено ${allFeedbacks.length} отзывов в целевом периоде`, LOG_CONFIG.CATEGORIES.OZON_API);
    timer.finish(LOG_CONFIG.LEVELS.SUCCESS);
    
    return allFeedbacks;
    
  } catch (error) {
    logError(`Ozon Adaptive: Ошибка для ${store.id}: ${error.message}`, LOG_CONFIG.CATEGORIES.OZON_API);
    timer.finish(LOG_CONFIG.LEVELS.ERROR);
    throw error;
  }
}

/**
 * Получает одну страницу отзывов с Ozon API
 */
function getOzonFeedbacksPage(store, includeAnswered, lastId = '', limit = 100) {
  const startTime = Date.now();
  
  try {
    // ✅ ИНТЕГРАЦИЯ СТАТИСТИКИ
    const apiStats = getApiStatsTracker();
    apiStats.incrementRequests('ozon');
    
    const url = `${OZON_CONFIG.API_BASE_URL}${OZON_CONFIG.ENDPOINTS.GET_FEEDBACKS}`;
    
    const payload = {
      limit: Math.min(limit, OZON_CONFIG.API_LIMITS.MAX_LIMIT),
      with_photos: false
    };
    
    if (lastId) {
      payload.last_id = lastId;
    }
    
    const response = makeOzonApiRequest(
      url, 
      store.credentials.clientId, 
      store.credentials.apiKey, 
      'POST', 
      payload
    );
    
    // ✅ ЗАПИСЫВАЕМ ВРЕМЯ ОТВЕТА
    const responseTime = Date.now() - startTime;
    apiStats.recordResponseTime('ozon', responseTime);
    
    if (!response.success) {
      apiStats.incrementErrors('ozon');
      return {
        success: false,
        error: response.error,
        feedbacks: [],
        lastId: null
      };
    }
    
    // Обрабатываем ответ (исправленная структура)
    const feedbacks = processOzonApiResponse(response.data, store, includeAnswered);
    const newLastId = extractOzonLastId(response.data);
    
    return {
      success: true,
      feedbacks: feedbacks,
      lastId: newLastId,
      error: null
    };
    
  } catch (error) {
    logError(`Ozon Page: Ошибка получения страницы: ${error.message}`, LOG_CONFIG.CATEGORIES.OZON_API);
    const apiStats = getApiStatsTracker();
    apiStats.incrementErrors('ozon');
    return {
      success: false,
      error: error.message,
      feedbacks: [],
      lastId: null
    };
  }
}

/**
 * Отправляет ответ на отзыв в Ozon
 */
function sendOzonFeedbackAnswer(feedbackId, answerText, store) {
  const timer = new PerformanceTimer(`sendOzonFeedbackAnswer-${feedbackId}`);
  const startTime = Date.now();
  
  try {
    if (!store?.credentials?.clientId || !store?.credentials?.apiKey) {
      throw new Error('Не указаны Client ID или API Key для Ozon');
    }
    
    if (!feedbackId || !answerText) {
      throw new Error('Не указан ID отзыва или текст ответа');
    }
    
    // Валидируем длину текста для Ozon (лимит 2000 символов)
    if (answerText.length > 2000) {
      throw new Error('Текст ответа превышает лимит 2000 символов');
    }
    
    // ✅ ИНТЕГРАЦИЯ СТАТИСТИКИ
    const apiStats = getApiStatsTracker();
    apiStats.incrementRequests('ozon');
    
    logApiRequest('Ozon', 'send_answer', { feedbackId, textLength: answerText.length });
    
    const url = `${OZON_CONFIG.API_BASE_URL}${OZON_CONFIG.ENDPOINTS.SEND_ANSWER}`;
    const payload = {
      review_id: feedbackId,
      text: answerText
    };
    
    const response = makeOzonApiRequest(
      url,
      store.credentials.clientId,
      store.credentials.apiKey,
      'POST',
      payload
    );
    
    // ✅ ЗАПИСЫВАЕМ ВРЕМЯ ОТВЕТА
    const responseTime = Date.now() - startTime;
    apiStats.recordResponseTime('ozon', responseTime);
    
    if (response.success) {
      logSuccess(`Ozon: Ответ отправлен на отзыв ${feedbackId}`, LOG_CONFIG.CATEGORIES.OZON_API);
      timer.finish(LOG_CONFIG.LEVELS.SUCCESS);
      
      return {
        success: true,
        feedbackId: feedbackId,
        message: 'Ответ успешно отправлен'
      };
    } else {
      apiStats.incrementErrors('ozon');
      throw new Error(response.error);
    }
    
  } catch (error) {
    logApiError('Ozon', 'send_answer', error);
    timer.finish(LOG_CONFIG.LEVELS.ERROR);
    
    const apiStats = getApiStatsTracker();
    apiStats.incrementErrors('ozon');
    
    return {
      success: false,
      feedbackId: feedbackId,
      error: error.message
    };
  }
}

/**
 * Выполняет HTTP запрос к Ozon API с retry логикой
 */
function makeOzonApiRequest(url, clientId, apiKey, method = 'POST', payload = null, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const options = {
        method: method,
        headers: {
          'Client-Id': clientId,
          'Api-Key': apiKey,
          'Content-Type': 'application/json'
        },
        muteHttpExceptions: true,
        followRedirects: true
      };
      
      if (payload) {
        options.payload = JSON.stringify(payload);
      }
      
      const response = UrlFetchApp.fetch(url, options);
      const responseCode = response.getResponseCode();
      const responseText = response.getContentText();
      
      logDebug(`Ozon API ${method}: HTTP ${responseCode} (попытка ${attempt})`, LOG_CONFIG.CATEGORIES.OZON_API);
      
      if (responseCode >= 200 && responseCode < 300) {
        let data = null;
        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
          logWarning('Ozon API: Не удалось разобрать JSON ответ', LOG_CONFIG.CATEGORIES.OZON_API);
        }
        
        return { success: true, data, responseCode };
      } else if (responseCode === 429) {
        const retryDelay = Math.pow(2, attempt) * 1000;
        logWarning(`Ozon API: Rate limit (429), задержка ${retryDelay}мс`, LOG_CONFIG.CATEGORIES.OZON_API);
        Utilities.sleep(retryDelay);
        continue;
      } else if (responseCode >= 500 && attempt < maxRetries) {
        const retryDelay = Math.pow(2, attempt) * 1000;
        logWarning(`Ozon API: Серверная ошибка ${responseCode}, повтор через ${retryDelay}мс`, LOG_CONFIG.CATEGORIES.OZON_API);
        Utilities.sleep(retryDelay);
        continue;
      } else {
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
        logWarning(`Ozon API: Ошибка сети (${error.message}), повтор через ${retryDelay}мс`, LOG_CONFIG.CATEGORIES.OZON_API);
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
 * Обрабатывает ответ Ozon API и нормализует данные
 */
function processOzonApiResponse(apiResponse, store, includeAnswered = false) {
  try {
    // ИСПРАВЛЕНО: Данные могут быть в разных местах
    const rawReviews = apiResponse?.reviews || apiResponse?.result?.reviews || [];
    
    if (!rawReviews || rawReviews.length === 0) {
      logDebug('Ozon API: Нет отзывов в ответе', LOG_CONFIG.CATEGORIES.OZON_API);
      return [];
    }
    
    const normalizedReviews = [];
    
    rawReviews.forEach(review => {
      try {
        // Пропускаем отзывы без текста
        if (!review.text || review.text.trim().length < CONFIG.MIN_REVIEW_TEXT_LENGTH) {
          return;
        }
        
        // Фильтруем по рейтингу
        const rating = parseInt(review.rating) || 0;
        if (!CONFIG.RESPOND_TO_RATINGS.includes(rating)) {
          return;
        }
        
        // Проверяем наличие ответа
        const hasAnswer = !!(review.reply_text || review.answer || review.seller_comment);
        
        // Пропускаем отвеченные если не включены
        if (hasAnswer && !includeAnswered) {
          return;
        }
        
        const normalizedReview = {
          id: review.id || review.review_id,
          createdDate: review.created_date || review.date,
          rating: rating,
          text: review.text.trim(),
          user: review.user_name || review.author || 'Аноним',
          hasAnswer: hasAnswer,
          product: {
            id: review.product_id || review.offer_id,
            name: review.product_name || 'Требуется загрузка',
            article: review.offer_id || review.sku || '',
            url: `https://www.ozon.ru/product/${review.product_id || ''}`
          },
          metadata: {
            source: 'ozon',
            storeId: store.id,
            storeName: store.name,
            processedAt: new Date()
          }
        };
        
        normalizedReviews.push(normalizedReview);
        
      } catch (error) {
        logWarning(`Ozon API: Ошибка обработки отзыва ${review.id}: ${error.message}`, LOG_CONFIG.CATEGORIES.OZON_API);
      }
    });
    
    logInfo(`Ozon API: Обработано ${normalizedReviews.length} отзывов из ${rawReviews.length}`, LOG_CONFIG.CATEGORIES.OZON_API);
    
    return normalizedReviews;
    
  } catch (error) {
    logError(`Ozon API: Ошибка обработки ответа: ${error.message}`, LOG_CONFIG.CATEGORIES.OZON_API);
    return [];
  }
}

/**
 * Извлекает last_id из ответа Ozon API для пагинации
 */
function extractOzonLastId(apiResponse) {
  try {
    return apiResponse?.last_id || 
           apiResponse?.result?.last_id || 
           apiResponse?.next_cursor || 
           null;
  } catch (error) {
    logWarning(`Ozon API: Ошибка извлечения last_id: ${error.message}`, LOG_CONFIG.CATEGORIES.OZON_API);
    return null;
  }
}

/**
 * Адаптивная пагинация для поиска отзывов по дате
 */
function getOzonFeedbacksWithAdaptivePagination(store, includeAnswered, options = {}) {
  const timer = new PerformanceTimer(`getOzonFeedbacksAdaptive-${store.id}`);
  
  try {
    if (!store.settings?.startDate) {
      logWarning('Ozon: Нет даты для адаптивной пагинации, переключаемся на стандартную', LOG_CONFIG.CATEGORIES.OZON_API);
      return getOzonFeedbacksWithStandardPagination(store, includeAnswered, options);
    }
    
    const targetDate = new Date(store.settings.startDate);
    const maxPages = options.maxPages || OZON_CONFIG.API_LIMITS.MAX_PAGES_ADAPTIVE;
    const limit = options.limit || OZON_CONFIG.API_LIMITS.DEFAULT_LIMIT;
    
    logInfo(`Ozon Adaptive: Ищем отзывы от ${targetDate.toISOString()} для ${store.name}`, LOG_CONFIG.CATEGORIES.OZON_API);
    
    const allFeedbacks = [];
    let lastId = '';
    let hasNext = true;
    let pageNumber = 0;
    let skipMultiplier = 1; // Коэффициент пропуска страниц
    let foundTargetPeriod = false;
    
    // Получаем прогресс из системы памяти
    const progress = getStoreProgress(store.id, 'collect_adaptive');
    if (progress) {
      lastId = progress.lastId || '';
      pageNumber = progress.pageNumber || 0;
      skipMultiplier = progress.skipMultiplier || 1;
      foundTargetPeriod = progress.foundTargetPeriod || false;
      
      logInfo(`Ozon Adaptive: Продолжаем с страницы ${pageNumber}, skip=${skipMultiplier}`, LOG_CONFIG.CATEGORIES.OZON_API);
    }
    
    while (hasNext && pageNumber < maxPages) {
      const startTime = Date.now();
      
      logDebug(`Ozon Adaptive: Страница ${pageNumber + 1}, skip=${skipMultiplier}, lastId=${lastId}`, LOG_CONFIG.CATEGORIES.OZON_API);
      
      const pageResponse = getOzonFeedbacksPage(store, includeAnswered, lastId, limit);
      
      if (!pageResponse.success) {
        logError(`Ozon Adaptive: Ошибка страницы ${pageNumber + 1}: ${pageResponse.error}`, LOG_CONFIG.CATEGORIES.OZON_API);
        break;
      }
      
      const pageFeedbacks = pageResponse.feedbacks;
      if (!pageFeedbacks || pageFeedbacks.length === 0) {
        logInfo(`Ozon Adaptive: Страница ${pageNumber + 1} пуста, завершаем`, LOG_CONFIG.CATEGORIES.OZON_API);
        break;
      }
      
      // Анализируем даты на странице
      const pageReviewsInRange = pageFeedbacks.filter(review => {
        const reviewDate = new Date(review.createdDate);
        return reviewDate >= targetDate;
      });
      
      const newestOnPage = pageFeedbacks.reduce((newest, review) => {
        const reviewDate = new Date(review.createdDate);
        return reviewDate > newest ? reviewDate : newest;
      }, new Date(0));
      
      logDebug(`Ozon Adaptive: Страница ${pageNumber + 1}, новейший отзыв: ${newestOnPage.toISOString()}`, LOG_CONFIG.CATEGORIES.OZON_API);
      
      if (!foundTargetPeriod && newestOnPage > targetDate) {
        // Еще не дошли до целевого периода - ускоряемся
        skipMultiplier = Math.min(skipMultiplier * 2, 10); // Максимум x10
        
        // Пропускаем страницы
        for (let skip = 0; skip < skipMultiplier - 1; skip++) {
          if (!pageResponse.lastId) break;
          
          const skipResponse = getOzonFeedbacksPage(store, includeAnswered, pageResponse.lastId, limit);
          if (!skipResponse.success || !skipResponse.feedbacks || skipResponse.feedbacks.length === 0) {
            break;
          }
          
          lastId = skipResponse.lastId;
          pageNumber++;
          
          // Небольшая задержка при пропуске
          Utilities.sleep(100);
        }
        
        logInfo(`Ozon Adaptive: Пропущено ${skipMultiplier - 1} страниц, новая позиция: ${pageNumber}`, LOG_CONFIG.CATEGORIES.OZON_API);
      } else {
        // Дошли до целевого периода или уже в нем
        if (!foundTargetPeriod) {
          foundTargetPeriod = true;
          skipMultiplier = 1;
          logInfo(`Ozon Adaptive: Достигли целевого периода на странице ${pageNumber + 1}`, LOG_CONFIG.CATEGORIES.OZON_API);
        }
        
        // Фильтруем отзывы по дате и кешу
        const newReviewsInRange = filterNewReviewsForStore(store.id, pageReviewsInRange);
        allFeedbacks.push(...newReviewsInRange);
        
        // Добавляем все ID в кеш
        const allPageIds = pageFeedbacks.map(f => f.id);
        addToReviewIdsCacheForStore(store.id, allPageIds);
        
        logInfo(`Ozon Adaptive: Найдено ${pageReviewsInRange.length} отзывов в диапазоне, ${newReviewsInRange.length} новых`, LOG_CONFIG.CATEGORIES.OZON_API);
      }
      
      // Сохраняем прогресс
      saveStoreProgress(store.id, 'collect_adaptive', {
        lastId: pageResponse.lastId,
        pageNumber: pageNumber + 1,
        skipMultiplier: skipMultiplier,
        foundTargetPeriod: foundTargetPeriod,
        totalProcessed: allFeedbacks.length
      });
      
      // Подготавливаем к следующей итерации
      lastId = pageResponse.lastId;
      pageNumber++;
      hasNext = pageFeedbacks.length >= limit && !!pageResponse.lastId;
      
      // Rate limiting
      const responseTime = Date.now() - startTime;
      const delay = getApiDelay('ozon');
      if (responseTime < delay) {
        Utilities.sleep(delay - responseTime);
      }
      
      // Дополнительная пауза каждые 10 страниц
      if (pageNumber % 10 === 0) {
        logDebug('Ozon Adaptive: Пауза каждые 10 страниц', LOG_CONFIG.CATEGORIES.OZON_API);
        Utilities.sleep(OZON_CONFIG.RATE_LIMITS.PAUSE_DURATION);
      }
    }
    
    // Очищаем прогресс при завершении
    if (!hasNext) {
      clearStoreProgress(store.id, 'collect_adaptive');
    }
    
    logSuccess(`Ozon Adaptive: Найдено ${allFeedbacks.length} отзывов в целевом периоде`, LOG_CONFIG.CATEGORIES.OZON_API);
    timer.finish(LOG_CONFIG.LEVELS.SUCCESS);
    
    return allFeedbacks;
    
  } catch (error) {
    logError(`Ozon Adaptive: Ошибка для ${store.id}: ${error.message}`, LOG_CONFIG.CATEGORIES.OZON_API);
    timer.finish(LOG_CONFIG.LEVELS.ERROR);
    throw error;
  }
}

/**
 * Получает информацию о товарах через Ozon Product API
 */
function getOzonProductsInfo(productIds, store) {
  const timer = new PerformanceTimer(`getOzonProductsInfo-${store.id}`);
  
  try {
    if (!store?.credentials?.clientId || !store?.credentials?.apiKey) {
      throw new Error('Не указаны Client ID или API Key для Ozon');
    }
    
    if (!productIds || productIds.length === 0) {
      return {};
    }
    
    // Ozon поддерживает до 1000 товаров за запрос, но используем меньший батч для стабильности
    const batchSize = 100;
    const productInfo = {};
    
    for (let i = 0; i < productIds.length; i += batchSize) {
      const batch = productIds.slice(i, i + batchSize);
      
      logDebug(`Ozon Product API: Запрашиваем информацию о ${batch.length} товарах`, LOG_CONFIG.CATEGORIES.OZON_API);
      
      const url = `${OZON_CONFIG.API_BASE_URL}${OZON_CONFIG.ENDPOINTS.PRODUCT_INFO}`;
      const payload = {
        offer_id: batch,
        product_id: [],
        sku: []
      };
      
      const response = makeOzonApiRequest(
        url,
        store.credentials.clientId,
        store.credentials.apiKey,
        'POST',
        payload
      );
      
      if (response.success && response.data?.result?.items) {
        response.data.result.items.forEach(item => {
          productInfo[item.offer_id || item.product_id] = {
            name: item.name || 'Без названия',
            brand: item.brand || '',
            article: item.offer_id || item.sku || '',
            category: item.category_name || '',
            url: `https://www.ozon.ru/product/${item.product_id || ''}`
          };
        });
      }
      
      // Rate limiting между батчами
      if (i + batchSize < productIds.length) {
        Utilities.sleep(getApiDelay('ozon'));
      }
    }
    
    logSuccess(`Ozon Product API: Получена информация о ${Object.keys(productInfo).length} товарах`, LOG_CONFIG.CATEGORIES.OZON_API);
    timer.finish(LOG_CONFIG.LEVELS.SUCCESS);
    
    return productInfo;
    
  } catch (error) {
    logApiError('Ozon', 'products_info', error);
    timer.finish(LOG_CONFIG.LEVELS.ERROR);
    return {};
  }
}

/**
 * Валидирует настройки магазина для Ozon API
 */
function validateOzonStoreSettings(store) {
  const errors = [];
  
  if (!store?.credentials?.clientId) {
    errors.push('Не указан Client ID');
  }
  
  if (!store?.credentials?.apiKey) {
    errors.push('Не указан API Key');
  } else if (store.credentials.apiKey.length < 10) {
    errors.push('API Key слишком короткий');
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
 * Тестирует подключение к Ozon API
 */
function testOzonApiConnection(store) {
  const timer = new PerformanceTimer(`testOzonApiConnection-${store.id}`);
  
  try {
    logInfo(`Тестирование Ozon API для магазина ${store.name}`, LOG_CONFIG.CATEGORIES.OZON_API);
    
    // Валидируем настройки
    const validation = validateOzonStoreSettings(store);
    if (!validation.isValid) {
      return {
        success: false,
        error: `Некорректные настройки: ${validation.errors.join(', ')}`
      };
    }
    
    // Выполняем тестовый запрос (1 отзыв)
    const testResponse = getOzonFeedbacksPage(store, false, '', 1);
    
    timer.finish(testResponse.success ? LOG_CONFIG.LEVELS.SUCCESS : LOG_CONFIG.LEVELS.ERROR);
    
    if (testResponse.success) {
      logSuccess(`Ozon API: Подключение успешно для магазина ${store.name}`, LOG_CONFIG.CATEGORIES.OZON_API);
      return {
        success: true,
        message: 'Подключение к Ozon API успешно',
        feedbacksFound: testResponse.feedbacks?.length || 0
      };
    } else {
      return {
        success: false,
        error: testResponse.error
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
 * ✅ ДОДЕЛАНО: Получает статистику работы с Ozon API с реальными счетчиками
 */
function getOzonApiStatistics(storeId) {
  try {
    const apiStats = getApiStatsTracker();
    const progress = getStoreProgress(storeId, 'collect');
    const adaptiveProgress = getStoreProgress(storeId, 'collect_adaptive');
    
    // Получаем реальную статистику из ApiStatsTracker
    const ozonStats = apiStats.getStats('ozon');
    
    return {
      storeId: storeId,
      apiEndpoint: OZON_CONFIG.ENDPOINTS.GET_FEEDBACKS,
      standardProgress: progress,
      adaptiveProgress: adaptiveProgress,
      lastTested: new Date(),
      // ✅ ИСПРАВЛЕНО: Реальные счетчики вместо TODO
      requestsCount: ozonStats.requests,
      errorsCount: ozonStats.errors,
      averageResponseTime: ozonStats.averageResponseTime,
      successRate: ozonStats.requests > 0 ? ((ozonStats.requests - ozonStats.errors) / ozonStats.requests * 100).toFixed(1) + '%' : 'N/A',
      statusWarning: ozonStats.errors > 10 ? 'Высокое количество ошибок' : null,
      // 🔧 ДОПОЛНИТЕЛЬНЫЕ МЕТРИКИ
      totalRequestTime: ozonStats.totalResponseTime || 0,
      lastRequestTime: ozonStats.lastRequestTime || null,
      apiStatus: ozonStats.requests > 0 ? (ozonStats.errors / ozonStats.requests > 0.1 ? 'UNSTABLE' : 'OK') : 'UNKNOWN'
    };
  } catch (error) {
    logError(`Ошибка получения статистики Ozon API: ${error.message}`, LOG_CONFIG.CATEGORIES.OZON_API);
    return null;
  }
}
