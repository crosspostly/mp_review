/**
 * @file ozon_auto_collection.gs
 * @description Автоматический сбор отзывов Ozon по расписанию (каждые 3 часа)
 * @version 1.0
 * @date 2025-10-29
 * 
 * ФУНКЦИОНАЛ (аналог N8N workflow):
 * - Запуск каждые 3 часа через триггер
 * - Получение отзывов только 4-5 звёзд с 0 комментариев (comments_amount = 0)
 * - Пагинация до 20 страниц с сохранением last_id
 * - Проверка дубликатов с существующими отзывами в таблице
 * - Запись только новых отзывов со статусом "NEW"
 * - Запоминание last_id в Script Properties
 * - Сброс last_id при отсутствии новых данных
 * 
 * API ENDPOINT:
 * POST https://api-seller.ozon.ru/v1/review/list
 * Headers: Client-Id, Api-Key
 * Body: { "limit": 100, "with_photos": false, "last_id": "..." }
 */

// ============ КОНФИГУРАЦИЯ ============
const OZON_AUTO_CONFIG = {
  // Триггер: каждые 3 часа
  TRIGGER_INTERVAL_HOURS: 3,
  
  // Пагинация
  MAX_PAGES_PER_RUN: 20,           // Максимум 20 страниц за раз
  REVIEWS_PER_PAGE: 100,            // 100 отзывов на страницу
  
  // Фильтры
  FILTER_RATINGS: [4, 5],           // Только 4 и 5 звёзд
  FILTER_COMMENTS_COUNT: 0,          // 0 комментариев
  
  // Ключи Script Properties
  LAST_ID_PREFIX: 'ozon_auto_lastId_',      // ozon_auto_lastId_{storeId}
  ITERATION_PREFIX: 'ozon_auto_iteration_',  // ozon_auto_iteration_{storeId}
  
  // Статус для новых отзывов
  NEW_STATUS: 'NEW',
  
  // API
  API_URL: 'https://api-seller.ozon.ru/v1/review/list'
};

/**
 * 🚀 ГЛАВНАЯ ФУНКЦИЯ: Триггер автоматического сбора отзывов Ozon
 * Запускается каждые 3 часа для всех активных магазинов Ozon
 */
function collectOzonReviewsAuto() {
  const startTime = Date.now();
  log('🚀 ЗАПУСК автоматического сбора отзывов Ozon');
  
  try {
    // Получаем активные магазины Ozon
    const allStores = getStores();
    const ozonStores = allStores.filter(store => 
      store.isActive && 
      (store.marketplace === 'Ozon' || store.marketplace === 'OZON')
    );
    
    if (ozonStores.length === 0) {
      log('Нет активных магазинов Ozon для автоматического сбора');
      return {
        success: true,
        message: 'Нет активных магазинов Ozon',
        storesProcessed: 0,
        totalNewReviews: 0
      };
    }
    
    log(`Найдено ${ozonStores.length} активных магазинов Ozon`);
    
    let totalNewReviews = 0;
    const results = [];
    
    // Обрабатываем каждый магазин
    for (let i = 0; i < ozonStores.length; i++) {
      const store = ozonStores[i];
      
      try {
        log(`[${store.name}] Начинаем автоматический сбор...`);
        
        const result = collectForStore(store);
        results.push(result);
        totalNewReviews += result.newReviewsCount || 0;
        
        // Задержка между магазинами
        if (i < ozonStores.length - 1) {
          Utilities.sleep(2000);
        }
        
      } catch (error) {
        log(`[${store.name}] ❌ Ошибка: ${error.message}`);
        results.push({
          storeId: store.id,
          storeName: store.name,
          success: false,
          error: error.message,
          newReviewsCount: 0
        });
      }
    }
    
    const duration = Math.round((Date.now() - startTime) / 1000);
    log(`✅ Автоматический сбор завершен за ${duration} сек: ${totalNewReviews} новых отзывов`);
    
    return {
      success: true,
      storesProcessed: ozonStores.length,
      totalNewReviews: totalNewReviews,
      duration: duration,
      results: results
    };
    
  } catch (error) {
    log(`❌ Критическая ошибка автоматического сбора: ${error.message}`);
    return {
      success: false,
      error: error.message,
      storesProcessed: 0,
      totalNewReviews: 0
    };
  }
}

/**
 * Собирает отзывы для конкретного магазина
 */
function collectForStore(store) {
  try {
    // Проверка credentials
    if (!store.credentials || !store.credentials.clientId || !store.credentials.apiKey) {
      throw new Error('Отсутствуют credentials');
    }
    
    // Получаем сохраненный прогресс
    const props = PropertiesService.getScriptProperties();
    const lastIdKey = OZON_AUTO_CONFIG.LAST_ID_PREFIX + store.id;
    const iterationKey = OZON_AUTO_CONFIG.ITERATION_PREFIX + store.id;
    
    const savedLastId = props.getProperty(lastIdKey) || '';
    const iteration = parseInt(props.getProperty(iterationKey) || '0', 10);
    
    log(`[${store.name}] Продолжаем с last_id="${savedLastId}", итерация=${iteration}`);
    
    // Получаем существующие ID отзывов из таблицы
    const existingIds = getExistingReviewIds(store);
    log(`[${store.name}] Загружено ${existingIds.length} существующих ID`);
    
    // Собираем новые отзывы
    const collectionResult = collectWithPagination(
      store,
      savedLastId,
      iteration,
      existingIds
    );
    
    // Записываем новые отзывы в таблицу
    if (collectionResult.newReviews.length > 0) {
      writeToSheet(store, collectionResult.newReviews);
      log(`[${store.name}] ✅ Записано ${collectionResult.newReviews.length} новых отзывов`);
    } else {
      log(`[${store.name}] Новых отзывов не найдено`);
    }
    
    // Сохраняем или сбрасываем прогресс
    if (collectionResult.hasNext && collectionResult.newLastId) {
      // Есть еще страницы - сохраняем
      props.setProperty(lastIdKey, collectionResult.newLastId);
      props.setProperty(iterationKey, collectionResult.nextIteration.toString());
      log(`[${store.name}] Прогресс сохранен: last_id="${collectionResult.newLastId}", итерация=${collectionResult.nextIteration}`);
    } else {
      // Достигли конца - сбрасываем
      props.deleteProperty(lastIdKey);
      props.deleteProperty(iterationKey);
      log(`[${store.name}] Прогресс сброшен (достигнут конец или нет данных)`);
    }
    
    return {
      storeId: store.id,
      storeName: store.name,
      success: true,
      newReviewsCount: collectionResult.newReviews.length,
      pagesProcessed: collectionResult.pagesProcessed,
      hasMore: collectionResult.hasNext
    };
    
  } catch (error) {
    log(`[${store.name}] ❌ Ошибка сбора: ${error.message}`);
    return {
      storeId: store.id,
      storeName: store.name,
      success: false,
      error: error.message,
      newReviewsCount: 0
    };
  }
}

/**
 * Собирает отзывы с пагинацией до MAX_PAGES_PER_RUN
 */
function collectWithPagination(store, startLastId, startIteration, existingIds) {
  const newReviews = [];
  let lastId = startLastId;
  let iteration = startIteration;
  let hasNext = true;
  let pagesProcessed = 0;
  
  const maxPages = OZON_AUTO_CONFIG.MAX_PAGES_PER_RUN;
  
  while (hasNext && pagesProcessed < maxPages) {
    const pageStart = Date.now();
    
    log(`[Ozon] Страница ${pagesProcessed + 1}/${maxPages}, last_id="${lastId}"`);
    
    // Запрашиваем страницу
    const pageResponse = fetchReviewsPage(store, lastId);
    
    if (!pageResponse.success) {
      log(`[Ozon] ❌ Ошибка получения страницы: ${pageResponse.error}`);
      break;
    }
    
    const pageReviews = pageResponse.reviews || [];
    const pageLastId = pageResponse.lastId || null;
    
    if (pageReviews.length === 0) {
      log(`[Ozon] Страница пуста, завершаем пагинацию`);
      hasNext = false;
      break;
    }
    
    // Фильтруем по критериям (4-5 звёзд, 0 комментариев)
    const filtered = filterByCriteria(pageReviews);
    log(`[Ozon] Отфильтровано ${filtered.length} из ${pageReviews.length}`);
    
    // Убираем дубликаты
    const unique = removeDuplicates(filtered, existingIds);
    log(`[Ozon] Найдено ${unique.length} новых отзывов`);
    
    // Добавляем к результату
    newReviews.push(...unique);
    
    // Добавляем новые ID в список существующих
    unique.forEach(review => existingIds.push(review.reviewId));
    
    // Обновляем для следующей итерации
    lastId = pageLastId;
    iteration++;
    pagesProcessed++;
    hasNext = !!pageLastId && pageReviews.length >= OZON_AUTO_CONFIG.REVIEWS_PER_PAGE;
    
    // Rate limiting
    const pageTime = Date.now() - pageStart;
    if (pageTime < 500) {
      Utilities.sleep(500 - pageTime);
    }
  }
  
  return {
    newReviews: newReviews,
    newLastId: lastId,
    nextIteration: iteration,
    pagesProcessed: pagesProcessed,
    hasNext: hasNext
  };
}

/**
 * Получает одну страницу отзывов с Ozon API
 */
function fetchReviewsPage(store, lastId) {
  try {
    const url = OZON_AUTO_CONFIG.API_URL;
    
    const payload = {
      limit: OZON_AUTO_CONFIG.REVIEWS_PER_PAGE,
      with_photos: false
    };
    
    if (lastId) {
      payload.last_id = lastId;
    }
    
    const options = {
      method: 'POST',
      headers: {
        'Client-Id': store.credentials.clientId,
        'Api-Key': store.credentials.apiKey,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(url, options);
    const code = response.getResponseCode();
    const text = response.getContentText();
    
    if (code !== 200) {
      return {
        success: false,
        error: `HTTP ${code}: ${text}`,
        reviews: [],
        lastId: null
      };
    }
    
    const data = JSON.parse(text);
    
    // Извлекаем отзывы и last_id
    const reviews = data.reviews || data.result?.reviews || [];
    const newLastId = data.last_id || data.result?.last_id || null;
    
    return {
      success: true,
      reviews: reviews,
      lastId: newLastId
    };
    
  } catch (error) {
    log(`❌ Ошибка запроса к Ozon API: ${error.message}`);
    return {
      success: false,
      error: error.message,
      reviews: [],
      lastId: null
    };
  }
}

/**
 * Фильтрует отзывы по критериям: 4-5 звёзд, 0 комментариев
 */
function filterByCriteria(reviews) {
  const filtered = [];
  
  for (let i = 0; i < reviews.length; i++) {
    const review = reviews[i];
    
    // Проверяем рейтинг
    const rating = parseInt(review.rating, 10);
    if (!OZON_AUTO_CONFIG.FILTER_RATINGS.includes(rating)) {
      continue;
    }
    
    // Проверяем количество комментариев
    const commentsCount = parseInt(review.comments_amount || 0, 10);
    if (commentsCount !== OZON_AUTO_CONFIG.FILTER_COMMENTS_COUNT) {
      continue;
    }
    
    // Проверяем наличие текста
    if (!review.text || review.text.trim().length === 0) {
      continue;
    }
    
    // Нормализуем отзыв
    const normalized = normalizeReview(review);
    filtered.push(normalized);
  }
  
  return filtered;
}

/**
 * Нормализует отзыв в формат для таблицы
 */
function normalizeReview(review) {
  const reviewDate = review.created_date || review.date || new Date().toISOString();
  const productId = review.product_id || '';
  const reviewLink = productId ? `https://www.ozon.ru/product/${productId}` : '';
  
  return {
    reviewId: review.id || review.review_id || '',
    reviewDate: reviewDate,
    sku: review.offer_id || review.sku || '',
    productName: review.product_name || '',
    reviewLink: reviewLink,
    rating: parseInt(review.rating, 10) || 0,
    reviewText: (review.text || '').substring(0, 1000),
    preparedAnswer: '',
    status: OZON_AUTO_CONFIG.NEW_STATUS,
    errorDetails: '',
    sendTime: '',
    commentsCount: parseInt(review.comments_amount || 0, 10)
  };
}

/**
 * Убирает дубликаты по ID
 */
function removeDuplicates(reviews, existingIds) {
  const unique = [];
  
  for (let i = 0; i < reviews.length; i++) {
    const review = reviews[i];
    const reviewId = review.reviewId;
    
    if (!reviewId) continue;
    
    // Проверяем, есть ли уже этот ID
    let isDuplicate = false;
    for (let j = 0; j < existingIds.length; j++) {
      if (existingIds[j] === reviewId) {
        isDuplicate = true;
        break;
      }
    }
    
    if (!isDuplicate) {
      unique.push(review);
    }
  }
  
  return unique;
}

/**
 * Получает существующие ID отзывов из листа магазина
 */
function getExistingReviewIds(store) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = `Отзывы (${store.name})`;
    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      log(`[${store.name}] Лист "${sheetName}" не найден`);
      return [];
    }
    
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return [];
    }
    
    // Колонка B = "ID отзыва"
    const reviewIdColumn = 2;
    const reviewIds = sheet.getRange(2, reviewIdColumn, lastRow - 1, 1).getValues();
    
    const ids = [];
    for (let i = 0; i < reviewIds.length; i++) {
      const id = reviewIds[i][0];
      if (id && id !== '') {
        ids.push(id.toString());
      }
    }
    
    return ids;
    
  } catch (error) {
    log(`[${store.name}] ❌ Ошибка чтения ID: ${error.message}`);
    return [];
  }
}

/**
 * Записывает новые отзывы в лист магазина
 */
function writeToSheet(store, reviews) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = `Отзывы (${store.name})`;
    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      log(`[${store.name}] ❌ Лист "${sheetName}" не найден для записи`);
      return;
    }
    
    const lastRow = sheet.getLastRow();
    const startRow = lastRow + 1;
    
    // Формируем строки
    const rows = [];
    for (let i = 0; i < reviews.length; i++) {
      const review = reviews[i];
      const rowNumber = startRow + i;
      
      // Формат: '№', 'ID отзыва', 'Дата отзыва', 'Артикул', 'Название товара',
      //         'Ссылка', 'Оценка', 'Текст отзыва', 'Подобранный ответ',
      //         'Статус', 'Детали ошибки', 'Время отправки'
      const row = [
        rowNumber - 1,              // №
        review.reviewId,            // ID отзыва
        review.reviewDate,          // Дата отзыва
        review.sku,                 // Артикул
        review.productName,         // Название товара
        review.reviewLink,          // Ссылка
        review.rating,              // Оценка
        review.reviewText,          // Текст отзыва
        review.preparedAnswer,      // Подобранный ответ (пусто)
        review.status,              // Статус (NEW)
        review.errorDetails,        // Детали ошибки (пусто)
        review.sendTime             // Время отправки (пусто)
      ];
      
      rows.push(row);
    }
    
    // Записываем все строки
    sheet.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);
    
    log(`[${store.name}] ✅ Записано ${rows.length} отзывов`);
    
  } catch (error) {
    log(`[${store.name}] ❌ Ошибка записи: ${error.message}`);
    throw error;
  }
}

// ============ УПРАВЛЕНИЕ ТРИГГЕРОМ ============

/**
 * Устанавливает триггер автоматического сбора (каждые 3 часа)
 */
function setupOzonAutoCollectionTrigger() {
  try {
    log('Настройка триггера автоматического сбора Ozon (каждые 3 часа)');
    
    // Удаляем старые триггеры
    deleteOzonAutoCollectionTrigger();
    
    // Создаем новый
    ScriptApp.newTrigger('collectOzonReviewsAuto')
      .timeBased()
      .everyHours(OZON_AUTO_CONFIG.TRIGGER_INTERVAL_HOURS)
      .create();
    
    log(`✅ Триггер установлен (каждые ${OZON_AUTO_CONFIG.TRIGGER_INTERVAL_HOURS} часа)`);
    
    SpreadsheetApp.getUi().alert(
      '✅ Триггер установлен',
      `Автоматический сбор отзывов Ozon будет запускаться каждые ${OZON_AUTO_CONFIG.TRIGGER_INTERVAL_HOURS} часа.`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    
    return {
      success: true,
      message: 'Триггер установлен успешно',
      interval: `${OZON_AUTO_CONFIG.TRIGGER_INTERVAL_HOURS} часов`
    };
    
  } catch (error) {
    log(`❌ Ошибка установки триггера: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Удаляет триггер автоматического сбора
 */
function deleteOzonAutoCollectionTrigger() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    let deletedCount = 0;
    
    for (let i = 0; i < triggers.length; i++) {
      const trigger = triggers[i];
      if (trigger.getHandlerFunction() === 'collectOzonReviewsAuto') {
        ScriptApp.deleteTrigger(trigger);
        deletedCount++;
      }
    }
    
    if (deletedCount > 0) {
      log(`Удалено ${deletedCount} старых триггеров`);
    }
    
    return {
      success: true,
      deletedCount: deletedCount
    };
    
  } catch (error) {
    log(`❌ Ошибка удаления триггеров: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Проверяет статус триггера
 */
function checkOzonAutoCollectionTriggerStatus() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    const found = [];
    
    for (let i = 0; i < triggers.length; i++) {
      const trigger = triggers[i];
      if (trigger.getHandlerFunction() === 'collectOzonReviewsAuto') {
        found.push({
          id: trigger.getUniqueId(),
          eventType: trigger.getEventType().toString(),
          handlerFunction: trigger.getHandlerFunction()
        });
      }
    }
    
    return {
      enabled: found.length > 0,
      triggersCount: found.length,
      triggers: found,
      interval: `${OZON_AUTO_CONFIG.TRIGGER_INTERVAL_HOURS} часов`
    };
    
  } catch (error) {
    log(`❌ Ошибка проверки триггера: ${error.message}`);
    return {
      enabled: false,
      error: error.message
    };
  }
}

/**
 * Сбрасывает прогресс для магазина (вручную)
 */
function resetOzonAutoCollectionProgress(storeId) {
  try {
    const props = PropertiesService.getScriptProperties();
    const lastIdKey = OZON_AUTO_CONFIG.LAST_ID_PREFIX + storeId;
    const iterationKey = OZON_AUTO_CONFIG.ITERATION_PREFIX + storeId;
    
    props.deleteProperty(lastIdKey);
    props.deleteProperty(iterationKey);
    
    log(`Прогресс сброшен для магазина ${storeId}`);
    
    return {
      success: true,
      message: 'Прогресс сброшен'
    };
    
  } catch (error) {
    log(`❌ Ошибка сброса прогресса: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}
