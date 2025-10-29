/**
 * ============================================================================
 * OZON: АВТОМАТИЧЕСКАЯ ОБРАБОТКА ОТЗЫВОВ (WORKFLOW)
 * ============================================================================
 * 
 * Полный автоматический workflow для Ozon:
 * 1. Подбор шаблонов для NEW отзывов
 * 2. Отправка PENDING ответов
 * 
 * ТРИГГЕР: Запускается каждый час через .everyHours(1)
 * ВРЕМЯ ВЫПОЛНЕНИЯ: Укладывается в 250 секунд
 * 
 * ============================================================================
 */

/**
 * 🎯 ГЛАВНЫЙ WORKFLOW: Полная автоматизация Ozon
 * Триггер вызывает эту функцию каждый час
 */
function processOzonWorkflow() {
  const startTime = Date.now();
  const maxExecutionTime = 240 * 1000; // 4 минуты (оставляем запас)
  
  log('='.repeat(70));
  log('🎯 OZON WORKFLOW: ПОДБОР ШАБЛОНОВ + ОТПРАВКА - СТАРТ');
  log('='.repeat(70));
  
  // ШАГ 1: Подбор шаблонов для NEW отзывов
  log('📝 ШАГ 1/2: Подбор шаблонов для NEW отзывов...');
  const templateResult = processNewOzonReviewsInternal();
  
  const step1Duration = Date.now() - startTime;
  log(`✅ ШАГ 1 завершен за ${Math.round(step1Duration/1000)} сек`);
  log(`   Подобрано шаблонов: ${templateResult.totalMatched}`);
  
  // Проверяем оставшееся время
  const remainingTime = maxExecutionTime - step1Duration;
  if (remainingTime < 30000) {
    log(`⏱️ Недостаточно времени для отправки (${Math.round(remainingTime/1000)} сек). Завершаю.`);
    log('='.repeat(70));
    return;
  }
  
  // ШАГ 2: Отправка PENDING ответов для Ozon магазинов
  log('-'.repeat(70));
  log('📤 ШАГ 2/2: Отправка подготовленных ответов...');
  const sendResult = sendPendingAnswersOzonOnly();
  
  const totalDuration = Date.now() - startTime;
  
  log('='.repeat(70));
  log('📊 ИТОГОВАЯ СТАТИСТИКА WORKFLOW:');
  log(`   Шаблонов подобрано: ${templateResult.totalMatched}`);
  log(`   Ответов отправлено: ${sendResult.totalSuccess}/${sendResult.totalSent}`);
  log(`   Время выполнения: ${Math.round(totalDuration/1000)} сек`);
  log('🎯 OZON WORKFLOW: ЗАВЕРШЕН');
  log('='.repeat(70));
}

/**
 * 🎯 РУЧНОЙ ЗАПУСК: Только подбор шаблонов
 * Вызывается из меню для ручного подбора
 */
function processNewOzonReviews() {
  const startTime = Date.now();
  
  log('='.repeat(70));
  log('🎯 OZON: РУЧНОЙ ПОДБОР ШАБЛОНОВ - СТАРТ');
  log('='.repeat(70));
  
  const result = processNewOzonReviewsInternal();
  
  const totalDuration = Date.now() - startTime;
  
  log('='.repeat(70));
  log('📊 ИТОГОВАЯ СТАТИСТИКА:');
  log(`   Магазинов обработано: ${result.storesProcessed}`);
  log(`   Отзывов обработано: ${result.totalProcessed}`);
  log(`   Шаблонов подобрано: ${result.totalMatched}`);
  log(`   Пропущено (нет шаблона): ${result.totalSkipped}`);
  log(`   Время выполнения: ${Math.round(totalDuration/1000)} сек`);
  log('🎯 OZON: РУЧНОЙ ПОДБОР ШАБЛОНОВ - ЗАВЕРШЕН');
  log('='.repeat(70));
}

/**
 * 🔧 ВНУТРЕННЯЯ ФУНКЦИЯ: Подбор шаблонов
 * Вызывается из workflow или вручную
 */
function processNewOzonReviewsInternal() {
  const startTime = Date.now();
  const maxExecutionTime = 200 * 1000; // 3.5 минуты максимум
  
  // Получаем активные магазины Ozon
  const allStores = getStores();
  const ozonStores = allStores.filter(s => s.isActive && s.marketplace === 'Ozon');
  
  if (ozonStores.length === 0) {
    log('⚠️ Нет активных магазинов Ozon.');
    return { storesProcessed: 0, totalProcessed: 0, totalMatched: 0, totalSkipped: 0 };
  }
  
  log(`📊 Найдено активных магазинов Ozon: ${ozonStores.length}`);
  
  // Получаем шаблоны ответов
  const templates = getTemplates();
  if (templates.length === 0) {
    log('❌ ОШИБКА: Нет шаблонов ответов. Обработка невозможна.');
    return { storesProcessed: 0, totalProcessed: 0, totalMatched: 0, totalSkipped: 0 };
  }
  
  log(`✅ Загружено шаблонов: ${templates.length}`);
  
  let totalProcessed = 0;
  let totalMatched = 0;
  let totalSkipped = 0;
  let storesProcessed = 0;
  
  // Обрабатываем каждый магазин
  for (const store of ozonStores) {
    const elapsedTime = Date.now() - startTime;
    const remainingTime = maxExecutionTime - elapsedTime;
    
    if (remainingTime < 20000) {
      log(`⏱️ ОСТАНОВКА: осталось ${Math.round(remainingTime/1000)} сек`);
      log(`📊 Обработано магазинов: ${storesProcessed}/${ozonStores.length}`);
      break;
    }
    
    log('-'.repeat(70));
    log(`🏪 Обрабатываю магазин: ${store.name} (${storesProcessed + 1}/${ozonStores.length})`);
    log(`⏱️ Времени осталось: ${Math.round(remainingTime/1000)} сек`);
    
    const storeStartTime = Date.now();
    const result = processNewOzonReviewsForStore(store, templates);
    const storeDuration = Date.now() - storeStartTime;
    
    totalProcessed += result.processed;
    totalMatched += result.matched;
    totalSkipped += result.skipped;
    storesProcessed++;
    
    log(`✅ Магазин обработан за ${Math.round(storeDuration/1000)} сек`);
    log(`   Обработано: ${result.processed}, подобрано: ${result.matched}, пропущено: ${result.skipped}`);
  }
  
  return { storesProcessed, totalProcessed, totalMatched, totalSkipped };
}

/**
 * 🔄 Обработка NEW отзывов для одного магазина
 */
function processNewOzonReviewsForStore(store, templates) {
  const sheetName = `Отзывы (${store.name})`;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    log(`⚠️ Лист "${sheetName}" не найден. Пропускаю магазин.`);
    return { processed: 0, matched: 0, skipped: 0 };
  }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  // Находим индексы колонок
  const colIdx = {};
  CONFIG.HEADERS.forEach((header, idx) => {
    colIdx[header] = idx;
  });
  
  const statusCol = colIdx['Статус'] + 1;
  const answerCol = colIdx['Подобранный ответ'] + 1;
  
  let processed = 0;
  let matched = 0;
  let skipped = 0;
  
  // Обрабатываем NEW отзывы
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const status = row[colIdx['Статус']];
    
    if (status !== CONFIG.STATUS.NEW) continue;
    
    processed++;
    
    const reviewId = row[colIdx['ID отзыва']];
    const rating = row[colIdx['Рейтинг']];
    
    log(`   📝 NEW отзыв ID: ${reviewId} (рейтинг: ${rating})`);
    
    // Проверяем рейтинг
    if (!CONFIG.RESPOND_TO_RATINGS.includes(rating)) {
      log(`      ⚠️ Рейтинг ${rating} не подходит для ответа`);
      skipped++;
      continue;
    }
    
    // Подбираем шаблон
    const template = selectRandomTemplate(templates, rating);
    
    if (!template) {
      log(`      ❌ Нет шаблона для рейтинга ${rating}`);
      const rowNumber = i + 1;
      sheet.getRange(rowNumber, statusCol).setValue(CONFIG.STATUS.NO_TEMPLATE);
      skipped++;
      continue;
    }
    
    // Записываем шаблон и меняем статус
    const rowNumber = i + 1;
    sheet.getRange(rowNumber, answerCol).setValue(template);
    sheet.getRange(rowNumber, statusCol).setValue(CONFIG.STATUS.PENDING);
    
    log(`      ✅ Подобран шаблон, статус: NEW → PENDING`);
    matched++;
    
    Utilities.sleep(100);
  }
  
  return { processed, matched, skipped };
}

/**
 * 📤 Отправка PENDING ответов (только Ozon)
 */
function sendPendingAnswersOzonOnly() {
  log('--- 📤 ОТПРАВКА PENDING ОТВЕТОВ (ТОЛЬКО OZON) ---');
  
  const allStores = getStores();
  const ozonStores = allStores.filter(s => s.isActive && s.marketplace === 'Ozon');
  
  if (ozonStores.length === 0) {
    log('⚠️ Нет активных магазинов Ozon.');
    return { totalSent: 0, totalSuccess: 0 };
  }
  
  log(`📊 Найдено магазинов Ozon: ${ozonStores.length}`);
  
  let totalSent = 0;
  let totalSuccess = 0;
  const maxExecutionTime = 60 * 1000;
  const startTime = Date.now();
  
  for (const store of ozonStores) {
    const elapsedTime = Date.now() - startTime;
    const remainingTime = maxExecutionTime - elapsedTime;
    
    if (remainingTime < 10000) {
      log(`⏱️ ОСТАНОВКА отправки: осталось ${Math.round(remainingTime/1000)} сек`);
      break;
    }
    
    log(`--- 📤 Обрабатываю магазин: ${store.name} ---`);
    const storeResult = sendPendingAnswersForStoreInternal(store);
    
    totalSent += storeResult.sentCount;
    totalSuccess += storeResult.successCount;
    
    log(`--- ✅ Завершено для ${store.name}: ${storeResult.successCount}/${storeResult.sentCount} ---`);
    
    if (storeResult.sentCount > 0) {
      Utilities.sleep(1000);
    }
  }
  
  log(`--- 📊 ОТПРАВКА ЗАВЕРШЕНА: успешно ${totalSuccess}/${totalSent} ---`);
  
  return { totalSent, totalSuccess };
}

/**
 * 📤 Внутренняя функция отправки для одного магазина
 */
function sendPendingAnswersForStoreInternal(store) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(`Отзывы (${store.name})`);
  if (!sheet) {
    log(`[${store.name}] ⚠️ Лист не найден`);
    return { sentCount: 0, successCount: 0 };
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const statusCol = headers.indexOf('Статус') + 1;
  const answerCol = headers.indexOf('Подобранный ответ') + 1;
  const idCol = headers.indexOf('ID отзыва') + 1;
  const errorCol = headers.indexOf('Детали ошибки') + 1;
  const timeCol = headers.indexOf('Время отправки') + 1;

  if (statusCol === 0) {
    log(`[${store.name}] ❌ Не найден столбец "Статус"`);
    return { sentCount: 0, successCount: 0 };
  }

  // Собираем PENDING ответы
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
    log(`[${store.name}] 📭 Нет ответов для отправки`);
    return { sentCount: 0, successCount: 0 };
  }

  log(`[${store.name}] 🚀 Найдено ${pendingAnswers.length} ответов для отправки`);

  let successCount = 0;

  pendingAnswers.forEach((answer, index) => {
    log(`[${store.name}] 📤 ${index + 1}/${pendingAnswers.length}: ID ${answer.feedbackId}`);
    
    const result = sendAnswer(store, answer.feedbackId, answer.answerText);
    
    sheet.getRange(answer.rowIndex, statusCol).setValue(result.status);
    sheet.getRange(answer.rowIndex, errorCol).setValue(result.error);
    sheet.getRange(answer.rowIndex, timeCol).setValue(result.timestamp);
    
    if (result.status === CONFIG.STATUS.SENT) {
      successCount++;
      log(`[${store.name}] ✅ Успешно отправлен ID ${answer.feedbackId}`);
    } else {
      log(`[${store.name}] ❌ Ошибка ID ${answer.feedbackId}: ${result.error}`);
    }
    
    // Rate limiting для Ozon
    Utilities.sleep(OZON_CONFIG.RATE_LIMITS.DELAY_BETWEEN_REQUESTS);
  });

  return { sentCount: pendingAnswers.length, successCount };
}

/**
 * ============================================================================
 * УПРАВЛЕНИЕ ТРИГГЕРАМИ
 * ============================================================================
 */

/**
 * ✅ Создать часовой триггер для Ozon workflow
 * Использует .everyHours(1) - официально поддерживается Google Apps Script
 */
function createOzonTemplateMatchingTrigger() {
  deleteOzonTemplateMatchingTrigger();
  
  // Создаем триггер через everyHours(1)
  ScriptApp.newTrigger('processOzonWorkflow')
    .timeBased()
    .everyHours(1)
    .create();
  
  log('✅ Триггер Ozon workflow создан (каждый час)');
  SpreadsheetApp.getUi().alert(
    '✅ Триггер создан',
    'Автоматический Ozon workflow (подбор шаблонов + отправка) будет запускаться каждый час.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/**
 * ❌ Удалить триггер Ozon workflow
 */
function deleteOzonTemplateMatchingTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  let deletedCount = 0;
  
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'processOzonWorkflow') {
      ScriptApp.deleteTrigger(trigger);
      deletedCount++;
    }
  });
  
  if (deletedCount > 0) {
    log(`🗑️ Удалено триггеров Ozon workflow: ${deletedCount}`);
    SpreadsheetApp.getUi().alert(
      '✅ Триггер удален',
      `Удалено триггеров: ${deletedCount}`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } else {
    log('ℹ️ Триггеров Ozon workflow не найдено');
    SpreadsheetApp.getUi().alert(
      'ℹ️ Триггер не найден',
      'Триггеры Ozon workflow не найдены.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}

/**
 * ℹ️ Проверить статус триггера
 */
function checkOzonTemplateMatchingTriggerStatus() {
  const triggers = ScriptApp.getProjectTriggers();
  const matchingTriggers = triggers.filter(t => t.getHandlerFunction() === 'processOzonWorkflow');
  
  if (matchingTriggers.length === 0) {
    SpreadsheetApp.getUi().alert(
      'ℹ️ Триггер НЕ активен',
      'Триггер Ozon workflow НЕ активен.\n\nИспользуйте меню для создания триггера.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } else {
    const trigger = matchingTriggers[0];
    const info = `Функция: ${trigger.getHandlerFunction()}\n` +
                 `Тип: ${trigger.getEventType()}\n` +
                 `Найдено триггеров: ${matchingTriggers.length}`;
    
    SpreadsheetApp.getUi().alert(
      '✅ Триггер АКТИВЕН',
      `Триггер Ozon workflow АКТИВЕН.\n\n${info}`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}
