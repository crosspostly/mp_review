/**
 * @file trigger_system.gs
 * @description Система управления триггерами для MP Review Manager
 * @version 2.0
 * @date 2025-10-26
 * 
 * АРХИТЕКТУРА:
 * - 3-триггерная система (collect → prepare → send)
 * - Централизованное управление триггерами
 * - Автоматическая синхронизация с активными магазинами
 * - Система мониторинга и диагностики
 */

/**
 * Настраивает полную систему триггеров для всех активных магазинов
 * @param {number} intervalMinutes - Интервал между запусками триггеров в минутах
 * @returns {Object} Результат настройки триггеров
 */
function setupCompleteTriggersSystem(intervalMinutes = TRIGGER_CONFIG.INTERVAL_MINUTES) {
  var timer = new PerformanceTimer('setupCompleteTriggersSystem');
  
  try {
    logInfo('Настройка полной системы триггеров', LOG_CONFIG.CATEGORIES.TRIGGER);
    
    // Получаем активные магазины
    var activeStores = getActiveStores();
    if (activeStores.length === 0) {
      logWarning('Нет активных магазинов для настройки триггеров', LOG_CONFIG.CATEGORIES.TRIGGER);
      return {
        success: false,
        error: 'Нет активных магазинов',
        triggersCreated: 0
      };
    }
    
    logInfo('Найдено ' + activeStores.length + ' активных магазинов', LOG_CONFIG.CATEGORIES.TRIGGER);
    
    // Удаляем все существующие триггеры
    var deletedCount = deleteAllSystemTriggers();
    logInfo('Удалено старых триггеров: ' + deletedCount, LOG_CONFIG.CATEGORIES.TRIGGER);
    
    // Создаем новые триггеры
    var results = {
      collectTrigger: null,
      prepareTrigger: null, 
      sendTrigger: null
    };
    
    // ТРИГГЕР 1: Сбор отзывов (каждые N минут)
    results.collectTrigger = createTrigger(
      'hourlyReviewCollector',
      intervalMinutes,
      'Сбор отзывов со всех активных магазинов'
    );
    
    // ТРИГГЕР 2: Подготовка ответов (каждые N минут + смещение)
    results.prepareTrigger = createTrigger(
      'selectReviewAnswers',
      intervalMinutes,
      'Подбор ответов для новых отзывов'
    );
    
    // ТРИГГЕР 3: Отправка ответов (каждые N минут + смещение)
    results.sendTrigger = createTrigger(
      'sendReviewAnswers',
      intervalMinutes,
      'Отправка подготовленных ответов'
    );
    
    // Сохраняем информацию о триггерах
    saveTriggerSystemInfo({
      intervalMinutes: intervalMinutes,
      activeStores: activeStores.length,
      triggers: results,
      setupDate: new Date(),
      version: '2.0'
    });
    
    var successCount = Object.values(results).filter(function(t) { return t?.success; }).length;
    
    logSuccess('Система триггеров настроена: ' + successCount + '/3 триггеров созданы', LOG_CONFIG.CATEGORIES.TRIGGER);
    timer.finish(LOG_CONFIG.LEVELS.SUCCESS);
    
    return {
      success: successCount === 3,
      triggersCreated: successCount,
      results: results,
      activeStores: activeStores.length,
      intervalMinutes: intervalMinutes
    };
    
  } catch (error) {
    logError('Ошибка настройки системы триггеров: ' + error.message, LOG_CONFIG.CATEGORIES.TRIGGER);
    timer.finish(LOG_CONFIG.LEVELS.ERROR);
    
    return {
      success: false,
      error: error.message,
      triggersCreated: 0
    };
  }
}

/**
 * ТРИГГЕР 1: Сбор отзывов со всех активных магазинов
 */
function hourlyReviewCollector() {
  var timer = new PerformanceTimer('hourlyReviewCollector');
  
  try {
    logTrigger('COLLECT', 'Запуск сбора отзывов', LOG_CONFIG.LEVELS.INFO);
    
    var activeStores = getActiveStores();
    if (activeStores.length === 0) {
      logTrigger('COLLECT', 'Нет активных магазинов для обработки', LOG_CONFIG.LEVELS.WARNING);
      timer.finish(LOG_CONFIG.LEVELS.WARNING);
      return;
    }
    
    var results = {
      totalStores: activeStores.length,
      processedStores: 0,
      totalReviews: 0,
      newReviews: 0,
      errors: []
    };
    
    var maxExecutionTime = TRIGGER_CONFIG.MAX_EXECUTION_TIME;
    var startTime = Date.now();
    
    // Обрабатываем магазины последовательно
    for (var __i = 0; __i < activeStores.length; __i++) {
      var store = activeStores[__i];
      var elapsedTime = Date.now() - startTime;
      if (elapsedTime > maxExecutionTime) {
        logTrigger('COLLECT', 'Превышено время выполнения, остановка на магазине ' + store.name, LOG_CONFIG.LEVELS.WARNING);
        break;
      }
      
      try {
        logTrigger('COLLECT', 'Обработка магазина: ' + store.name + ' (' + store.marketplace + ')', LOG_CONFIG.LEVELS.INFO);
        
        var storeResults = collectReviewsForStore(store);
        
        results.processedStores++;
        results.totalReviews += storeResults.totalReviews;
        results.newReviews += storeResults.newReviews;
        
        logTrigger('COLLECT', store.name + ': ' + storeResults.newReviews + '/' + storeResults.totalReviews + ' новых отзывов', LOG_CONFIG.LEVELS.SUCCESS);
        
      } catch (error) {
        var errorMsg = 'Ошибка обработки ' + store.name + ': ' + error.message;
        results.errors.push(errorMsg);
        logTrigger('COLLECT', errorMsg, LOG_CONFIG.LEVELS.ERROR);
      }
      
      // Rate limiting между магазинами
      Utilities.sleep(500);
    }
    
    var totalTime = Date.now() - startTime;
    logTrigger('COLLECT', 'Завершено за ' + Math.round(totalTime/1000) + 'с: ' + results.processedStores + ' магазинов, ' + results.newReviews + ' новых отзывов', LOG_CONFIG.LEVELS.SUCCESS);
    
    timer.finish(LOG_CONFIG.LEVELS.SUCCESS);
    return results;
    
  } catch (error) {
    logTrigger('COLLECT', 'Критическая ошибка: ' + error.message, LOG_CONFIG.LEVELS.ERROR);
    timer.finish(LOG_CONFIG.LEVELS.ERROR);
    throw error;
  }
}

/**
 * ТРИГГЕР 2: Подготовка ответов для новых отзывов
 */
function selectReviewAnswers() {
  var timer = new PerformanceTimer('selectReviewAnswers');
  
  try {
    logTrigger('PREPARE', 'Запуск подготовки ответов', LOG_CONFIG.LEVELS.INFO);
    
    var activeStores = getActiveStores();
    if (activeStores.length === 0) {
      logTrigger('PREPARE', 'Нет активных магазинов для обработки', LOG_CONFIG.LEVELS.WARNING);
      timer.finish(LOG_CONFIG.LEVELS.WARNING);
      return;
    }
    
    var results = {
      totalStores: activeStores.length,
      processedStores: 0,
      totalReviews: 0,
      preparedAnswers: 0,
      errors: []
    };
    
    var maxExecutionTime = TRIGGER_CONFIG.MAX_EXECUTION_TIME;
    var startTime = Date.now();
    
    // Обрабатываем магазины
    for (var __i = 0; __i < activeStores.length; __i++) {
      var store = activeStores[__i];
      var elapsedTime = Date.now() - startTime;
      if (elapsedTime > maxExecutionTime) {
        logTrigger('PREPARE', 'Превышено время выполнения, остановка на магазине ' + store.name, LOG_CONFIG.LEVELS.WARNING);
        break;
      }
      
      try {
        logTrigger('PREPARE', 'Подготовка ответов для: ' + store.name, LOG_CONFIG.LEVELS.INFO);
        
        var storeResults = prepareAnswersForStore(store);
        
        results.processedStores++;
        results.totalReviews += storeResults.totalReviews;
        results.preparedAnswers += storeResults.preparedAnswers;
        
        logTrigger('PREPARE', store.name + ': ' + storeResults.preparedAnswers + '/' + storeResults.totalReviews + ' ответов подготовлено', LOG_CONFIG.LEVELS.SUCCESS);
        
      } catch (error) {
        var errorMsg = 'Ошибка подготовки для ' + store.name + ': ' + error.message;
        results.errors.push(errorMsg);
        logTrigger('PREPARE', errorMsg, LOG_CONFIG.LEVELS.ERROR);
      }
      
      // Rate limiting между магазинами
      Utilities.sleep(300);
    }
    
    var totalTime = Date.now() - startTime;
    logTrigger('PREPARE', 'Завершено за ' + Math.round(totalTime/1000) + 'с: ' + results.processedStores + ' магазинов, ' + results.preparedAnswers + ' ответов готовы', LOG_CONFIG.LEVELS.SUCCESS);
    
    timer.finish(LOG_CONFIG.LEVELS.SUCCESS);
    return results;
    
  } catch (error) {
    logTrigger('PREPARE', 'Критическая ошибка: ' + error.message, LOG_CONFIG.LEVELS.ERROR);
    timer.finish(LOG_CONFIG.LEVELS.ERROR);
    throw error;
  }
}

/**
 * ТРИГГЕР 3: Отправка подготовленных ответов
 */
function sendReviewAnswers() {
  var timer = new PerformanceTimer('sendReviewAnswers');
  
  try {
    logTrigger('SEND', 'Запуск отправки ответов', LOG_CONFIG.LEVELS.INFO);
    
    var activeStores = getActiveStores();
    if (activeStores.length === 0) {
      logTrigger('SEND', 'Нет активных магазинов для обработки', LOG_CONFIG.LEVELS.WARNING);
      timer.finish(LOG_CONFIG.LEVELS.WARNING);
      return;
    }
    
    var results = {
      totalStores: activeStores.length,
      processedStores: 0,
      totalPending: 0,
      sentAnswers: 0,
      errors: []
    };
    
    var maxExecutionTime = TRIGGER_CONFIG.MAX_EXECUTION_TIME;
    var startTime = Date.now();
    
    // Обрабатываем магазины
    for (var __i = 0; __i < activeStores.length; __i++) {
      var store = activeStores[__i];
      var elapsedTime = Date.now() - startTime;
      if (elapsedTime > maxExecutionTime) {
        logTrigger('SEND', 'Превышено время выполнения, остановка на магазине ' + store.name, LOG_CONFIG.LEVELS.WARNING);
        break;
      }
      
      try {
        logTrigger('SEND', 'Отправка ответов для: ' + store.name, LOG_CONFIG.LEVELS.INFO);
        
        var storeResults = sendAnswersForStore(store);
        
        results.processedStores++;
        results.totalPending += storeResults.totalPending;
        results.sentAnswers += storeResults.sentAnswers;
        
        logTrigger('SEND', store.name + ': ' + storeResults.sentAnswers + '/' + storeResults.totalPending + ' ответов отправлено', LOG_CONFIG.LEVELS.SUCCESS);
        
      } catch (error) {
        var errorMsg = 'Ошибка отправки для ' + store.name + ': ' + error.message;
        results.errors.push(errorMsg);
        logTrigger('SEND', errorMsg, LOG_CONFIG.LEVELS.ERROR);
      }
      
      // Rate limiting между магазинами и запросами
      var delay = getApiDelay(store.marketplace);
      Utilities.sleep(delay);
    }
    
    var totalTime = Date.now() - startTime;
    logTrigger('SEND', 'Завершено за ' + Math.round(totalTime/1000) + 'с: ' + results.processedStores + ' магазинов, ' + results.sentAnswers + ' ответов отправлено', LOG_CONFIG.LEVELS.SUCCESS);
    
    timer.finish(LOG_CONFIG.LEVELS.SUCCESS);
    return results;
    
  } catch (error) {
    logTrigger('SEND', 'Критическая ошибка: ' + error.message, LOG_CONFIG.LEVELS.ERROR);
    timer.finish(LOG_CONFIG.LEVELS.ERROR);
    throw error;
  }
}

// ============ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ ТРИГГЕРОВ ============

/**
 * Собирает отзывы для одного магазина
 */
function collectReviewsForStore(store) {
  try {
    var newReviews = [];
    
    if (store.marketplace === 'Wildberries') {
      newReviews = getWbFeedbacks(store, false);
    } else if (store.marketplace === 'Ozon') {
      newReviews = getOzonFeedbacks(store, false);
    } else {
      throw new Error('Неподдерживаемый маркетплейс: ' + store.marketplace);
    }
    
    // Фильтруем новые отзывы через кеш
    var filteredReviews = filterNewReviewsForStore(store.id, newReviews);
    
    // Сохраняем новые отзывы в Google Sheets
    if (filteredReviews.length > 0) {
      saveReviewsToSheet(store, filteredReviews);
      
      // Обновляем кеш
      var reviewIds = filteredReviews.map(function(r) { return r.id; });
      addToReviewIdsCacheForStore(store.id, reviewIds);
    }
    
    return {
      totalReviews: newReviews.length,
      newReviews: filteredReviews.length
    };
    
  } catch (error) {
    logError('Ошибка сбора отзывов для магазина ' + store.id + ': ' + error.message, LOG_CONFIG.CATEGORIES.TRIGGER);
    throw error;
  }
}

/**
 * Подготавливает ответы для магазина
 */
function prepareAnswersForStore(store) {
  try {
    // Получаем отзывы со статусом NEW из Google Sheets
    var newReviews = getReviewsFromSheetByStatus(store, CONFIG.STATUS.NEW);
    
    var preparedCount = 0;
    
    for (var __i = 0; __i < newReviews.length; __i++) {
      var review = newReviews[__i];
      try {
        // Подбираем шаблон ответа
        var answerTemplate = selectAnswerTemplate(review, store);
        
        if (answerTemplate) {
          // Обновляем статус и добавляем ответ
          updateReviewInSheet(store, review.id, {
            answer: answerTemplate,
            status: CONFIG.STATUS.PENDING
          });
          
          preparedCount++;
        } else {
          // Помечаем как ошибку если не удалось подобрать шаблон
          updateReviewInSheet(store, review.id, {
            status: CONFIG.STATUS.ERROR,
            error: 'Не удалось подобрать подходящий шаблон ответа'
          });
        }
        
      } catch (error) {
        logWarning('Ошибка подготовки ответа для отзыва ' + review.id + ': ' + error.message, LOG_CONFIG.CATEGORIES.TRIGGER);
        
        updateReviewInSheet(store, review.id, {
          status: CONFIG.STATUS.ERROR,
          error: error.message
        });
      }
    }
    
    return {
      totalReviews: newReviews.length,
      preparedAnswers: preparedCount
    };
    
  } catch (error) {
    logError('Ошибка подготовки ответов для магазина ' + store.id + ': ' + error.message, LOG_CONFIG.CATEGORIES.TRIGGER);
    throw error;
  }
}

/**
 * Отправляет ответы для магазина
 */
function sendAnswersForStore(store) {
  try {
    // Получаем отзывы готовые к отправке
    var pendingReviews = getReviewsFromSheetByStatus(store, CONFIG.STATUS.PENDING);
    
    // Ограничиваем количество для контроля времени выполнения
    var batchSize = getBatchSize('send');
    var reviewsToSend = pendingReviews.slice(0, batchSize);
    
    var sentCount = 0;
    
    for (var __i = 0; __i < reviewsToSend.length; __i++) {
      var review = reviewsToSend[__i];
      try {
        var sendResult = null;
        
        if (store.marketplace === 'Wildberries') {
          sendResult = sendWbFeedbackAnswer(review.id, review.answer, store);
        } else if (store.marketplace === 'Ozon') {
          sendResult = sendOzonFeedbackAnswer(review.id, review.answer, store);
        } else {
          throw new Error('Неподдерживаемый маркетплейс: ' + store.marketplace);
        }
        
        if (sendResult.success) {
          updateReviewInSheet(store, review.id, {
            status: CONFIG.STATUS.SENT,
            sentDate: new Date()
          });
          sentCount++;
        } else {
          updateReviewInSheet(store, review.id, {
            status: CONFIG.STATUS.ERROR,
            error: sendResult.error
          });
        }
        
        // Rate limiting между отправками
        var delay = getApiDelay(store.marketplace);
        Utilities.sleep(delay);
        
      } catch (error) {
        logWarning('Ошибка отправки ответа для отзыва ' + review.id + ': ' + error.message, LOG_CONFIG.CATEGORIES.TRIGGER);
        
        updateReviewInSheet(store, review.id, {
          status: CONFIG.STATUS.ERROR,
          error: error.message
        });
      }
    }
    
    return {
      totalPending: pendingReviews.length,
      sentAnswers: sentCount
    };
    
  } catch (error) {
    logError('Ошибка отправки ответов для магазина ' + store.id + ': ' + error.message, LOG_CONFIG.CATEGORIES.TRIGGER);
    throw error;
  }
}

// ============ УПРАВЛЕНИЕ ТРИГГЕРАМИ ============

/**
 * Создает один триггер
 */
function createTrigger(functionName, intervalMinutes, description = '') {
  try {
    var trigger = ScriptApp.newTrigger(functionName)
      .timeBased()
      .everyMinutes(intervalMinutes)
      .create();
    
    logTrigger('CREATE', 'Создан триггер: ' + functionName + ' (каждые ' + intervalMinutes + ' мин)', LOG_CONFIG.LEVELS.SUCCESS);
    
    return {
      success: true,
      triggerId: trigger.getUniqueId(),
      functionName: functionName,
      intervalMinutes: intervalMinutes,
      description: description
    };
    
  } catch (error) {
    logTrigger('CREATE', 'Ошибка создания триггера ' + functionName + ': ' + error.message, LOG_CONFIG.LEVELS.ERROR);
    
    return {
      success: false,
      error: error.message,
      functionName: functionName
    };
  }
}

/**
 * Удаляет все системные триггеры
 */
function deleteAllSystemTriggers() {
  try {
    var allTriggers = ScriptApp.getProjectTriggers();
    var systemFunctions = ['hourlyReviewCollector', 'selectReviewAnswers', 'sendReviewAnswers', 'processAllStores'];
    
    var deletedCount = 0;
    
    for (var i = 0; i < allTriggers.length; i++) {
      var trigger = allTriggers[i];
      var functionName = trigger.getHandlerFunction();
      if (systemFunctions.includes(functionName)) {
        ScriptApp.deleteTrigger(trigger);
        deletedCount++;
        logTrigger('DELETE', 'Удален триггер: ' + functionName, LOG_CONFIG.LEVELS.INFO);
      }
    });
    
    return deletedCount;
    
  } catch (error) {
    logTrigger('DELETE', 'Ошибка удаления триггеров: ' + error.message, LOG_CONFIG.LEVELS.ERROR);
    return 0;
  }
}

/**
 * Получает информацию о всех активных триггерах системы
 */
function getSystemTriggersInfo() {
  try {
    var allTriggers = ScriptApp.getProjectTriggers();
    var systemFunctions = ['hourlyReviewCollector', 'selectReviewAnswers', 'sendReviewAnswers'];
    
    var systemTriggers = allTriggers
      .filter(function(trigger) { return systemFunctions.includes(trigger.getHandlerFunction()); })
      .map(function(trigger) { return {
        id: trigger.getUniqueId(),
        functionName: trigger.getHandlerFunction(),
        triggerType: trigger.getTriggerSource().toString(),
        isTimeBased: trigger.getTriggerSource() === ScriptApp.TriggerSource.CLOCK
      }; });
    
    return {
      total: systemTriggers.length,
      expected: systemFunctions.length,
      isComplete: systemTriggers.length === systemFunctions.length,
      triggers: systemTriggers
    };
    
  } catch (error) {
    logError('Ошибка получения информации о триггерах: ' + error.message, LOG_CONFIG.CATEGORIES.TRIGGER);
    return {
      total: 0,
      expected: 3,
      isComplete: false,
      error: error.message
    };
  }
}

/**
 * Сохраняет информацию о системе триггеров
 */
function saveTriggerSystemInfo(info) {
  try {
    var props = PropertiesService.getScriptProperties();
    props.setProperty('TRIGGER_SYSTEM_INFO', JSON.stringify(info));
    
    logTrigger('SYSTEM', 'Информация о системе триггеров сохранена', LOG_CONFIG.LEVELS.SUCCESS);
    
  } catch (error) {
    logError('Ошибка сохранения информации о триггерах: ' + error.message, LOG_CONFIG.CATEGORIES.TRIGGER);
  }
}

/**
 * Получает сохраненную информацию о системе триггеров
 */
function getTriggerSystemInfo() {
  try {
    var props = PropertiesService.getScriptProperties();
    var info = props.getProperty('TRIGGER_SYSTEM_INFO');
    
    return info ? JSON.parse(info) : null;
    
  } catch (error) {
    logError('Ошибка получения информации о системе триггеров: ' + error.message, LOG_CONFIG.CATEGORIES.TRIGGER);
    return null;
  }
}

// ============ ФУНКЦИИ ИНТЕГРАЦИИ С GOOGLE SHEETS ============

/**
 * Сохраняет отзывы в лист магазина
 */
function saveReviewsToSheet(store, reviews) {
  try {
    if (!reviews || reviews.length === 0) return;
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(store.id);
    
    // Создаем лист если не существует
    if (!sheet) {
      createStoreSheetIfNotExists(store);
      sheet = ss.getSheetByName(store.id);
    }
    
    // Подготавливаем данные для вставки
    var rows = reviews.map(function(review) { return [
      review.id,
      review.createdDate,
      review.rating,
      review.text,
      JSON.stringify(review.product),
      CONFIG.STATUS.NEW,
      new Date(), // processedDate
      '', // answer (пока пустой)
      '' // errorMsg
    ]);
    
    // Добавляем строки
    var startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, rows.length, 9).setValues(rows);
    
    logStore(store.id, 'Сохранено ' + reviews.length + ' отзывов в лист', LOG_CONFIG.LEVELS.SUCCESS);
    
  } catch (error) {
    logError('Ошибка сохранения отзывов в лист ' + store.id + ': ' + error.message, LOG_CONFIG.CATEGORIES.STORE);
    throw error;
  }
}

/**
 * Получает отзывы из листа по статусу
 */
function getReviewsFromSheetByStatus(store, status) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(store.id);
    
    if (!sheet) {
      return [];
    }
    
    var data = sheet.getDataRange().getValues();
    var reviews = [];
    
    // Пропускаем заголовок (первая строка)
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      
      if (row[5] === status) { // Колонка status
        reviews.push({
          id: row[0],
          createdDate: row[1],
          rating: row[2],
          text: row[3],
          product: typeof row[4] === 'string' ? JSON.parse(row[4]) : row[4],
          status: row[5],
          processedDate: row[6],
          answer: row[7],
          error: row[8]
        });
      }
    }
    
    return reviews;
    
  } catch (error) {
    logError('Ошибка получения отзывов из листа ' + store.id + ': ' + error.message, LOG_CONFIG.CATEGORIES.STORE);
    return [];
  }
}

/**
 * Обновляет отзыв в листе
 */
function updateReviewInSheet(store, reviewId, updates) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(store.id);
    
    if (!sheet) {
      throw new Error('Лист ' + store.id + ' не найден');
    }
    
    var data = sheet.getDataRange().getValues();
    
    // Ищем строку с нужным reviewId
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === reviewId) { // Колонка ID
        
        // Обновляем нужные поля
        if (updates.answer !== undefined) sheet.getRange(i + 1, 8).setValue(updates.answer);
        if (updates.status !== undefined) sheet.getRange(i + 1, 6).setValue(updates.status);
        if (updates.error !== undefined) sheet.getRange(i + 1, 9).setValue(updates.error);
        if (updates.sentDate !== undefined) sheet.getRange(i + 1, 7).setValue(updates.sentDate);
        
        logDebug('Обновлен отзыв ' + reviewId + ' в листе ' + store.id, LOG_CONFIG.CATEGORIES.STORE);
        return true;
      }
    }
    
    logWarning('Отзыв ' + reviewId + ' не найден в листе ' + store.id, LOG_CONFIG.CATEGORIES.STORE);
    return false;
    
  } catch (error) {
    logError('Ошибка обновления отзыва ' + reviewId + ' в листе ' + store.id + ': ' + error.message, LOG_CONFIG.CATEGORIES.STORE);
    return false;
  }
}

/**
 * Подбирает шаблон ответа для отзыва
 */
function selectAnswerTemplate(review, store) {
  try {
    // Базовые шаблоны по рейтингу
    var template = '';
    
    switch (review.rating) {
      case 5:
        template = TEMPLATE_CONFIG.DEFAULT_TEMPLATES.RATING_5;
        break;
      case 4:
        template = TEMPLATE_CONFIG.DEFAULT_TEMPLATES.RATING_4;
        break;
      case 3:
        template = TEMPLATE_CONFIG.DEFAULT_TEMPLATES.RATING_3;
        break;
      case 2:
        template = TEMPLATE_CONFIG.DEFAULT_TEMPLATES.RATING_2;
        break;
      case 1:
        template = TEMPLATE_CONFIG.DEFAULT_TEMPLATES.RATING_1;
        break;
      default:
        template = TEMPLATE_CONFIG.DEFAULT_TEMPLATES.RATING_4; // По умолчанию
    }
    
    // Можно добавить персонализацию на основе текста отзыва
    if (TEMPLATE_CONFIG.PERSONALIZATION.USE_PRODUCT_NAME && review.product?.name) {
      template = template.replace(/товар/g, review.product.name);
    }
    
    return template;
    
  } catch (error) {
    logError('Ошибка подбора шаблона для отзыва ' + review.id + ': ' + error.message, LOG_CONFIG.CATEGORIES.TRIGGER);
    return null;
  }
}

// ============ БЫСТРЫЕ ФУНКЦИИ ДЛЯ НАСТРОЙКИ ============

/**
 * Быстрая настройка с интервалом 30 минут
 */
function setupTriggers30Min() {
  return setupCompleteTriggersSystem(30);
}

/**
 * Быстрая настройка с интервалом 60 минут
 */
function setupTriggers60Min() {
  return setupCompleteTriggersSystem(60);
}

/**
 * Быстрая настройка с интервалом 5 минут (для тестирования)
 */
function setupTriggers5Min() {
  return setupCompleteTriggersSystem(5);
}

}
