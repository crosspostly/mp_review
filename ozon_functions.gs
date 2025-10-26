// ============ CRITICAL OZON API FIXES ============
// These functions implement adaptive pagination and memory system for Ozon API
// to match the efficiency of Wildberries implementation

// ============ OZON API HELPERS ============
// OZON_CONFIG уже определен в code.gs - используем его
// ПРИМЕЧАНИЕ: Функции прогресса (getStartingPageForStore, updateStorePageProgress) используются из code.gs

// ============ OZON-SPECIFIC FUNCTIONS ============
// ПРИМЕЧАНИЕ: Общие утилиты (formatDateForOzon, isDevMode) используются из code.gs

/**
 * 🚀 НОВАЯ РЕАЛИЗАЦИЯ: Адаптивная пагинация для Ozon с поддержкой фильтра по дате
 * Аналогично WB функции, с оптимизациями для больших диапазонов дат
 * @param {string} clientId - Client ID для Ozon API
 * @param {string} apiKey - API Key для Ozon API  
 * @param {boolean} includeAnswered - Включать отвеченные отзывы
 * @param {Object} store - Конфигурация магазина с настройками
 * @returns {Array} Все подходящие отзывы
 */
function getOzonFeedbacksWithAdaptivePagination(clientId, apiKey, includeAnswered, store, fetchContext) {
  log(`[Ozon Adaptive] 🚀 ЗАПУСК адаптивной пагинации...`);

  if (!store || !store.settings || !store.settings.startDate) {
    log(`[Ozon Adaptive] ❌ Нет даты начала — переключаюсь на стандартную пагинацию`);
    return getOzonFeedbacksWithStandardPagination(clientId, apiKey, includeAnswered, store, fetchContext);
  }

  fetchContext = fetchContext || {};
  const directPersist = typeof fetchContext.persist === 'function';

  const startDate = new Date(store.settings.startDate);
  const today = new Date();
  const daysDiff = Math.ceil((today - startDate) / (1000 * 60 * 60 * 24));

  log(`[Ozon Adaptive] 📅 Диапазон дат: ${store.settings.startDate} – ${today.toISOString().split('T')[0]} (${daysDiff} дней)`);

  const adaptiveLimit = OZON_CONFIG.API_LIMITS.MAX_LIMIT;
  const MAX_EXECUTION_TIME = 5 * 60 * 1000;
  const startTime = Date.now();

  let hasNext = true;
  let lastId = "";
  let processedPages = 0;
  let skippedPages = 0;
  let pageNumber = 0;

  const collectedReviews = [];

  const persistBatch = (reviews, meta) => {
    if (!reviews || reviews.length === 0) return;

    if (directPersist) {
      try {
        fetchContext.persist(reviews, { ...meta, mode: 'adaptive', marketplace: 'Ozon' });
        fetchContext.persistedCount = (fetchContext.persistedCount || 0) + reviews.length;
      } catch (error) {
        log(`[Ozon Adaptive] ❌ Ошибка persist(): ${error.message}`);
        collectedReviews.push(...reviews);
      }
    } else {
      collectedReviews.push(...reviews);
    }
  };

  const startingPage = getStartingPageForStore(store, includeAnswered);
  if (startingPage > 0) {
    pageNumber = startingPage;
    log(`[Ozon Adaptive] 📖 Продолжаем с сохранённой страницы ${startingPage}`);
  }

  while (hasNext && (Date.now() - startTime) < MAX_EXECUTION_TIME) {
    try {
      log(`[Ozon Adaptive] 📄 Обработка страницы ${pageNumber + 1}...`);

      const pageFeedbacks = getOzonFeedbacksPage(clientId, apiKey, includeAnswered, lastId, adaptiveLimit, store);

      if (pageFeedbacks === null) {
        log(`[Ozon Adaptive] ❌ Ошибка получения страницы ${pageNumber + 1}, завершаю`);
        break;
      }

      if (pageFeedbacks.length === 0) {
        log(`[Ozon Adaptive] ✅ Пустая страница ${pageNumber + 1}, пагинация завершена`);
        updateStorePageProgress(store, includeAnswered, pageNumber, true);
        break;
      }

      const processedFeedbacks = processFeedbacksPageForOzon(pageFeedbacks);
      const matchingFeedbacks = processedFeedbacks.filter((fb, index) => {
        const reviewDate = new Date(fb.createdDate);
        const isMatch = reviewDate >= startDate;

        if (index < 3) {
          log(`[Ozon Adaptive DEBUG] ID ${fb.id}: created=${fb.createdDate}, >= start=${isMatch}`);
        }

        return isMatch;
      });

      persistBatch(matchingFeedbacks, { page: pageNumber + 1 });

      processedPages++;

      log(`[Ozon Adaptive] 📊 Страница ${pageNumber + 1}: всего=${pageFeedbacks.length}, подходящих=${matchingFeedbacks.length}`);

      if (pageFeedbacks.length < adaptiveLimit) {
        log(`[Ozon Adaptive] ✅ Последняя страница (${pageFeedbacks.length} < ${adaptiveLimit})`);
        updateStorePageProgress(store, includeAnswered, pageNumber, true);
        break;
      }

      lastId = pageFeedbacks[pageFeedbacks.length - 1].id || lastId;

      if ((pageNumber + 1) % 5 === 0) {
        updateStorePageProgress(store, includeAnswered, pageNumber, false);
      }

      pageNumber++;
      hasNext = pageFeedbacks.length === adaptiveLimit;
      Utilities.sleep(OZON_CONFIG.RATE_LIMITS.DELAY_BETWEEN_REQUESTS || 500);

    } catch (error) {
      log(`[Ozon Adaptive] ❌ Ошибка на странице ${pageNumber + 1}: ${error.message}`);
      break;
    }
  }

  const duration = Math.round((Date.now() - startTime) / 1000);
  log(`[Ozon Adaptive] 🏁 Завершено: страниц=${processedPages}, пропущено=${skippedPages}, время=${duration}с`);

  fetchContext.persisted = directPersist;

  const sorted = applySortingPreferences(collectedReviews, store);
  if (directPersist) {
    fetchContext.persistedCount = fetchContext.persistedCount || sorted.length;
  }
  return sorted;
}

/**
 * 🚀 НОВАЯ РЕАЛИЗАЦИЯ: Стандартная пагинация для Ozon без фильтра по дате
 * Для случаев, когда не нужна адаптивная оптимизация
 * @param {string} clientId - Client ID для Ozon API  
 * @param {string} apiKey - API Key для Ozon API
 * @param {boolean} includeAnswered - Включать отвеченные отзывы
 * @param {Object} store - Конфигурация магазина
 * @returns {Array} Все подходящие отзывы
 */
function getOzonFeedbacksWithStandardPagination(clientId, apiKey, includeAnswered, store, fetchContext) {
  log(`[Ozon Standard] 🚀 ЗАПУСК стандартной пагинации...`);

  fetchContext = fetchContext || {};
  const directPersist = typeof fetchContext.persist === 'function';

  const MAX_EXECUTION_TIME = 5 * 60 * 1000;
  const startTime = Date.now();
  const limit = OZON_CONFIG.API_LIMITS.MAX_LIMIT;

  let hasNext = true;
  let lastId = "";
  let pageNumber = 0;
  let processedPages = 0;

  const collectedReviews = [];

  const persistBatch = (reviews, meta) => {
    if (!reviews || reviews.length === 0) return;

    if (directPersist) {
      try {
        fetchContext.persist(reviews, { ...meta, mode: 'standard', marketplace: 'Ozon' });
        fetchContext.persistedCount = (fetchContext.persistedCount || 0) + reviews.length;
      } catch (error) {
        log(`[Ozon Standard] ❌ Ошибка persist(): ${error.message}`);
        collectedReviews.push(...reviews);
      }
    } else {
      collectedReviews.push(...reviews);
    }
  };

  const startingPage = getStartingPageForStore(store, includeAnswered);
  if (startingPage > 0) {
    pageNumber = startingPage;
    log(`[Ozon Standard] 📖 Продолжаем с сохранённой страницы ${startingPage}`);
  }

  while (hasNext && (Date.now() - startTime) < MAX_EXECUTION_TIME) {
    try {
      log(`[Ozon Standard] 📄 Обработка страницы ${pageNumber + 1}...`);

      const pageFeedbacks = getOzonFeedbacksPage(clientId, apiKey, includeAnswered, lastId, limit, store);

      if (pageFeedbacks === null) {
        log(`[Ozon Standard] ❌ Ошибка получения страницы ${pageNumber + 1}, завершаю`);
        break;
      }

      if (pageFeedbacks.length === 0) {
        log(`[Ozon Standard] ✅ Пустая страница ${pageNumber + 1}, пагинация завершена`);
        updateStorePageProgress(store, includeAnswered, pageNumber, true);
        break;
      }

      const processedFeedbacks = processFeedbacksPageForOzon(pageFeedbacks);
      persistBatch(processedFeedbacks, { page: pageNumber + 1 });

      processedPages++;

      log(`[Ozon Standard] 📊 Страница ${pageNumber + 1}: получено ${pageFeedbacks.length}`);

      if (pageFeedbacks.length < limit) {
        log(`[Ozon Standard] ✅ Последняя страница (${pageFeedbacks.length} < ${limit})`);
        updateStorePageProgress(store, includeAnswered, pageNumber, true);
        break;
      }

      lastId = pageFeedbacks[pageFeedbacks.length - 1].id || lastId;

      if ((pageNumber + 1) % 5 === 0) {
        updateStorePageProgress(store, includeAnswered, pageNumber, false);
      }

      pageNumber++;
      hasNext = pageFeedbacks.length === limit;
      Utilities.sleep(OZON_CONFIG.RATE_LIMITS.DELAY_BETWEEN_REQUESTS || 500);

    } catch (error) {
      log(`[Ozon Standard] ❌ Ошибка на странице ${pageNumber + 1}: ${error.message}`);
      break;
    }
  }

  const duration = Math.round((Date.now() - startTime) / 1000);
  log(`[Ozon Standard] 🏁 Завершено: страниц=${processedPages}, время=${duration}с`);

  fetchContext.persisted = directPersist;

  const sorted = applySortingPreferences(collectedReviews, store);
  if (directPersist) {
    fetchContext.persistedCount = fetchContext.persistedCount || sorted.length;
  }
  return sorted;
}

/**
 * 🆕 HELPER ФУНКЦИЯ: Получение одной страницы отзывов Ozon
 * @param {string} clientId - Client ID для Ozon API
 * @param {string} apiKey - API Key для Ozon API
 * @param {boolean} includeAnswered - Включать отвеченные отзывы
 * @param {string} lastId - ID для пагинации
 * @param {number} limit - Лимит записей на страницу
 * @param {Object} store - Конфигурация магазина для фильтра дат
 * @returns {Array|null} Отзывы или null при ошибке
 */
function getOzonFeedbacksPage(clientId, apiKey, includeAnswered, lastId, limit, store) {
  try {
    const url = 'https://api-seller.ozon.ru/v1/review/list';
    
    // Базовая структура запроса
    let payload = {
      filter: {
        has_text: true,  // Только отзывы с текстом
      },
      sort: {
        type: 'CREATED_AT',   // 🚀 ВОЗВРАТ к рабочей версии: type как в коммите 65f5131
        order: 'DESC'         // 🚀 ВОЗВРАТ к рабочей версии: uppercase DESC
      },
      limit: limit,
      last_id: lastId
    };
    
    // Настройка фильтра по статусу ответов
    if (includeAnswered) {
      payload.filter.status = ['PENDING', 'PROCESSED', 'MODERATED', 'NEW'];
    } else {
      payload.filter.has_answer = false;
      payload.filter.status = ['PENDING', 'MODERATED', 'NEW'];
    }
    
    // Фильтр по дате из настроек магазина (если есть)
    if (store && store.settings && store.settings.startDate) {
      const startDate = store.settings.startDate;
      const today = new Date().toISOString().split('T')[0];
      
      payload.filter.date_from = formatDateForOzon(startDate);
      payload.filter.date_to = formatDateForOzon(today);
    }
    
    const response = UrlFetchApp.fetch(url, {
      method: 'POST',
      headers: { 
        'Client-Id': clientId, 
        'Api-Key': apiKey,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();
    
    if (responseCode !== 200) {
      log(`[Ozon Helper] ❌ API ошибка: код ${responseCode}, ответ: ${responseBody.substring(0, 200)}`);
      return null;
    }
    
    const json = JSON.parse(responseBody);
    
    // Обработка структуры ответа
    let reviews = [];
    if (json.result && json.result.reviews) {
      reviews = json.result.reviews;
    } else if (json.reviews) {
      reviews = json.reviews;
    } else if (json.data && json.data.reviews) {
      reviews = json.data.reviews;
    } else {
      log(`[Ozon Helper] ⚠️ Неожиданная структура ответа: ${Object.keys(json).join(', ')}`);
      return [];
    }
    
    return reviews;
    
  } catch (e) {
    log(`[Ozon Helper] ❌ Критическая ошибка: ${e.message}`);
    return null;
  }
}

/**
 * 🆕 HELPER ФУНКЦИЯ: Обработка страницы отзывов Ozon в нормализованный формат
 * @param {Array} pageFeedbacks - Сырые данные отзывов с Ozon API
 * @returns {Array} Обработанные отзывы в стандартном формате
 */
function processFeedbacksPageForOzon(pageFeedbacks) {
  const processedFeedbacks = [];
  
  pageFeedbacks.forEach(fb => {
    // Проверяем наличие текста ДО обработки
    const hasText = fb.text && fb.text.trim() && fb.text.trim() !== '(без текста)';
    
    if (!hasText) {
      if (isDevMode()) {
        log(`[Ozon Helper DEBUG] ⏭️ Пропущен пустой отзыв ID ${fb.id}: текст="${fb.text || '(нет)'}"`);
      }
      return; // Пропускаем пустые отзывы
    }
    
    // Обрабатываем отзыв с текстом
    processedFeedbacks.push({
      id: fb.id,
      createdDate: fb.published_at || fb.created_at,
      rating: fb.rating,
      text: fb.text,
      user: 'Аноним',
      hasAnswer: !!(fb.answer && fb.answer.text), // проверка наличия ответа для Ozon
      product: {
        id: fb.sku || fb.offer_id,
        name: 'Не указано', // Можно улучшить через Product API
        url: `https://www.ozon.ru/product/${fb.sku || fb.offer_id}`
      }
    });
  });
  
  return processedFeedbacks;
}

/**
 * 🚀 НОВАЯ ФУНКЦИЯ: Применение пользовательских настроек сортировки для массива отзывов
 * @param {Array} feedbacks - Массив отзывов для сортировки
 * @param {Object} store - Store configuration with sorting preferences
 * @returns {Array} Отсортированный массив отзывов
 */
function applySortingPreferences(feedbacks, store) {
  if (!feedbacks || feedbacks.length === 0) return feedbacks;
  
  // Проверяем настройки сортировки в конфигурации магазина
  const sortOldestFirst = store.settings?.sortOldestFirst || false;
  
  if (sortOldestFirst) {
    log(`[${store.name}] Применена настройка: сортировка старых отзывов сначала.`);
    feedbacks.sort((a, b) => new Date(a.createdDate) - new Date(b.createdDate)); // Старые первыми
  } else {
    log(`[${store.name}] Применена стандартная сортировка: новые отзывы сначала.`);
    feedbacks.sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate)); // Новые первыми
  }
  
  return feedbacks;
}
