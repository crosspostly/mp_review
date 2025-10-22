/**
 * 🧪 ФУНКЦИИ ТЕСТИРОВАНИЯ ДЛЯ UI
 * 
 * Этот файл содержит функции, которые вызываются из меню Google Sheets
 * для запуска различных тестов системы.
 */

/**
 * 🚀 Запуск всех тестов из меню
 */
function runAllTests() {
  try {
    // Включаем режим разработчика для подробных логов
    enableDevMode();
    
    // Запускаем все тесты
    const results = runAllTests();
    
    // Показываем результат пользователю
    const successRate = Math.round((results.passed / results.total) * 100);
    const message = `🧪 РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ\n\n` +
                   `📊 Всего тестов: ${results.total}\n` +
                   `✅ Пройдено: ${results.passed}\n` +
                   `❌ Провалено: ${results.failed}\n` +
                   `📈 Процент успеха: ${successRate}%\n\n` +
                   `Подробные логи смотрите в консоли Google Apps Script.`;
    
    SpreadsheetApp.getUi().alert('Результаты тестирования', message, SpreadsheetApp.getUi().ButtonSet.OK);
    
    return results;
    
  } catch (error) {
    const errorMessage = `❌ Ошибка запуска тестов:\n\n${error.message}\n\n` +
                        `Проверьте консоль Google Apps Script для подробностей.`;
    
    SpreadsheetApp.getUi().alert('Ошибка тестирования', errorMessage, SpreadsheetApp.getUi().ButtonSet.OK);
    
    logError(`Ошибка запуска всех тестов: ${error.message}`, 'UI-TEST');
    return null;
  }
}

/**
 * 🧪 Запуск быстрых тестов из меню
 */
function runQuickTests() {
  try {
    // Включаем режим разработчика для подробных логов
    enableDevMode();
    
    // Запускаем быстрые тесты
    const success = runQuickTests();
    
    // Показываем результат пользователю
    const message = success ? 
      '✅ Быстрые тесты пройдены успешно!\n\nВсе критические функции работают корректно.' :
      '❌ Быстрые тесты провалены!\n\nПроверьте консоль Google Apps Script для подробностей.';
    
    const title = success ? 'Тесты пройдены' : 'Тесты провалены';
    
    SpreadsheetApp.getUi().alert(title, message, SpreadsheetApp.getUi().ButtonSet.OK);
    
    return success;
    
  } catch (error) {
    const errorMessage = `❌ Ошибка запуска быстрых тестов:\n\n${error.message}\n\n` +
                        `Проверьте консоль Google Apps Script для подробностей.`;
    
    SpreadsheetApp.getUi().alert('Ошибка тестирования', errorMessage, SpreadsheetApp.getUi().ButtonSet.OK);
    
    logError(`Ошибка запуска быстрых тестов: ${error.message}`, 'UI-TEST');
    return false;
  }
}

/**
 * 📊 Запуск тестов производительности из меню
 */
function runPerformanceTests() {
  try {
    // Включаем режим разработчика для подробных логов
    enableDevMode();
    
    // Запускаем тесты производительности
    const success = runPerformanceTests();
    
    // Показываем результат пользователю
    const message = success ? 
      '✅ Тесты производительности пройдены!\n\nСистема работает с оптимальной скоростью.' :
      '⚠️ Проблемы с производительностью!\n\nПроверьте консоль Google Apps Script для подробностей.';
    
    const title = success ? 'Производительность OK' : 'Проблемы с производительностью';
    
    SpreadsheetApp.getUi().alert(title, message, SpreadsheetApp.getUi().ButtonSet.OK);
    
    return success;
    
  } catch (error) {
    const errorMessage = `❌ Ошибка запуска тестов производительности:\n\n${error.message}\n\n` +
                        `Проверьте консоль Google Apps Script для подробностей.`;
    
    SpreadsheetApp.getUi().alert('Ошибка тестирования', errorMessage, SpreadsheetApp.getUi().ButtonSet.OK);
    
    logError(`Ошибка запуска тестов производительности: ${error.message}`, 'UI-TEST');
    return false;
  }
}

/**
 * 🔧 Запуск тестов API из меню
 */
function runApiTests() {
  try {
    // Включаем режим разработчика для подробных логов
    enableDevMode();
    
    // Запускаем тесты API
    const wbSuccess = testWbApiFunctions();
    const ozonSuccess = testOzonApiFunctions();
    
    const allSuccess = wbSuccess && ozonSuccess;
    
    // Показываем результат пользователю
    const message = `🔌 РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ API\n\n` +
                   `🛒 Wildberries API: ${wbSuccess ? '✅ OK' : '❌ Ошибка'}\n` +
                   `📦 Ozon API: ${ozonSuccess ? '✅ OK' : '❌ Ошибка'}\n\n` +
                   `Общий результат: ${allSuccess ? '✅ Все API работают' : '❌ Есть проблемы с API'}\n\n` +
                   `Подробные логи смотрите в консоли Google Apps Script.`;
    
    const title = allSuccess ? 'API тесты пройдены' : 'Проблемы с API';
    
    SpreadsheetApp.getUi().alert(title, message, SpreadsheetApp.getUi().ButtonSet.OK);
    
    return allSuccess;
    
  } catch (error) {
    const errorMessage = `❌ Ошибка запуска тестов API:\n\n${error.message}\n\n` +
                        `Проверьте консоль Google Apps Script для подробностей.`;
    
    SpreadsheetApp.getUi().alert('Ошибка тестирования', errorMessage, SpreadsheetApp.getUi().ButtonSet.OK);
    
    logError(`Ошибка запуска тестов API: ${error.message}`, 'UI-TEST');
    return false;
  }
}

/**
 * 🔒 Запуск тестов безопасности из меню
 */
function runSecurityTests() {
  try {
    // Включаем режим разработчика для подробных логов
    enableDevMode();
    
    // Запускаем тесты безопасности
    const success = testSecurity();
    
    // Показываем результат пользователю
    const message = success ? 
      '✅ Тесты безопасности пройдены!\n\nВсе проверки безопасности выполнены успешно.' :
      '❌ Проблемы с безопасностью!\n\nПроверьте консоль Google Apps Script для подробностей.';
    
    const title = success ? 'Безопасность OK' : 'Проблемы с безопасностью';
    
    SpreadsheetApp.getUi().alert(title, message, SpreadsheetApp.getUi().ButtonSet.OK);
    
    return success;
    
  } catch (error) {
    const errorMessage = `❌ Ошибка запуска тестов безопасности:\n\n${error.message}\n\n` +
                        `Проверьте консоль Google Apps Script для подробностей.`;
    
    SpreadsheetApp.getUi().alert('Ошибка тестирования', errorMessage, SpreadsheetApp.getUi().ButtonSet.OK);
    
    logError(`Ошибка запуска тестов безопасности: ${error.message}`, 'UI-TEST');
    return false;
  }
}

/**
 * 🔗 Запуск интеграционных тестов из меню
 */
function runIntegrationTests() {
  try {
    // Включаем режим разработчика для подробных логов
    enableDevMode();
    
    // Запускаем интеграционные тесты
    const fullStoreSuccess = testFullStoreProcessing();
    const progressSuccess = testProgressSystem();
    
    const allSuccess = fullStoreSuccess && progressSuccess;
    
    // Показываем результат пользователю
    const message = `🔗 РЕЗУЛЬТАТЫ ИНТЕГРАЦИОННЫХ ТЕСТОВ\n\n` +
                   `🏪 Полная обработка магазина: ${fullStoreSuccess ? '✅ OK' : '❌ Ошибка'}\n` +
                   `📊 Система прогресса: ${progressSuccess ? '✅ OK' : '❌ Ошибка'}\n\n` +
                   `Общий результат: ${allSuccess ? '✅ Все интеграционные тесты пройдены' : '❌ Есть проблемы с интеграцией'}\n\n` +
                   `Подробные логи смотрите в консоли Google Apps Script.`;
    
    const title = allSuccess ? 'Интеграционные тесты пройдены' : 'Проблемы с интеграцией';
    
    SpreadsheetApp.getUi().alert(title, message, SpreadsheetApp.getUi().ButtonSet.OK);
    
    return allSuccess;
    
  } catch (error) {
    const errorMessage = `❌ Ошибка запуска интеграционных тестов:\n\n${error.message}\n\n` +
                        `Проверьте консоль Google Apps Script для подробностей.`;
    
    SpreadsheetApp.getUi().alert('Ошибка тестирования', errorMessage, SpreadsheetApp.getUi().ButtonSet.OK);
    
    logError(`Ошибка запуска интеграционных тестов: ${error.message}`, 'UI-TEST');
    return false;
  }
}

/**
 * 📋 Показать статус системы из меню
 */
function showSystemStatus() {
  try {
    // Получаем информацию о системе
    const stores = getStores();
    const activeStores = stores.filter(store => store.isActive);
    const triggers = ScriptApp.getProjectTriggers();
    
    // Получаем статистику логов
    const logSheet = getLogSheet();
    let logCount = 0;
    if (logSheet) {
      logCount = logSheet.getLastRow() - 1; // -1 для заголовка
    }
    
    // Показываем статус пользователю
    const message = `📊 СТАТУС СИСТЕМЫ\n\n` +
                   `🏪 Всего магазинов: ${stores.length}\n` +
                   `✅ Активных магазинов: ${activeStores.length}\n` +
                   `⏰ Активных триггеров: ${triggers.length}\n` +
                   `📝 Записей в логе: ${logCount}\n\n` +
                   `🔄 Последняя проверка: ${new Date().toLocaleString()}\n\n` +
                   `Для подробной диагностики запустите полные тесты.`;
    
    SpreadsheetApp.getUi().alert('Статус системы', message, SpreadsheetApp.getUi().ButtonSet.OK);
    
    return {
      totalStores: stores.length,
      activeStores: activeStores.length,
      triggers: triggers.length,
      logCount: logCount
    };
    
  } catch (error) {
    const errorMessage = `❌ Ошибка получения статуса системы:\n\n${error.message}\n\n` +
                        `Проверьте консоль Google Apps Script для подробностей.`;
    
    SpreadsheetApp.getUi().alert('Ошибка', errorMessage, SpreadsheetApp.getUi().ButtonSet.OK);
    
    logError(`Ошибка получения статуса системы: ${error.message}`, 'UI-STATUS');
    return null;
  }
}

/**
 * 🧹 Очистка логов из меню
 */
function clearLogs() {
  try {
    const ui = SpreadsheetApp.getUi();
    
    // Спрашиваем подтверждение
    const response = ui.alert(
      'Очистка логов',
      'Вы уверены, что хотите очистить все логи?\n\nЭто действие нельзя отменить!',
      ui.ButtonSet.YES_NO
    );
    
    if (response === ui.Button.YES) {
      // Очищаем лог-лист
      const logSheet = getLogSheet();
      if (logSheet) {
        const lastRow = logSheet.getLastRow();
        if (lastRow > 1) {
          logSheet.getRange(2, 1, lastRow - 1, logSheet.getLastColumn()).clear();
        }
      }
      
      ui.alert('Логи очищены', 'Все логи успешно очищены.', ui.ButtonSet.OK);
      logSuccess('Логи очищены пользователем', 'UI-CLEANUP');
      
    } else {
      ui.alert('Отменено', 'Очистка логов отменена.', ui.ButtonSet.OK);
    }
    
  } catch (error) {
    const errorMessage = `❌ Ошибка очистки логов:\n\n${error.message}\n\n` +
                        `Проверьте консоль Google Apps Script для подробностей.`;
    
    SpreadsheetApp.getUi().alert('Ошибка', errorMessage, SpreadsheetApp.getUi().ButtonSet.OK);
    
    logError(`Ошибка очистки логов: ${error.message}`, 'UI-CLEANUP');
  }
}

/**
 * 🔧 Диагностика системы из меню
 */
function runSystemDiagnostics() {
  try {
    // Включаем режим разработчика для подробных логов
    enableDevMode();
    
    // Запускаем диагностику
    const results = {
      stores: testStoreManagement(),
      triggers: testTriggerSystem(),
      data: testDataProcessing(),
      api: testWbApiFunctions() && testOzonApiFunctions()
    };
    
    const allSuccess = Object.values(results).every(Boolean);
    
    // Показываем результат пользователю
    const message = `🔧 РЕЗУЛЬТАТЫ ДИАГНОСТИКИ СИСТЕМЫ\n\n` +
                   `🏪 Управление магазинами: ${results.stores ? '✅ OK' : '❌ Ошибка'}\n` +
                   `⏰ Система триггеров: ${results.triggers ? '✅ OK' : '❌ Ошибка'}\n` +
                   `📊 Обработка данных: ${results.data ? '✅ OK' : '❌ Ошибка'}\n` +
                   `🔌 API интеграции: ${results.api ? '✅ OK' : '❌ Ошибка'}\n\n` +
                   `Общий результат: ${allSuccess ? '✅ Система работает корректно' : '❌ Обнаружены проблемы'}\n\n` +
                   `Подробные логи смотрите в консоли Google Apps Script.`;
    
    const title = allSuccess ? 'Диагностика пройдена' : 'Обнаружены проблемы';
    
    SpreadsheetApp.getUi().alert(title, message, SpreadsheetApp.getUi().ButtonSet.OK);
    
    return results;
    
  } catch (error) {
    const errorMessage = `❌ Ошибка диагностики системы:\n\n${error.message}\n\n` +
                        `Проверьте консоль Google Apps Script для подробностей.`;
    
    SpreadsheetApp.getUi().alert('Ошибка диагностики', errorMessage, SpreadsheetApp.getUi().ButtonSet.OK);
    
    logError(`Ошибка диагностики системы: ${error.message}`, 'UI-DIAGNOSTICS');
    return null;
  }
}