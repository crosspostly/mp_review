/**
 * 🧪 ФУНКЦИИ ТЕСТИРОВАНИЯ
 * 
 * Этот файл содержит функции для запуска тестов из меню Google Sheets
 */

// ======================================================================
// ========================== ТЕСТИРОВАНИЕ =============================
// ======================================================================

/**
 * 🧪 Запуск всех тестов
 */
function runAllTests() {
  try {
    log('[Tests] 🧪 Запуск комплексного тестирования...');
    
    // Включаем режим разработчика для подробных логов
    const wasDevMode = isDevMode();
    if (!wasDevMode) {
      enableDevMode();
    }
    
    // Запускаем тесты из tests.gs
    const results = runAllTests();
    
    // Восстанавливаем режим разработчика
    if (!wasDevMode) {
      disableDevMode();
    }
    
    const successRate = Math.round((results.passed / results.total) * 100);
    
    SpreadsheetApp.getUi().alert(
      '🧪 Результаты тестирования',
      `Всего тестов: ${results.total}\nПройдено: ${results.passed}\nПровалено: ${results.failed}\nПроцент успеха: ${successRate}%`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    
    log(`[Tests] ✅ Тестирование завершено: ${results.passed}/${results.total} тестов пройдено`);
    
  } catch (error) {
    log(`[Tests] ❌ Ошибка тестирования: ${error.message}`);
    SpreadsheetApp.getUi().alert(
      '❌ Ошибка тестирования',
      `Ошибка: ${error.message}`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}

/**
 * 🧪 Быстрые тесты критических функций
 */
function runQuickTests() {
  try {
    log('[Tests] ⚡ Запуск быстрых тестов...');
    
    // Включаем режим разработчика
    const wasDevMode = isDevMode();
    if (!wasDevMode) {
      enableDevMode();
    }
    
    // Запускаем быстрые тесты
    const success = runQuickTests();
    
    // Восстанавливаем режим разработчика
    if (!wasDevMode) {
      disableDevMode();
    }
    
    SpreadsheetApp.getUi().alert(
      '⚡ Быстрые тесты',
      success ? '✅ Все критические тесты пройдены!' : '❌ Некоторые тесты провалены. Проверьте логи.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    
    log(`[Tests] ${success ? '✅' : '❌'} Быстрые тесты завершены`);
    
  } catch (error) {
    log(`[Tests] ❌ Ошибка быстрых тестов: ${error.message}`);
    SpreadsheetApp.getUi().alert(
      '❌ Ошибка тестирования',
      `Ошибка: ${error.message}`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}

/**
 * 🧪 Тест производительности
 */
function runPerformanceTests() {
  try {
    log('[Tests] 📊 Запуск тестов производительности...');
    
    // Включаем режим разработчика
    const wasDevMode = isDevMode();
    if (!wasDevMode) {
      enableDevMode();
    }
    
    // Запускаем тесты производительности
    const success = runPerformanceTests();
    
    // Восстанавливаем режим разработчика
    if (!wasDevMode) {
      disableDevMode();
    }
    
    SpreadsheetApp.getUi().alert(
      '📊 Тесты производительности',
      success ? '✅ Тесты производительности завершены! Проверьте логи для деталей.' : '❌ Ошибка в тестах производительности.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    
    log(`[Tests] ${success ? '✅' : '❌'} Тесты производительности завершены`);
    
  } catch (error) {
    log(`[Tests] ❌ Ошибка тестов производительности: ${error.message}`);
    SpreadsheetApp.getUi().alert(
      '❌ Ошибка тестирования',
      `Ошибка: ${error.message}`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}