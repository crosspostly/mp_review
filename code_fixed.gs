// ВРЕМЕННЫЙ ФАЙЛ ДЛЯ ИСПРАВЛЕНИЯ СИНТАКСИЧЕСКИХ ОШИБОК
// Правильная реализация функций для обработки магазинов

// ============ ADVANCED PROCESSING FUNCTIONS ============

/**
 * Обработка только магазинов Wildberries
 * Полезно когда нужно сфокусироваться на одной платформе
 */
function processWildberriesStores() {
  const devMode = isDevMode();
  log(`--- ЗАПУСК ОБРАБОТКИ WILDBERRIES (${devMode ? 'РЕЖИМ РАЗРАБОТЧИКА' : 'БОЕВОЙ РЕЖИМ'}) ---`);
  const wbStores = getStores().filter(s => s.isActive && s.marketplace === 'Wildberries');
  
  if (wbStores.length === 0) {
    log('Нет активных магазинов Wildberries для обработки.');
    return;
  }
  
  log(`Найдено ${wbStores.length} активных магазинов WB.`);
  processStoresWithTimeControl(wbStores, devMode);
}

/**
 * Обработка только магазинов Ozon
 * Полезно когда нужно сфокусироваться на одной платформе
 */
function processOzonStores() {
  const devMode = isDevMode();
  log(`--- ЗАПУСК ОБРАБОТКИ OZON (${devMode ? 'РЕЖИМ РАЗРАБОТЧИКА' : 'БОЕВОЙ РЕЖИМ'}) ---`);
  const ozonStores = getStores().filter(s => s.isActive && s.marketplace === 'Ozon');
  
  if (ozonStores.length === 0) {
    log('Нет активных магазинов Ozon для обработки.');
    return;
  }
  
  log(`Найдено ${ozonStores.length} активных магазинов Ozon.`);
  processStoresWithTimeControl(ozonStores, devMode);
}

/**
 * Универсальная функция обработки списка магазинов с контролем времени
 * @param {Array} stores - Список магазинов для обработки
 * @param {boolean} devMode - Режим разработчика
 */
function processStoresWithTimeControl(stores, devMode) {
  const maxExecutionTime = 5 * 60 * 1000; // 5 минут лимит
  const startTime = Date.now();
  let processedCount = 0;
  
  for (const store of stores) {
    const elapsedTime = Date.now() - startTime;
    const remainingTime = maxExecutionTime - elapsedTime;
    
    if (remainingTime < 30000) {
      log(`⏱️ ОСТАНОВКА: осталось ${Math.round(remainingTime/1000)} сек`);
      log(`📊 Успешно обработано: ${processedCount}/${stores.length} магазинов`);
      break;
    }
    
    log(`--- Обрабатываю: ${store.name} [${store.marketplace}] (${processedCount + 1}/${stores.length}) ---`);
    log(`⏱️ Времени осталось: ${Math.round(remainingTime/1000)} сек`);
    
    const storeStartTime = Date.now();
    processSingleStore(store, devMode);
    const storeDuration = Date.now() - storeStartTime;
    
    processedCount++;
    log(`--- Завершено: ${store.name} (${Math.round(storeDuration/1000)} сек) ---`);
  }
  
  const totalDuration = Date.now() - startTime;
  log(`--- ОБРАБОТКА ЗАВЕРШЕНА: ${processedCount}/${stores.length} магазинов за ${Math.round(totalDuration/1000)} сек ---`);
}