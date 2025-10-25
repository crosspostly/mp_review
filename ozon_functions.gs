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
function getOzonFeedbacksWithAdaptivePagination(clientId, apiKey, includeAnswered, store) {
  log(`[Ozon Adaptive] 🚀 ЗАПУСК адаптивной пагинации...`);
  
  if (!store || !store.settings || !store.settings.startDate) {
    log(`[Ozon Adaptive] ❌ ОШИБКА: Не задана дата начала поиска для адаптивной пагинации`);
    return getOzonFeedbacksWithStandardPagination(clientId, apiKey, includeAnswered, store);
  }
  
  const startDate = new Date(store.settings.startDate);
  const today = new Date();
  const daysDiff = Math.ceil((today - startDate) / (1000 * 60 * 60 * 24));
  
  log(`[Ozon Adaptive] 📅 Диапазон дат: ${store.settings.startDate} - ${today.toISOString().split('T')[0]} (${daysDiff} дней)`);
  
  // 📈 ВРЕМЕННО ОТКЛЮЧАЕМ ПРОПУСК СТРАНИЦ ДЛЯ ОТЛАДКИ
  let skipMultiplier = 1; // НЕ пропускаем страницы
  let adaptiveLimit = OZON_CONFIG.API_LIMITS.MAX_LIMIT;
  
  log(`[Ozon Adaptive] 🐞 DEBUG РЕЖИМ: пропуск страниц ОТКЛЮЧЕН для диагностики сортировки (диапазон ${daysDiff} дней)`);
  
  const MAX_EXECUTION_TIME = 5 * 60 * 1000; // 5 минут
  const startTime = Date.now();
  let allMatchingFeedbacks = [];
  let hasNext = true;
  let lastId = "";
  let pageNumber = 0;
  let processedPages = 0;
  let skippedPages = 0;
  
  // 🚀 ПРОМЕЖУТОЧНОЕ СОХРАНЕНИЕ: Инициализация буфера
  let reviewsBuffer = [];
  let pagesSinceLastSave = 0;
  let totalSaved = 0;
  
  // 🚀 Интеграция с системой памяти прогресса
  const startingPage = getStartingPageForStore(store, includeAnswered);
  if (startingPage > 0) {
    pageNumber = startingPage;
    log(`[Ozon Adaptive] 📖 Продолжение с страницы ${startingPage}`);
  }
  
  while (hasNext && (Date.now() - startTime) < MAX_EXECUTION_TIME) {
    try {
      // 🚀 АДАПТИВНЫЙ ПРОПУСК СТРАНИЦ
      if (pageNumber % skipMultiplier !== 0 && pageNumber > 0) {
        skippedPages++;
        pageNumber++;
        continue; // Пропускаем страницу
      }
      
      log(`[Ozon Adaptive] 📄 Обработка страницы ${pageNumber + 1}...`);
      
      const pageFeedbacks = getOzonFeedbacksPage(clientId, apiKey, includeAnswered, lastId, adaptiveLimit, store);
      
      if (pageFeedbacks === null) {
        log(`[Ozon Adaptive] ❌ Ошибка получения страницы ${pageNumber + 1}, завершаем`);
        break;
      }
      
      if (pageFeedbacks.length === 0) {
        log(`[Ozon Adaptive] ✅ Пустая страница ${pageNumber + 1}, завершаем пагинацию`);
        updateStorePageProgress(store, includeAnswered, pageNumber, true);
        break;
      }
      
      // 📊 Обработка и фильтрация отзывов
      const processedFeedbacks = processFeedbacksPageForOzon(pageFeedbacks);
      const matchingFeedbacks = processedFeedbacks.filter(fb => {
        const reviewDate = new Date(fb.createdDate);
        const isMatch = reviewDate >= startDate;
        
        // 🐞 ОТЛАДКА: Показываем первые 3 отзыва для диагностики дат
        if (processedFeedbacks.indexOf(fb) < 3) {
          log(`[Ozon Adaptive DEBUG] Отзыв ${fb.id}: дата="${fb.createdDate}", parsed="${reviewDate.toISOString()}", startDate="${startDate.toISOString()}", match=${isMatch}`);
        }
        
        return isMatch;
      });
      
      allMatchingFeedbacks = allMatchingFeedbacks.concat(matchingFeedbacks);
      processedPages++;
      pagesSinceLastSave++;
      
      // 🚀 ПРОМЕЖУТОЧНОЕ СОХРАНЕНИЕ: Управление буфером
      const bufferStats = manageReviewsBuffer(reviewsBuffer, matchingFeedbacks, store, pagesSinceLastSave);
      if (bufferStats.saved > 0) {
        totalSaved += bufferStats.saved;
        pagesSinceLastSave = 0; // Сброс счетчика после сохранения
        log(`[Ozon Adaptive] 💾 Промежуточное сохранение: ${bufferStats.saved} отзывов (всего сохранено: ${totalSaved})`);
      }
      
      log(`[Ozon Adaptive] 📊 Страница ${pageNumber + 1}: получено ${pageFeedbacks.length}, обработано ${processedFeedbacks.length}, подошло по дате ${matchingFeedbacks.length}, в буфере ${bufferStats.bufferSize}`);
      
      // 📈 КРИТЕРИИ ЗАВЕРШЕНИЯ - ВРЕМЕННО ОТКЛЮЧЕНЫ ДЛЯ ОТЛАДКИ
      // ❌ УБРАЛ ЛОГИКУ ОСТАНОВКИ ПО ДАТЕ - она неверная!
      // Пусть обрабатывает больше страниц, чтобы найти новые отзывы
      log(`[Ozon Adaptive] 🐞 DEBUG: НЕ останавливаемся по дате, ищем дальше (найдено ${matchingFeedbacks.length} подходящих)`);
      
      if (pageFeedbacks.length < adaptiveLimit) {
        log(`[Ozon Adaptive] ✅ Последняя страница (${pageFeedbacks.length} < ${adaptiveLimit})`);
        // 🚀 ФИНАЛЬНОЕ СОХРАНЕНИЕ: Принудительно сохраняем остатки буфера
        const finalSaved = saveReviewsBuffer(reviewsBuffer, store, true);
        if (finalSaved > 0) {
          totalSaved += finalSaved;
          log(`[Ozon Adaptive] 💾 Финальное сохранение: ${finalSaved} отзывов (всего сохранено: ${totalSaved})`);
        }
        updateStorePageProgress(store, includeAnswered, pageNumber, true);
        break;
      }
      
      // Обновляем lastId для следующей страницы
      if (pageFeedbacks.length > 0) {
        lastId = pageFeedbacks[pageFeedbacks.length - 1].id;
      }
      
      pageNumber++;
      
      // 📝 Сохранение прогресса каждые 5 страниц
      if (processedPages % 5 === 0) {
        updateStorePageProgress(store, includeAnswered, pageNumber - 1, false);
      }
      
      hasNext = (pageFeedbacks.length === adaptiveLimit);
      
      Utilities.sleep(OZON_CONFIG.RATE_LIMITS.DELAY_BETWEEN_REQUESTS || 500);
      
    } catch (e) {
      log(`[Ozon Adaptive] ❌ Ошибка на странице ${pageNumber + 1}: ${e.message}`);
      break;
    }
  }
  
  const duration = Math.round((Date.now() - startTime) / 1000);
  log(`[Ozon Adaptive] 🏁 ЗАВЕРШЕНО: ${allMatchingFeedbacks.length} отзывов за ${duration}с (обработано ${processedPages} страниц, пропущено ${skippedPages})`);
  
  // Применяем сортировку из настроек магазина
  return applySortingPreferences(allMatchingFeedbacks, store);
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
function getOzonFeedbacksWithStandardPagination(clientId, apiKey, includeAnswered, store) {
  log(`[Ozon Standard] 🚀 ЗАПУСК стандартной пагинации...`);
  
  const MAX_EXECUTION_TIME = 5 * 60 * 1000; // 5 минут
  const startTime = Date.now();
  let allFeedbacks = [];
  let hasNext = true;
  let lastId = "";
  let pageNumber = 0;
  const limit = OZON_CONFIG.API_LIMITS.MAX_LIMIT;
  
  // 🚀 ПРОМЕЖУТОЧНОЕ СОХРАНЕНИЕ: Инициализация буфера
  let reviewsBuffer = [];
  let pagesSinceLastSave = 0;
  let totalSaved = 0;
  
  // 🚀 Интеграция с системой памяти прогресса
  const startingPage = getStartingPageForStore(store, includeAnswered);
  if (startingPage > 0) {
    pageNumber = startingPage;
    log(`[Ozon Standard] 📖 Продолжение с страницы ${startingPage}`);
  }
  
  while (hasNext && (Date.now() - startTime) < MAX_EXECUTION_TIME) {
    try {
      log(`[Ozon Standard] 📄 Обработка страницы ${pageNumber + 1}...`);
      
      const pageFeedbacks = getOzonFeedbacksPage(clientId, apiKey, includeAnswered, lastId, limit, store);
      
      if (pageFeedbacks === null) {
        log(`[Ozon Standard] ❌ Ошибка получения страницы ${pageNumber + 1}, завершаем`);
        break;
      }
      
      if (pageFeedbacks.length === 0) {
        log(`[Ozon Standard] ✅ Пустая страница ${pageNumber + 1}, завершаем пагинацию`);
        updateStorePageProgress(store, includeAnswered, pageNumber, true);
        break;
      }
      
      // 📊 Обработка отзывов
      const processedFeedbacks = processFeedbacksPageForOzon(pageFeedbacks);
      allFeedbacks = allFeedbacks.concat(processedFeedbacks);
      pagesSinceLastSave++;
      
      // 🚀 ПРОМЕЖУТОЧНОЕ СОХРАНЕНИЕ: Управление буфером
      const bufferStats = manageReviewsBuffer(reviewsBuffer, processedFeedbacks, store, pagesSinceLastSave);
      if (bufferStats.saved > 0) {
        totalSaved += bufferStats.saved;
        pagesSinceLastSave = 0; // Сброс счетчика после сохранения
        log(`[Ozon Standard] 💾 Промежуточное сохранение: ${bufferStats.saved} отзывов (всего сохранено: ${totalSaved})`);
      }
      
      log(`[Ozon Standard] 📊 Страница ${pageNumber + 1}: получено ${pageFeedbacks.length}, обработано ${processedFeedbacks.length}, в буфере ${bufferStats.bufferSize}`);
      
      if (pageFeedbacks.length < limit) {
        log(`[Ozon Standard] ✅ Последняя страница (${pageFeedbacks.length} < ${limit})`);
        // 🚀 ФИНАЛЬНОЕ СОХРАНЕНИЕ: Принудительно сохраняем остатки буфера
        const finalSaved = saveReviewsBuffer(reviewsBuffer, store, true);
        if (finalSaved > 0) {
          totalSaved += finalSaved;
          log(`[Ozon Standard] 💾 Финальное сохранение: ${finalSaved} отзывов (всего сохранено: ${totalSaved})`);
        }
        updateStorePageProgress(store, includeAnswered, pageNumber, true);
        break;
      }
      
      // Обновляем lastId для следующей страницы
      if (pageFeedbacks.length > 0) {
        lastId = pageFeedbacks[pageFeedbacks.length - 1].id;
      }
      
      pageNumber++;
      
      // 📝 Сохранение прогресса каждые 5 страниц
      if (pageNumber % 5 === 0) {
        updateStorePageProgress(store, includeAnswered, pageNumber - 1, false);
      }
      
      hasNext = (pageFeedbacks.length === limit);
      
      Utilities.sleep(OZON_CONFIG.RATE_LIMITS.DELAY_BETWEEN_REQUESTS || 500);
      
    } catch (e) {
      log(`[Ozon Standard] ❌ Ошибка на странице ${pageNumber + 1}: ${e.message}`);
      break;
    }
  }
  
  const duration = Math.round((Date.now() - startTime) / 1000);
  log(`[Ozon Standard] 🎯 ИТОГОВАЯ СТАТИСТИКА за ${duration}с:`);
  log(`[Ozon Standard] 📊 Отзывов получено: ${allFeedbacks.length}`);
  log(`[Ozon Standard] 📄 Страниц обработано: ${pageNumber}`);
  log(`[Ozon Standard] 💾 Промежуточно сохранено: ${totalSaved} отзывов`);
  log(`[Ozon Standard] 🏁 ЗАВЕРШЕНО успешно`);
  
  // Применяем сортировку из настроек магазина
  return applySortingPreferences(allFeedbacks, store);
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
