/**
 * @file logger.gs
 * @description Модульная система логирования для MP Review Manager
 * @version 2.0
 * @date 2025-10-26
 * 
 * АРХИТЕКТУРА:
 * - Централизованное логирование всей системы
 * - Разные уровни и категории логов
 * - Автоматическая ротация логов
 * - Поддержка консоли и Google Sheets
 */

/**
 * Главная функция логирования
 * @param {string} message - Сообщение для лога
 * @param {string} level - Уровень лога (DEBUG, INFO, WARNING, ERROR, SUCCESS)
 * @param {string} category - Категория лога (SYSTEM, WB-API, OZON-API, etc.)
 * @param {Object} metadata - Дополнительные данные для лога
 */
function log(message, level = LOG_CONFIG.LEVELS.INFO, category = LOG_CONFIG.CATEGORIES.SYSTEM, metadata = null) {
  try {
    // Проверяем входные параметры
    if (!message || typeof message !== 'string') {
      console.error('Logger: Некорректное сообщение для лога');
      return;
    }
    
    // Форматируем сообщение
    var formattedMessage = formatLogMessage(message, level, category, metadata);
    
    // Выводим в консоль (всегда)
    logToConsole(formattedMessage, level);
    
    // Сохраняем в Google Sheets (с обработкой ошибок)
    try {
      logToSheet(formattedMessage, level, category);
    } catch (sheetError) {
      console.error('Logger: Ошибка записи в Sheets: ' + sheetError.message);
    }
    
  } catch (error) {
    console.error('Logger: Критическая ошибка: ' + error.message);
  }
}

/**
 * Быстрые функции логирования для разных уровней
 */
function logDebug(message, category = LOG_CONFIG.CATEGORIES.SYSTEM, metadata = null) {
  var envConfig = getEnvironmentConfig();
  if (envConfig.ENABLE_DETAILED_LOGGING) {
    log(message, LOG_CONFIG.LEVELS.DEBUG, category, metadata);
  }
}

function logInfo(message, category = LOG_CONFIG.CATEGORIES.SYSTEM, metadata = null) {
  log(message, LOG_CONFIG.LEVELS.INFO, category, metadata);
}

function logWarning(message, category = LOG_CONFIG.CATEGORIES.SYSTEM, metadata = null) {
  log(message, LOG_CONFIG.LEVELS.WARNING, category, metadata);
}

function logError(message, category = LOG_CONFIG.CATEGORIES.SYSTEM, metadata = null) {
  log(message, LOG_CONFIG.LEVELS.ERROR, category, metadata);
}

function logSuccess(message, category = LOG_CONFIG.CATEGORIES.SYSTEM, metadata = null) {
  log(message, LOG_CONFIG.LEVELS.SUCCESS, category, metadata);
}

/**
 * Специализированные функции логирования для API
 */
function logApiRequest(marketplace, endpoint, params = null) {
  var message = 'Запрос к ' + marketplace + ' API: ' + endpoint;
  var category = marketplace === 'Wildberries' ? LOG_CONFIG.CATEGORIES.WB_API : LOG_CONFIG.CATEGORIES.OZON_API;
  logDebug(message, category, { endpoint, params });
}

function logApiResponse(marketplace, endpoint, responseCode, responseTime = null) {
  var message = 'Ответ ' + marketplace + ' API: ' + endpoint + ' (HTTP ' + responseCode + ')';
  var category = marketplace === 'Wildberries' ? LOG_CONFIG.CATEGORIES.WB_API : LOG_CONFIG.CATEGORIES.OZON_API;
  var level = responseCode >= 200 && responseCode < 300 ? LOG_CONFIG.LEVELS.SUCCESS : LOG_CONFIG.LEVELS.ERROR;
  log(message, level, category, { endpoint, responseCode, responseTime });
}

function logApiError(marketplace, endpoint, error, statusCode = null) {
  var message = 'Ошибка ' + marketplace + ' API: ' + endpoint + ' - ' + error.message || error;
  var category = marketplace === 'Wildberries' ? LOG_CONFIG.CATEGORIES.WB_API : LOG_CONFIG.CATEGORIES.OZON_API;
  logError(message, category, { endpoint, error: error.message || error, statusCode });
}

/**
 * Функции логирования для разных компонентов системы
 */
function logTrigger(triggerName, message, level = LOG_CONFIG.LEVELS.INFO, metadata = null) {
  var formattedMessage = '[' + triggerName + '] ' + message;
  log(formattedMessage, level, LOG_CONFIG.CATEGORIES.TRIGGER, metadata);
}

function logCache(operation, storeId, message, level = LOG_CONFIG.LEVELS.INFO, metadata = null) {
  var formattedMessage = '[' + operation + '] ' + storeId + ': ' + message;
  log(formattedMessage, level, LOG_CONFIG.CATEGORIES.CACHE, metadata);
}

function logStore(storeId, message, level = LOG_CONFIG.LEVELS.INFO, metadata = null) {
  var formattedMessage = '[' + storeId + '] ' + message;
  log(formattedMessage, level, LOG_CONFIG.CATEGORIES.STORE, metadata);
}

/**
 * Форматирует сообщение лога
 */
function formatLogMessage(message, level, category, metadata) {
  var timestamp = Utilities.formatDate(new Date(), LOG_CONFIG.TIMEZONE, LOG_CONFIG.DATE_FORMAT);
  var emoji = getLogEmoji(level);
  
  var formattedMessage = '[' + timestamp + '] ' + emoji + ' [' + category + '] ' + message;
  
  if (metadata && Object.keys(metadata).length > 0) {
    formattedMessage += ' | ' + JSON.stringify(metadata);
  }
  
  return formattedMessage;
}

/**
 * Возвращает эмодзи для уровня лога
 */
function getLogEmoji(level) {
  switch (level) {
    case LOG_CONFIG.LEVELS.DEBUG: return '🔍';
    case LOG_CONFIG.LEVELS.INFO: return 'ℹ️';
    case LOG_CONFIG.LEVELS.WARNING: return '⚠️';
    case LOG_CONFIG.LEVELS.ERROR: return '❌';
    case LOG_CONFIG.LEVELS.SUCCESS: return '✅';
    default: return '📝';
  }
}

/**
 * Выводит лог в консоль Google Apps Script
 */
function logToConsole(message, level) {
  switch (level) {
    case LOG_CONFIG.LEVELS.ERROR:
      console.error(message);
      break;
    case LOG_CONFIG.LEVELS.WARNING:
      console.warn(message);
      break;
    case LOG_CONFIG.LEVELS.DEBUG:
      console.debug(message);
      break;
    default:
      console.log(message);
  }
}

/**
 * Сохраняет лог в Google Sheets
 */
function logToSheet(message, level, category) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var logSheet = ss.getSheetByName(CONFIG.SHEETS.LOGS);
    
    // Создаем лист логов если не существует
    if (!logSheet) {
      logSheet = ss.insertSheet(CONFIG.SHEETS.LOGS);
      initializeLogSheet(logSheet);
    }
    
    // Проверяем размер лога и очищаем если нужно
    var currentRows = logSheet.getLastRow();
    if (currentRows > LOG_CONFIG.MAX_LOG_ROWS) {
      cleanupOldLogs(logSheet);
    }
    
    // Добавляем новую запись
    var timestamp = new Date();
    logSheet.appendRow([timestamp, level, category, message]);
    
  } catch (error) {
    console.error('Ошибка записи в лист логов: ' + error.message);
  }
}

/**
 * Инициализирует лист логов заголовками
 */
function initializeLogSheet(sheet) {
  var headers = ['Время', 'Уровень', 'Категория', 'Сообщение'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // Форматирование заголовков
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#f0f0f0');
  
  // Автоширина колонок
  sheet.autoResizeColumns(1, headers.length);
}

/**
 * Очищает старые логи для экономии места
 */
function cleanupOldLogs(sheet) {
  try {
    var totalRows = sheet.getLastRow();
    var rowsToDelete = totalRows - LOG_CONFIG.CLEANUP_ROWS;
    
    if (rowsToDelete > 0) {
      // Удаляем старые строки (оставляем заголовок + CLEANUP_ROWS новых записей)
      sheet.deleteRows(2, rowsToDelete);
      console.log('Logger: Удалено ' + rowsToDelete + ' старых записей из лога');
    }
  } catch (error) {
    console.error('Ошибка очистки логов: ' + error.message);
  }
}

// ============ PERFORMANCE TIMER КЛАСС ============

/**
 * Класс для измерения времени выполнения операций
 */
class PerformanceTimer {
  constructor(operationName = 'operation') {
    this.operationName = operationName;
    this.startTime = Date.now();
    this.endTime = null;
    
    logDebug('Timer started: ' + operationName, LOG_CONFIG.CATEGORIES.SYSTEM);
  }
  
  /**
   * Завершает измерение времени
   */
  finish(logLevel = LOG_CONFIG.LEVELS.DEBUG) {
    this.endTime = Date.now();
    var duration = this.getTotalTime();
    
    var message = 'Timer finished: ' + this.operationName + ' (' + duration + 'ms)';
    log(message, logLevel, LOG_CONFIG.CATEGORIES.SYSTEM, { 
      operation: this.operationName, 
      duration: duration 
    });
  }
  
  /**
   * Получает общее время выполнения
   */
  getTotalTime() {
    var end = this.endTime || Date.now();
    return end - this.startTime;
  }
  
  /**
   * Получает промежуточное время
   */
  getElapsedTime() {
    return Date.now() - this.startTime;
  }
  
  /**
   * Проверяет не превышен ли таймаут
   */
  isTimeout(timeoutMs) {
    return this.getElapsedTime() > timeoutMs;
  }
}

/**
 * Получает последние записи логов
 * @param {number} count - Количество записей
 * @param {string} level - Фильтр по уровню (опционально)
 * @param {string} category - Фильтр по категории (опционально)
 * @returns {Array} Массив записей логов
 */
function getRecentLogs(count = 100, level = null, category = null) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var logSheet = ss.getSheetByName(CONFIG.SHEETS.LOGS);
    
    if (!logSheet) {
      return [];
    }
    
    var totalRows = logSheet.getLastRow();
    if (totalRows <= 1) {
      return []; // Только заголовки
    }
    
    // Получаем последние записи
    var startRow = Math.max(2, totalRows - count + 1);
    var numRows = totalRows - startRow + 1;
    var data = logSheet.getRange(startRow, 1, numRows, 4).getValues();
    
    // Фильтруем по уровню и категории если заданы
    var filteredData = data;
    if (level) {
      filteredData = filteredData.filter(function(row) { return row[1] === level; });
    }
    if (category) {
      filteredData = filteredData.filter(function(row) { return row[2] === category; });
    }
    
    return filteredData.reverse(); // Новые записи первыми
    
  } catch (error) {
    console.error('Ошибка получения логов: ' + error.message);
    return [];
  }
}

/**
 * Получает статистику логов
 * @returns {Object} Статистика по уровням и категориям
 */
function getLogStatistics() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var logSheet = ss.getSheetByName(CONFIG.SHEETS.LOGS);
    
    if (!logSheet) {
      return { levels: {}, categories: {}, total: 0 };
    }
    
    var totalRows = logSheet.getLastRow();
    if (totalRows <= 1) {
      return { levels: {}, categories: {}, total: 0 };
    }
    
    var data = logSheet.getRange(2, 1, totalRows - 1, 4).getValues();
    var stats = {
      levels: {},
      categories: {},
      total: data.length
    };
    
    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      var level = row[1];
      var category = row[2];
      
      stats.levels[level] = (stats.levels[level] || 0) + 1;
      stats.categories[category] = (stats.categories[category] || 0) + 1;
    });
    
    return stats;
    
  } catch (error) {
    console.error('Ошибка получения статистики логов: ' + error.message);
    return { levels: {}, categories: {}, total: 0, error: error.message };
  }
}

/**
 * Экспортирует логи в текстовый формат
 * @param {number} count - Количество записей для экспорта
 * @returns {string} Логи в текстовом формате
 */
function exportLogsAsText(count = 1000) {
  try {
    var logs = getRecentLogs(count);
    if (!logs.length) {
      return 'Логи не найдены';
    }
    
    var textLogs = 'MP Review Manager - Экспорт логов (' + logs.length + ' записей)\n';
    textLogs += '='.repeat(80) + '\n\n';
    
    for (var i = 0; i < logs.length; i++) {
      var log = logs[i];
      var [timestamp, level, category, message] = log;
      var formattedTime = Utilities.formatDate(timestamp, LOG_CONFIG.TIMEZONE, LOG_CONFIG.DATE_FORMAT);
      textLogs += '[' + formattedTime + '] [' + level + '] [' + category + '] ' + message + '\n';
    });
    
    return textLogs;
    
  } catch (error) {
    return 'Ошибка экспорта логов: ' + error.message;
  }
}
