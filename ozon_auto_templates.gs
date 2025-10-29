/**
 * ============================================================================
 * OZON: АВТОМАТИЧЕСКАЯ ОБРАБОТКА ОТЗЫВОВ (АРХИТЕКТУРА 2-Х ТРИГГЕРОВ)
 * ============================================================================
 *
 * Раздельная архитектура для максимальной надежности и производительности:
 * 1. БЫСТРЫЙ ПОДБОРЩИК: Триггер раз в 15 минут. Находит все NEW отзывы
 *    и подбирает им шаблоны. Работает только с таблицей, без API.
 * 2. МЕДЛЕННЫЙ ОТПРАВЩИК: Триггер раз в час. Находит все PENDING ответы
 *    и отправляет их в Ozon, соблюдая лимиты. Работает с API.
 *
 * ============================================================================
 */

/**
 * ----------------------------------------------------------------------------
 * 🎯 ТРИГГЕР №1: БЫСТРЫЙ ПОДБОРЩИК ШАБЛОНОВ (запуск каждые 15 минут)
 * ----------------------------------------------------------------------------
 * Задача: максимально быстро обработать все новые отзывы во всех магазинах,
 * не используя медленные API-запросы.
 */
function processNewOzonReviews() {
  const startTime = Date.now();
  log('='.repeat(70));
  log('🎯 БЫСТРЫЙ ПОДБОРЩИК: СТАРТ');
  
  const allStores = getStores();
  const ozonStores = allStores.filter(s => s.isActive && s.marketplace === 'Ozon');
  const templates = getTemplates();
  
  if (ozonStores.length === 0 || templates.length === 0) {
      log('⚠️ Нет активных магазинов Ozon или шаблонов для обработки. Завершаю.');
      log('='.repeat(70));
      return;
  }
  
  let totalMatched = 0;

  for (const store of ozonStores) {
      const result = processNewOzonReviewsForStore(store, templates);
      if(result.matched > 0) {
        log(`  - ${store.name}: подобрано ${result.matched} шаблонов`);
      }
      totalMatched += result.matched;
  }
  
  const totalDuration = Date.now() - startTime;
  log(`✅ БЫСТРЫЙ ПОДБОРЩИК: ЗАВЕРШЕН за ${totalDuration} мс. Всего подобрано: ${totalMatched}`);
  log('='.repeat(70));
}



/**
 * ----------------------------------------------------------------------------
 * 🎯 ТРИГГЕР №2: МЕДЛЕННЫЙ ОТПРАВЩИК ОТВЕТОВ (запуск каждый час)
 * ----------------------------------------------------------------------------
 * Задача: методично отправить все подготовленные ответы ("PENDING")
 * через API Ozon, соблюдая все лимиты и задержки.
 */
function sendPendingAnswersOzonOnly() {
  const startTime = Date.now();
  log('='.repeat(70));
  log('🎯 МЕДЛЕННЫЙ ОТПРАВЩИК: СТАРТ');
  
  const allStores = getStores();
  const ozonStores = allStores.filter(s => s.isActive && s.marketplace === 'Ozon');
  
  if (ozonStores.length === 0) {
    log('⚠️ Нет активных магазинов Ozon для отправки. Завершаю.');
    log('='.repeat(70));
    return;
  }
  
  let totalSent = 0;
  let totalSuccess = 0;
  
  for (const store of ozonStores) {
    const storeResult = sendPendingAnswersForStoreInternal(store);
    if(storeResult.sentCount > 0) {
        log(`  - ${store.name}: отправлено ${storeResult.successCount}/${storeResult.sentCount}`);
        totalSent += storeResult.sentCount;
        totalSuccess += storeResult.successCount;
    }
  }
  
  const totalDuration = Date.now() - startTime;
  log(`✅ МЕДЛЕННЫЙ ОТПРАВЩИК: ЗАВЕРШЕН за ${Math.round(totalDuration/1000)} сек. Всего отправлено: ${totalSuccess}/${totalSent}`);
  log('='.repeat(70));
}

/**
 * ----------------------------------------------------------------------------
 * ⚙️ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
 * ----------------------------------------------------------------------------
 */

/**
 * 🔄 Обработка NEW отзывов для ОДНОГО магазина (вызывается БЫСТРЫМ ПОДБОРЩИКОМ)
 * Оптимизирована для скорости: собирает все изменения и вносит их в таблицу одним махом.
 */
function processNewOzonReviewsForStore(store, templates) {
  const sheetName = `Отзывы (${store.name})`;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    return { matched: 0 };
  }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const statusColIdx = headers.indexOf('Статус');
  const answerColIdx = headers.indexOf('Подобранный ответ');
  const ratingColIdx = headers.indexOf('Оценка');

  if (statusColIdx === -1 || answerColIdx === -1 || ratingColIdx === -1) {
      log(`     ❌ Ошибка в \"${sheetName}\": отсутствуют столбцы \"Статус\", \"Оценка\" или \"Подобранный ответ\".`);
      return { matched: 0 };
  }

  let matched = 0;
  const changes = []; // Собираем изменения для пакетного обновления

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const status = row[statusColIdx];
    
    if (status !== CONFIG.STATUS.NEW) continue;
    
    const rating = row[ratingColIdx];
    
    if (!CONFIG.RESPOND_TO_RATINGS.includes(rating)) {
      continue;
    }
    
    const template = selectRandomTemplate(templates, rating);
    
    if (!template) {
      changes.push({row: i + 1, col: statusColIdx + 1, value: CONFIG.STATUS.NO_TEMPLATE});
      continue;
    }
    
    // Готовим изменения для статуса и ответа
    changes.push({row: i + 1, col: answerColIdx + 1, value: template});
    changes.push({row: i + 1, col: statusColIdx + 1, value: CONFIG.STATUS.PENDING});
    
    matched++;
  }
  
  if (changes.length > 0) {
    // Применяем все изменения на листе за один раз
    changes.forEach(c => sheet.getRange(c.row, c.col).setValue(c.value));
    SpreadsheetApp.flush();
  }

  return { matched };
}



/**
 * 📤 Внутренняя функция отправки для ОДНОГО магазина (вызывается МЕДЛЕННЫМ ОТПРАВЩИКОМ)
 */
function sendPendingAnswersForStoreInternal(store) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(`Отзывы (${store.name})`);
  if (!sheet) {
    return { sentCount: 0, successCount: 0 };
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const statusCol = headers.indexOf('Статус') + 1;
  const answerCol = headers.indexOf('Подобранный ответ') + 1;
  const idCol = headers.indexOf('ID отзыва') + 1;
  const errorCol = headers.indexOf('Детали ошибки') + 1;
  const timeCol = headers.indexOf('Время отправки') + 1;

  if (statusCol === 0 || answerCol === 0 || idCol === 0) {
    log(`     ❌ Ошибка в \"${sheet.getName()}\": отсутствуют необходимые столбцы.`);
    return { sentCount: 0, successCount: 0 };
  }

  const pendingAnswers = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][statusCol - 1] === CONFIG.STATUS.PENDING) {
      pendingAnswers.push({
        rowIndex: i + 1,
        feedbackId: data[i][idCol - 1],
        answerText: data[i][answerCol - 1]
      });
    }
  }

  if (pendingAnswers.length === 0) {
    return { sentCount: 0, successCount: 0 };
  }

  let successCount = 0;
  log(`  - ${store.name}: найдено ${pendingAnswers.length} ответов для отправки.`);

  pendingAnswers.forEach((answer) => {
    const result = sendAnswer(store, answer.feedbackId, answer.answerText);
    
    sheet.getRange(answer.rowIndex, statusCol).setValue(result.status);
    sheet.getRange(answer.rowIndex, errorCol).setValue(result.error);
    sheet.getRange(answer.rowIndex, timeCol).setValue(result.timestamp);
    
    if (result.status === CONFIG.STATUS.SENT) {
      successCount++;
    }
    
    Utilities.sleep(OZON_CONFIG.RATE_LIMITS.DELAY_BETWEEN_REQUESTS);
  });

  return { sentCount: pendingAnswers.length, successCount };
}

/**
 * ============================================================================
 * 🚀 УПРАВЛЕНИЕ ТРИГГЕРАМИ
 * ============================================================================
 */

/**
 * ✅ ГЛАВНАЯ ФУНКЦИЯ НАСТРОЙКИ: Создает правильные триггеры для Ozon
 * Запустите эту функцию ОДИН РАЗ, чтобы настроить автоматизацию.
 */
function setupOzonTriggers() {
  deleteAllOzonTriggers(); // Сначала удаляем все старые триггеры
  
  // 1. Создаем "Быстрого подборщика" (каждые 15 минут)
  ScriptApp.newTrigger('processNewOzonReviews')
    .timeBased()
    .everyMinutes(15)
    .create();
  
  // 2. Создаем "Медленного отправщика" (каждый час)
  ScriptApp.newTrigger('sendPendingAnswersOzonOnly')
    .timeBased()
    .everyHours(1)
    .create();
  
  const message = '✅ Автоматизация Ozon настроена! Создано 2 триггера: подборщик (15 мин) и отправщик (1 час).';
  log(message);
  SpreadsheetApp.getUi().alert(message);
}

/**
 * ❌ Удаляет ВСЕ триггеры, связанные с обработкой Ozon
 */
function deleteAllOzonTriggers() {
  const ozonFunctions = ['processNewOzonReviews', 'sendPendingAnswersOzonOnly', 'processOzonWorkflow'];
  const triggers = ScriptApp.getProjectTriggers();
  let deletedCount = 0;
  
  triggers.forEach(trigger => {
    if (ozonFunctions.includes(trigger.getHandlerFunction())) {
      ScriptApp.deleteTrigger(trigger);
      deletedCount++;
    }
  });
  
  if (deletedCount > 0) {
    log(`🗑️ Удалено старых триггеров Ozon: ${deletedCount}`);
  }
}

/**
 * ℹ️ Проверить статус триггеров Ozon
 */
function checkOzonTriggersStatus() {
  const ozonFunctions = ['processNewOzonReviews', 'sendPendingAnswersOzonOnly'];
  const triggers = ScriptApp.getProjectTriggers().filter(t => ozonFunctions.includes(t.getHandlerFunction()));
  
  if (triggers.length < 2) {
    SpreadsheetApp.getUi().alert(
      '⚠️ Автоматизация Ozon настроена НЕПРАВИЛЬНО!',
      `Найдено только ${triggers.length} из 2 необходимых триггеров. Запустите функцию "setupOzonTriggers" для исправления.`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } else {
    let info = '✅ Автоматизация Ozon активна! Найдены 2 триггера:\n\n';
    triggers.forEach(t => {
      info += `- Функция: ${t.getHandlerFunction()}\n- Тип: ${t.getEventType()}\n\n`;
    });
    SpreadsheetApp.getUi().alert('✅ Триггеры в порядке', info, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}
