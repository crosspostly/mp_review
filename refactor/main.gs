/**
 * @file main.gs
 * @description Главная точка входа для MP Review Manager v2.0
 * @version 2.0
 * @date 2025-10-26
 * 
 * АРХИТЕКТУРА:
 * Новая модульная система с чистым разделением ответственности:
 * - config.gs: Централизованная конфигурация
 * - logger.gs: Система логирования
 * - store_manager.gs: Управление магазинами
 * - cache_manager.gs: Система кеширования
 * - wb_api.gs: API Wildberries
 * - ozon_api.gs: API Ozon
 * - trigger_system.gs: Автоматизация
 * - main.gs: Оркестрация и UI
 */

// ============ ОСНОВНЫЕ ФУНКЦИИ ДЛЯ GOOGLE SHEETS UI ============

/**
 * Создает пользовательское меню в Google Sheets
 */
function onOpen() {
  var timer = new PerformanceTimer('onOpen');
  
  try {
    var ui = SpreadsheetApp.getUi();
    
    var menu = ui.createMenu('MP Review Manager v2.0')
      
      // Основные функции
      .addItem('📊 Панель управления', 'showDashboard')
      .addSeparator()
      
      // Управление магазинами
      .addSubMenu(ui.createMenu('🏪 Магазины')
        .addItem('➕ Добавить магазин', 'showAddStoreDialog')
        .addItem('📝 Управление магазинами', 'showStoreManagerDialog')
        .addItem('✅ Активные магазины', 'showActiveStores')
        .addItem('🔄 Синхронизировать все', 'syncAllStores'))
      
      // Система триггеров
      .addSubMenu(ui.createMenu('⚡ Автоматизация')
        .addItem('🚀 Настроить триггеры (30 мин)', 'setupTriggers30Min')
        .addItem('🚀 Настроить триггеры (60 мин)', 'setupTriggers60Min')
        .addItem('🔍 Статус триггеров', 'showTriggersStatus')
        .addItem('🧹 Очистить все триггеры', 'deleteAllSystemTriggers'))
      
      // Операции с отзывами
      .addSubMenu(ui.createMenu('💬 Отзывы')
        .addItem('📥 Собрать новые отзывы', 'collectAllReviews')
        .addItem('🤖 Подготовить ответы', 'prepareAllAnswers')
        .addItem('📤 Отправить ответы', 'sendAllAnswers')
        .addItem('📈 Статистика отзывов', 'showReviewsStats'))
      
      // Инструменты и настройки
      .addSubMenu(ui.createMenu('🔧 Инструменты')
        .addItem('📋 Экспорт данных', 'exportAllData')
        .addItem('🧪 Тестирование API', 'runApiTests')
        .addItem('📊 Системная диагностика', 'runSystemDiagnostics')
        .addItem('🔄 Сброс кешей', 'clearAllCaches'))
      
      // Режим разработчика
      .addSubMenu(ui.createMenu('🛠️ Режим разработчика')
        .addItem('✅ Включить', 'enableDevMode')
        .addItem('❌ Выключить', 'disableDevMode')
        .addItem('📊 Статус', 'showDevModeStatus')
        .addItem('🐞 Показать логи', 'showLogsSheet'))
      
      .addSeparator()
      .addItem('❓ Справка', 'showHelp');
    
    menu.addToUi();
    
    logSuccess('Пользовательское меню создано', LOG_CONFIG.CATEGORIES.SYSTEM);
    timer.finish(LOG_CONFIG.LEVELS.SUCCESS);
    
  } catch (error) {
    logError('Ошибка создания меню: ' + error.message + '\', LOG_CONFIG.CATEGORIES.SYSTEM);
    timer.finish(LOG_CONFIG.LEVELS.ERROR);
  }
}

/**
 * Отображает панель управления системой
 */
function showDashboard() {
  try {
    var timer = new PerformanceTimer('showDashboard');
    
    logInfo('Открытие панели управления', LOG_CONFIG.CATEGORIES.UI);
    
    // Собираем статистику
    var stats = {
      activeStores: getActiveStores().length,
      totalStores: getAllStores().length,
      triggersStatus: getSystemTriggersInfo(),
      systemHealth: runQuickHealthCheck(),
      lastUpdate: new Date()
    };
    
    var html = generateDashboardHTML(stats);
    
    var htmlOutput = HtmlService.createHtmlOutput(html)
      .setWidth(800)
      .setHeight(600)
      .setTitle('MP Review Manager - Панель управления');
    
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Панель управления');
    
    logSuccess('Панель управления отображена', LOG_CONFIG.CATEGORIES.UI);
    timer.finish(LOG_CONFIG.LEVELS.SUCCESS);
    
  } catch (error) {
    logError(\'Ошибка отображения панели управления: ' + error.message + '\', LOG_CONFIG.CATEGORIES.UI);
    showErrorDialog('Ошибка панели управления', error.message);
  }
}

// ============ ФУНКЦИИ УПРАВЛЕНИЯ МАГАЗИНАМИ ============

/**
 * Показывает боковую панель управления магазинами (совместимость со старым кодом)
 */
function showStoreManagerSidebar() {
  try {
    logInfo('Открытие панели управления магазинами', LOG_CONFIG.CATEGORIES.UI);
    
    var html = HtmlService.createTemplateFromFile('StoreManagerSidebar');
    var htmlOutput = html.evaluate()
      .setTitle('🏪 Управление магазинами')
      .setWidth(400);
    
    SpreadsheetApp.getUi().showSidebar(htmlOutput);
    
    logSuccess('Панель управления магазинами открыта', LOG_CONFIG.CATEGORIES.UI);
    
  } catch (error) {
    logError(\'Ошибка открытия панели управления: ' + error.message + '\', LOG_CONFIG.CATEGORIES.UI);
    
    // Fallback - показываем простое диалоговое окно
    var ui = SpreadsheetApp.getUi();
    ui.alert('Ошибка', 
      \'Не удалось открыть панель управления магазинами: ' + error.message + '\', 
      ui.ButtonSet.OK);
  }
}

/**
 * Алиас для совместимости со старым кодом
 */
function showStoreManagerDialog() {
  showStoreManagerSidebar();
}

/**
 * Тестирует подключение к API магазина (для UI)
 */
function testStoreConnection(credentials, marketplace) {
  try {
    logInfo(\'Тестирование подключения к ' + marketplace + '\', LOG_CONFIG.CATEGORIES.UI);
    
    if (marketplace === 'Wildberries') {
      if (!credentials.apiKey) {
        return { success: false, message: 'API ключ не указан' };
      }
      
      // Простой тест WB API - ИСПРАВЛЕНО: добавлен обязательный параметр isAnswered
      var url = \'' + WB_CONFIG.API_BASE_URL + '' + WB_CONFIG.ENDPOINTS.GET_FEEDBACKS + '?isAnswered=false&take=1&skip=0\';
      
      var response = UrlFetchApp.fetch(url, {
        method: 'GET',
        headers: { 'Authorization': credentials.apiKey },
        muteHttpExceptions: true
      });
      
      var code = response.getResponseCode();
      var responseBody = response.getContentText();
      
      logInfo(\'[WB Test] Статус: ' + code + ', Ответ: ' + responseBody.substring(0, 200) + '...\', LOG_CONFIG.CATEGORIES.WB_API);
      
      if (code === 200) {
        return { success: true, message: '✅ Подключение к WB API успешно! Ключ имеет доступ к отзывам.' };
      } else if (code === 401) {
        return { success: false, message: '❌ Ошибка 401: Неверный API ключ WB' };
      } else if (code === 403) {
        return { success: false, message: '❌ Ошибка 403: API ключ не имеет необходимых разрешений' };
      } else if (code === 429) {
        return { success: false, message: '❌ Ошибка 429: Превышен лимит запросов WB API' };
      } else {
        return { success: false, message: \'❌ Ошибка WB API: ' + code + '. ' + responseBody.substring(0, 100) + '\' };
      }
      
    } else if (marketplace === 'Ozon') {
      if (!credentials.clientId || !credentials.apiKey) {
        return { success: false, message: 'Client ID или API ключ не указаны' };
      }
      
      // Простой тест Ozon API
      var url = \'' + OZON_CONFIG.API_BASE_URL + '' + OZON_CONFIG.ENDPOINTS.GET_FEEDBACKS + '\';
      
      var response = UrlFetchApp.fetch(url, {
        method: 'POST',
        headers: {
          'Client-Id': credentials.clientId,
          'Api-Key': credentials.apiKey
        },
        contentType: 'application/json',
        payload: JSON.stringify({ limit: 1 }),
        muteHttpExceptions: true
      });
      
      var code = response.getResponseCode();
      var responseBody = response.getContentText();
      
      logInfo(\'[Ozon Test] Статус: ' + code + ', Ответ: ' + responseBody.substring(0, 200) + '...\', LOG_CONFIG.CATEGORIES.OZON_API);
      
      if (code === 200) {
        return { success: true, message: '✅ Подключение к Ozon API успешно! Доступ к отзывам подтвержден.' };
      } else if (code === 401) {
        return { success: false, message: '❌ Ошибка 401: Неверные Client ID или API Key для Ozon' };
      } else if (code === 403) {
        return { success: false, message: '❌ Ошибка 403: Недостаточно прав доступа для Ozon API' };
      } else if (code === 404) {
        return { success: false, message: '❌ Ошибка 404: API endpoint не найден. Проверьте URL Ozon API' };
      } else if (code === 429) {
        return { success: false, message: '❌ Ошибка 429: Превышен лимит запросов Ozon API' };
      } else {
        return { success: false, message: \'❌ Ошибка Ozon API: ' + code + '. ' + responseBody.substring(0, 100) + '\' };
      }
    }
    
    return { success: false, message: 'Неподдерживаемый маркетплейс' };
    
  } catch (error) {
    logError(\'Ошибка тестирования подключения: ' + error.message + '\', LOG_CONFIG.CATEGORIES.UI);
    return { success: false, message: \'❌ Ошибка: ' + error.message + '\' };
  }
}

/**
 * Показывает диалог добавления нового магазина
 */
function showAddStoreDialog() {
  try {
    var html = HtmlService.createHtmlOutputFromFile('addStoreDialog')
      .setWidth(500)
      .setHeight(400)
      .setTitle('Добавить новый магазин');
    
    SpreadsheetApp.getUi().showModalDialog(html, 'Добавить магазин');
    
  } catch (error) {
    logError(\'Ошибка диалога добавления магазина: ' + error.message + '\', LOG_CONFIG.CATEGORIES.UI);
    showErrorDialog('Ошибка', 'Не удалось открыть диалог добавления магазина');
  }
}

/**
 * Добавляет новый магазин (вызывается из HTML диалога)
 */
function addNewStore(storeData) {
  try {
    var timer = new PerformanceTimer('addNewStore');
    
    logInfo(\'Добавление нового магазина: ' + storeData.name + '\', LOG_CONFIG.CATEGORIES.STORE);
    
    // Валидация данных
    var validationResult = validateStoreData(storeData);
    if (!validationResult.valid) {
      return {
        success: false,
        error: validationResult.errors.join(', ')
      };
    }
    
    // Добавляем магазин через store_manager
    var result = addStore(storeData);
    
    if (result.success) {
      // Создаем лист для магазина
      createStoreSheetIfNotExists(result.store);
      
      // Инициализируем кеш
      initializeCacheForStore(result.store.id);
      
      logSuccess(\'Магазин ' + storeData.name + ' успешно добавлен\', LOG_CONFIG.CATEGORIES.STORE);
      timer.finish(LOG_CONFIG.LEVELS.SUCCESS);
      
      return {
        success: true,
        message: 'Магазин успешно добавлен',
        storeId: result.store.id
      };
      
    } else {
      timer.finish(LOG_CONFIG.LEVELS.ERROR);
      return result;
    }
    
  } catch (error) {
    logError(\'Ошибка добавления магазина: ' + error.message + '\', LOG_CONFIG.CATEGORIES.STORE);
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Отображает список активных магазинов
 */
function showActiveStores() {
  try {
    var activeStores = getActiveStores();
    
    if (activeStores.length === 0) {
      showInfoDialog('Активные магазины', 'У вас пока нет активных магазинов.\n\nДобавьте магазин через меню "Магазины" → "Добавить магазин"');
      return;
    }
    
    var message = \'Активные магазины (' + activeStores.length + '):\n\n\';
    
    // ЗАЩИТА forEach ERROR: Дополнительная проверка что activeStores это массив
    if (Array.isArray(activeStores)) {
      for (var index = 0; index < activeStores.length; index++) {
      var store = activeStores[index];
        message += \'' + index + 1 + '. ' + store.name + '\n\';
        message += \'   Маркетплейс: ' + store.marketplace + '\n\';
        message += \'   Статус: ' + (store.isActive ? '✅ Активен' : '❌ Неактивен') + '\n\';
        message += \'   Добавлен: ' + new Date(store.createdDate).toLocaleDateString('ru-RU') + '\n\n\';
      });
    } else {
      logError(\'showActiveStores: activeStores не массив, получено: ' + typeof activeStores + '\', LOG_CONFIG.CATEGORIES.UI);
      message += \'⚠️ Ошибка загрузки списка магазинов\';
    }
    
    showInfoDialog('Активные магазины', message);
    
  } catch (error) {
    logError(\'Ошибка отображения активных магазинов: ' + error.message + '\', LOG_CONFIG.CATEGORIES.UI);
    showErrorDialog('Ошибка', 'Не удалось загрузить список активных магазинов');
  }
}

/**
 * Синхронизирует все активные магазины
 */
function syncAllStores() {
  try {
    var timer = new PerformanceTimer('syncAllStores');
    
    showProgressDialog('Синхронизация магазинов', 'Синхронизация данных со всеми активными магазинами...');
    
    var activeStores = getActiveStores();
    if (activeStores.length === 0) {
      closeProgressDialog();
      showInfoDialog('Синхронизация', 'Нет активных магазинов для синхронизации');
      return;
    }
    
    var results = {
      totalStores: activeStores.length,
      successful: 0,
      failed: 0,
      errors: []
    };
    
    for (var __i = 0; __i < activeStores.length; __i++) {
      var store = activeStores[__i];
      try {
        logInfo(\'Синхронизация магазина: ' + store.name + '\', LOG_CONFIG.CATEGORIES.STORE);
        
        // Сбор отзывов
        var reviewsResult = collectReviewsForStore(store);
        
        results.successful++;
        logSuccess(\'' + store.name + ': синхронизация завершена\', LOG_CONFIG.CATEGORIES.STORE);
        
      } catch (error) {
        results.failed++;
        results.errors.push(\'' + store.name + ': ' + error.message + '\');
        logError(\'Ошибка синхронизации ' + store.name + ': ' + error.message + '\', LOG_CONFIG.CATEGORIES.STORE);
      }
    }
    
    closeProgressDialog();
    
    var message = \'Синхронизация завершена:\n\n\';
    message += \'✅ Успешно: ' + results.successful + '\n\';
    message += \'❌ Ошибки: ' + results.failed + '\n\';
    
    if (results.errors.length > 0) {
      message += \'\nОшибки:\n' + results.errors.join('\n') + '\';
    }
    
    showInfoDialog('Результаты синхронизации', message);
    
    timer.finish(LOG_CONFIG.LEVELS.SUCCESS);
    
  } catch (error) {
    closeProgressDialog();
    logError(\'Ошибка синхронизации магазинов: ' + error.message + '\', LOG_CONFIG.CATEGORIES.STORE);
    showErrorDialog('Ошибка синхронизации', error.message);
  }
}

// ============ ФУНКЦИИ УПРАВЛЕНИЯ ОТЗЫВАМИ ============

/**
 * Собирает новые отзывы со всех активных магазинов
 */
function collectAllReviews() {
  try {
    logInfo('Запуск сбора всех отзывов через UI', LOG_CONFIG.CATEGORIES.UI);
    
    showProgressDialog('Сбор отзывов', 'Получение новых отзывов со всех активных магазинов...');
    
    // Используем триггерную функцию
    var result = hourlyReviewCollector();
    
    closeProgressDialog();
    
    if (result) {
      var message = \'Сбор отзывов завершен:\n\n\';
      message += \'📊 Магазинов обработано: ' + result.processedStores + '/' + result.totalStores + '\n\';
      message += \'📥 Всего отзывов получено: ' + result.totalReviews + '\n\';
      message += \'🆕 Новых отзывов: ' + result.newReviews + '\n\';
      
      if (result.errors && result.errors.length > 0) {
        message += \'\n❌ Ошибки:\n' + result.errors.join('\n') + '\';
      }
      
      showInfoDialog('Результаты сбора отзывов', message);
    }
    
  } catch (error) {
    closeProgressDialog();
    logError(\'Ошибка сбора отзывов: ' + error.message + '\', LOG_CONFIG.CATEGORIES.UI);
    showErrorDialog('Ошибка сбора отзывов', error.message);
  }
}

/**
 * Подготавливает ответы для всех новых отзывов
 */
function prepareAllAnswers() {
  try {
    logInfo('Запуск подготовки ответов через UI', LOG_CONFIG.CATEGORIES.UI);
    
    showProgressDialog('Подготовка ответов', 'Подбор ответов для новых отзывов...');
    
    // Используем триггерную функцию
    var result = selectReviewAnswers();
    
    closeProgressDialog();
    
    if (result) {
      var message = \'Подготовка ответов завершена:\n\n\';
      message += \'📊 Магазинов обработано: ' + result.processedStores + '/' + result.totalStores + '\n\';
      message += \'📝 Отзывов обработано: ' + result.totalReviews + '\n\';
      message += \'✅ Ответов подготовлено: ' + result.preparedAnswers + '\n\';
      
      if (result.errors && result.errors.length > 0) {
        message += \'\n❌ Ошибки:\n' + result.errors.join('\n') + '\';
      }
      
      showInfoDialog('Результаты подготовки ответов', message);
    }
    
  } catch (error) {
    closeProgressDialog();
    logError(\'Ошибка подготовки ответов: ' + error.message + '\', LOG_CONFIG.CATEGORIES.UI);
    showErrorDialog('Ошибка подготовки ответов', error.message);
  }
}

/**
 * Отправляет все подготовленные ответы
 */
function sendAllAnswers() {
  try {
    logInfo('Запуск отправки ответов через UI', LOG_CONFIG.CATEGORIES.UI);
    
    showProgressDialog('Отправка ответов', 'Отправка подготовленных ответов на маркетплейсы...');
    
    // Используем триггерную функцию
    var result = sendReviewAnswers();
    
    closeProgressDialog();
    
    if (result) {
      var message = \'Отправка ответов завершена:\n\n\';
      message += \'📊 Магазинов обработано: ' + result.processedStores + '/' + result.totalStores + '\n\';
      message += \'📤 К отправке было: ' + result.totalPending + '\n\';
      message += \'✅ Успешно отправлено: ' + result.sentAnswers + '\n\';
      
      if (result.errors && result.errors.length > 0) {
        message += \'\n❌ Ошибки:\n' + result.errors.join('\n') + '\';
      }
      
      showInfoDialog('Результаты отправки ответов', message);
    }
    
  } catch (error) {
    closeProgressDialog();
    logError(\'Ошибка отправки ответов: ' + error.message + '\', LOG_CONFIG.CATEGORIES.UI);
    showErrorDialog('Ошибка отправки ответов', error.message);
  }
}

/**
 * Показывает статистику по отзывам
 */
function showReviewsStats() {
  try {
    var timer = new PerformanceTimer('showReviewsStats');
    
    var activeStores = getActiveStores();
    if (activeStores.length === 0) {
      showInfoDialog('Статистика отзывов', 'Нет активных магазинов для анализа статистики');
      return;
    }
    
    var stats = {
      stores: activeStores.length,
      totalReviews: 0,
      newReviews: 0,
      pendingReviews: 0,
      sentReviews: 0,
      errorReviews: 0
    };
    
    // Собираем статистику по всем магазинам
    for (var __i = 0; __i < activeStores.length; __i++) {
      var store = activeStores[__i];
      try {
        var storeStats = getStoreReviewsStats(store);
        
        stats.totalReviews += storeStats.total;
        stats.newReviews += storeStats.new;
        stats.pendingReviews += storeStats.pending;
        stats.sentReviews += storeStats.sent;
        stats.errorReviews += storeStats.error;
        
      } catch (error) {
        logWarning(\'Ошибка получения статистики для ' + store.name + ': ' + error.message + '\', LOG_CONFIG.CATEGORIES.STORE);
      }
    }
    
    var message = \'📊 СТАТИСТИКА ОТЗЫВОВ\n\n\';
    message += \'🏪 Активных магазинов: ' + stats.stores + '\n\';
    message += \'📝 Всего отзывов: ' + stats.totalReviews + '\n\n\';
    message += \'📊 По статусам:\n\';
    message += \'🆕 Новые: ' + stats.newReviews + '\n\';
    message += \'⏳ Готовы к отправке: ' + stats.pendingReviews + '\n\';
    message += \'✅ Отправлены: ' + stats.sentReviews + '\n\';
    message += \'❌ Ошибки: ' + stats.errorReviews + '\n\';
    
    showInfoDialog('Статистика отзывов', message);
    
    timer.finish(LOG_CONFIG.LEVELS.SUCCESS);
    
  } catch (error) {
    logError(\'Ошибка получения статистики отзывов: ' + error.message + '\', LOG_CONFIG.CATEGORIES.UI);
    showErrorDialog('Ошибка статистики', error.message);
  }
}

// ============ ФУНКЦИИ УПРАВЛЕНИЯ ТРИГГЕРАМИ ============

/**
 * Показывает статус системы триггеров
 */
function showTriggersStatus() {
  try {
    var triggersInfo = getSystemTriggersInfo();
    var savedInfo = getTriggerSystemInfo();
    
    var message = \'⚡ СТАТУС СИСТЕМЫ ТРИГГЕРОВ\n\n\';
    
    if (triggersInfo.isComplete) {
      message += \'✅ Система работает корректно\n\';
      message += \'📊 Активных триггеров: ' + triggersInfo.total + '/' + triggersInfo.expected + '\n\n\';
      
      triggersInfo.for (var index = 0; index < triggers.length; index++) {
      var trigger = triggers[index];
        message += \'' + index + 1 + '. ' + trigger.functionName + '\n\';
        message += \'   ID: ' + trigger.id + '\n\';
        message += \'   Тип: ' + trigger.isTimeBased ? 'По времени' : 'Другой' + '\n\n\';
      });
      
      if (savedInfo) {
        message += \'📅 Настроены: ' + new Date(savedInfo.setupDate).toLocaleString('ru-RU') + '\n\';
        message += \'⏰ Интервал: ' + savedInfo.intervalMinutes + ' минут\n\';
        message += \'🏪 Магазинов: ' + savedInfo.activeStores + '\n\';
      }
      
    } else {
      message += \'❌ Система триггеров не настроена\n\';
      message += \'📊 Найдено триггеров: ' + triggersInfo.total + '/' + triggersInfo.expected + '\n\n\';
      message += \'💡 Для настройки используйте:\n\';
      message += \'   Меню → Автоматизация → Настроить триггеры\n\';
    }
    
    showInfoDialog('Статус триггеров', message);
    
  } catch (error) {
    logError(\'Ошибка получения статуса триггеров: ' + error.message + '\', LOG_CONFIG.CATEGORIES.UI);
    showErrorDialog('Ошибка статуса триггеров', error.message);
  }
}

// ============ ДИАГНОСТИЧЕСКИЕ ФУНКЦИИ ============

/**
 * Запускает системную диагностику
 */
function runSystemDiagnostics() {
  try {
    var timer = new PerformanceTimer('runSystemDiagnostics');
    
    showProgressDialog('Системная диагностика', 'Проверка состояния системы...');
    
    var diagnostics = {
      timestamp: new Date(),
      stores: {
        total: getAllStores().length,
        active: getActiveStores().length,
        withErrors: 0
      },
      triggers: getSystemTriggersInfo(),
      performance: {
        cacheHits: 0,
        apiCalls: 0
      },
      system: {
        memoryUsage: 'N/A',
        executionTime: 0
      }
    };
    
    // Проверяем магазины
    var activeStores = getActiveStores();
    for (var __i = 0; __i < activeStores.length; __i++) {
      var store = activeStores[__i];
      try {
        // Пробуем получить данные магазина
        getStoreById(store.id);
      } catch (error) {
        diagnostics.stores.withErrors++;
      }
    }
    
    closeProgressDialog();
    
    var message = \'🔍 СИСТЕМНАЯ ДИАГНОСТИКА\n\n\';
    message += \'📅 Дата: ' + diagnostics.timestamp.toLocaleString('ru-RU') + '\n\n\';
    
    message += \'🏪 МАГАЗИНЫ:\n\';
    message += \'   Всего: ' + diagnostics.stores.total + '\n\';
    message += \'   Активные: ' + diagnostics.stores.active + '\n\';
    message += \'   С ошибками: ' + diagnostics.stores.withErrors + '\n\n\';
    
    message += \'⚡ ТРИГГЕРЫ:\n\';
    message += \'   Статус: ' + diagnostics.triggers.isComplete ? '✅ Работают' : '❌ Проблемы' + '\n\';
    message += \'   Активные: ' + diagnostics.triggers.total + '/' + diagnostics.triggers.expected + '\n\n\';
    
    if (diagnostics.stores.withErrors > 0 || !diagnostics.triggers.isComplete) {
      message += \'⚠️ ОБНАРУЖЕНЫ ПРОБЛЕМЫ:\n\';
      if (diagnostics.stores.withErrors > 0) {
        message += \'- Ошибки в конфигурации магазинов\n\';
      }
      if (!diagnostics.triggers.isComplete) {
        message += \'- Неполная настройка триггеров\n\';
      }
    } else {
      message += \'✅ Система работает корректно\';
    }
    
    showInfoDialog('Системная диагностика', message);
    
    timer.finish(LOG_CONFIG.LEVELS.SUCCESS);
    
  } catch (error) {
    closeProgressDialog();
    logError(\'Ошибка системной диагностики: ' + error.message + '\', LOG_CONFIG.CATEGORIES.SYSTEM);
    showErrorDialog('Ошибка диагностики', error.message);
  }
}

/**
 * Быстрая проверка состояния системы
 */
function runQuickHealthCheck() {
  try {
    return {
      stores: getActiveStores().length > 0,
      triggers: getSystemTriggersInfo().isComplete,
      sheets: SpreadsheetApp.getActiveSpreadsheet() !== null
    };
  } catch (error) {
    logError(\'Ошибка быстрой проверки: ' + error.message + '\', LOG_CONFIG.CATEGORIES.SYSTEM);
    return {
      stores: false,
      triggers: false,
      sheets: false
    };
  }
}

/**
 * Тестирует API соединения
 */
function runApiTests() {
  try {
    var timer = new PerformanceTimer('runApiTests');
    
    showProgressDialog('Тестирование API', 'Проверка подключений к маркетплейсам...');
    
    var activeStores = getActiveStores();
    if (activeStores.length === 0) {
      closeProgressDialog();
      showInfoDialog('Тестирование API', 'Нет активных магазинов для тестирования API');
      return;
    }
    
    var results = [];
    
    for (var __i = 0; __i < activeStores.length; __i++) {
      var store = activeStores[__i];
      try {
        var testResult = null;
        
        if (store.marketplace === 'Wildberries') {
          // Тест WB API
          testResult = testWbConnection(store);
        } else if (store.marketplace === 'Ozon') {
          // Тест Ozon API
          testResult = testOzonConnection(store);
        }
        
        results.push({
          store: store.name,
          marketplace: store.marketplace,
          status: testResult?.success ? 'OK' : 'ERROR',
          message: testResult?.message || 'Тест не выполнен'
        });
        
      } catch (error) {
        results.push({
          store: store.name,
          marketplace: store.marketplace,
          status: 'ERROR',
          message: error.message
        });
      }
    }
    
    closeProgressDialog();
    
    var message = \'🧪 РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ API\n\n\';
    
    for (var index = 0; index < results.length; index++) {
      var result = results[index];
      var status = result.status === 'OK' ? '✅' : '❌';
      message += \'' + index + 1 + '. ' + result.store + ' (' + result.marketplace + ')\n\';
      message += \'   Статус: ' + status + ' ' + result.status + '\n\';
      message += \'   ' + result.message + '\n\n\';
    });
    
    showInfoDialog('Результаты тестирования API', message);
    
    timer.finish(LOG_CONFIG.LEVELS.SUCCESS);
    
  } catch (error) {
    closeProgressDialog();
    logError(\'Ошибка тестирования API: ' + error.message + '\', LOG_CONFIG.CATEGORIES.SYSTEM);
    showErrorDialog('Ошибка тестирования', error.message);
  }
}

// ============ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ UI ============

/**
 * Показывает диалог с информацией
 */
function showInfoDialog(title, message) {
  try {
    var ui = SpreadsheetApp.getUi();
    ui.alert(title, message, ui.ButtonSet.OK);
  } catch (error) {
    logError(\'Ошибка показа информационного диалога: ' + error.message + '\', LOG_CONFIG.CATEGORIES.UI);
  }
}

/**
 * Показывает диалог с ошибкой
 */
function showErrorDialog(title, message) {
  try {
    var ui = SpreadsheetApp.getUi();
    ui.alert(\'❌ ' + title + '\', message, ui.ButtonSet.OK);
    
    // Дублируем в лог
    logError(\'UI Error - ' + title + ': ' + message + '\', LOG_CONFIG.CATEGORIES.UI);
    
  } catch (error) {
    console.error(\'Критическая ошибка UI: ' + error.message + '\');
  }
}

/**
 * Показывает диалог прогресса (имитация)
 */
function showProgressDialog(title, message) {
  try {
    // В Google Sheets нет нативной поддержки progress dialog
    // Используем toast notifications
    SpreadsheetApp.getActiveSpreadsheet().toast(message, title, 10);
    
  } catch (error) {
    logError(\'Ошибка показа диалога прогресса: ' + error.message + '\', LOG_CONFIG.CATEGORIES.UI);
  }
}

/**
 * Закрывает диалог прогресса
 */
function closeProgressDialog() {
  try {
    SpreadsheetApp.getActiveSpreadsheet().toast('', '', 1);
  } catch (error) {
    // Игнорируем ошибки закрытия
  }
}

/**
 * Генерирует HTML для панели управления
 */
function generateDashboardHTML(stats) {
  var healthStatus = stats.systemHealth;
  var triggersStatus = stats.triggersStatus;
  
  var html = \'
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #4CAF50; color: white; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
        .stat-card { border: 1px solid #ddd; padding: 15px; border-radius: 5px; text-align: center; }
        .stat-number { font-size: 24px; font-weight: bold; color: #4CAF50; }
        .status-good { color: #4CAF50; }
        .status-warning { color: #FF9800; }
        .status-error { color: #f44336; }
        .action-buttons { margin-top: 20px; }
        .btn { padding: 8px 16px; margin: 5px; border: none; border-radius: 3px; cursor: pointer; }
        .btn-primary { background: #4CAF50; color: white; }
        .btn-secondary { background: #2196F3; color: white; }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>MP Review Manager v2.0</h2>
        <p>Панель управления системой автоматизации отзывов</p>
      </div>
      
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-number">' + stats.activeStores + '</div>
          <div>Активных магазинов</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">' + stats.totalStores + '</div>
          <div>Всего магазинов</div>
        </div>
        <div class="stat-card">
          <div class="stat-number ' + triggersStatus.isComplete ? 'status-good' : 'status-error' + '">
            ' + triggersStatus.total + '/' + triggersStatus.expected + '
          </div>
          <div>Активные триггеры</div>
        </div>
        <div class="stat-card">
          <div class="stat-number ' + (healthStatus.stores && healthStatus.triggers && healthStatus.sheets) ? 'status-good' : 'status-warning' + '">
            ' + (healthStatus.stores && healthStatus.triggers && healthStatus.sheets) ? '✅' : '⚠️' + '
          </div>
          <div>Состояние системы</div>
        </div>
      </div>
      
      <div>
        <h3>Быстрые действия:</h3>
        <div class="action-buttons">
          <button class="btn btn-primary" onclick="google.script.run.collectAllReviews()">
            📥 Собрать отзывы
          </button>
          <button class="btn btn-primary" onclick="google.script.run.prepareAllAnswers()">
            🤖 Подготовить ответы
          </button>
          <button class="btn btn-primary" onclick="google.script.run.sendAllAnswers()">
            📤 Отправить ответы
          </button>
          <button class="btn btn-secondary" onclick="google.script.run.showReviewsStats()">
            📊 Статистика
          </button>
        </div>
      </div>
      
      <div style="margin-top: 30px; padding: 10px; background: #f5f5f5; border-radius: 5px;">
        <small>
          Последнее обновление: ' + stats.lastUpdate.toLocaleString('ru-RU') + '<br>
          Версия: 2.0 | Архитектура: Модульная
        </small>
      </div>
    </body>
    </html>
  \';
  
  return html;
}

// ============ ФУНКЦИИ ЭКСПОРТА И ИНСТРУМЕНТОВ ============

/**
 * Экспортирует все данные системы
 */
function exportAllData() {
  try {
    var timer = new PerformanceTimer('exportAllData');
    
    showProgressDialog('Экспорт данных', 'Подготовка данных для экспорта...');
    
    var exportData = {
      metadata: {
        exportDate: new Date(),
        version: '2.0',
        systemInfo: runQuickHealthCheck()
      },
      stores: getAllStores(),
      activeStores: getActiveStores(),
      triggersInfo: getSystemTriggersInfo(),
      savedTriggerInfo: getTriggerSystemInfo()
    };
    
    // Создаем новый лист для экспорта
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var exportSheetName = \'Export_' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss') + '\';
    
    var exportSheet = ss.getSheetByName(exportSheetName);
    if (exportSheet) {
      ss.deleteSheet(exportSheet);
    }
    
    exportSheet = ss.insertSheet(exportSheetName);
    
    // Записываем данные экспорта
    exportSheet.getRange(1, 1).setValue('MP Review Manager - Экспорт данных');
    exportSheet.getRange(2, 1).setValue(JSON.stringify(exportData, null, 2));
    
    closeProgressDialog();
    
    showInfoDialog('Экспорт завершен', \'Данные экспортированы в лист: ' + exportSheetName + '\');
    
    timer.finish(LOG_CONFIG.LEVELS.SUCCESS);
    
  } catch (error) {
    closeProgressDialog();
    logError(\'Ошибка экспорта данных: ' + error.message + '\', LOG_CONFIG.CATEGORIES.SYSTEM);
    showErrorDialog('Ошибка экспорта', error.message);
  }
}

/**
 * Очищает все кеши системы
 */
function clearAllCaches() {
  try {
    var timer = new PerformanceTimer('clearAllCaches');
    
    var result = clearAllStoreCaches();
    
    var message = \'🧹 Очистка кешей завершена\n\n\';
    message += \'📊 Очищено кешей: ' + result.clearedCaches + '\n\';
    message += \'❌ Ошибок: ' + result.errors + '\n\';
    
    if (result.errorMessages.length > 0) {
      message += \'\nДетали ошибок:\n' + result.errorMessages.join('\n') + '\';
    }
    
    showInfoDialog('Очистка кешей', message);
    
    timer.finish(LOG_CONFIG.LEVELS.SUCCESS);
    
  } catch (error) {
    logError(\'Ошибка очистки кешей: ' + error.message + '\', LOG_CONFIG.CATEGORIES.SYSTEM);
    showErrorDialog('Ошибка очистки кешей', error.message);
  }
}

/**
 * Показывает справочную информацию
 */
function showHelp() {
  var helpMessage = \'
📖 MP REVIEW MANAGER v2.0 - СПРАВКА

🏪 УПРАВЛЕНИЕ МАГАЗИНАМИ:
• Добавьте магазины через "Магазины" → "Добавить магазин"
• Укажите API ключи и необходимые параметры
• Проверьте статус в "Активные магазины"

⚡ АВТОМАТИЗАЦИЯ:
• Настройте триггеры для автоматической работы
• Рекомендуемый интервал: 30-60 минут
• Система работает в 3 этапа: сбор → подготовка → отправка

💬 РАБОТА С ОТЗЫВАМИ:
• Новые отзывы собираются автоматически
• Ответы подбираются по шаблонам
• Отправка происходит с соблюдением лимитов API

🔧 ДИАГНОСТИКА:
• Используйте "Системная диагностика" для проверки
• "Тестирование API" проверит подключения
• Логи доступны в соответствующих листах

📞 ПОДДЕРЖКА:
• Проверьте логи при возникновении проблем
• Убедитесь в корректности API ключей
• При ошибках используйте "Сброс кешей"

Версия: 2.0 | Архитектура: Модульная
  \';
  
  showInfoDialog('Справка по системе', helpMessage.trim());
}

// ============ СЛУЖЕБНЫЕ ФУНКЦИИ ============

/**
 * Валидация данных магазина
 */
function validateStoreData(storeData) {
  var errors = [];
  
  if (!storeData.name || storeData.name.trim().length === 0) {
    errors.push('Название магазина не может быть пустым');
  }
  
  if (!storeData.marketplace || !['Wildberries', 'Ozon'].includes(storeData.marketplace)) {
    errors.push('Выберите корректный маркетплейс');
  }
  
  if (!storeData.apiKey || storeData.apiKey.trim().length === 0) {
    errors.push('API ключ не может быть пустым');
  }
  
  // Дополнительная валидация для Wildberries
  if (storeData.marketplace === 'Wildberries') {
    if (!storeData.supplierId) {
      errors.push('Для Wildberries требуется Supplier ID');
    }
  }
  
  // Дополнительная валидация для Ozon
  if (storeData.marketplace === 'Ozon') {
    if (!storeData.clientId) {
      errors.push('Для Ozon требуется Client ID');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * Получает статистику отзывов для магазина
 */
function getStoreReviewsStats(store) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(store.id);
    
    if (!sheet) {
      return { total: 0, new: 0, pending: 0, sent: 0, error: 0 };
    }
    
    var data = sheet.getDataRange().getValues();
    var stats = { total: 0, new: 0, pending: 0, sent: 0, error: 0 };
    
    // Пропускаем заголовок
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var status = row[5]; // Колонка status
      
      stats.total++;
      
      switch (status) {
        case CONFIG.STATUS.NEW:
          stats.new++;
          break;
        case CONFIG.STATUS.PENDING:
          stats.pending++;
          break;
        case CONFIG.STATUS.SENT:
          stats.sent++;
          break;
        case CONFIG.STATUS.ERROR:
          stats.error++;
          break;
      }
    }
    
    return stats;
    
  } catch (error) {
    logError(\'Ошибка получения статистики для магазина ' + store.id + ': ' + error.message + '\', LOG_CONFIG.CATEGORIES.STORE);
    return { total: 0, new: 0, pending: 0, sent: 0, error: 0 };
  }
}

// ============ ИНИЦИАЛИЗАЦИЯ СИСТЕМЫ ============

/**
 * Инициализирует систему при первом запуске
 */
function initializeSystem() {
  try {
    var timer = new PerformanceTimer('initializeSystem');
    
    logInfo('Инициализация системы MP Review Manager v2.0', LOG_CONFIG.CATEGORIES.SYSTEM);
    
    // Проверяем наличие основных листов
    ensureSystemSheetsExist();
    
    // Инициализируем конфигурацию
    initializeSystemConfiguration();
    
    // Создаем первоначальную структуру
    setupInitialStructure();
    
    logSuccess('Система успешно инициализирована', LOG_CONFIG.CATEGORIES.SYSTEM);
    timer.finish(LOG_CONFIG.LEVELS.SUCCESS);
    
    return true;
    
  } catch (error) {
    logError(\'Ошибка инициализации системы: ' + error.message + '\', LOG_CONFIG.CATEGORIES.SYSTEM);
    return false;
  }
}

/**
 * Проверяет наличие системных листов
 */
function ensureSystemSheetsExist() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Создаем основные системные листы если их нет
    var requiredSheets = ['Магазины', 'Настройки', 'Логи'];
    
    for (var i = 0; i < requiredSheets.length; i++) {
      var sheetName = requiredSheets[i];
      if (!ss.getSheetByName(sheetName)) {
        ss.insertSheet(sheetName);
        logInfo(\'Создан системный лист: ' + sheetName + '\', LOG_CONFIG.CATEGORIES.SYSTEM);
      }
    });
    
  } catch (error) {
    logError(\'Ошибка создания системных листов: ' + error.message + '\', LOG_CONFIG.CATEGORIES.SYSTEM);
    throw error;
  }
}

/**
 * Настраивает начальную структуру системы
 */
function setupInitialStructure() {
  try {
    // Настраиваем заголовки для листа магазинов
    setupStoresSheetHeaders();
    
    // Создаем базовую конфигурацию
    createBaseConfiguration();
    
  } catch (error) {
    logError(\'Ошибка настройки начальной структуры: ' + error.message + '\', LOG_CONFIG.CATEGORIES.SYSTEM);
    throw error;
  }
}

/**
 * Настраивает заголовки для листа магазинов
 */
function setupStoresSheetHeaders() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var storesSheet = ss.getSheetByName('Магазины');
    
    var headers = ['ID', 'Название', 'Маркетплейс', 'API Key', 'Client ID', 'Supplier ID', 'Статус', 'Дата создания'];
    storesSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
  } catch (error) {
    logError(\'Ошибка настройки заголовков листа магазинов: ' + error.message + '\', LOG_CONFIG.CATEGORIES.SYSTEM);
  }
}

/**
 * ✅ ДОДЕЛАНО: Создает базовую конфигурацию системы
 */
function createBaseConfiguration() {
  try {
    var props = PropertiesService.getScriptProperties();
    
    // Устанавливаем базовые параметры если их нет
    if (!props.getProperty('SYSTEM_VERSION')) {
      props.setProperty('SYSTEM_VERSION', '2.0');
      props.setProperty('SYSTEM_INITIALIZED', 'true');
      props.setProperty('INITIALIZATION_DATE', new Date().toISOString());
      logSuccess('Базовая конфигурация системы создана', LOG_CONFIG.CATEGORIES.SYSTEM);
    }
    
  } catch (error) {
    logError(\'Ошибка создания базовой конфигурации: ' + error.message + '\', LOG_CONFIG.CATEGORIES.SYSTEM);
  }
}

/**
 * ✅ ДОДЕЛАНО: Алиас для инициализации системной конфигурации
 */
function initializeSystemConfiguration() {
  logInfo('Инициализация системной конфигурации', LOG_CONFIG.CATEGORIES.SYSTEM);
  createBaseConfiguration();
  
  // Дополнительная инициализация
  try {
    // Проверяем что все нужные листы созданы
    ensureSystemSheetsExist();
    
    // Инициализируем кеши для всех активных магазинов
    var activeStores = getActiveStores();
    
    // ЗАЩИТА forEach ERROR: Проверяем что activeStores это массив
    if (Array.isArray(activeStores)) {
      for (var i = 0; i < activeStores.length; i++) {
      var store = activeStores[i];
        initializeCacheForStore(store.id);
      });
    } else {
      logError(\'setupSystem: activeStores не массив, получено: ' + typeof activeStores + '\', LOG_CONFIG.CATEGORIES.SYSTEM);
    }
    
    logSuccess('Системная конфигурация полностью инициализирована', LOG_CONFIG.CATEGORIES.SYSTEM);
  } catch (error) {
    logError(\'Ошибка инициализации системной конфигурации: ' + error.message + '\', LOG_CONFIG.CATEGORIES.SYSTEM);
  }
}

/**
 * ✅ ДОДЕЛАНО: Проверяет и создает системные листы если они отсутствуют
 */
function ensureSystemSheetsExist() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var requiredSheets = [CONFIG.SHEETS.STORES, CONFIG.SHEETS.SETTINGS, CONFIG.SHEETS.LOGS];
    
    for (var i = 0; i < requiredSheets.length; i++) {
      var sheetName = requiredSheets[i];
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
        
        // Инициализируем заголовки для разных типов листов
        if (sheetName === CONFIG.SHEETS.STORES) {
          sheet.getRange(1, 1, 1, 6).setValues([
            ['ID', 'Название', 'Маркетплейс', 'API Key', 'Client ID', 'Активен']
          ]);
        } else if (sheetName === CONFIG.SHEETS.SETTINGS) {
          sheet.getRange(1, 1, 1, 3).setValues([
            ['Параметр', 'Значение', 'Описание']
          ]);
        } else if (sheetName === CONFIG.SHEETS.LOGS) {
          sheet.getRange(1, 1, 1, 4).setValues([
            ['Время', 'Уровень', 'Категория', 'Сообщение']
          ]);
        }
        
        logInfo(\'Создан системный лист: ' + sheetName + '\', LOG_CONFIG.CATEGORIES.SYSTEM);
      }
    });
  } catch (error) {
    logError(\'Ошибка создания системных листов: ' + error.message + '\', LOG_CONFIG.CATEGORIES.SYSTEM);
  }
}

// ============ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ HTML ============

/**
 * Функция для включения HTML файлов (нужна для HtmlService)
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ============ РЕЖИМ РАЗРАБОТЧИКА ============

/**
 * Включает режим разработчика
 */
function enableDevMode() {
  setDevMode(true);
}

/**
 * Выключает режим разработчика  
 */
function disableDevMode() {
  setDevMode(false);
}

/**
 * Устанавливает режим разработчика
 */
function setDevMode(enabled) {
  try {
    PropertiesService.getUserProperties().setProperty(CONFIG.DEV_MODE_KEY, enabled.toString());
    var status = enabled ? 'ВКЛЮЧЕН' : 'ВЫКЛЮЧЕН';
    
    logInfo(\'Режим разработчика ' + status + '\', LOG_CONFIG.CATEGORIES.SYSTEM);
    
    SpreadsheetApp.getUi().alert(\'🛠️ Режим разработчика ' + status + '\', 
      enabled ? 
        'Включен детальный режим логирования и отладки.

Все операции будут записываться в лист "Логи".' :
        'Логирование переведено в обычный режим.',
      SpreadsheetApp.getUi().ButtonSet.OK);
    
    // Обновляем индикатор статуса
    updateDevModeStatus();
    
  } catch (error) {
    logError(\'Ошибка установки режима разработчика: ' + error.message + '\', LOG_CONFIG.CATEGORIES.SYSTEM);
    SpreadsheetApp.getUi().alert('Ошибка', \'Не удалось изменить режим разработчика: ' + error.message + '\', SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/**
 * Проверяет включен ли режим разработчика
 */
function isDevMode() {
  try {
    return PropertiesService.getUserProperties().getProperty(CONFIG.DEV_MODE_KEY) === 'true';
  } catch (error) {
    logError(\'Ошибка проверки режима разработчика: ' + error.message + '\', LOG_CONFIG.CATEGORIES.SYSTEM);
    return false;
  }
}

/**
 * Обновляет индикатор статуса режима разработчика
 */
function updateDevModeStatus() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var settingsSheet = ss.getSheetByName(CONFIG.SHEETS.SETTINGS);
    
    if (!settingsSheet) {
      settingsSheet = ss.insertSheet(CONFIG.SHEETS.SETTINGS);
      settingsSheet.getRange(1, 1, 1, 3).setValues([['Параметр', 'Значение', 'Описание']]);
    }
    
    var devModeStatus = isDevMode() ? "🛠️ РЕЖИМ РАЗРАБОТЧИКА: ВКЛ" : "РЕЖИМ РАЗРАБОТЧИКА: ВЫКЛ";
    
    // Обновляем статус в листе настроек
    settingsSheet.getRange(2, 1).setValue('DEV_MODE');
    settingsSheet.getRange(2, 2).setValue(devModeStatus);
    settingsSheet.getRange(2, 3).setValue('Включает подробное логирование для отладки');
    
    logDebug(\'Обновлен индикатор режима разработчика: ' + devModeStatus + '\', LOG_CONFIG.CATEGORIES.SYSTEM);
    
  } catch (error) {
    logError(\'Ошибка обновления индикатора режима разработчика: ' + error.message + '\', LOG_CONFIG.CATEGORIES.SYSTEM);
  }
}

/**
 * Показывает текущий статус режима разработчика
 */
function showDevModeStatus() {
  try {
    var isEnabled = isDevMode();
    var status = isEnabled ? 'ВКЛЮЧЕН ✅' : 'ВЫКЛЮЧЕН ❌';
    
    var message = \'🛠️ РЕЖИМ РАЗРАБОТЧИКА: ' + status + '

\';
    
    if (isEnabled) {
      message += \'📊 АКТИВНЫЕ ВОЗМОЖНОСТИ:
\';
      message += \'• Подробное логирование всех операций
\';
      message += \'• Детальные сообщения об ошибках
\';
      message += \'• Расширенная диагностическая информация
\';
      message += \'• Логи записываются в лист "Логи"

\';
      message += \'💡 Для выключения используйте:
\';
      message += \'   Меню → Режим разработчика → Выключить\';
    } else {
      message += \'📊 ТЕКУЩИЙ РЕЖИМ:
\';
      message += \'• Обычное логирование (только важные события)
\';
      message += \'• Минимальный объем отладочной информации

\';
      message += \'💡 Для включения используйте:
\';
      message += \'   Меню → Режим разработчика → Включить\';
    }
    
    SpreadsheetApp.getUi().alert('Статус режима разработчика', message, SpreadsheetApp.getUi().ButtonSet.OK);
    
  } catch (error) {
    logError(\'Ошибка показа статуса режима разработчика: ' + error.message + '\', LOG_CONFIG.CATEGORIES.SYSTEM);
    SpreadsheetApp.getUi().alert('Ошибка', 'Не удалось получить статус режима разработчика', SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/**
 * Показывает лист с логами
 */
function showLogsSheet() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var logsSheet = ss.getSheetByName(CONFIG.SHEETS.LOGS);
    
    if (!logsSheet) {
      // Создаем лист логов если его нет
      logsSheet = ss.insertSheet(CONFIG.SHEETS.LOGS);
      logsSheet.getRange(1, 1, 1, 4).setValues([['Время', 'Уровень', 'Категория', 'Сообщение']]);
      
      logInfo('Создан новый лист логов', LOG_CONFIG.CATEGORIES.SYSTEM);
    }
    
    // Активируем лист логов
    ss.setActiveSheet(logsSheet);
    
    var rowCount = logsSheet.getLastRow();
    var message = \'📝 ЛИСТ ЛОГОВ АКТИВИРОВАН

\';
    message += \'📊 Всего записей: ' + rowCount > 1 ? rowCount - 1 : 0 + '
\';
    
    if (rowCount > 1) {
      message += \'📅 Последняя запись: ' + logsSheet.getRange(rowCount, 1).getValue() + '
\';
      message += \'
💡 Лист автоматически активирован - можете просмотреть все логи\';
    } else {
      message += \'
💡 Лист логов пуст. Записи будут появляться по мере работы системы.\';
    }
    
    // Если режим разработчика выключен, предлагаем включить
    if (!isDevMode()) {
      message += \'

⚠️ Режим разработчика ВЫКЛЮЧЕН
\';
      message += \'Для подробного логирования включите режим разработчика\';
    }
    
    SpreadsheetApp.getUi().alert('Лист логов', message, SpreadsheetApp.getUi().ButtonSet.OK);
    
    logInfo('Пользователь открыл лист логов', LOG_CONFIG.CATEGORIES.UI);
    
  } catch (error) {
    logError(\'Ошибка открытия листа логов: ' + error.message, LOG_CONFIG.CATEGORIES.SYSTEM);
    SpreadsheetApp.getUi().alert('Ошибка', 'Не удалось открыть лист логов', SpreadsheetApp.getUi().ButtonSet.OK);
  }
