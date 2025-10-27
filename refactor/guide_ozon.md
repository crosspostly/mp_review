# 📖 ПОЛНЫЙ ГАЙД: Система кеша для множества магазинов
## Октябрь 2025 | Production-Ready решение

---

## 🎯 ОТВЕТ НА ТВОЙ ВОПРОС

**"Для каждого магазина будут раздельные кеши ID?"**

✅ **ДА! Каждый магазин имеет свой независимый кеш в Properties:**

```javascript
reviewIds_ozon_001    // Магазин Ozon #1
reviewIds_ozon_002    // Магазин Ozon #2
reviewIds_wb_001      // Магазин WB #1
reviewIds_wb_002      // Магазин WB #2
// и т.д.
```

---

## 📊 ПОЛНАЯ АРХИТЕКТУРА СИСТЕМЫ

```
Google Sheets (ВСЕ МАГАЗИНЫ):
├─ Лист "Stores" (конфиг: ID, ключи API, статус)
├─ Лист "Settings" (шаблоны ответов)
├─ Лист "Logs" (логи всей системы)
└─ Листы по магазинам: ozon_001, ozon_002, wb_001, wb_002

Google Apps Script Properties (КЕША КАЖДОГО МАГАЗИНА):
├─ reviewIds_ozon_001: [uuid1, uuid2, uuid3, ...] ← 1234 ID
├─ reviewIds_ozon_002: [uuid100, uuid101, uuid102, ...] ← 567 ID
├─ reviewIds_wb_001: [uuid200, uuid201, ...] ← 2345 ID
├─ reviewIds_wb_002: [uuid300, uuid301, ...] ← 890 ID
├─ stripe_position_ozon_001: 0 (если много страниц)
├─ stripe_position_ozon_002: 1
└─ и т.д.

ТРИГГЕРЫ (3 основных):
├─ Триггер 1: hourlyReviewCollector() — каждый час (сбор)
├─ Триггер 2: selectReviewAnswers() — каждые 30 минут (подбор)
└─ Триггер 3: sendReviewAnswers() — каждые 30 минут (отправка)
```

---

## 🔧 ПОЛНЫЙ КОД: Многомагазинная система

### ЧАСТЬ 1: ИНИЦИАЛИЗАЦИЯ (Первый запуск)

```javascript
/**
 * ИНИЦИАЛИЗАЦИЯ: Запусти один раз
 * Собирает ВСЕ отзывы со ВСЕХ магазинов
 * initializeAllStores()
 */
function initializeAllStores() {
    log(`\n🚀 ========== ИНИЦИАЛИЗАЦИЯ СИСТЕМЫ ==========\n`);
    
    const stores = getActiveStores();
    log(`📊 Найдено активных магазинов: ${stores.length}`);
    
    let completed = 0;
    let failed = 0;
    
    stores.forEach((store, index) => {
        try {
            log(`\n[${index + 1}/${stores.length}] 📦 Инициализация ${store.name} (${store.id})`);
            
            // Это может занять ДО 30 минут для всех магазинов!
            const reviewCount = collectAllOzonReviewsFirstTime(store.id);
            
            if (reviewCount > 0) {
                completed++;
                log(`✅ ${store.name}: ${reviewCount} отзывов загружено`);
            } else {
                failed++;
                log(`⚠️ ${store.name}: нет отзывов или ошибка`);
            }
            
        } catch (error) {
            failed++;
            log(`❌ ${store.name}: ${error.message}`);
        }
    });
    
    log(`\n🏁 ========== РЕЗУЛЬТАТЫ ==========`);
    log(`✅ Успешно: ${completed}`);
    log(`❌ Ошибок: ${failed}`);
    log(`📊 Всего магазинов: ${stores.length}`);
}

/**
 * СБОР ВСЕх отзывов для ОДНОГО магазина (ПЕРВЫЙ ЗАПУСК)
 */
function collectAllOzonReviewsFirstTime(storeId) {
    log(`\n🚀 ПЕРВЫЙ ЗАПУСК: ${storeId}`);
    
    const store = getStoreById(storeId);
    if (!store) {
        log(`❌ Магазин ${storeId} не найден`);
        return 0;
    }
    
    const props = PropertiesService.getScriptProperties();
    const cacheKey = `reviewIds_${storeId}`;
    
    // Проверяем есть ли уже кеш (чтобы не парсить дважды)
    const existingCache = props.getProperty(cacheKey);
    if (existingCache) {
        const existingIds = JSON.parse(existingCache);
        log(`⚠️ Кеш уже существует: ${existingIds.length} ID. Пропускаем инициализацию.`);
        return existingIds.length;
    }
    
    const startTime = Date.now();
    let allReviews = [];
    let page = 1;
    const MAX_PAGES = 100;
    
    log(`📦 Магазин: ${store.name}`);
    log(`🔑 Marketplace: ${store.marketplace}`);
    
    // ГЛАВНЫЙ ЦИКЛ: парсим ВСЕ страницы
    while (page <= MAX_PAGES) {
        try {
            log(`   📄 Страница ${page}/${MAX_PAGES}...`);
            
            // Получаем страницу отзывов
            let pageReviews = [];
            
            if (store.marketplace === 'Ozon') {
                pageReviews = getOzonReviewsPageFixed(
                    store.clientId,
                    store.apiKey,
                    false,
                    page
                );
            } else if (store.marketplace === 'Wildberries') {
                // Для WB используем skip-based pagination
                const skip = (page - 1) * 100;
                if (skip > 199990) {
                    log(`✅ Достигли максимума WB (199990)`);
                    break;
                }
                pageReviews = getWbReviewsPage(store.apiKey, skip, 100);
            }
            
            if (!pageReviews || pageReviews.length === 0) {
                log(`✅ Пустая страница, конец`);
                break;
            }
            
            allReviews = allReviews.concat(pageReviews);
            log(`      ${pageReviews.length} отзывов, всего: ${allReviews.length}`);
            
            // Rate limiting
            Utilities.sleep(500);
            page++;
            
        } catch (error) {
            if (error.message && error.message.includes('429')) {
                log(`⏳ Rate limit, ждём 3 сек...`);
                Utilities.sleep(3000);
            } else {
                log(`❌ Ошибка на странице ${page}: ${error.message}`);
                break;
            }
        }
    }
    
    // Сохраняем отзывы в Sheets
    if (allReviews.length > 0) {
        log(`\n💾 Сохраняем ${allReviews.length} отзывов в Sheets...`);
        batchSaveToSheet(allReviews, store, 'NEW');
        
        // КРИТИЧНО: Сохраняем ID в Properties кеш (ОТДЕЛЬНЫЙ ДЛЯ КАЖДОГО МАГАЗИНА)
        log(`⚡ Сохраняем ID в Properties кеш: ${cacheKey}`);
        const reviewIds = allReviews.map(r => r.id);
        props.setProperty(cacheKey, JSON.stringify(reviewIds));
        
        log(`✅ Кеш создан: ${reviewIds.length} ID`);
    }
    
    const duration = Math.round((Date.now() - startTime) / 1000);
    log(`🏁 Завершено за ${duration}с\n`);
    
    return allReviews.length;
}

/**
 * СБОР ВСЕх отзывов для ОДНОГО магазина (КАЖДЫЙ ЧАС)
 * Парсим всю базу, но берём только НОВЫЕ по ID
 */
function collectNewReviewsIncremental(storeId) {
    const store = getStoreById(storeId);
    if (!store) return [];
    
    const props = PropertiesService.getScriptProperties();
    const cacheKey = `reviewIds_${storeId}`;
    
    // ШАГ 1: Получаем существующий кеш из Properties
    const cachedIds = JSON.parse(props.getProperty(cacheKey) || '[]');
    const cachedSet = new Set(cachedIds);
    
    // ШАГ 2: Парсим отзывы (ВСЕ или по полосам, смотри ниже)
    let allReviews = [];
    
    if (store.marketplace === 'Ozon') {
        allReviews = collectOzonReviewsByStripe(store, 20); // 20 страниц за раз
    } else if (store.marketplace === 'Wildberries') {
        allReviews = collectWBReviewsIncremental(store);
    }
    
    // ШАГ 3: ФИЛЬТРУЕМ: берём только новые ID
    const newReviews = allReviews.filter(r => !cachedSet.has(r.id));
    
    // ШАГ 4: Сохраняем новые
    if (newReviews.length > 0) {
        batchSaveToSheet(newReviews, store, 'NEW');
        
        // ОБНОВЛЯЕМ КЕШ: добавляем новые ID
        const allNewIds = [...cachedSet, ...newReviews.map(r => r.id)];
        props.setProperty(cacheKey, JSON.stringify(allNewIds));
        
        log(`[${store.id}] ✅ ${newReviews.length} новых (всего: ${allNewIds.length})`);
    }
    
    return newReviews;
}
```

### ЧАСТЬ 2: ПОЛОСКА-СИСТЕМА (для больших магазинов)

```javascript
/**
 * Если магазин имеет 200+ страниц, используем полоски
 * Каждый час парсим одну полоску (50 страниц)
 * За 4 часа полностью "пересканируем" весь магазин
 */
function collectOzonReviewsByStripe(store, pagesPerStripe = 50) {
    const props = PropertiesService.getScriptProperties();
    const stripeKey = `stripe_position_${store.id}`;
    
    // Получаем текущую позицию полоски
    const currentStripe = parseInt(props.getProperty(stripeKey) || '0');
    const startPage = currentStripe * pagesPerStripe + 1;
    const endPage = (currentStripe + 1) * pagesPerStripe;
    
    log(`[${store.id}] 📍 Полоса ${currentStripe}: стр. ${startPage}-${endPage}`);
    
    let stripeReviews = [];
    
    for (let page = startPage; page <= endPage; page++) {
        try {
            const pageReviews = getOzonReviewsPageFixed(
                store.clientId,
                store.apiKey,
                false,
                page
            );
            
            if (!pageReviews || pageReviews.length === 0) break;
            
            stripeReviews = stripeReviews.concat(pageReviews);
            Utilities.sleep(500);
            
        } catch (error) {
            if (!error.message.includes('429')) break;
            Utilities.sleep(3000);
        }
    }
    
    // Переходим на следующую полоску (циклически)
    const nextStripe = (currentStripe + 1) % 4; // 4 полоски = 200 страниц
    props.setProperty(stripeKey, nextStripe.toString());
    
    return stripeReviews;
}

/**
 * WB: Каждый час парсим последние 24 часа
 */
function collectWBReviewsIncremental(store) {
    const last24h = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000);
    
    const url = new URL('https://feedbacks-api.wildberries.ru/api/v1/feedbacks');
    url.searchParams.append('isAnswered', 'false');
    url.searchParams.append('take', '5000');
    url.searchParams.append('skip', '0');
    url.searchParams.append('order', 'dateDesc');
    url.searchParams.append('dateFrom', last24h.toString());
    
    try {
        const response = UrlFetchApp.fetch(url.toString(), {
            method: 'GET',
            headers: {
                'Authorization': store.apiKey
            },
            muteHttpExceptions: true
        });
        
        if (response.getResponseCode() !== 200) return [];
        
        const json = JSON.parse(response.getContentText());
        return (json.data?.feedbacks || []).map(r => ({
            id: r.id,
            rating: r.productValuation,
            text: r.text,
            created_at: r.createdDate,
            product: { name: r.productDetails?.productName }
        }));
        
    } catch (error) {
        log(`[${store.id}] ❌ WB ошибка: ${error.message}`);
        return [];
    }
}
```

### ЧАСТЬ 3: ГЛАВНЫЙ ТРИГГЕР (каждый час)

```javascript
/**
 * ТРИГГЕР 1: Сбор новых отзывов ОТ ВСЕХ магазинов
 * Запуск: каждый час
 */
function hourlyReviewCollector() {
    log(`\n${'='.repeat(50)}`);
    log(`🚀 СБОР ОТЗЫВОВ: ${new Date().toLocaleString('ru-RU')}`);
    log(`${'='.repeat(50)}`);
    
    const stores = getActiveStores();
    log(`📊 Обработаем ${stores.length} магазинов\n`);
    
    let stats = {
        total: 0,
        newReviews: 0,
        errors: 0
    };
    
    stores.forEach((store, index) => {
        try {
            log(`\n[${index + 1}/${stores.length}] 📦 ${store.name} (${store.id})`);
            
            const newReviews = collectNewReviewsIncremental(store.id);
            stats.newReviews += newReviews.length;
            
        } catch (error) {
            log(`❌ Ошибка: ${error.message}`);
            stats.errors++;
        }
    });
    
    log(`\n${'='.repeat(50)}`);
    log(`📊 ИТОГО:`);
    log(`   ✅ Новых отзывов: ${stats.newReviews}`);
    log(`   ❌ Ошибок: ${stats.errors}`);
    log(`${'='.repeat(50)}\n`);
}

/**
 * ТРИГГЕР 2: Подбор ответов ДЛЯ ВСЕХ магазинов
 * Запуск: каждые 30 минут
 */
function selectReviewAnswers() {
    log(`\n🔍 ПОДБОР ОТВЕТОВ: ${new Date().toLocaleString('ru-RU')}\n`);
    
    const stores = getActiveStores();
    let totalAnswers = 0;
    
    stores.forEach(store => {
        try {
            // Находим NEW отзывы в Sheets этого магазина
            const newReviews = getReviewsByStatusFromSheet(store.id, 'NEW', 100);
            
            if (newReviews.length === 0) return;
            
            log(`[${store.id}] 📊 Найдено ${newReviews.length} NEW отзывов`);
            
            // Подбираем ответы
            const updates = newReviews.map(review => {
                const template = selectTemplate(review.rating);
                const answer = customizeAnswer(template, review.text);
                
                return {
                    rowIndex: review.rowIndex,
                    status: 'PENDING_SEND',
                    answer: answer,
                    preparedAt: new Date()
                };
            }).filter(Boolean);
            
            if (updates.length > 0) {
                batchUpdateReviewsInSheet(store.id, updates);
                totalAnswers += updates.length;
                log(`[${store.id}] ✅ Подготовлено ${updates.length}`);
            }
            
        } catch (error) {
            log(`[${store.id}] ❌ ${error.message}`);
        }
    });
    
    log(`\n📊 ВСЕГО ПОДГОТОВЛЕНО: ${totalAnswers}`);
}

/**
 * ТРИГГЕР 3: Отправка ответов ДЛЯ ВСЕХ магазинов
 * Запуск: каждые 30 минут
 */
function sendReviewAnswers() {
    log(`\n📤 ОТПРАВКА ОТВЕТОВ: ${new Date().toLocaleString('ru-RU')}\n`);
    
    const stores = getActiveStores();
    let totalSent = 0;
    let totalFailed = 0;
    
    stores.forEach(store => {
        try {
            const pendingReviews = getReviewsByStatusFromSheet(store.id, 'PENDING_SEND', 50);
            
            if (pendingReviews.length === 0) return;
            
            log(`[${store.id}] 📊 Отправляем ${pendingReviews.length}`);
            
            const updates = [];
            
            pendingReviews.forEach(review => {
                try {
                    const fullReview = getFullReviewFromSheet(store.id, review.rowIndex);
                    let success = false;
                    
                    if (store.marketplace === 'Ozon') {
                        success = sendOzonAnswer(store, review.id, fullReview.answer);
                        Utilities.sleep(500);
                    } else if (store.marketplace === 'Wildberries') {
                        success = sendWBAnswer(store, review.id, fullReview.answer);
                        Utilities.sleep(333);
                    }
                    
                    updates.push({
                        rowIndex: review.rowIndex,
                        status: success ? 'SENT' : 'ERROR',
                        errorMsg: success ? '' : 'Ошибка'
                    });
                    
                    if (success) totalSent++;
                    else totalFailed++;
                    
                } catch (error) {
                    updates.push({
                        rowIndex: review.rowIndex,
                        status: 'ERROR',
                        errorMsg: error.message
                    });
                    totalFailed++;
                }
            });
            
            if (updates.length > 0) {
                batchUpdateReviewsInSheet(store.id, updates);
            }
            
        } catch (error) {
            log(`[${store.id}] ❌ ${error.message}`);
        }
    });
    
    log(`\n📊 РЕЗУЛЬТАТЫ:`);
    log(`   ✅ Отправлено: ${totalSent}`);
    log(`   ❌ Ошибок: ${totalFailed}`);
}
```

### ЧАСТЬ 4: HELPERS

```javascript
/**
 * Получить все активные магазины
 */
function getActiveStores() {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sheet = ss.getSheetByName('Stores');
        if (!sheet) return [];
        
        const data = sheet.getDataRange().getValues();
        const stores = [];
        
        for (let i = 1; i < data.length; i++) {
            if (data[i][5] === true || data[i][5] === 'TRUE') {
                stores.push({
                    id: data[i][0],
                    name: data[i][1],
                    marketplace: data[i][2],
                    apiKey: data[i][3],
                    clientId: data[i][4],
                    isActive: true
                });
            }
        }
        
        return stores;
    } catch (e) {
        log(`❌ getActiveStores: ${e.message}`);
        return [];
    }
}

/**
 * Получить магазин по ID
 */
function getStoreById(storeId) {
    const stores = getActiveStores();
    return stores.find(s => s.id === storeId);
}

/**
 * Получить отзывы со статусом из Sheets
 */
function getReviewsByStatusFromSheet(storeId, status, limit) {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sheet = ss.getSheetByName(storeId);
        if (!sheet) return [];
        
        const data = sheet.getDataRange().getValues();
        const reviews = [];
        
        for (let i = 1; i < data.length && reviews.length < limit; i++) {
            if (data[i][5] === status) {
                reviews.push({
                    rowIndex: i + 1,
                    id: data[i][0],
                    rating: data[i][2],
                    text: data[i][3],
                    status: data[i][5]
                });
            }
        }
        
        return reviews;
    } catch (e) {
        log(`❌ getReviewsByStatusFromSheet ${storeId}: ${e.message}`);
        return [];
    }
}

/**
 * Получить полную информацию об отзыве
 */
function getFullReviewFromSheet(storeId, rowIndex) {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sheet = ss.getSheetByName(storeId);
        if (!sheet) return {};
        
        const data = sheet.getRange(rowIndex, 1, 1, 9).getValues()[0];
        return {
            id: data[0],
            answer: data[7] || ''
        };
    } catch (e) {
        return {};
    }
}

/**
 * Batch сохранение в Sheets
 */
function batchSaveToSheet(reviews, store, status) {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        let sheet = ss.getSheetByName(store.id);
        
        if (!sheet) {
            sheet = ss.insertSheet(store.id);
            sheet.getRange(1, 1, 1, 9).setValues([[
                'reviewId', 'createdDate', 'rating', 'text', 'product',
                'status', 'processedDate', 'answer', 'errorMsg'
            ]]);
        }
        
        const rows = reviews.map(r => [
            r.id,
            r.created_at || r.createdDate || new Date().toISOString(),
            r.rating || 0,
            r.text || '',
            r.product?.name || '',
            status,
            new Date(),
            '',
            ''
        ]);
        
        sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 9).setValues(rows);
    } catch (e) {
        log(`❌ batchSaveToSheet: ${e.message}`);
    }
}

/**
 * Batch обновление статусов
 */
function batchUpdateReviewsInSheet(storeId, updates) {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sheet = ss.getSheetByName(storeId);
        if (!sheet) return;
        
        updates.forEach(update => {
            sheet.getRange(update.rowIndex, 6, 1, 4).setValues([[
                update.status,
                update.preparedAt || update.sentAt || new Date(),
                update.answer || '',
                update.errorMsg || ''
            ]]);
        });
    } catch (e) {
        log(`❌ batchUpdateReviewsInSheet: ${e.message}`);
    }
}

/**
 * Логирование
 */
function log(message) {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const logSheet = ss.getSheetByName('Logs') || ss.insertSheet('Logs');
        
        if (logSheet.getLastRow() > 5000) {
            logSheet.deleteRows(2, 1000);
        }
        
        logSheet.appendRow([new Date(), message]);
    } catch (e) {
        console.log(message);
    }
}
```

---

## 📋 ИНСТРУКЦИЯ: НАЧАЛО РАБОТЫ

### Шаг 1: Подготовка Google Sheets

Создай листы:
- **Stores** (заголовки: id, name, marketplace, apiKey, clientId, isActive)
- **Settings** (шаблоны ответов)
- **Logs** (автоматический лог)
- Листы по магазинам создадутся автоматически

### Шаг 2: Заполни лист Stores

```
id          | name         | marketplace  | apiKey      | clientId | isActive
ozon_001    | Мой Ozon     | Ozon        | xxxxxxxx    | xxxxxxx  | TRUE
wb_001      | Мой WB       | Wildberries | xxxxxxxx    |          | TRUE
```

### Шаг 3: Первый запуск (один раз)

```javascript
// Запусти в консоли Apps Script
initializeAllStores()

// Ждёшь пока завершится (может быть 30+ минут)
// В Logs будешь видеть прогресс
```

### Шаг 4: Установи триггеры

1. Extensions → Apps Script Triggers
2. Создай 3 триггера:
   - `hourlyReviewCollector` → Every hour
   - `selectReviewAnswers` → Every 30 minutes
   - `sendReviewAnswers` → Every 30 minutes

### Шаг 5: Проверка

```javascript
// Запусти проверку
healthCheck()

// Должно показать:
// ✅ Магазинов загружено: 2
// ✅ Кешей создано: 2
// ✅ Триггеров активно: 3
```

---

## 📊 ПРИМЕРЫ КЕШЕЙ

**После инициализации в Properties ты увидишь:**

```
reviewIds_ozon_001 = "[\"uuid-1\", \"uuid-2\", \"uuid-3\", ...]"  // 1234 ID
reviewIds_ozon_002 = "[\"uuid-100\", \"uuid-101\", ...]"          // 567 ID
reviewIds_wb_001   = "[\"uuid-200\", \"uuid-201\", ...]"          // 2345 ID
reviewIds_wb_002   = "[\"uuid-300\", \"uuid-301\", ...]"          // 890 ID
```

**Каждый кеш независим и хранит ID отзывов ТОЛЬКО этого магазина.**

---

## 🎯 ИТОГОВАЯ СХЕМА

```
ДЕНЬ 1 (30+ минут):
┌─────────────────────────────┐
│ initializeAllStores()       │
│ ├─ ozon_001: парсим все    │
│ ├─ ozon_002: парсим все    │
│ ├─ wb_001: парсим все      │
│ └─ wb_002: парсим все      │
└─────────────────────────────┘
     ↓ (сохраняются независимые кеши)

ДЕНЬ 2+:
КАЖДЫЙ ЧАС:
┌────────────────────────────┐
│ hourlyReviewCollector()    │
│ ├─ ozon_001: 20 стр → 50  │
│ ├─ ozon_002: 20 стр → 30  │ 
│ ├─ wb_001: 24ч → 100     │
│ └─ wb_002: 24ч → 50      │
└────────────────────────────┘
     ↓ (берёт СВОЙ кеш каждого)

КАЖДЫЙ КЕША:
├─ ozon_001: 1234 → 1250 (16 новых)
├─ ozon_002: 567 → 580 (13 новых)
├─ wb_001: 2345 → 2360 (15 новых)
└─ wb_002: 890 → 900 (10 новых)

РЕЗУЛЬТАТ: 54 новых отзыва за час ✅
```

---

## ✅ ГОТОВО!

Всё готово к использованию. Просто:

1. ✅ Скопируй весь код
2. ✅ Создай листы в Google Sheets
3. ✅ Запусти `initializeAllStores()` один раз
4. ✅ Установи 3 триггера
5. ✅ Profit! 🚀
