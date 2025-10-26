/**
 * MERGED Code.gs — финальная интеграция:
 * - Часовые триггеры (сбор/подбор/отправка)
 * - Ozon stripes=10, rotation по магазинам, fullscan (много-сессионный)
 * - Кеш Properties (ID/полосы/оффсет), детальное логирование
 */

// ===================== CONFIG =====================
const CONFIG = {
  STATUS: { NEW: 'NEW', PENDING_SEND: 'PENDING_SEND', SENT: 'SENT', ERROR: 'ERROR' },
  RESPOND_TO_RATINGS: [4, 5],
  MAX_REVIEWS_PER_RUN: 50,
  MAX_EXECUTION_TIME_MS: 5.5 * 60 * 1000,
  RATE_LIMITS: { OZON: 1000, WB: 1100 },
  OZON: { PAGES_PER_STRIPE: 10, MAX_STRIPES: 4, API_URL: 'https://api-seller.ozon.ru/v1/review/list', COMMENT_URL: 'https://api-seller.ozon.ru/v1/review/comment/create' },
  WB: { HOURS_BACK: 24, MAX_TAKE: 5000, API_URL: 'https://feedbacks-api.wildberries.ru/api/v1/feedbacks', ANSWER_URL: 'https://feedbacks-api.wildberries.ru/api/v1/feedbacks' },
  SHEETS: { TEMPLATES: 'Шаблоны ответов', STORES: 'Магазины', LOGS: 'Логи системы' },
  REVIEW_HEADERS: ['№','ID отзыва','Дата','Рейтинг','Текст отзыва','Товар','Подобранный ответ','Статус','Ошибка','Время отправки']
};

// ===================== MENU =====================
function onOpen(){
  try{
    const ui = SpreadsheetApp.getUi();
    const m = ui.createMenu('🤖 Автоответы v2.0');
    m.addItem('⚙️ Первоначальная настройка','initialSetup');
    m.addItem('🧭 Полный сбор Ozon (сессия)','runOzonFullScanSession');
    m.addSeparator();
    m.addItem('🔄 Установить триггеры (1 час)','setupRealisticTriggers');
    m.addItem('⚡ Инкрементальный сбор СЕЙЧАС','runIncrementalCollection');
    m.addItem('🎯 Подбор ответов СЕЙЧАС','runAnswerSelection');
    m.addItem('📤 Отправить ответы СЕЙЧАС','runAnswerSending');
    m.addToUi();
  }catch(e){ log(`onOpen error: ${e.message}`,'ERROR','SYSTEM'); }
}

// ===================== LOG =====================
function log(message, level='INFO', category='SYSTEM'){
  try{
    const ts = new Date().toLocaleString('ru-RU',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'});
    console.log(`[${level}] [${category}] ${message}`);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(CONFIG.SHEETS.LOGS) || ss.insertSheet(CONFIG.SHEETS.LOGS);
    if(sh.getLastRow()===0){ sh.appendRow(['Время','Уровень','Сообщение','Категория']); }
    sh.appendRow([ts, level, message, category]);
    const last = sh.getLastRow(); if(last>1200){ sh.deleteRows(2, last-1200); }
  }catch(_){ /* ignore */ }
}

// ===================== INITIAL SETUP =====================
function initialSetup(){
  createSheet(CONFIG.SHEETS.TEMPLATES, ['Шаблон ответа','Для рейтинга']);
  createSheet(CONFIG.SHEETS.STORES, ['ID','Название','Маркетплейс','Client ID','API Key','Активен']);
  createSheet(CONFIG.SHEETS.LOGS, ['Время','Уровень','Сообщение','Категория']);
  fillExampleTemplates();
  SpreadsheetApp.getUi().alert('✅ Настройка завершена');
}

// ===================== STORES =====================
function getActiveStores(){
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.STORES);
  if(!sh || sh.getLastRow()<2) return [];
  const rows = sh.getRange(2,1,sh.getLastRow()-1,6).getValues();
  return rows.filter(r=>r[0] && r[1] && r[2] && r[4] && r[5]===true).map((r,i)=>({
    id: String(r[0]), name: String(r[1]), marketplace: String(r[2]),
    credentials: { clientId: r[3]?String(r[3]):'', apiKey: String(r[4]) }, rowIndex: i+2
  }));
}

// ===================== CACHE & ROTATION =====================
function filterDuplicatesByCache(reviews, storeId){
  if(!reviews||reviews.length===0) return [];
  const key = `reviewIds_${storeId}`; const props = PropertiesService.getScriptProperties();
  const arr = JSON.parse(props.getProperty(key)||'[]'); const set = new Set(arr);
  const fresh = reviews.filter(r=>!set.has(r.id));
  log(`[${storeId}] 🔍 всего ${reviews.length}, новых ${fresh.length} (кеш=${arr.length})`,'INFO','CACHE');
  return fresh;
}
function addToCache(newReviews, storeId){
  if(!newReviews||newReviews.length===0) return;
  const key = `reviewIds_${storeId}`; const props = PropertiesService.getScriptProperties();
  const arr = JSON.parse(props.getProperty(key)||'[]');
  const plus = newReviews.map(r=>r.id);
  const merged = arr.concat(plus);
  if(merged.length>10000){ merged.splice(0, merged.length-10000); }
  props.setProperty(key, JSON.stringify(merged));
}
function getStripePosition(storeId){ const k=`stripe_position_${storeId}`; const v=PropertiesService.getScriptProperties().getProperty(k); return v?parseInt(v,10):0; }
function setStripePosition(storeId,pos){ PropertiesService.getScriptProperties().setProperty(`stripe_position_${storeId}`, String(pos)); }
function getStripeLastId(storeId, stripe){ return PropertiesService.getScriptProperties().getProperty(`stripe_lastid_${storeId}_${stripe}`)||''; }
function saveStripeLastId(storeId, stripe, lastId){ PropertiesService.getScriptProperties().setProperty(`stripe_lastid_${storeId}_${stripe}`, lastId); }
function getLastStoreIndex(){ const v=PropertiesService.getScriptProperties().getProperty('last_store_index'); return v?parseInt(v,10):0; }
function setLastStoreIndex(i){ PropertiesService.getScriptProperties().setProperty('last_store_index', String(i)); }
function rotateStores(stores, offset){ if(!stores||stores.length===0) return stores; const k=((offset%stores.length)+stores.length)%stores.length; return stores.slice(k).concat(stores.slice(0,k)); }

// ===================== TRIGGERS (1 HOUR) =====================
function setupRealisticTriggers(){
  try{
    deleteAllTriggers();
    ScriptApp.newTrigger('runIncrementalCollection').timeBased().everyHours(1).create();
    ScriptApp.newTrigger('runAnswerSelection').timeBased().everyHours(1).create();
    ScriptApp.newTrigger('runAnswerSending').timeBased().everyHours(1).create();
    SpreadsheetApp.getUi().alert('✅ Триггеры установлены на 1 час');
  }catch(e){ log(`❌ Ошибка установки триггеров: ${e.message}`,'ERROR','TRIGGER'); }
}
function deleteAllTriggers(){ ScriptApp.getProjectTriggers().forEach(t=>ScriptApp.deleteTrigger(t)); }

// ===================== INCREMENTAL COLLECTION =====================
function runIncrementalCollection(){
  const start=Date.now(); const LIMIT=CONFIG.MAX_EXECUTION_TIME_MS; const storesAll=getActiveStores(); if(storesAll.length===0){ log('⚠️ Нет активных магазинов','WARN','TRIGGER'); return; }
  const lastIndex=getLastStoreIndex(); const stores=rotateStores(storesAll, lastIndex); let processed=0;
  for(const store of stores){
    if(LIMIT-(Date.now()-start)<60000){ setLastStoreIndex((lastIndex+processed)%storesAll.length); log('⏰ Стоп: осталось <60с, продолжим в след. запуск','WARN','TRIGGER'); return; }
    try{
      if(store.marketplace==='Ozon'){ collectOzonReviewsByStripe(store, CONFIG.OZON.PAGES_PER_STRIPE); }
      else if(store.marketplace==='Wildberries'){ collectWBReviewsLast24h(store); }
    }catch(err){ log(`[${store.name}] ❌ Ошибка инкрементального сбора: ${err.message}`,'ERROR','TRIGGER'); }
    processed++;
  }
  setLastStoreIndex((lastIndex+1)%storesAll.length);
  log('✅ Все магазины обработаны (инкрементально)','INFO','TRIGGER');
}

// ===================== OZON =====================
function getOzonPageWithFullLogging(store, lastId){
  const payload={ filter:{ has_text:true, has_answer:false, status:['PENDING','MODERATED','NEW'] }, sort:{ type:'CREATED_AT', order:'DESC' }, limit:100, last_id:lastId };
  try{
    const res=UrlFetchApp.fetch(CONFIG.OZON.API_URL,{ method:'POST', headers:{'Client-Id':store.credentials.clientId,'Api-Key':store.credentials.apiKey,'Content-Type':'application/json'}, payload:JSON.stringify(payload), muteHttpExceptions:true });
    const code=res.getResponseCode(); const body=res.getContentText();
    if(code!==200){ log(`[${store.name}] ❌ OZON HTTP ${code}: ${body.substring(0,300)}`,'ERROR','OZON'); return []; }
    const json=JSON.parse(body); const reviews=(json.reviews && Array.isArray(json.reviews))?json.reviews:(json.result&&Array.isArray(json.result.reviews)?json.result.reviews:[]);
    return reviews.map(r=>({ id:r.id, createdDate:r.created_date||r.published_at||new Date().toISOString(), rating:r.score||r.rating||0, text:r.text||'', hasAnswer:r.has_answer||false, product:{ name:r.product_name||'Не указано', id:r.sku||r.offer_id||'' } }));
  }catch(e){ log(`[${store.name}] ❌ Ozon page error: ${e.message}`,'ERROR','OZON'); return []; }
}
function collectOzonReviewsByStripe(store, pagesPerStripe){
  const stripe=getStripePosition(store.id); let lastId=getStripeLastId(store.id, stripe); let got=0; const start=Date.now();
  log(`[${store.name}] 📍 Полоска ${stripe}, pages=${pagesPerStripe}, lastId=${lastId?lastId.substring(0,8)+'...':'empty'}`,'INFO','OZON');
  while(got<pagesPerStripe){
    if(CONFIG.MAX_EXECUTION_TIME_MS-(Date.now()-start)<45000){ log(`[${store.name}] ⏰ стоп по времени внутри полоски`,'WARN','OZON'); break; }
    const page=getOzonPageWithFullLogging(store,lastId); if(page.length===0) break;
    lastId=page[page.length-1].id; const fresh=filterDuplicatesByCache(page, store.id); if(fresh.length){ batchSaveToSheet(fresh, store, CONFIG.STATUS.NEW); addToCache(fresh, store.id); }
    got++; Utilities.sleep(CONFIG.RATE_LIMITS.OZON);
  }
  saveStripeLastId(store.id, stripe, lastId);
  setStripePosition(store.id, (stripe+1)%CONFIG.OZON.MAX_STRIPES);
  log(`[${store.name}] ✅ Полоска ${stripe} завершена: страниц=${got}`,'INFO','OZON');
}

// ===================== WB =====================
function collectWBReviewsLast24h(store){
  try{
    const from=new Date(); from.setHours(from.getHours()-CONFIG.WB.HOURS_BACK); const fromUnix=Math.floor(from.getTime()/1000);
    const url=`${CONFIG.WB.API_URL}?isAnswered=false&take=${CONFIG.WB.MAX_TAKE}&skip=0&dateFrom=${fromUnix}&order=dateDesc`;
    const res=UrlFetchApp.fetch(url,{method:'GET',headers:{'Authorization':store.credentials.apiKey},muteHttpExceptions:true}); const code=res.getResponseCode(); const body=res.getContentText();
    if(code!==200){ log(`[${store.name}] ❌ WB HTTP ${code}: ${body.substring(0,200)}`,'ERROR','WB'); return []; }
    const json=JSON.parse(body); const fbs=json.data?.feedbacks||[];
    const items=fbs.filter(f=>f.text&&f.text.trim()).map(f=>({ id:f.id, createdDate:f.createdDate, rating:f.rating||f.productValuation||0, text:f.text, hasAnswer:!!(f.answer&&f.answer.text), product:{ name:f.productDetails?.productName||'Не указано', id:f.productDetails?.nmId||'' } }));
    const fresh=filterDuplicatesByCache(items, store.id); if(fresh.length){ batchSaveToSheet(fresh, store, CONFIG.STATUS.NEW); addToCache(fresh, store.id); }
    log(`[${store.name}] ✅ WB 24h: новых=${fresh.length}`,'INFO','WB'); return fresh;
  }catch(e){ log(`[${store.name}] ❌ WB error: ${e.message}`,'ERROR','WB'); return []; }
}

// ===================== FULL SCAN (SESSION PER STORE) =====================
function runOzonFullScanSession(){
  const stores=getActiveStores().filter(s=>s.marketplace==='Ozon'); if(stores.length===0){ SpreadsheetApp.getUi().alert('Нет активных Ozon магазинов'); return; }
  const ui=SpreadsheetApp.getUi(); const names=stores.map((s,i)=>`${i+1}. ${s.name}`).join('\n'); const ans=ui.prompt('Полный сбор Ozon (сессия)','Выберите номер магазина:\n\n'+names,ui.ButtonSet.OK_CANCEL); if(ans.getSelectedButton()!==ui.Button.OK) return; const idx=parseInt(ans.getResponseText(),10)-1; if(isNaN(idx)||idx<0||idx>=stores.length){ ui.alert('Неверный номер'); return; }
  const store=stores[idx];
  const SESSION_MAX_PAGES=300; const START=Date.now(); const LIMIT=CONFIG.MAX_EXECUTION_TIME_MS; const props=PropertiesService.getScriptProperties();
  const kA=`ozon_fullscan_active_${store.id}`, kL=`ozon_fullscan_last_id_${store.id}`, kP=`ozon_fullscan_pages_scanned_${store.id}`, kT=`ozon_fullscan_total_collected_${store.id}`;
  let active=props.getProperty(kA)==='true'; let lastId=props.getProperty(kL)||''; let pages=parseInt(props.getProperty(kP)||'0',10); let total=parseInt(props.getProperty(kT)||'0',10);
  if(!active){ active=true; lastId=''; pages=0; total=0; props.setProperty(kA,'true'); props.setProperty(kL,lastId); props.setProperty(kP,String(pages)); props.setProperty(kT,String(total)); log(`[${store.name}] 🔥 Старт полного скана`,'INFO','FULLSCAN'); } else { log(`[${store.name}] ▶️ Продолжение с lastId=${lastId?lastId.substring(0,8)+'...':'empty'}`,'INFO','FULLSCAN'); }
  let done=0; while(done<SESSION_MAX_PAGES){ if(LIMIT-(Date.now()-START)<45000){ log(`[${store.name}] ⏰ стоп по времени (сессия)`,'WARN','FULLSCAN'); break; }
    const page=getOzonPageWithFullLogging(store,lastId); if(page.length===0){ props.setProperty(kA,'false'); ui.alert('Полный скан завершен',`Всего стр: ${pages}, отзывов: ${total}`); log(`[${store.name}] ✅ Полный скан завершен`, 'INFO','FULLSCAN'); return; }
    lastId=page[page.length-1].id; const fresh=filterDuplicatesByCache(page, store.id); if(fresh.length){ batchSaveToSheet(fresh, store, CONFIG.STATUS.NEW); addToCache(fresh, store.id); total+=fresh.length; props.setProperty(kT,String(total)); }
    pages+=1; done+=1; props.setProperty(kL,lastId); props.setProperty(kP,String(pages)); Utilities.sleep(CONFIG.RATE_LIMITS.OZON);
  }
  ui.alert('Сессия завершена',`+${done} стр, всего: ${pages} стр, ${total} отзывов. Запустите снова для продолжения.`);
}

// ===================== SELECTION =====================
function runAnswerSelection(){ const start=Date.now(); const LIMIT=CONFIG.MAX_EXECUTION_TIME_MS; const stores=getActiveStores(); const templates=getTemplates(); if(templates.length===0) return; for(const s of stores){ if(LIMIT-(Date.now()-start)<45000) return; try{ const n=processNewReviewsForStore(s,templates); if(n) log(`[${s.name}] 🎯 подготовлено ${n}`,'INFO','SELECT'); }catch(e){ log(`[${s.name}] ❌ selection: ${e.message}`,'ERROR','SELECT'); } } }
function processNewReviewsForStore(store, templates){ const shN=`Отзывы_${store.name.replace(/[^а-яА-Яa-zA-Z0-9]/g,'_')}`; const sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(shN); if(!sh||sh.getLastRow()<2) return 0; const data=sh.getDataRange().getValues(); const h=data[0]; const iStatus=h.indexOf('Статус'), iRating=h.indexOf('Рейтинг'), iAnswer=h.indexOf('Подобранный ответ'); let cnt=0; for(let r=1;r<data.length && cnt<CONFIG.MAX_REVIEWS_PER_RUN;r++){ const st=data[r][iStatus], rating=data[r][iRating]; if(st!==CONFIG.STATUS.NEW) continue; if(!CONFIG.RESPOND_TO_RATINGS.includes(rating)){ sh.getRange(r+1,iStatus+1).setValue(CONFIG.STATUS.ERROR); sh.getRange(r+1,iAnswer+1).setValue(`Рейтинг ${rating} не для ответа`); continue; } const tmpl=selectTemplate(templates, rating); if(!tmpl){ sh.getRange(r+1,iStatus+1).setValue(CONFIG.STATUS.ERROR); sh.getRange(r+1,iAnswer+1).setValue(`Нет шаблона для ${rating}`); continue; } sh.getRange(r+1,iAnswer+1).setValue(tmpl); sh.getRange(r+1,iStatus+1).setValue(CONFIG.STATUS.PENDING_SEND); cnt++; } return cnt; }
function getTemplates(){ const sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.TEMPLATES); if(!sh||sh.getLastRow()<2) return []; return sh.getRange(2,1,sh.getLastRow()-1,2).getValues().filter(r=>r[0]&&r[1]).map(r=>({text:String(r[0]).trim(), rating:String(r[1]).trim()})); }
function selectTemplate(templates, rating){ const suit=templates.filter(t=> t.rating.includes('-')? (rating>=parseInt(t.rating.split('-')[0]) && rating<=parseInt(t.rating.split('-')[1])) : parseInt(t.rating)===rating ); if(!suit.length) return null; return suit[Math.floor(Math.random()*suit.length)].text; }

// ===================== SENDING =====================
function runAnswerSending(){ const start=Date.now(); const LIMIT=CONFIG.MAX_EXECUTION_TIME_MS; const stores=getActiveStores(); for(const s of stores){ if(LIMIT-(Date.now()-start)<45000) return; try{ const r=sendPendingAnswersForStore(s); if(r.sent>0) log(`[${s.name}] 📤 ${r.success}/${r.sent}`,'INFO','SEND'); }catch(e){ log(`[${s.name}] ❌ send: ${e.message}`,'ERROR','SEND'); } } }
function sendPendingAnswersForStore(store){ const shN=`Отзывы_${store.name.replace(/[^а-яА-Яa-zA-Z0-9]/g,'_')}`; const sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(shN); if(!sh||sh.getLastRow()<2) return {sent:0,success:0}; const d=sh.getDataRange().getValues(); const h=d[0]; const iId=h.indexOf('ID отзыва'), iSt=h.indexOf('Статус'), iAns=h.indexOf('Подобранный ответ'), iErr=h.indexOf('Ошибка'), iTime=h.indexOf('Время отправки'); let sent=0, ok=0; for(let r=1;r<d.length && sent<CONFIG.MAX_REVIEWS_PER_RUN;r++){ if(d[r][iSt]!==CONFIG.STATUS.PENDING_SEND) continue; const id=d[r][iId], text=d[r][iAns]; if(!id||!text) continue; sent++; let res={success:false,error:''}; if(store.marketplace==='Ozon') res=sendOzonAnswer(store,id,text); else if(store.marketplace==='Wildberries') res=sendWBAnswer(store,id,text); sh.getRange(r+1,iSt+1).setValue(res.success?CONFIG.STATUS.SENT:CONFIG.STATUS.ERROR); if(iErr>=0) sh.getRange(r+1,iErr+1).setValue(res.error||''); if(res.success && iTime>=0) sh.getRange(r+1,iTime+1).setValue(new Date().toLocaleString('ru-RU')); if(res.success) ok++; Utilities.sleep(store.marketplace==='Ozon'?CONFIG.RATE_LIMITS.OZON:CONFIG.RATE_LIMITS.WB); } return {sent,success:ok}; }
function sendOzonAnswer(store, reviewId, answerText){ const payload={review_id:reviewId, text:answerText, mark_review_as_processed:true}; try{ const res=UrlFetchApp.fetch(CONFIG.OZON.COMMENT_URL,{method:'POST',headers:{'Client-Id':store.credentials.clientId,'Api-Key':store.credentials.apiKey,'Content-Type':'application/json'},payload:JSON.stringify(payload),muteHttpExceptions:true}); const code=res.getResponseCode(); const body=res.getContentText(); if(code===200) return {success:true,error:''}; return {success:false,error:`HTTP ${code}: ${body.substring(0,100)}`}; }catch(e){ return {success:false,error:e.message}; } }
function sendWBAnswer(store, reviewId, answerText){ const url=`${CONFIG.WB.ANSWER_URL}/${reviewId}`; const payload={text:answerText}; try{ const res=UrlFetchApp.fetch(url,{method:'PATCH',headers:{'Authorization':store.credentials.apiKey,'Content-Type':'application/json'},payload:JSON.stringify(payload),muteHttpExceptions:true}); const code=res.getResponseCode(); const body=res.getContentText(); if(code===200||code===204) return {success:true,error:''}; return {success:false,error:`HTTP ${code}: ${body.substring(0,100)}`}; }catch(e){ return {success:false,error:e.message}; } }

// ===================== SHEETS =====================
function createSheet(name, headers){ const ss=SpreadsheetApp.getActiveSpreadsheet(); let sh=ss.getSheetByName(name); if(!sh) sh=ss.insertSheet(name); if(headers&&headers.length){ if(sh.getLastRow()===0) sh.appendRow(headers); const ex=sh.getRange(1,1,1,headers.length).getValues()[0]; const match=ex.length===headers.length && ex.every((v,i)=>v===headers[i]); if(!match){ sh.getRange(1,1,1,headers.length).setValues([headers]); } sh.getRange(1,1,1,headers.length).setFontWeight('bold').setBackground('#4285f4').setFontColor('#fff'); sh.setFrozenRows(1); for(let i=1;i<=headers.length;i++){ sh.autoResizeColumn(i); } } return sh; }
function batchSaveToSheet(reviews, store, status){ if(!reviews||reviews.length===0) return; const name=`Отзывы_${store.name.replace(/[^а-яА-Яa-zA-Z0-9]/g,'_')}`; const sh=createSheet(name, CONFIG.REVIEW_HEADERS); const start=sh.getLastRow()+1; const rows=reviews.map((r,idx)=>[start+idx-1, r.id, new Date(r.createdDate), r.rating, r.text||'', r.product.name||'Не указано', '', status, '', '' ]); sh.getRange(start,1,rows.length,CONFIG.REVIEW_HEADERS.length).setValues(rows); log(`[${store.name}] 📊 сохранено ${rows.length} отзывов в ${name}`,'INFO','SHEET'); }
