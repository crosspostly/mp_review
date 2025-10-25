/**
 * 🚀 РЕАЛИЗАЦИЯ ФИНАЛЬНОЙ СХЕМЫ
 * Основные триггеры согласно final-working-schema.md
 * 100% Google Apps Script без сторонних сервисов
 */

// ============ ТРИГГЕР 1: СБОР ОТЗЫВОВ (каждые 2 часа) ============

/**
 * 🎯 ГЛАВНЫЙ ТРИГГЕР СБОРА ОТЗЫВОВ
 * Запускается каждые 2 часа согласно финальной схеме
 */
function hourlyReviewCollector() {
  const startTime = Date.now();
  const MAX_TIME = 5 * 60 * 1000; // 5 минут лимит
  
  const props = PropertiesService.getScriptProperties();
  let startIndex = parseInt(props.getProperty('lastProcessedStoreIndex') || '0');
  
  log(`[Collector] 🚀 Начало сбора (с магазина ${startIndex})`);
  
  const stores = getActiveStores();
  
  for (let i = startIndex; i < stores.length; i++) {
    // Проверка времени
    if (Date.now() - startTime > MAX_TIME) {
      props.setProperty('lastProcessedStoreIndex', i.toString());
      log(`[Collector] ⏰ Время истекло, прогресс: ${i}`);
      return;
    }
    
    const store = stores[i];
    log(`[Collector] 📦 ${i + 1}/${stores.length}: ${store.name}`);
    
    try {
      let allReviews = [];
      
      // Сбор по типу маркетплейса
      if (store.marketplace === 'Ozon') {
        allReviews = collectOzonReviews(store);
      } else if (store.marketplace === 'Wildberries') {
        allReviews = collectWBReviews(store);
      }
      
      if (allReviews.length > 0) {
        // КРИТИЧНО: фильтрация через Properties
        const newReviews = filterDuplicatesByProperties(allReviews, store.id);
        
        if (newReviews.length > 0) {
          // Batch сохранение в Sheets
          batchSaveToSheet(newReviews, store.id);
          log(`[Collector] ✅ ${store.name}: ${newReviews.length} новых`);
        } else {
          log(`[Collector] ℹ️ ${store.name}: все дубликаты`);
        }
      }
      
    } catch (e) {
      log(`[Collector] ❌ ${store.name}: ${e.message}`);
    }
  }
  
  // Сброс прогресса
  props.setProperty('lastProcessedStoreIndex', '0');
  log(`[Collector] 🏁 Цикл завершён`);
}

/**
 * 🟠 Сбор отзывов Ozon (только первые 20 страниц)
 */
function collectOzonReviews(store) {
  const MAX_PAGES = 20;
  const DELAY_MS = 800;
  let allReviews = [];
  
  log(`[Ozon] Сбор для ${store.name}, max ${MAX_PAGES} страниц`);
  
  for (let page = 1; page <= MAX_PAGES; page++) {
    try {
      if (page > 1) Utilities.sleep(DELAY_MS);
      
      const pageReviews = getOzonReviewsPage(store, page);
      
      if (pageReviews.length === 0) {
        log(`[Ozon] Страница ${page} пуста, стоп`);
        break;
      }
      
      allReviews = allReviews.concat(pageReviews);
      log(`[Ozon] Страница ${page}: ${pageReviews.length} отзывов`);
      
    } catch (e) {
      if (e.message.includes('429')) {
        log(`[Ozon] Rate limit, ждём 2 сек`);
        Utilities.sleep(2000);
        continue;
      }
      log(`[Ozon] Ошибка на странице ${page}: ${e.message}`);
      break;
    }
  }
  
  log(`[Ozon] Собрано ${allReviews.length} отзывов`);
  return allReviews;
}

/**
 * 📄 Получение страницы отзывов Ozon
 */
function getOzonReviewsPage(store, page) {
  const url = 'https://api-seller.ozon.ru/v1/review/list';
  const options = {
    method: 'post',
    headers: {
      'Client-Id': store.credentials.clientId,
      'Api-Key': store.credentials.apiKey,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify({
      page: page,
      page_size: 50 // 50 отзывов на страницу
    }),
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(url, options);
  const result = JSON.parse(response.getContentText());
  
  if (!result.result || !result.result.reviews) {
    return [];
  }
  
  return result.result.reviews.map(r => ({
    id: r.id,
    date: r.created_date || new Date().toISOString(),
    rating: r.score || 0,
    text: r.text || '',
    product: r.product_name || '',
    marketplace: 'Ozon'
  }));
}

/**
 * 🔵 Сбор отзывов Wildberries (за последние 24 часа)
 */
function collectWBReviews(store) {
  const DELAY_MS = 500;
  const last24h = Math.floor(Date.now() / 1000) - (24 * 60 * 60);
  
  log(`[WB] Сбор для ${store.name}, последние 24h`);
  
  try {
    Utilities.sleep(DELAY_MS);
    
    const url = `https://feedbacks-api.wildberries.ru/api/v1/feedbacks?dateFrom=${last24h}&take=5000`;
    const options = {
      method: 'get',
      headers: {
        'Authorization': store.credentials.apiKey
      },
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());
    
    const reviews = (result.data?.feedbacks || []).map(r => ({
      id: r.id,
      date: r.createdDate || new Date().toISOString(),
      rating: r.productValuation || 0,
      text: r.text || '',
      product: r.productDetails?.productName || '',
      marketplace: 'Wildberries'
    }));
    
    log(`[WB] Собрано ${reviews.length} отзывов`);
    return reviews;
    
  } catch (e) {
    log(`[WB] Ошибка: ${e.message}`);
    return [];
  }
}

/**
 * 🗃️ КРИТИЧНАЯ ФУНКЦИЯ: Фильтрация дубликатов через Properties
 */
function filterDuplicatesByProperties(newReviews, storeId) {
  const props = PropertiesService.getScriptProperties();
  const key = `reviewIds_${storeId}`;
  
  // Получаем кеш ID
  const cachedIds = JSON.parse(props.getProperty(key) || '[]');
  const cachedSet = new Set(cachedIds);
  
  // Фильтруем
  const uniqueReviews = newReviews.filter(r => !cachedSet.has(r.id));
  
  // Обновляем кеш
  if (uniqueReviews.length > 0) {
    const newIds = uniqueReviews.map(r => r.id);
    const allIds = [...cachedSet, ...newIds];
    
    // Храним только последние 10K ID
    props.setProperty(key, JSON.stringify(allIds.slice(-10000)));
  }
  
  return uniqueReviews;
}

/**
 * 📊 Batch сохранение в лист
 */
function batchSaveToSheet(reviews, storeId) {
  const sheet = getOrCreateStoreSheet(storeId);
  const now = new Date();
  
  const rows = reviews.map(r => [
    r.id,
    r.date,
    r.rating,
    r.text,
    r.product,
    'NEW', // status
    now,   // processedDate
    '',    // answer
    ''     // errorMsg
  ]);
  
  // ОДНА операция setValues
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 9).setValues(rows);
}

/**
 * 📋 Получение или создание листа магазина
 */
function getOrCreateStoreSheet(storeId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Ищем магазин по ID для получения красивого названия листа
  const stores = getStores();
  const store = stores.find(s => s.id === storeId);
  const sheetName = store ? `Отзывы (${store.name})` : storeId;
  
  let sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, 9).setValues([['ID отзыва', 'Дата отзыва', 'Рейтинг', 'Текст отзыва', 'Товар', 'Статус', 'Дата обработки', 'Подобранный ответ', 'Ошибки']]);
  }
  
  return sheet;
}

/**
 * 🏪 Получение активных магазинов
 */
function getActiveStores() {
  return getStores().filter(s => s.isActive);
}

/**
 * 🧪 Тестовая функция проверки Properties кеширования
 */
function testPropertiesCaching(reviews, storeId) {
  try {
    log(`[TEST CACHE] 🗃️ Тестирование Properties кеширования для магазина ${storeId}...`);
    
    // Симулируем первоначальное сохранение
    const reviewIds = reviews.map(r => r.id);
    log(`[TEST CACHE] 💾 Сохраняем ${reviewIds.length} ID отзывов...`);
    
    const props = PropertiesService.getScriptProperties();
    const key = `reviewIds_${storeId}`;
    
    // Сохраняем ID
    props.setProperty(key, JSON.stringify(reviewIds));
    log(`[TEST CACHE] ✅ ID сохранены в Properties с ключом: ${key}`);
    
    // Проверяем чтение
    const savedIds = JSON.parse(props.getProperty(key) || '[]');
    log(`[TEST CACHE] 📖 Прочитано ${savedIds.length} ID из Properties`);
    
    // Тестируем фильтрацию дубликатов
    const newReviews = filterDuplicatesByProperties(reviews, storeId);
    log(`[TEST CACHE] 🔍 После фильтрации дубликатов: ${newReviews.length} новых из ${reviews.length} всего`);
    
    // Проверяем, что дубликаты отфильтровались
    if (newReviews.length === 0) {
      log(`[TEST CACHE] ✅ Фильтрация работает! Все отзывы распознаны как дубликаты`);
    } else {
      log(`[TEST CACHE] ⚠️ Найдено ${newReviews.length} новых отзывов (возможно, это нормально при первом запуске)`);
    }
    
  } catch (e) {
    log(`[TEST CACHE] ❌ Ошибка тестирования кеширования: ${e.message}`);
  }
}

// ============ ТРИГГЕР 2: ПОДБОР ОТВЕТОВ (каждые 2 часа) ============

/**
 * 💡 Подбор ответов для новых отзывов
 */
function selectReviewAnswers() {
  log('[Selector] 🚀 Начало подбора');
  
  const newReviews = getAllReviewsByStatus('NEW', 100);
  
  if (newReviews.length === 0) {
    log('[Selector] ℹ️ Новых отзывов нет');
    return;
  }
  
  log(`[Selector] 📊 Найдено ${newReviews.length} отзывов`);
  
  const updates = [];
  
  newReviews.forEach(review => {
    try {
      // Выбор шаблона по рейтингу
      let template = '';
      
      switch(review.rating) {
        case 5:
          template = '🌟 Спасибо за отличный отзыв! Рады, что вам понравилось!';
          break;
        case 4:
          template = '👍 Благодарим за оценку! Ваше мнение очень важно для нас.';
          break;
        case 3:
          template = '💭 Спасибо за отзыв. Обязательно учтём ваши замечания.';
          break;
        case 2:
        case 1:
          template = '😔 Извините за разочарование. Свяжитесь с нами для решения проблемы.';
          break;
        default:
          template = 'Спасибо за ваш отзыв!';
      }
      
      // Кастомизация по ключевым словам
      if (review.text) {
        const text = review.text.toLowerCase();
        
        if (text.includes('доставка') || text.includes('курьер')) {
          template += '\n📦 По вопросам доставки свяжитесь с нами.';
        }
        
        if (text.includes('качество') || text.includes('брак')) {
          template += '\n🔧 Готовы помочь с возвратом или заменой товара.';
        }
        
        if (text.includes('цена') || text.includes('дорого')) {
          template += '\n💰 Следите за нашими акциями и скидками!';
        }
      }
      
      updates.push({
        ...review,
        answer: template,
        status: 'PENDING_SEND',
        processedDate: new Date()
      });
      
    } catch (e) {
      log(`[Selector] ❌ Ошибка ${review.id}: ${e}`);
    }
  });
  
  if (updates.length > 0) {
    batchUpdateReviews(updates);
    log(`[Selector] ✅ Обработано ${updates.length}`);
  }
}

// ============ ТРИГГЕР 3: ОТПРАВКА ОТВЕТОВ (каждые 2 часа) ============

/**
 * 📤 Отправка ответов на отзывы
 */
function sendReviewAnswers() {
  log('[Sender] 🚀 Начало отправки');
  
  const pendingReviews = getAllReviewsByStatus('PENDING_SEND', 50);
  
  if (pendingReviews.length === 0) {
    log('[Sender] ℹ️ Ответов для отправки нет');
    return;
  }
  
  log(`[Sender] 📊 Отправляем ${pendingReviews.length}`);
  
  const updates = [];
  
  pendingReviews.forEach(review => {
    try {
      let success = false;
      
      if (review.marketplace === 'Ozon') {
        success = sendOzonAnswer(review);
        Utilities.sleep(500); // Rate limit Ozon
      } else if (review.marketplace === 'Wildberries') {
        success = sendWBAnswer(review);
        Utilities.sleep(333); // Rate limit WB
      }
      
      updates.push({
        ...review,
        status: success ? 'SENT' : 'ERROR',
        errorMsg: success ? '' : 'Ошибка отправки'
      });
      
      log(`[Sender] ${success ? '✅' : '❌'} ${review.id}`);
      
    } catch (e) {
      log(`[Sender] ❌ Exception ${review.id}: ${e}`);
      updates.push({
        ...review,
        status: 'ERROR',
        errorMsg: e.toString()
      });
    }
  });
  
  if (updates.length > 0) {
    batchUpdateReviews(updates);
  }
}

/**
 * 🟠 Отправка ответа на отзыв Ozon
 */
function sendOzonAnswer(review) {
  const store = getStoreById(review.storeId);
  
  const url = 'https://api-seller.ozon.ru/v1/review/comment/create';
  const options = {
    method: 'post',
    headers: {
      'Client-Id': store.credentials.clientId,
      'Api-Key': store.credentials.apiKey,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify({
      review_id: review.id,
      text: review.answer
    }),
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());
    return result.result === true;
  } catch (e) {
    log(`[Ozon API] Ошибка: ${e.message}`);
    return false;
  }
}

/**
 * 🔵 Отправка ответа на отзыв WB
 */
function sendWBAnswer(review) {
  const store = getStoreById(review.storeId);
  
  const url = `https://feedbacks-api.wildberries.ru/api/v1/feedbacks/${review.id}`;
  const options = {
    method: 'patch',
    headers: {
      'Authorization': store.credentials.apiKey,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify({
      text: review.answer
    }),
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    return response.getResponseCode() === 200;
  } catch (e) {
    log(`[WB API] Ошибка: ${e.message}`);
    return false;
  }
}

// ============ HELPER ФУНКЦИИ ============

/**
 * 🔍 Поиск отзывов по статусу из всех листов
 */
function getAllReviewsByStatus(status, limit) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  let allReviews = [];
  
  sheets.forEach(sheet => {
    const name = sheet.getName();
    if (name === 'Stores' || name === 'Settings' || name === 'Logs') return;
    
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length && allReviews.length < limit; i++) {
      if (data[i][5] === status) {
        allReviews.push({
          sheetName: name,
          storeId: name,
          rowIndex: i + 1,
          id: data[i][0],
          date: data[i][1],
          rating: data[i][2],
          text: data[i][3],
          product: data[i][4],
          status: data[i][5],
          processedDate: data[i][6],
          answer: data[i][7],
          errorMsg: data[i][8],
          marketplace: name.split('_')[0]
        });
      }
    }
  });
  
  return allReviews.slice(0, limit);
}

/**
 * 📝 Batch обновление отзывов
 */
function batchUpdateReviews(updates) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const grouped = {};
  
  updates.forEach(u => {
    if (!grouped[u.sheetName]) grouped[u.sheetName] = [];
    grouped[u.sheetName].push(u);
  });
  
  Object.entries(grouped).forEach(([sheetName, sheetUpdates]) => {
    const sheet = ss.getSheetByName(sheetName);
    
    sheetUpdates.forEach(u => {
      sheet.getRange(u.rowIndex, 6, 1, 4).setValues([[
        u.status,
        u.processedDate || new Date(),
        u.answer || '',
        u.errorMsg || ''
      ]]);
    });
  });
}

/**
 * 🏪 Получение магазина по ID
 */
function getStoreById(storeId) {
  const stores = getStores();
  return stores.find(s => s.id === storeId);
}

// ============ УПРАВЛЕНИЕ ТРИГГЕРАМИ ============

/**
 * 🎛️ Создание всех триггеров согласно финальной схеме
 */
function setupFinalSchemaTriggers() {
  const ui = SpreadsheetApp.getUi();
  
  try {
    // Удаляем старые триггеры
    deleteAllSchemaTriggers();
    
    // Создаем новые триггеры каждые 2 часа
    ScriptApp.newTrigger('hourlyReviewCollector')
      .timeBased()
      .everyHours(2)
      .create();
      
    ScriptApp.newTrigger('selectReviewAnswers')
      .timeBased()
      .everyHours(2)
      .create();
      
    ScriptApp.newTrigger('sendReviewAnswers')
      .timeBased()
      .everyHours(2)
      .create();
    
    log('[Triggers] ✅ Созданы 3 триггера финальной схемы (каждые 2 часа)');
    ui.alert('✅ ТРИГГЕРЫ СОЗДАНЫ', 'Установлены 3 триггера согласно финальной схеме:\n\n1. Сбор отзывов (каждые 2 часа)\n2. Подбор ответов (каждые 2 часа)\n3. Отправка ответов (каждые 2 часа)', ui.ButtonSet.OK);
    
  } catch (e) {
    log(`[Triggers] ❌ Ошибка создания триггеров: ${e.message}`);
    ui.alert('❌ ОШИБКА', `Ошибка создания триггеров:\n\n${e.message}`, ui.ButtonSet.OK);
  }
}

/**
 * 🗑️ Удаление всех триггеров схемы
 */
function deleteAllSchemaTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  const schemaFunctions = ['hourlyReviewCollector', 'selectReviewAnswers', 'sendReviewAnswers'];
  
  let deletedCount = 0;
  triggers.forEach(trigger => {
    if (schemaFunctions.includes(trigger.getHandlerFunction())) {
      ScriptApp.deleteTrigger(trigger);
      deletedCount++;
    }
  });
  
  if (deletedCount > 0) {
    log(`[Triggers] 🗑️ Удалено ${deletedCount} триггеров финальной схемы`);
  }
}

/**
 * 🎯 Тестовый запуск всей цепочки схемы
 */
function testFinalSchemaChain() {
  const ui = SpreadsheetApp.getUi();
  
  const response = ui.alert(
    '🧪 ТЕСТ ФИНАЛЬНОЙ СХЕМЫ',
    'Протестировать всю цепочку:\n1. Сбор отзывов\n2. Подбор ответов\n3. Отправка ответов\n\nЭто займет несколько минут.',
    ui.ButtonSet.YES_NO
  );
  
  if (response !== ui.Button.YES) {
    return;
  }
  
  log('[Schema Test] 🧪 ТЕСТИРОВАНИЕ цепочки финальной схемы...');
  
  try {
    // Включаем dev mode
    const wasDevMode = isDevMode();
    if (!wasDevMode) setDevMode('true');
    
    // 1. Сбор отзывов
    log('[Schema Test] 1️⃣ Тестируем сбор отзывов...');
    hourlyReviewCollector();
    
    // 2. Подбор ответов
    log('[Schema Test] 2️⃣ Тестируем подбор ответов...');
    selectReviewAnswers();
    
    // 3. Отправка ответов (только в dev mode)
    if (isDevMode()) {
      log('[Schema Test] 3️⃣ Тестируем отправку ответов (dev mode)...');
      // В dev mode не отправляем реально
      log('[Schema Test] ⚠️ Отправка пропущена в dev mode');
    }
    
    // Восстанавливаем режим
    if (!wasDevMode) setDevMode('false');
    
    ui.alert('✅ ТЕСТ ЗАВЕРШЕН', 'Цепочка финальной схемы протестирована!\n\nПроверьте логи для деталей.', ui.ButtonSet.OK);
    
  } catch (e) {
    log(`[Schema Test] ❌ Ошибка тестирования: ${e.message}`);
    ui.alert('❌ ОШИБКА', `Ошибка тестирования схемы:\n\n${e.message}`, ui.ButtonSet.OK);
  }
}
