/**
 * Ozon Full-Scan Session (multi-session checkpointing)
 * Пробегает до SESSION_MAX_PAGES страниц или 5.5 минут, сохраняет чекпоинт и выходит.
 */
function runOzonFullScanSession() {
  const stores = getActiveStores().filter(s => s.marketplace === 'Ozon');
  if (stores.length === 0) {
    log('⚠️ Нет активных Ozon магазинов для полного сканирования', 'WARN', 'FULLSCAN');
    return;
  }
  const ui = SpreadsheetApp.getUi();
  const storeNames = stores.map((s,i)=>`${i+1}. ${s.name}`).join('\n');
  const res = ui.prompt('ПОЛНЫЙ СБОР (Ozon): выберите магазин', storeNames + '\n\nВведите номер:', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  const idx = parseInt(res.getResponseText(),10)-1;
  if (isNaN(idx) || idx<0 || idx>=stores.length) { ui.alert('Неверный номер'); return; }
  const store = stores[idx];
  
  const SESSION_MAX_PAGES = 300;           // До 300 страниц за сессию
  const START_TS = Date.now();
  const HARD_LIMIT = 5.5 * 60 * 1000;      // 5.5 минут на сессию
  
  // Чекпоинты
  const props = PropertiesService.getScriptProperties();
  const keyActive = `ozon_fullscan_active_${store.id}`;
  const keyLastId = `ozon_fullscan_last_id_${store.id}`;
  const keyPages  = `ozon_fullscan_pages_scanned_${store.id}`;
  const keyTotal  = `ozon_fullscan_total_collected_${store.id}`;
  
  let active = props.getProperty(keyActive) === 'true';
  let lastId = props.getProperty(keyLastId) || '';
  let pagesScanned = parseInt(props.getProperty(keyPages) || '0', 10);
  let totalCollected = parseInt(props.getProperty(keyTotal) || '0', 10);
  
  if (!active) {
    active = true;
    lastId = '';
    pagesScanned = 0;
    totalCollected = 0;
    props.setProperty(keyActive, 'true');
    props.setProperty(keyLastId, lastId);
    props.setProperty(keyPages, pagesScanned.toString());
    props.setProperty(keyTotal, totalCollected.toString());
    log(`[${store.name}] 🔥 Старт полного сканирования базы Ozon`, 'INFO', 'FULLSCAN');
  } else {
    log(`[${store.name}] ▶️ Продолжение полного сканирования с last_id=${lastId ? lastId.substring(0,8)+'...' : 'empty'}`, 'INFO', 'FULLSCAN');
  }
  
  const collectedThisSession = [];
  let pagesThisSession = 0;
  
  while (pagesThisSession < SESSION_MAX_PAGES) {
    // Контроль времени
    const elapsed = Date.now() - START_TS;
    if (elapsed > HARD_LIMIT) {
      log(`[${store.name}] ⏰ Прерывание по времени: ${Math.round(elapsed/1000)} сек`, 'WARN', 'FULLSCAN');
      break;
    }
    
    // Запрос одной страницы
    const page = getOzonPageWithFullLogging(store, lastId);
    if (page.length === 0) {
      // База исчерпана
      props.setProperty(keyActive, 'false');
      log(`[${store.name}] ✅ Полный скан завершен. Всего страниц: ${pagesScanned}, всего отзывов: ${totalCollected}`, 'INFO', 'FULLSCAN');
      break;
    }
    
    // Обновляем чекпоинт lastId
    lastId = page[page.length - 1].id;
    pagesScanned += 1;
    pagesThisSession += 1;
    props.setProperty(keyLastId, lastId);
    props.setProperty(keyPages, pagesScanned.toString());
    
    // Фильтруем дубли через кеш и сохраняем только новые
    const newOnPage = filterDuplicatesByCache(page, store.id);
    if (newOnPage.length > 0) {
      batchSaveToSheet(newOnPage, store, CONFIG.STATUS.NEW);
      addToCache(newOnPage, store.id);
      totalCollected += newOnPage.length;
      props.setProperty(keyTotal, totalCollected.toString());
    }
    
    log(`[${store.name}] 📄 Стр.${pagesScanned}: получено ${page.length}, новых ${newOnPage.length}, lastId=${lastId.substring(0,8)}...`, 'INFO', 'FULLSCAN');
    
    Utilities.sleep(CONFIG.RATE_LIMITS.OZON);
  }
  
  // Итог по сессии
  const sessElapsed = Math.round((Date.now() - START_TS) / 1000);
  const stillActive = props.getProperty(keyActive) === 'true';
  if (stillActive) {
    log(`[${store.name}] ⏹ Сессия пол.скана завершена: +${pagesThisSession} стр за ${sessElapsed} сек. Всего: ${pagesScanned} стр, ${totalCollected} отзывов. Повторите запуск для продолжения.`, 'INFO', 'FULLSCAN');
    SpreadsheetApp.getUi().alert('Полный скан (сессия завершена)', `+${pagesThisSession} страниц за ${sessElapsed} сек.\nВсего: ${pagesScanned} стр, ${totalCollected} отзывов.\nПовторите запуск для продолжения.`);
  } else {
    SpreadsheetApp.getUi().alert('Полный скан завершен', `Всего страниц: ${pagesScanned}\nВсего отзывов: ${totalCollected}`);
  }
}
