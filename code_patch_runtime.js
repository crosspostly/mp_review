/* BIG COMMIT: 1h triggers, Ozon stripe=10, store rotation, fullscan menu */

function setupRealisticTriggers(){
  try{
    deleteAllTriggers();
    // 1) Сбор каждые 1 час
    ScriptApp.newTrigger('runIncrementalCollection').timeBased().everyHours(1).create();
    // 2) Подбор каждые 1 час
    ScriptApp.newTrigger('runAnswerSelection').timeBased().everyHours(1).create();
    // 3) Отправка каждые 1 час
    ScriptApp.newTrigger('runAnswerSending').timeBased().everyHours(1).create();
  }catch(e){
    log(`❌ Ошибка установки триггеров: ${e.message}`, 'ERROR', 'TRIGGER');
  }
}

// Конфиг: снизили полоски для Ozon
CONFIG.OZON = Object.assign({}, CONFIG.OZON || {}, {
  PAGES_PER_STRIPE: 10,
  MAX_STRIPES: 4
});

// Круговой оффсет магазинов
function getLastStoreIndex(){
  const k = 'last_store_index';
  const v = PropertiesService.getScriptProperties().getProperty(k);
  return v ? parseInt(v,10) : 0;
}
function setLastStoreIndex(i){
  PropertiesService.getScriptProperties().setProperty('last_store_index', String(i));
}
function rotateStores(stores, offset){
  if(!stores || stores.length===0) return stores;
  const k = ((offset % stores.length) + stores.length) % stores.length;
  return stores.slice(k).concat(stores.slice(0,k));
}

// Обновленная версия инкрементального сборщика
function runIncrementalCollection(){
  const start = Date.now();
  const HARD_LIMIT = CONFIG.MAX_EXECUTION_TIME_MS || (5.5*60*1000);
  const storesAll = getActiveStores();
  if(storesAll.length===0){ log('⚠️ Нет активных магазинов','WARN','TRIGGER'); return; }

  const lastIndex = getLastStoreIndex();
  const stores = rotateStores(storesAll, lastIndex);
  let processed = 0;

  for(const store of stores){
    const elapsed = Date.now()-start;
    if(HARD_LIMIT - elapsed < 60000){
      // < 60 сек — сохраняем смещение и выходим
      const newIndex = (lastIndex + processed) % storesAll.length;
      setLastStoreIndex(newIndex);
      log(`⏰ Стоп: осталось <60с. Смещение магазина сохранено: ${newIndex}`,'WARN','TRIGGER');
      return;
    }

    try{
      if(store.marketplace==='Ozon'){
        const stripeCnt = CONFIG.OZON.PAGES_PER_STRIPE || 10;
        const _ = collectOzonReviewsByStripe(store, stripeCnt);
      } else if(store.marketplace==='Wildberries'){
        const _ = collectWBReviewsLast24h(store);
      }
    }catch(err){
      log(`[${store.name}] ❌ Ошибка инкрементального сбора: ${err.message}`,'ERROR','TRIGGER');
    }

    processed++;
  }

  // Все магазины обработаны — сдвигаем старт на +1 для равномерности
  const newIndex = (lastIndex + 1) % storesAll.length;
  setLastStoreIndex(newIndex);
  log(`✅ Все магазины обработаны. Следующий старт с индекса: ${newIndex}`,'INFO','TRIGGER');
}

// Пункт меню для полного скана Ozon по магазину (много-сессионный)
function onOpen(){
  try{
    const ui = SpreadsheetApp.getUi();
    const m = ui.createMenu('🤖 Автоответы');
    m.addItem('⚙️ Первоначальная настройка','initialSetup');
    m.addItem('🧭 Полный сбор Ozon (сессия)','runOzonFullScanSession');
    m.addSeparator();
    m.addItem('🔄 Установить триггеры (1 час)','setupRealisticTriggers');
    m.addToUi();
  }catch(e){
    log(`onOpen error: ${e.message}`,'ERROR','SYSTEM');
  }
}
