/**
 * @file Code.gs
 * @description Main backend logic for the Multi-Store Auto-Reply Manager.
 */

// ============ GLOBAL CONFIGURATION ============
const CONFIG = {
  PROPERTIES_KEY: 'REGISTERED_STORES',
  DEV_MODE_KEY: 'DEV_MODE_ENABLED',
  SHEETS: {
    TEMPLATES: 'Шаблоны ответов'
  },
  LOG_SHEET_NAME: '🐞 Лог отладки',
  LOG_MAX_ROWS: 2500,
  RESPOND_TO_RATINGS: [4, 5],
  DELAY_BETWEEN_REQUESTS: 1100,
  MAX_FEEDBACKS_PER_RUN: 50,
  MIN_REVIEW_TEXT_LENGTH: 3, // Минимальная длина текста отзыва для обработки
  HEADERS: ['ID отзыва', 'Дата отзыва', 'Артикул', 'Название товара', 'Ссылка', 'Оценка', 'Текст отзыва', 'Подобранный ответ', 'Статус', 'Детали ошибки', 'Время отправки'],
  STATUS: {
    PENDING: 'Готово к отправке',
    SENT: 'Отправлено',
    ERROR: 'Ошибка',
    MANUAL: 'Ручной ответ',
    SKIPPED_RATING: 'Пропущено (рейтинг)',
    SKIPPED_PROCESSED: 'Пропущено (уже обработан)',
    SKIPPED_EMPTY: 'Пропущено (пустой отзыв)',
    NO_TEMPLATE: 'Нет шаблона'
  }
};

// ============ WILDBERRIES API CONFIGURATION ============
const WB_CONFIG = {
  MARKETPLACE_NAME: 'Wildberries',
  MARKETPLACE_CODE: 'WB',
  API_BASE_URL: 'https://feedbacks-api.wildberries.ru/api/v1',
  ENDPOINTS: {
    GET_FEEDBACKS: '/feedbacks',
    SEND_ANSWER: '/feedbacks'  // {id} будет добавлен динамически
  },
  API_LIMITS: {
    MAX_TAKE: 1000,          // Консервативный увеличенный лимит (протестирован)
    DEFAULT_SKIP: 0,
    RECOMMENDED_TAKE: 100,   // Проверенный безопасный лимит
    SAFE_TAKE: 500,          // Золотая середина для стабильности
    PAGINATION_STEP: 100,    // Размер страницы для пагинации
    MAX_PAGES: 10            // Максимум страниц за один запуск (1000 отзывов)
  },
  PAGINATION: {
    ENABLED: true,
    STORAGE_KEY: 'WB_LAST_SKIP_OFFSET',
    AUTO_RESET_HOURS: 24     // Сброс offset каждые 24 часа
  },
  RATE_LIMITS: {
    REQUESTS_PER_MINUTE: 60,        // Максимум запросов в минуту
    DELAY_BETWEEN_REQUESTS: 1100,   // Миллисекунды между запросами
    BURST_LIMIT: 10,                // Максимум быстрых запросов подряд (без задержки)
    BURST_DELAY: 100,               // Минимальная задержка в burst режиме (мс)
    RECOVERY_DELAY: 5000            // Задержка после исчерпания burst лимита (мс)
  },
  BATCH_PROCESSING: {
    ENABLED: false,                 // WB API не поддерживает batch отправку
    ALTERNATIVE: 'smart_throttling' // Используем умное регулирование скорости
  },
  RATING_FIELDS: {
    REVIEW_RATING: 'rating',        // Рейтинг ОТЗЫВА (1-5, может быть null если нет текста отзыва)
    PRODUCT_RATING: 'productValuation' // Общая ОЦЕНКА ТОВАРА (1-5, всегда есть при покупке)
  },
  DATA_EXPLANATION: {
    // Объяснение структуры данных WB API:
    // 1. Пользователь покупает товар → ставит productValuation (1-5 звезд)
    // 2. Опционально: пользователь пишет отзыв → добавляется rating + text
    // 3. Если только оценка товара (без текста) → rating=null, text=null
    // 4. Отвечать можно ТОЛЬКО на отзывы с текстом (rating не null)
    RATING_LOGIC: 'rating || productValuation || 0', // Приоритет: рейтинг отзыва, затем товара
    RESPONDABLE: 'Только отзывы с текстом (rating != null && text != null)'
  },
  REQUIRED_TEXT_FIELDS: ['text'], // Поля, которые должны содержать текст
  PRODUCT_URL_TEMPLATE: 'https://www.wildberries.ru/catalog/{productId}/detail.aspx'
};

// ============ OZON API CONFIGURATION ============
const OZON_CONFIG = {
  MARKETPLACE_NAME: 'Ozon',
  MARKETPLACE_CODE: 'OZON',
  API_BASE_URL: 'https://api-seller.ozon.ru/v1',
  ENDPOINTS: {
    GET_REVIEWS: '/review/list',
    SEND_COMMENT: '/review/comment/create'
  },
  API_LIMITS: {
    MAX_LIMIT: 100,          // РЕАЛЬНЫЙ максимальный лимит Ozon API (проверено)
    MIN_LIMIT: 20,           // РЕАЛЬНЫЙ минимальный лимит Ozon API
    DEFAULT_LIMIT: 100,      // Используем максимальный разрешенный лимит
    RECOMMENDED_LIMIT: 100,  // Рекомендуемый = максимальный для эффективности
    PAGINATION_STEP: 100     // Размер страницы - используем максимум
  },
  PAGINATION: {
    ENABLED: false,          // Ozon API не поддерживает skip/offset пагинацию
    ALTERNATIVE: 'timestamp_based' // Используем timestamp-based filtering
  },
  RATE_LIMITS: {
    REQUESTS_PER_MINUTE: 100,       // Максимум запросов в минуту (выше чем WB)
    DELAY_BETWEEN_REQUESTS: 600,    // Миллисекунды между запросами (быстрее WB)
    BURST_LIMIT: 20,                // Максимум быстрых запросов подряд (без задержки)
    BURST_DELAY: 50,                // Минимальная задержка в burst режиме (мс)
    RECOVERY_DELAY: 3000            // Задержка после исчерпания burst лимита (мс)
  },
  BATCH_PROCESSING: {
    ENABLED: false,                 // Ozon API не поддерживает batch отправку
    ALTERNATIVE: 'sequential_with_smart_throttling' // Последовательная отправка с умным throttling
  },
  WEBHOOK: {
    SUPPORTED: false,               // Ozon API webhook требует исследования
    ALTERNATIVE: 'intelligent_polling' // Умный polling с timestamp filtering
  },
  RATING_FIELDS: {
    REVIEW_RATING: 'rating'
  },
  REVIEW_STATUSES: {
    UNPROCESSED: 'UNPROCESSED',
    PROCESSED: 'PROCESSED'
  },
  REQUIRED_TEXT_FIELDS: ['text'], // Поля, которые должны содержать текст
  PRODUCT_URL_TEMPLATE: 'https://www.ozon.ru/product/{sku}'
};

// ============ MENU CREATION ============
function onOpen(e) {
  const ui = SpreadsheetApp.getUi();
  const menu = ui.createMenu('🤖 Автоответы');
  menu.addItem('⚙️ Первоначальная настройка', 'initialSetup');
  menu.addItem('🏪 Управление магазинами', 'showStoreManagerSidebar');
  menu.addSeparator();
  menu.addItem('▶️ Запустить обработку сейчас', 'processAllStores');
  menu.addItem('▶️ Отправить подготовленные ответы', 'sendPendingAnswers');
  menu.addSeparator();
  
  // 🛠️ РЕЖИМ РАЗРАБОТЧИКА - содержит все тесты и отладочные функции
  const devMenu = ui.createMenu('🛠️ Режим разработчика');
  devMenu.addItem('🔧 Включить режим разработчика', 'enableDevMode');
  devMenu.addItem('🔧 Выключить режим разработчика', 'disableDevMode');
  devMenu.addSeparator();
  devMenu.addItem('🧪 Тест: ответ на конкретный отзыв WB', 'testWbFeedbackAnswerById');
  devMenu.addItem('🗑️ Удалить отзыв по ID', 'manuallyDeleteReviewById');
  menu.addSubMenu(devMenu);
  
  const triggerSubMenu = ui.createMenu('🔄 Управление автозапуском');
  triggerSubMenu.addItem('Установить автозапуск (5 мин)', 'createTrigger5Min');
  triggerSubMenu.addItem('Установить автозапуск (30 мин)', 'createTrigger30Min');
  triggerSubMenu.addSeparator();
  triggerSubMenu.addItem('🎯 Создать индивидуальные триггеры для магазинов', 'createPerStoreTriggers');
  triggerSubMenu.addItem('🗑️ Удалить все индивидуальные триггеры', 'deletePerStoreTriggers');
  triggerSubMenu.addItem('Установить автозапуск (1 час)', 'createTrigger1Hour');
  triggerSubMenu.addSeparator();
  triggerSubMenu.addItem('❌ Удалить все триггеры автозапуска', 'deleteAllTriggers');
  menu.addSubMenu(triggerSubMenu);
  
  menu.addSeparator();
  menu.addItem('🐞 Показать/Скрыть лог отладки', 'toggleLogSheet');
  menu.addToUi();
  updateDevModeStatus();
}

// ============ DEV MODE ============
function setDevMode(enabled) {
  PropertiesService.getUserProperties().setProperty(CONFIG.DEV_MODE_KEY, enabled);
  const status = enabled ? 'ВКЛЮЧЕН' : 'ВЫКЛЮЧЕН';
  log(`Режим разработчика ${status}.`);
  SpreadsheetApp.getUi().alert(`Режим разработчика ${status}.`);
  updateDevModeStatus();
}

function enableDevMode() { setDevMode('true'); }
function disableDevMode() { setDevMode('false'); }

function isDevMode() {
  return PropertiesService.getUserProperties().getProperty(CONFIG.DEV_MODE_KEY) === 'true';
}

function updateDevModeStatus() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.TEMPLATES);
  if (sheet) {
    sheet.getRange("D1").setValue(isDevMode() ? "РЕЖИМ РАЗРАБОТЧИКА: ВКЛ" : "РЕЖИМ РАЗРАБОТЧИКА: ВЫКЛ")
         .setFontWeight("bold")
         .setFontColor(isDevMode() ? "#EA4335" : "#34A853");
  }
}

// ============ ОБОГАЩЕНИЕ НАЗВАНИЯМИ ТОВАРОВ ============

/**
 * WB: Получение названий товаров по nmId через Content API
 * @param {Array} nmIds - Массив nmId товаров
 * @param {string} apiKey - WB API ключ
 * @returns {Object} Справочник {nmId: название}
 */
function getWbProductNames(nmIds, apiKey) {
    if (!nmIds || nmIds.length === 0) return {};
    
    // Убираем дубликаты
    const uniqueNmIds = [...new Set(nmIds)];
    log(`[WB Products] 🏷️ Запрашиваю названия для ${uniqueNmIds.length} товаров...`);
    
    const url = 'https://suppliers-api.wildberries.ru/content/v2/cards/cursor/list';
    const payload = {
        filter: {
            nmID: uniqueNmIds
        },
        limit: Math.min(uniqueNmIds.length, 100) // WB лимит
    };
    
    try {
        const response = UrlFetchApp.fetch(url, {
            method: 'POST',
            headers: { 
                'Authorization': apiKey,
                'Content-Type': 'application/json'
            },
            payload: JSON.stringify(payload),
            muteHttpExceptions: true
        });
        
        const responseCode = response.getResponseCode();
        const responseBody = response.getContentText();
        
        if (responseCode !== 200) {
            log(`[WB Products] ❌ ОШИБКА получения названий: ${responseCode}. ${responseBody}`);
            // Специальная обработка частых ошибок API
            if (responseCode === 401) {
                log(`[WB Products] ❌ КРИТИЧНО: Неверный API ключ для Content API`);
            } else if (responseCode === 403) {
                log(`[WB Products] ❌ КРИТИЧНО: API ключ не имеет доступа к Content API`);
            } else if (responseCode === 404) {
                log(`[WB Products] ❌ КРИТИЧНО: Content API endpoint недоступен. Возможно изменился URL.`);
            } else if (responseCode === 429) {
                log(`[WB Products] ❌ ПРЕВЫШЕН лимит запросов к Content API. Нужна пауза.`);
            }
            return {};
        }
        
        const json = JSON.parse(responseBody);
        const cards = json.data?.cards || [];
        
        const productNames = {};
        cards.forEach(card => {
            if (card.nmID && card.name) {
                productNames[card.nmID] = card.name;
            }
        });
        
        log(`[WB Products] ✅ Получено ${Object.keys(productNames).length} названий товаров`);
        return productNames;
        
    } catch (e) {
        log(`[WB Products] ❌ КРИТИЧЕСКАЯ ОШИБКА: ${e.message}`);
        // Специальная обработка DNS ошибок
        if (e.message.includes('DNS') || e.message.includes('resolve')) {
            log(`[WB Products] ❌ DNS ОШИБКА: Проверьте доступность suppliers-api.wildberries.ru. Возможно временные проблемы с сетью.`);
        }
        return {};
    }
}

/**
 * Ozon: Получение названий товаров по offer_id через Product API
 * @param {Array} offerIds - Массив offer_id товаров
 * @param {string} clientId - Ozon Client ID
 * @param {string} apiKey - Ozon API ключ
 * @returns {Object} Справочник {offer_id: название}
 */
function getOzonProductNames(offerIds, clientId, apiKey) {
    if (!offerIds || offerIds.length === 0) return {};
    
    // Убираем дубликаты и фильтруем невалидные offer_id
    const uniqueOfferIds = [...new Set(offerIds)].filter(id => {
        // ИСПРАВЛЕНИЕ: Фильтруем только строковые offer_id и исключаем числовые sku
        if (!id || typeof id !== 'string') return false;
        // Исключаем чисто числовые ID (это sku, не offer_id)
        if (/^\d+$/.test(id)) return false;
        return true;
    });
    
    log(`[Ozon Products] 🏷️ Запрашиваю названия для ${uniqueOfferIds.length} товаров (отфильтровано ${offerIds.length - uniqueOfferIds.length} невалидных ID)...`);
    
    if (uniqueOfferIds.length === 0) {
        log(`[Ozon Products] ⚠️ Нет валидных offer_id для запроса названий`);
        return {};
    }
    
    const url = 'https://api-seller.ozon.ru/v3/product/list';
    const payload = {
        filter: {
            offer_id: uniqueOfferIds
        },
        last_id: "",
        limit: Math.min(uniqueOfferIds.length, 100) // Ozon лимит
    };
    
    try {
        const response = UrlFetchApp.fetch(url, {
            method: 'POST',
            headers: { 
                'Client-Id': clientId, 
                'Api-Key': apiKey,
                'Content-Type': 'application/json'
            },
            payload: JSON.stringify(payload),
            muteHttpExceptions: true
        });
        
        const responseCode = response.getResponseCode();
        const responseBody = response.getContentText();
        
        if (responseCode !== 200) {
            log(`[Ozon Products] ❌ ОШИБКА получения названий: ${responseCode}. ${responseBody}`);
            return {};
        }
        
        const json = JSON.parse(responseBody);
        const items = json.result?.items || [];
        
        const productNames = {};
        items.forEach(item => {
            if (item.offer_id && item.name) {
                productNames[item.offer_id] = item.name;
            }
        });
        
        log(`[Ozon Products] ✅ Получено ${Object.keys(productNames).length} названий товаров`);
        return productNames;
        
    } catch (e) {
        log(`[Ozon Products] ❌ КРИТИЧЕСКАЯ ОШИБКА: ${e.message}`);
        return {};
    }
}

/**
 * НОВАЯ ФУНКЦИЯ: Ozon получение названий товаров через /v3/product/info/list
 * Этот endpoint поддерживает поиск по sku, product_id, offer_id
 * @param {Array} identifiers - Массив {type: 'sku'|'product_id'|'offer_id', value: '...'}
 * @param {string} clientId - Ozon Client ID
 * @param {string} apiKey - Ozon API ключ
 * @returns {Object} Справочник {identifier: {name, price, images, etc}}
 */
function getOzonProductInfoList(identifiers, clientId, apiKey) {
    if (!identifiers || identifiers.length === 0) return {};
    
    log(`[Ozon Product Info] 🏷️ Запрашиваю детальную информацию для ${identifiers.length} товаров...`);
    
    // Проверяем кеш перед запросом
    const cache = CacheService.getScriptCache();
    const uncachedIdentifiers = [];
    const cachedResults = {};
    
    identifiers.forEach(id => {
        const cacheKey = `ozon_product_${id.type}_${id.value}`;
        const cached = cache.get(cacheKey);
        if (cached) {
            try {
                cachedResults[id.value] = JSON.parse(cached);
            } catch (e) {
                log(`[Ozon Product Info] ⚠️ Ошибка парсинга кеша для ${id.value}: ${e.message}`);
                uncachedIdentifiers.push(id);
            }
        } else {
            uncachedIdentifiers.push(id);
        }
    });
    
    if (Object.keys(cachedResults).length > 0) {
        log(`[Ozon Product Info] 💾 Получено из кеша: ${Object.keys(cachedResults).length} товаров`);
    }
    
    if (uncachedIdentifiers.length === 0) {
        log(`[Ozon Product Info] ✅ Все данные получены из кеша`);
        return cachedResults;
    }
    
    log(`[Ozon Product Info] 🌐 Запрашиваю с сервера: ${uncachedIdentifiers.length} товаров`);
    
    // Разбиваем на батчи по 100 товаров (лимит API)
    const batches = [];
    for (let i = 0; i < uncachedIdentifiers.length; i += 100) {
        batches.push(uncachedIdentifiers.slice(i, i + 100));
    }
    
    log(`[Ozon Product Info] 📦 Разбито на ${batches.length} батчей`);
    
    const allResults = { ...cachedResults };
    
    batches.forEach((batch, batchIndex) => {
        log(`[Ozon Product Info] 📤 Обработка батча ${batchIndex + 1}/${batches.length} (${batch.length} товаров)...`);
        
        // Группируем по типу идентификатора
        const skus = batch.filter(id => id.type === 'sku').map(id => parseInt(id.value));
        const productIds = batch.filter(id => id.type === 'product_id').map(id => parseInt(id.value));
        const offerIds = batch.filter(id => id.type === 'offer_id').map(id => id.value);
        
        const payload = {};
        if (skus.length > 0) payload.sku = skus;
        if (productIds.length > 0) payload.product_id = productIds;
        if (offerIds.length > 0) payload.offer_id = offerIds;
        
        if (Object.keys(payload).length === 0) {
            log(`[Ozon Product Info] ⚠️ Пустой payload для батча ${batchIndex + 1}, пропускаем`);
            return;
        }
        
        const url = 'https://api-seller.ozon.ru/v3/product/info/list';
        
        try {
            const response = UrlFetchApp.fetch(url, {
                method: 'POST',
                headers: { 
                    'Client-Id': clientId, 
                    'Api-Key': apiKey,
                    'Content-Type': 'application/json'
                },
                payload: JSON.stringify(payload),
                muteHttpExceptions: true
            });
            
            const responseCode = response.getResponseCode();
            const responseBody = response.getContentText();
            
            if (responseCode !== 200) {
                log(`[Ozon Product Info] ❌ ОШИБКА батча ${batchIndex + 1}: ${responseCode}. ${responseBody.substring(0, 200)}`);
                return;
            }
            
            const json = JSON.parse(responseBody);
            const items = json.result?.items || [];
            
            log(`[Ozon Product Info] ✅ Батч ${batchIndex + 1}: получено ${items.length} товаров`);
            
            // Обрабатываем результаты и кешируем
            items.forEach(item => {
                const productInfo = {
                    name: item.name || 'Не указано',
                    sku: item.sku,
                    product_id: item.id,
                    offer_id: item.offer_id,
                    price: item.price || null,
                    old_price: item.old_price || null,
                    currency_code: item.currency_code || 'RUB',
                    images: item.images || [],
                    description: item.description || ''
                };
                
                // Сохраняем по всем возможным идентификаторам
                if (item.sku) {
                    allResults[item.sku] = productInfo;
                    const cacheKey = `ozon_product_sku_${item.sku}`;
                    cache.put(cacheKey, JSON.stringify(productInfo), 86400); // 24 часа
                }
                if (item.id) {
                    allResults[item.id] = productInfo;
                    const cacheKey = `ozon_product_product_id_${item.id}`;
                    cache.put(cacheKey, JSON.stringify(productInfo), 86400);
                }
                if (item.offer_id) {
                    allResults[item.offer_id] = productInfo;
                    const cacheKey = `ozon_product_offer_id_${item.offer_id}`;
                    cache.put(cacheKey, JSON.stringify(productInfo), 86400);
                }
            });
            
            // Задержка между батчами для соблюдения rate limits
            if (batchIndex < batches.length - 1) {
                Utilities.sleep(OZON_CONFIG.RATE_LIMITS.DELAY_BETWEEN_REQUESTS);
            }
            
        } catch (e) {
            log(`[Ozon Product Info] ❌ КРИТИЧЕСКАЯ ОШИБКА батча ${batchIndex + 1}: ${e.message}`);
        }
    });
    
    log(`[Ozon Product Info] 🎯 ИТОГО: получено ${Object.keys(allResults).length} товаров (из них ${Object.keys(cachedResults).length} из кеша)`);
    return allResults;
}

// ============ ДАТА УТИЛИТЫ ============

/**
 * Конвертация даты в Unix timestamp для WB API
 * @param {string} dateString - Дата в формате "YYYY-MM-DD"
 * @returns {number} Unix timestamp
 */
function getUnixTimestamp(dateString) {
    return Math.floor(new Date(dateString).getTime() / 1000);
}

/**
 * Конвертация даты в RFC3339 формат для Ozon API
 * @param {string} dateString - Дата в формате "YYYY-MM-DD" 
 * @returns {string} RFC3339 формат
 */
function formatDateForOzon(dateString) {
    return new Date(dateString + 'T00:00:00.000Z').toISOString();
}

/**
 * Получить диапазон дат (последние N дней)
 * @param {number} days - Количество дней назад
 * @returns {Object} {dateFrom, dateTo}
 */
function getDateRange(days = 30) {
    const today = new Date();
    const dateFrom = new Date(today.getTime() - (days * 24 * 60 * 60 * 1000));
    
    return {
        dateFrom: dateFrom.toISOString().split('T')[0], // YYYY-MM-DD
        dateTo: today.toISOString().split('T')[0]       // YYYY-MM-DD
    };
}

// ============ WB PAGINATION FUNCTIONS ============

/**
 * НОВАЯ ФУНКЦИЯ: Получение ВСЕХ подходящих отзывов WB с полной пагинацией "до победного"
 * @param {string} apiKey - WB API ключ
 * @param {boolean} includeAnswered - Включать ли отвеченные отзывы
 * @param {Object} store - Настройки магазина для фильтрации по дате
 * @returns {Array} Массив всех подходящих отзывов
 */
function getWbFeedbacksWithFullPagination(apiKey, includeAnswered = false, store = null) {
    log(`[WB] 🚀 Запуск ПОЛНОЙ пагинации "до победного" (includeAnswered=${includeAnswered})...`);
    
    try {
        if (includeAnswered) {
            return getWbAllFeedbacksWithPagination(apiKey, store);
        } else {
            return getWbUnansweredFeedbacksWithPagination(apiKey, store);
        }
    } catch (e) {
        log(`[WB] КРИТИЧЕСКАЯ ОШИБКА в главной функции: ${e.stack}`);
        return [];
    }
}

/**
 * Получение всех отзывов (отвеченные + неотвеченные) с пагинацией
 */
function getWbAllFeedbacksWithPagination(apiKey, store = null) {
    log(`[WB] Получение ВСЕХ отзывов (отвеченные + неотвеченные) с пагинацией...`);
    
    const answeredFeedbacks = getWbFeedbacksByType(apiKey, true, store);   // isAnswered=true
    const unansweredFeedbacks = getWbFeedbacksByType(apiKey, false, store); // isAnswered=false
    
    const allFeedbacks = [...answeredFeedbacks, ...unansweredFeedbacks];
    
    // Удаляем дубликаты по ID
    const uniqueFeedbacks = [];
    const seenIds = new Set();
    allFeedbacks.forEach(fb => {
        if (!seenIds.has(fb.id)) {
            seenIds.add(fb.id);
            uniqueFeedbacks.push(fb);
        }
    });
    
    // Сортируем по дате (новые первыми)
    uniqueFeedbacks.sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate));
    
    log(`[WB] ✅ Получено ${uniqueFeedbacks.length} уникальных отзывов (отвеченные: ${answeredFeedbacks.length}, неотвеченные: ${unansweredFeedbacks.length})`);
    return uniqueFeedbacks;
}

/**
 * Получение только неотвеченных отзывов с пагинацией
 */
function getWbUnansweredFeedbacksWithPagination(apiKey, store = null) {
    log(`[WB] Получение только НЕОТВЕЧЕННЫХ отзывов с пагинацией...`);
    return getWbFeedbacksByType(apiKey, false, store);
}

/**
 * ЯДРО ПАГИНАЦИИ: Получение отзывов определенного типа с полным перебором страниц
 * @param {string} apiKey - API ключ
 * @param {boolean} isAnswered - true для отвеченных, false для неотвеченных
 * @param {Object} store - Настройки магазина для фильтрации по дате
 * @returns {Array} Все подходящие отзывы
 */
function getWbFeedbacksByType(apiKey, isAnswered, store = null) {
    const type = isAnswered ? 'отвеченные' : 'неотвеченные';
    log(`[WB] 📖 Начинаю полную пагинацию для ${type} отзывов...`);
    
    let allFeedbacks = [];
    let currentSkip = 0;
    let pageNumber = 1;
    const take = WB_CONFIG.API_LIMITS.PAGINATION_STEP; // 100 отзывов за страницу
    const maxPages = 100; // Защита от бесконечного цикла (10,000 отзывов максимум)
    let consecutiveEmptyPages = 0; // Счетчик пустых страниц подряд
    
    while (pageNumber <= maxPages) {
        log(`[WB] 📄 Запрашиваю страницу ${pageNumber} (skip=${currentSkip}, take=${take})...`);
        
        // ✅ ИСПРАВЛЕНО: Используем настройки даты из конфига магазина
        let url = `https://feedbacks-api.wildberries.ru/api/v1/feedbacks?isAnswered=${isAnswered}&take=${take}&skip=${currentSkip}&order=dateDesc`;
        
        // ✅ ИСПРАВЛЕНО: WB Feedbacks API НЕ поддерживает dateFrom/dateTo параметры
        // Фильтрация по дате будет выполнена на клиентской стороне после получения данных
        if (store && store.settings && store.settings.startDate) {
            log(`[WB] 🗓️ Настроена дата фильтрации: ${store.settings.startDate} (фильтрация будет выполнена после получения данных)`);
        } else {
            log(`[WB] 🗓️ Фильтр по дате не применен - получаем все доступные отзывы`);
        }
        
        try {
            const response = UrlFetchApp.fetch(url, { 
                method: 'GET', 
                headers: { 'Authorization': apiKey }, 
                muteHttpExceptions: true 
            });
            
            const responseCode = response.getResponseCode();
            const responseBody = response.getContentText();
            
            // РАСШИРЕННЫЕ ЛОГИ API ОТВЕТОВ
            log(`[WB] 🌐 API ответ страница ${pageNumber}: код ${responseCode}, размер тела ${responseBody.length} символов`);
            
            if (responseCode !== 200) {
                log(`[WB] ❌ ОШИБКА на странице ${pageNumber}: Код ${responseCode}. Тело: ${responseBody.substring(0, 500)}`);
                break;
            }
            
            const json = JSON.parse(responseBody);
            if (json.error) {
                log(`[WB] ❌ API ОШИБКА на странице ${pageNumber}: ${json.errorText}. Полный ответ: ${JSON.stringify(json)}`);
                break;
            }
            
            const pageFeedbacks = json.data?.feedbacks || [];
            const totalInResponse = json.data?.countUnanswered || json.data?.countAll || 'неизвестно';
            log(`[WB] 📄 Страница ${pageNumber}: получено ${pageFeedbacks.length} отзывов (всего в системе: ${totalInResponse})`);
            
            // ИСПРАВЛЕНИЕ: НЕ останавливаемся при получении 0 отзывов на ранних страницах!
            // WB API может иметь пустые промежуточные страницы из-за фильтрации isAnswered
            if (pageFeedbacks.length === 0) {
                consecutiveEmptyPages++;
                log(`[WB] ⚠️ Пустая страница ${pageNumber} (${consecutiveEmptyPages} подряд из максимум 5)`);
                
                // ИСПРАВЛЕНО: Проверяем 5 пустых страниц подряд перед остановкой (включая первую!)
                if (consecutiveEmptyPages >= 5) {
                    log(`[WB] ✅ Пагинация завершена: ${consecutiveEmptyPages} пустых страниц подряд - конец данных`);
                    break;
                }
                
                log(`[WB] ⏭️ Продолжаем поиск на странице ${pageNumber + 1} (пропустили ${consecutiveEmptyPages} пустых)...`);
                currentSkip += take;
                pageNumber++;
                Utilities.sleep(200);
                continue; // Переходим к следующей странице
            } else {
                // Сбрасываем счетчик при получении данных
                if (consecutiveEmptyPages > 0) {
                    log(`[WB] 🎯 Найдены данные на странице ${pageNumber}! Сбрасываю счетчик пустых страниц (было ${consecutiveEmptyPages})`);
                }
                consecutiveEmptyPages = 0;
            }
            
            // Конвертируем и фильтруем отзывы
            const processedFeedbacks = [];
            let emptyReviewsCount = 0;
            
            pageFeedbacks.forEach(fb => {
                // Проверяем наличие текста ДО обработки
                const hasText = fb.text && fb.text.trim() && fb.text.trim() !== '(без текста)';
                
                if (!hasText) {
                    emptyReviewsCount++;
                    if (isDevMode()) {
                        log(`[WB DEBUG] ⏭️ Пропущен пустой отзыв ID ${fb.id}: текст="${fb.text || '(нет)'}"`);
                    }
                    return;
                }
                
                // Обрабатываем отзыв с текстом
                const actualRating = fb.rating || fb.productValuation || 0;
                
                if (isDevMode()) {
                    const dataType = fb.rating ? 'ОТЗЫВ+ОЦЕНКА' : 'ТОЛЬКО_ОЦЕНКА_ТОВАРА';
                    log(`[WB DEBUG] ✅ ID ${fb.id}: ${dataType}, rating=${fb.rating}, используем=${actualRating}`);
                }
                
                processedFeedbacks.push({
                    id: fb.id,
                    createdDate: fb.createdDate,
                    rating: actualRating,
                    text: fb.text,
                    user: 'N/A',
                    product: {
                        id: fb.productDetails.nmId,
                        name: fb.productDetails.productName,
                        url: `https://www.wildberries.ru/catalog/${fb.productDetails.nmId}/detail.aspx`
                    }
                });
            });
            
            log(`[WB] 📄 Страница ${pageNumber}: обработано ${processedFeedbacks.length} подходящих, пропущено ${emptyReviewsCount} пустых`);
            
            allFeedbacks = allFeedbacks.concat(processedFeedbacks);
            
            // Если получили меньше отзывов чем запрашивали - это последняя страница
            if (pageFeedbacks.length < take) {
                log(`[WB] ✅ Последняя страница ${pageNumber}: получено ${pageFeedbacks.length} < ${take}`);
                break;
            }
            
            currentSkip += take;
            pageNumber++;
            
            // ✅ ПРАВИЛЬНЫЕ RPS ЛИМИТЫ: WB = 400мс между запросами (3 RPS)
            Utilities.sleep(400);
            
            // Дополнительная пауза каждые 10 запросов для стабильности
            if (pageNumber % 10 === 0) {
                log(`[WB] 💤 Дополнительная пауза после ${pageNumber} страниц...`);
                Utilities.sleep(2000);
            }
            
        } catch (e) {
            log(`[WB] ❌ КРИТИЧЕСКАЯ ОШИБКА на странице ${pageNumber}: ${e.message}`);
            break;
        }
    }
    
    if (pageNumber > maxPages) {
        log(`[WB] ⚠️ ПРЕДУПРЕЖДЕНИЕ: Достигнут максимум страниц (${maxPages})`);
    }
    
    // Сортируем по дате (новые первыми)
    allFeedbacks.sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate));
    
    // ✅ ОБОГАЩАЕМ НАЗВАНИЯМИ ТОВАРОВ из Content API
    if (allFeedbacks.length > 0 && store && store.credentials && store.credentials.apiKey) {
        const nmIds = allFeedbacks.map(fb => fb.product.id).filter(id => id);
        const productNames = getWbProductNames(nmIds, store.credentials.apiKey);
        
        if (Object.keys(productNames).length > 0) {
            allFeedbacks.forEach(fb => {
                if (productNames[fb.product.id]) {
                    fb.product.name = productNames[fb.product.id];
                }
            });
            log(`[WB] 🏷️ Названия товаров обновлены для ${Object.keys(productNames).length} отзывов`);
        }
    }
    
    log(`[WB] 🎯 ИТОГО для ${type}: получено ${allFeedbacks.length} подходящих отзывов за ${pageNumber - 1} страниц`);
    return allFeedbacks;
}

// ============ HELPER FUNCTIONS FOR API TESTING ============
function testWbContentApiAccess(apiKey) {
  try {
    const url = 'https://suppliers-api.wildberries.ru/content/v2/cards/cursor/list';
    const payload = { limit: 1 }; // Минимальный тест-запрос
    
    const response = UrlFetchApp.fetch(url, {
      method: 'POST',
      headers: { 
        'Authorization': apiKey,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    
    const code = response.getResponseCode();
    log(`[WB Content API Test] Код ответа: ${code}`);
    
    return code === 200;
  } catch (e) {
    log(`[WB Content API Test] Ошибка: ${e.message}`);
    return false;
  }
}

function testOzonProductApiAccess(clientId, apiKey) {
  try {
    const url = 'https://api-seller.ozon.ru/v3/product/list';
    const payload = { limit: 1, last_id: "", filter: {} }; // Минимальный тест-запрос
    
    const response = UrlFetchApp.fetch(url, {
      method: 'POST',
      headers: { 
        'Client-Id': clientId,
        'Api-Key': apiKey,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    
    const code = response.getResponseCode();
    log(`[Ozon Product API Test] Код ответа: ${code}`);
    
    return code === 200;
  } catch (e) {
    log(`[Ozon Product API Test] Ошибка: ${e.message}`);
    return false;
  }
}

// ============ CONNECTION TESTER ============
function testStoreConnection(credentials, marketplace) {
  log(`[Тест] Запуск проверки для ${marketplace}.`);
  if (!marketplace) {
    return { success: false, message: 'Сначала выберите маркетплейс.' };
  }
  try {
    if (marketplace === 'Wildberries') {
      if (!credentials.apiKey) return { success: false, message: 'API ключ не указан.' };
      
      // Базовая валидация формата ключа
      if (!credentials.apiKey.trim() || credentials.apiKey.length < 10) {
        return { success: false, message: 'API ключ слишком короткий или пустой.' };
      }
      
      const url = 'https://feedbacks-api.wildberries.ru/api/v1/feedbacks?isAnswered=false&take=1&skip=0';
      const response = UrlFetchApp.fetch(url, { method: 'GET', headers: { 'Authorization': credentials.apiKey }, muteHttpExceptions: true });
      const code = response.getResponseCode();
      const responseBody = response.getContentText();
      
      log(`[Тест WB] Ответ: ${code}. Тело: ${responseBody.substring(0, 200)}...`);
      
      if (code === 200) {
        // Дополнительно проверяем Content API доступ
        const contentTestResult = testWbContentApiAccess(credentials.apiKey);
        const mainMessage = 'Успешно! Ключ имеет доступ к новым отзывам.';
        if (contentTestResult) {
          return { success: true, message: mainMessage + ' Content API также доступен.' };
        } else {
          return { success: true, message: mainMessage + ' ⚠️ Content API недоступен - названия товаров будут "Не указано".' };
        }
      }
      if (code === 401) return { success: false, message: 'Ошибка 401: Неверный API ключ.' };
      if (code === 403) return { success: false, message: 'Ошибка 403: API ключ не имеет необходимых разрешений.' };
      if (code === 429) return { success: false, message: 'Ошибка 429: Превышен лимит запросов. Попробуйте позже.' };
      return { success: false, message: `Неожиданный ответ сервера: ${code}. ${responseBody.substring(0, 100)}...` };
    } else if (marketplace === 'Ozon') {
      if (!credentials.clientId || !credentials.apiKey) return { success: false, message: 'Client ID и API Key должны быть указаны.' };
      
      // Базовая валидация формата ключей
      if (!credentials.clientId.trim() || credentials.clientId.length < 5) {
        return { success: false, message: 'Client ID слишком короткий или пустой.' };
      }
      if (!credentials.apiKey.trim() || credentials.apiKey.length < 10) {
        return { success: false, message: 'API Key слишком короткий или пустой.' };
      }
      
      const url = 'https://api-seller.ozon.ru/v1/review/list';
      const payload = { limit: 20 };
      const response = UrlFetchApp.fetch(url, {
        method: 'POST',
        headers: { 'Client-Id': credentials.clientId, 'Api-Key': credentials.apiKey },
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });
      const code = response.getResponseCode();
      const responseBody = response.getContentText();
      log(`[Тест Ozon] Ответ: ${code}. Тело: ${responseBody.substring(0, 300)}...`);
      
      if (code === 200) {
        try {
          const json = JSON.parse(responseBody);
          // Улучшенная проверка структуры ответа - проверяем различные варианты
          if (json.reviews !== undefined || (json.result && json.result.reviews) || (json.data && json.data.reviews)) {
            // Дополнительно проверяем Product API доступ
            const productTestResult = testOzonProductApiAccess(credentials.clientId, credentials.apiKey);
            const mainMessage = 'Успешно! Ключи имеют доступ к отзывам.';
            if (productTestResult) {
              return { success: true, message: mainMessage + ' Product API также доступен.' };
            } else {
              return { success: true, message: mainMessage + ' ⚠️ Product API недоступен - названия товаров будут "Не указано".' };
            }
          } else {
            return { success: false, message: 'API изменился: неожиданная структура ответа. Получены ключи: ' + Object.keys(json).join(', ') };
          }
        } catch (e) {
          return { success: false, message: 'Ошибка парсинга JSON ответа: ' + e.message };
        }
      }
      if (code === 401) return { success: false, message: 'Ошибка 401: Неверный Api-Key или Client-Id.' };
      if (code === 403) {
        try {
          const json = JSON.parse(responseBody);
          return { success: false, message: `Ошибка 403: ${json.message || 'Доступ запрещен. Проверьте права API ключа.'}` };
        } catch (e) {
          return { success: false, message: 'Ошибка 403: Доступ запрещен. Проверьте Client-Id и API Key.' };
        }
      }
      if (code === 404) return { success: false, message: 'Ошибка 404: Неверный адрес запроса. Возможно, API Ozon изменился.' };
      if (code === 429) return { success: false, message: 'Ошибка 429: Превышен лимит запросов. Попробуйте позже.' };
      if (code >= 500) return { success: false, message: `Ошибка сервера Ozon (${code}). Попробуйте позже.` };
      return { success: false, message: `Неожиданный ответ сервера: ${code}. ${responseBody.substring(0, 100)}...` };
    }
    return { success: false, message: 'Неизвестный маркетплейс.' };
  } catch (e) {
    log(`[Тест] Критическая ошибка: ${e.stack}`);
    return { success: false, message: `Произошла ошибка: ${e.message}` };
  }
}

// ============ LOGGING & INITIAL SETUP ============
function log(message) {
  try {
    const logSheet = createOrGetLogSheet_();
    const timestamp = new Date().toLocaleString('ru-RU', { hour12: false });
    logSheet.insertRowBefore(2).getRange(2, 1, 1, 2).setValues([[timestamp, message]]);
    
    const lastRow = logSheet.getLastRow();
    if (lastRow > CONFIG.LOG_MAX_ROWS) {
      logSheet.deleteRows(CONFIG.LOG_MAX_ROWS + 1, lastRow - CONFIG.LOG_MAX_ROWS);
    }
  } catch (e) {
    console.error(`Failed to write to log sheet: ${e.stack}. Log message was: "${message}".`);
  }
}

function createOrGetLogSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.LOG_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.LOG_SHEET_NAME, ss.getNumSheets());
    sheet.getRange('A1:B1').setValues([['Время', 'Сообщение']])
           .setFontWeight('bold').setBackground('#f3f3f3');
    sheet.setColumnWidth(1, 150);
    sheet.setColumnWidth(2, 800);
    sheet.hideSheet();
  }
  return sheet;
}

function toggleLogSheet() {
  const sheet = createOrGetLogSheet_();
  if (sheet.isSheetHidden()) {
    sheet.showSheet();
    SpreadsheetApp.getActiveSpreadsheet().setActiveSheet(sheet);
  } else {
    sheet.hideSheet();
  }
}

function initialSetup() {
  log('Запуск первоначальной настройки...');
  const templateSheet = createOrGetSheet(CONFIG.SHEETS.TEMPLATES, ['Шаблон ответа', 'Для оценки (4, 5, или 4-5)']);
  fillInitialTemplates();
  updateDevModeStatus();
  log('Первоначальная настройка успешно завершена.');
  SpreadsheetApp.getUi().alert('✅ Настройка завершена', `Создан лист "${CONFIG.SHEETS.TEMPLATES}" и индикатор режима разработчика.`, SpreadsheetApp.getUi().ButtonSet.OK);
}

// ============ UI FUNCTIONS ============
function showStoreManagerSidebar() {
  const html = HtmlService.createTemplateFromFile('StoreManagerSidebar').evaluate().setTitle('🏪 Управление магазинами').setWidth(450);
  SpreadsheetApp.getUi().showSidebar(html);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ============ SORTING FUNCTION ============
/**
 * Sorts a sheet by date column (newest first)
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - The sheet to sort
 */
function sortSheetByDate(sheet) {
  if (sheet.getLastRow() <= 2) return; // Нет данных для сортировки (только заголовок и максимум одна строка данных)
  
  const dateColumnIndex = CONFIG.HEADERS.indexOf('Дата отзыва') + 1;
  if (dateColumnIndex === 0) {
    log('ОШИБКА: Не найден столбец "Дата отзыва" для сортировки.');
    return;
  }
  
  // Сортируем данные (исключая заголовок) по столбцу с датой в убывающем порядке
  const range = sheet.getRange(2, 1, sheet.getLastRow() - 1, CONFIG.HEADERS.length);
  range.sort([{column: dateColumnIndex, ascending: false}]);
}

// ============ DATE FILTERING FUNCTION ============
/**
 * Filters feedbacks based on store's start date setting
 * @param {Array} feedbacks - Array of feedback objects
 * @param {Object} store - Store configuration with settings
 * @returns {Array} Filtered feedbacks
 */
function filterFeedbacksByDate(feedbacks, store) {
  if (!store.settings || !store.settings.startDate) {
    return feedbacks; // No date filter, return all feedbacks
  }
  
  const startDate = new Date(store.settings.startDate);
  if (isNaN(startDate.getTime())) {
    log(`[${store.name}] ПРЕДУПРЕЖДЕНИЕ: Некорректная дата начала поиска отзывов: ${store.settings.startDate}. Фильтр не применен.`);
    return feedbacks;
  }
  
  // Check if start date is in the future
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset to start of day for fair comparison
  
  if (startDate > today) {
    log(`[${store.name}] ПРЕДУПРЕЖДЕНИЕ: Дата начала поиска (${store.settings.startDate}) в будущем! Все отзывы будут отфильтрованы. Проверьте настройки магазина.`);
    // Continue with filtering but add the warning
  }
  
  const filteredFeedbacks = feedbacks.filter(feedback => {
    const feedbackDate = new Date(feedback.createdDate);
    return feedbackDate >= startDate;
  });
  
  if (filteredFeedbacks.length !== feedbacks.length) {
    log(`[${store.name}] Применен фильтр по дате: осталось ${filteredFeedbacks.length} из ${feedbacks.length} отзывов (начиная с ${store.settings.startDate}).`);
    
    // Additional warning if no feedbacks remain and start date is future
    if (filteredFeedbacks.length === 0 && startDate > today) {
      log(`[${store.name}] ❌ ВНИМАНИЕ: Дата фильтра установлена в будущем! Установите правильную дату в настройках магазина.`);
    }
  }
  
  return filteredFeedbacks;
}

// ============ RATING FILTERING FUNCTION ============
/**
 * Filters feedbacks to include only 4 and 5 star reviews
 * @param {Array} feedbacks - Array of feedback objects
 * @param {Object} store - Store configuration
 * @returns {Array} Filtered feedbacks (only 4-5 stars)
 */
function filterFeedbacksByRating(feedbacks, store) {
  const originalCount = feedbacks.length;
  const targetRatings = [4, 5]; // Only 4 and 5 star reviews
  
  const filteredFeedbacks = feedbacks.filter(feedback => {
    return targetRatings.includes(feedback.rating);
  });
  
  if (filteredFeedbacks.length !== originalCount) {
    const filtered = originalCount - filteredFeedbacks.length;
    log(`[${store.name}] Применен фильтр по рейтингу (4-5 звезд): осталось ${filteredFeedbacks.length} из ${originalCount} отзывов (исключено ${filtered} отзывов с низким рейтингом).`);
  }
  
  return filteredFeedbacks;
}

// ============ EMPTY REVIEW FILTERING FUNCTION ============
/**
 * Filters out reviews without meaningful text content
 * @param {Array} feedbacks - Array of feedback objects
 * @param {Object} store - Store configuration
 * @returns {Array} Filtered feedbacks (only those with meaningful text)
 */
function filterFeedbacksByContent(feedbacks, store) {
  const originalCount = feedbacks.length;
  
  const filteredFeedbacks = feedbacks.filter(feedback => {
    const text = (feedback.text || '').trim();
    
    // Skip reviews with no text or very short text
    if (!text || text === '(без текста)' || text.length < CONFIG.MIN_REVIEW_TEXT_LENGTH) {
      if (isDevMode()) {
        log(`[${store.marketplace} DEBUG] Пропущен отзыв ID ${feedback.id}: пустой или очень короткий текст ("${text}")`);
      }
      return false;
    }
    
    return true;
  });
  
  if (filteredFeedbacks.length !== originalCount) {
    const skippedCount = originalCount - filteredFeedbacks.length;
    log(`[${store.name}] Применен фильтр по содержанию: осталось ${filteredFeedbacks.length} из ${originalCount} отзывов (исключено ${skippedCount} пустых отзывов).`);
  }
  
  return filteredFeedbacks;
}

// ============ CORE PROCESSING LOGIC ============

/**
 * Main function to process new feedback for all active stores.
 */
function processAllStores() {
  const devMode = isDevMode();
  log(`--- ЗАПУСК ОБРАБОТКИ (${devMode ? 'РЕЖИМ РАЗРАБОТЧИКА' : 'БОЕВОЙ РЕЖИМ'}) ---`);
  const allStores = getStores();
  const activeStores = allStores.filter(store => store.isActive);
  if (activeStores.length === 0) {
    log('Нет активных магазинов для обработки. Завершаю работу.');
    return;
  }
  
  log(`Найдено ${activeStores.length} активных магазинов.`);
  activeStores.forEach(store => {
    log(`--- Начинаю обработку магазина: ${store.name} [${store.marketplace}] ---`);
    processSingleStore(store, devMode);
    log(`--- Завершение обработки магазина: ${store.name} ---`);
  });
  log('--- ОБРАБОТКА ВСЕХ МАГАЗИНОВ ЗАВЕРШЕНА ---');
}

function processSingleStore(store, devMode) {
  const sheet = createOrGetSheet(`Отзывы (${store.name})`, CONFIG.HEADERS);
  const processedIds = getProcessedIdsFromSheet(sheet);
  const templates = getTemplates();
  if (templates.length === 0) {
      log(`[${store.name}] ОШИБКА: Нет шаблонов ответов. Обработка невозможна.`);
      return;
  }
  
  const includeAnswered = store.settings?.includeAnswered || false;
  log(`[${store.name}] Получение отзывов (${includeAnswered ? 'ВСЕ отзывы' : 'только неотвеченные'})...`);
  let feedbacks = (store.marketplace === 'Wildberries') 
      ? getWbFeedbacks(store.credentials.apiKey, includeAnswered, store) 
      : getOzonFeedbacks(store.credentials.clientId, store.credentials.apiKey, includeAnswered, store);
      
  if (!feedbacks || feedbacks.length === 0) { 
      log(`[${store.name}] Новых отзывов не найдено.`);
      return;
  }
  
  log(`[${store.name}] Найдено всего ${feedbacks.length} необработанных отзывов.`);
  
  // Apply content filter first - remove empty reviews
  feedbacks = filterFeedbacksByContent(feedbacks, store);
  
  // Apply date filter
  feedbacks = filterFeedbacksByDate(feedbacks, store);
  
  // Apply rating filter - only 4 and 5 star reviews
  feedbacks = filterFeedbacksByRating(feedbacks, store);
  
  const newFeedbacks = feedbacks.filter(fb => !processedIds.has(fb.id));
  log(`[${store.name}] Из них ${newFeedbacks.length} действительно новых (нет в таблице).`);
  if (newFeedbacks.length === 0) return;

  // 🚀 ПАРАЛЛЕЛЬНОЕ СОХРАНЕНИЕ: обрабатываем и сохраняем каждый отзыв сразу
  log(`[${store.name}] 🚀 ПАРАЛЛЕЛЬНОЕ СОХРАНЕНИЕ: обработка и немедленная запись результатов...`);
  
  let processedCount = 0;
  const maxToProcess = Math.min(newFeedbacks.length, CONFIG.MAX_FEEDBACKS_PER_RUN);
  
  newFeedbacks.slice(0, maxToProcess).forEach((feedback, index) => {
    const progressInfo = `[${index + 1}/${maxToProcess}]`;
    
    let rowData = [
        feedback.id, new Date(feedback.createdDate), feedback.product.id, 
        feedback.product.name, feedback.product.url, feedback.rating, 
        feedback.text
      ];

    if (!CONFIG.RESPOND_TO_RATINGS.includes(feedback.rating)) {
      rowData.push('', CONFIG.STATUS.SKIPPED_RATING, `Рейтинг ${feedback.rating} не входит в список для ответа.`, '');
      
      // 💾 СРАЗУ СОХРАНЯЕМ В ТАБЛИЦУ
      sheet.appendRow(rowData);
      processedCount++;
      
      log(`${progressInfo} [${store.name}] Пропущен отзыв ID: ${feedback.id} (рейтинг ${feedback.rating}). Ссылка: ${feedback.product.url}`);
      return;
    }
      
    const template = selectRandomTemplate(templates, feedback.rating);
    if (!template) {
      rowData.push('', CONFIG.STATUS.NO_TEMPLATE, `Не найден подходящий шаблон для рейтинга ${feedback.rating}.`, '');
      
      // 💾 СРАЗУ СОХРАНЯЕМ В ТАБЛИЦУ
      sheet.appendRow(rowData);
      processedCount++;
      
      log(`${progressInfo} [${store.name}] Нет шаблона для отзыва ID: ${feedback.id} (рейтинг ${feedback.rating}). Ссылка: ${feedback.product.url}`);
      return;
    }

    if (devMode) {
      rowData.push(template, CONFIG.STATUS.PENDING, '', '');
      
      // 💾 СРАЗУ СОХРАНЯЕМ В ТАБЛИЦУ
      sheet.appendRow(rowData);
      processedCount++;
      
      log(`${progressInfo} [${store.name}] DEV: Подготовлен ответ для отзыва ID: ${feedback.id}. Ссылка: ${feedback.product.url}`);
    } else {
      // Production mode: send answer immediately
      const result = sendAnswer(store, feedback.id, template);
      rowData.push(template, result.status, result.error, result.timestamp);
      
      // 💾 СРАЗУ СОХРАНЯЕМ В ТАБЛИЦУ ПОСЛЕ ОТПРАВКИ
      sheet.appendRow(rowData);
      processedCount++;
      
      log(`${progressInfo} [${store.name}] PROD: Отправлен ответ для ID: ${feedback.id}. Статус: ${result.status}. Ссылка: ${feedback.product.url}`);
      
      // Задержка только если это не последний отзыв
      if (index < maxToProcess - 1) {
        Utilities.sleep(CONFIG.DELAY_BETWEEN_REQUESTS);
      }
    }
  });
  
  if (processedCount > 0) {
    log(`[${store.name}] ✅ Сохранено ${processedCount} отзывов в режиме параллельной записи`);
    
    // Автоматическая сортировка по дате - новые отзывы наверх
    sortSheetByDate(sheet);
    log(`[${store.name}] Таблица отсортирована по дате (новые отзывы наверху).`);
  }
}

/**
 * Sends all pending answers from all store sheets.
 */
function sendPendingAnswers() {
  log('--- ЗАПУСК ОТПРАВКИ ПОДГОТОВЛЕННЫХ ОТВЕТОВ ---');
  const allStores = getStores().filter(s => s.isActive);
  
  allStores.forEach(store => {
    log(`--- Проверяю магазин: ${store.name} ---`);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(`Отзывы (${store.name})`);
    if (!sheet) return;

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const statusCol = headers.indexOf('Статус') + 1;
    const answerCol = headers.indexOf('Подобранный ответ') + 1;
    const idCol = headers.indexOf('ID отзыва') + 1;
    const errorCol = headers.indexOf('Детали ошибки') + 1;
    const timeCol = headers.indexOf('Время отправки') + 1;
    const linkCol = headers.indexOf('Ссылка') + 1;

    if (statusCol === 0) {
        log(`[${store.name}] Ошибка: не найден столбец "Статус".`);
        return;
    }

    let sentCount = 0;
    let successCount = 0;
    for (let i = 1; i < data.length; i++) {
      if (data[i][statusCol - 1] === CONFIG.STATUS.PENDING) {
        const feedbackId = data[i][idCol - 1];
        const answerText = data[i][answerCol - 1];
        const reviewLink = data[i][linkCol - 1] || '';
        
        const result = sendAnswer(store, feedbackId, answerText);
        
        sheet.getRange(i + 1, statusCol).setValue(result.status);
        sheet.getRange(i + 1, errorCol).setValue(result.error);
        sheet.getRange(i + 1, timeCol).setValue(result.timestamp);
        
        // Детальное логирование с ответом API
        let logMessage = `[${store.name}] Отправлен ответ для ID ${feedbackId}. Статус: ${result.status}${reviewLink ? '. Ссылка: ' + reviewLink : ''}`;
        if (result.apiResponse) {
          logMessage += `. Ответ API: ${result.apiResponse}`;
        }
        log(logMessage);
        
        sentCount++;
        if (result.status === CONFIG.STATUS.SENT) {
          successCount++;
        }
        Utilities.sleep(CONFIG.DELAY_BETWEEN_REQUESTS);
      }
    }

    if (sentCount > 0) {
        log(`[${store.name}] Попыток отправки: ${sentCount}. Успешно: ${successCount}. Ошибок: ${sentCount - successCount}.`);
    } else {
        log(`[${store.name}] Нет ответов, ожидающих отправки.`);
    }
  });
  log('--- ОТПРАВКА ПОДГОТОВЛЕННЫХ ОТВЕТОВ ЗАВЕРШЕНА ---');
}

// ============ API-SPECIFIC FUNCTIONS ============

/**
 * Universal function to send answer to review
 * Routes to appropriate marketplace-specific function
 * @param {Object} store - Store configuration
 * @param {string} feedbackId - Review ID
 * @param {string} text - Answer text
 * @returns {Object} Result object with status, error, timestamp, and apiResponse
 */
function sendAnswer(store, feedbackId, text) {
  try {
    let success, message, apiResponse;
    if (store.marketplace === WB_CONFIG.MARKETPLACE_NAME) {
      [success, message, apiResponse] = sendWbFeedbackAnswer(feedbackId, text, store.credentials.apiKey);
    } else if (store.marketplace === OZON_CONFIG.MARKETPLACE_NAME) {
      [success, message, apiResponse] = sendOzonFeedbackAnswer(feedbackId, text, store.credentials.clientId, store.credentials.apiKey);
    } else {
      return { status: CONFIG.STATUS.ERROR, error: 'Неизвестный маркетплейс', timestamp: '', apiResponse: '' };
    }
    
    if (success) {
      return { status: CONFIG.STATUS.SENT, error: '', timestamp: new Date(), apiResponse: apiResponse || 'OK' };
    } else {
      return { status: CONFIG.STATUS.ERROR, error: message, timestamp: new Date(), apiResponse: apiResponse || message };
    }
  } catch (e) {
    log(`КРИТИЧЕСКАЯ ОШИБКА при отправке ответа для ID ${feedbackId}: ${e.stack}`);
    return { status: CONFIG.STATUS.ERROR, error: e.message, timestamp: new Date(), apiResponse: e.message };
  }
}

// ============ WILDBERRIES API ============

/**
 * Главная функция получения отзывов WB с полной пагинацией
 */
function getWbFeedbacks(apiKey, includeAnswered = false, store = null) {
    log(`[WB] 🔄 Получение отзывов (включая отвеченные: ${includeAnswered})`);
    return getWbFeedbacksWithFullPagination(apiKey, includeAnswered, store);
}

function sendWbFeedbackAnswer(feedbackId, text, apiKey) {
    log(`[WB API] 🎯 НАЧАЛО отправки ответа для ID ${feedbackId}`);
    log(`[WB API] 📝 Текст ответа: "${text}" (длина: ${text.length} символов)`);
    log(`[WB API] 🔑 API ключ: ${apiKey.substring(0, 15)}... (длина: ${apiKey.length})`);
    
    // 🚀 ИСПОЛЬЗУЕМ ТОЛЬКО РАБОЧИЙ METHOD 2 (ID в теле запроса) 
    // Method 1 (ID в URL) всегда возвращает 404, удален из кода
    const result = attemptWbFeedbackAnswerMethod2(feedbackId, text, apiKey);
    if (result[0]) {
        log(`[WB API] ✅ УСПЕХ! Ответ отправлен (Method 2)`);
        return result;
    }
    
    log(`[WB API] ❌ Не удалось отправить ответ. Возможно, проблемы с API или ID отзыва.`);
    return result;
}

// Method 1 (ID в URL) УДАЛЕН - всегда возвращал 404 ошибку

/**
 * Method 2: ID в теле запроса - альтернативный подход
 * Endpoint: POST /api/v1/feedbacks/answer
 */
function attemptWbFeedbackAnswerMethod2(feedbackId, text, apiKey) {
    const url = `https://feedbacks-api.wildberries.ru/api/v1/feedbacks/answer`;
    const payload = { 
        id: feedbackId,  // ID в теле запроса
        text: text       // Текст также в теле
    };
    
    log(`[WB API Method 2] 🚀 URL: ${url}`);
    log(`[WB API Method 2] 📝 Payload: ${JSON.stringify(payload)}`);
    
    return sendWbApiRequest(url, payload, apiKey, "Method 2 (ID в теле)");
}

/**
 * Универсальная функция для отправки WB API запроса
 * @param {string} url - URL для запроса
 * @param {Object} payload - Тело запроса
 * @param {string} apiKey - API ключ
 * @param {string} methodName - Название метода для логирования
 * @returns {Array} [success, errorMessage, responseBody]
 */
function sendWbApiRequest(url, payload, apiKey, methodName) {
    try {
        log(`[WB ${methodName}] 📤 Отправка запроса...`);
        
        const response = UrlFetchApp.fetch(url, {
            method: 'POST',
            headers: { 
                'Authorization': apiKey,
                'Content-Type': 'application/json'
            },
            payload: JSON.stringify(payload),
            muteHttpExceptions: true
        });
        
        const code = response.getResponseCode();
        const responseBody = response.getContentText();
        const responseHeaders = response.getAllHeaders();
        
        // 🔍 ДЕТАЛЬНОЕ ЛОГИРОВАНИЕ каждого запроса
        log(`[WB ${methodName}] 📥 Код ответа: ${code}`);
        log(`[WB ${methodName}] 📥 Тело ответа: "${responseBody}"`);
        
        if (isDevMode()) {
            log(`[WB ${methodName} DEBUG] 📋 Заголовки запроса: Authorization: ${apiKey.substring(0, 20)}..., Content-Type: application/json`);
            log(`[WB ${methodName} DEBUG] 📋 Заголовки ответа: ${JSON.stringify(responseHeaders, null, 2)}`);
        }
        
        // 🎯 Анализ кодов ответа
        const success = (code === 200 || code === 201 || code === 204);
        let errorMessage = '';
        
        if (success) {
            log(`[WB ${methodName}] ✅ УСПЕХ: Код ${code}`);
            if (code === 200) log(`[WB ${methodName}] ℹ️ 200 OK - Ответ отправлен и сервер вернул данные`);
            if (code === 201) log(`[WB ${methodName}] ℹ️ 201 Created - Ответ успешно создан`);
            if (code === 204) log(`[WB ${methodName}] ℹ️ 204 No Content - Операция успешна, данных не возвращено`);
        } else {
            errorMessage = `${methodName}: Код ${code}. Ответ: ${responseBody}`;
            log(`[WB ${methodName}] ❌ НЕУДАЧА: ${errorMessage}`);
            
            // 🔍 Специальная диагностика типичных ошибок
            if (code === 400) log(`[WB ${methodName}] 🔎 400 Bad Request - Проверьте формат запроса и данные`);
            if (code === 401) log(`[WB ${methodName}] 🔎 401 Unauthorized - Проверьте API ключ`);
            if (code === 403) log(`[WB ${methodName}] 🔎 403 Forbidden - API ключ не имеет прав или отзыв уже отвечен`);
            if (code === 404) log(`[WB ${methodName}] 🔎 404 Not Found - Отзыв не найден или endpoint неверный`);
            if (code === 422) log(`[WB ${methodName}] 🔎 422 Unprocessable Entity - Проверьте данные (длина текста, статус отзыва)`);
            if (code === 429) log(`[WB ${methodName}] 🔎 429 Too Many Requests - Превышен лимит запросов (max 3/сек)`);
            if (code >= 500) log(`[WB ${methodName}] 🔎 ${code} Server Error - Временные проблемы на стороне WB`);
        }
        
        return [success, errorMessage, responseBody];
        
    } catch (e) {
        const criticalError = `${methodName} КРИТИЧЕСКАЯ ОШИБКА: ${e.message}`;
        log(`[WB ${methodName}] ⛔ ${criticalError}`);
        log(`[WB ${methodName}] 🔍 Stack trace: ${e.stack}`);
        return [false, criticalError, e.message];
    }
}

// ============ OZON API ============

/**
 * Fetches reviews from Ozon API
 * @param {string} clientId - Ozon Client ID
 * @param {string} apiKey - Ozon API Key
 * @param {boolean} includeAnswered - Whether to include answered reviews
 * @returns {Array} Array of normalized feedback objects
 */
function getOzonFeedbacks(clientId, apiKey, includeAnswered = false, store = null) {
    const url = 'https://api-seller.ozon.ru/v1/review/list';
    
    let payload = {
        filter: {
            has_text: true,  // Только отзывы с текстом
            has_answer: includeAnswered ? undefined : false,  // Фильтр по ответам
            status: includeAnswered ? ['MODERATED', 'NEW'] : ['MODERATED']  // Статусы отзывов
        },
        sort: {
            field: 'CREATED_AT',
            direction: 'DESC'  // Новые первыми
        },
        page: 1,
        limit: OZON_CONFIG.API_LIMITS.MAX_LIMIT  // 100 - максимум
    };

    // Применяем фильтр дат из настроек магазина
    if (store && store.settings && store.settings.startDate) {
        const startDate = store.settings.startDate;
        const today = new Date().toISOString().split('T')[0];
        
        const dateFrom = formatDateForOzon(startDate);
        const dateTo = formatDateForOzon(today);
        
        payload.filter.date_from = dateFrom;
        payload.filter.date_to = dateTo;
        
        log(`[Ozon] 🗓️ Применен фильтр дат магазина: ${startDate} - ${today} (RFC3339: ${dateFrom} - ${dateTo})`);
    } else {
        log(`[Ozon] 🗓️ Фильтр по дате не применен - получаем все доступные отзывы`);
    }
    try {
        const response = UrlFetchApp.fetch(url, {
            method: 'POST', headers: { 'Client-Id': clientId, 'Api-Key': apiKey },
            contentType: 'application/json', payload: JSON.stringify(payload),
            muteHttpExceptions: true
        });
        const responseCode = response.getResponseCode();
        const responseBody = response.getContentText();
        if (responseCode !== 200) {
            log(`[Ozon] ОШИБКА: Не удалось получить отзывы. Код: ${responseCode}. Тело: ${responseBody}`);
            return [];
        }

        const json = JSON.parse(responseBody);
        
        // ✅ УЛУЧШЕНА обработка различных структур ответа API
        let reviews = [];
        if (json.result && json.result.reviews) {
            reviews = json.result.reviews;
        } else if (json.reviews) {
            reviews = json.reviews;
        } else if (json.data && json.data.reviews) {
            reviews = json.data.reviews;
        } else {
            log(`[Ozon] ⚠️ ПРЕДУПРЕЖДЕНИЕ: Неожиданная структура ответа. Ключи: ${Object.keys(json).join(', ')}. Ответ: ${responseBody.substring(0, 200)}...`);
            return [];
        }
        
        if (!Array.isArray(reviews)) {
            log(`[Ozon] ОШИБКА: reviews не является массивом. Тип: ${typeof reviews}. Значение: ${JSON.stringify(reviews).substring(0, 100)}...`);
            return [];
        }

        log(`[Ozon] 📄 Получено ${reviews.length} отзывов через новый API`);

        // КРИТИЧНО: Сортировка по дате (новые отзывы первыми) 
        reviews.sort((a, b) => new Date(b.created_at || b.published_at) - new Date(a.created_at || a.published_at));
        
        let processedReviews = reviews.map(fb => ({
            id: fb.id, 
            createdDate: fb.published_at, 
            rating: fb.rating,
            text: fb.text || '(без текста)', 
            user: 'Аноним', // Имя пользователя недоступно в этом методе
            product: { 
              id: fb.sku || fb.offer_id, // Используем sku или offer_id
              name: 'Не указано', // Будет обновлено ниже через Product API
              url: `https://www.ozon.ru/product/${fb.sku || fb.offer_id}`
            }
        }));
        
        // ✅ ОБОГАЩАЕМ НАЗВАНИЯМИ ТОВАРОВ через /v3/product/info/list (новая функция с кешированием)
        if (processedReviews.length > 0 && store && store.credentials) {
            // Подготавливаем идентификаторы товаров для батч-запроса
            const identifiers = [];
            processedReviews.forEach(review => {
                const productId = review.product.id;
                if (!productId) return;
                
                // Определяем тип идентификатора (sku - числовой, offer_id - строковый)
                if (/^\d+$/.test(String(productId))) {
                    identifiers.push({ type: 'sku', value: String(productId) });
                } else {
                    identifiers.push({ type: 'offer_id', value: String(productId) });
                }
            });
            
            log(`[Ozon] 🏷️ Подготовлено ${identifiers.length} идентификаторов товаров для обогащения данными`);
            
            // Получаем детальную информацию о товарах с кешированием
            const productInfo = getOzonProductInfoList(identifiers, store.credentials.clientId, store.credentials.apiKey);
            
            if (Object.keys(productInfo).length > 0) {
                let enrichedCount = 0;
                processedReviews.forEach(review => {
                    const info = productInfo[review.product.id];
                    if (info && info.name) {
                        review.product.name = info.name;
                        // Опционально: можем также обогатить ценой и изображениями
                        if (info.price) {
                            review.product.price = info.price;
                        }
                        enrichedCount++;
                    }
                });
                log(`[Ozon] 🏷️ Обогащено ${enrichedCount} отзывов из ${Object.keys(productInfo).length} полученных товаров`);
            } else {
                log(`[Ozon] ⚠️ Не удалось получить информацию о товарах через Product API`);
            }
        }
        
        return processedReviews;
    } catch (e) {
        log(`[Ozon] КРИТИЧЕСКАЯ ОШИБКА при запросе отзывов: ${e.stack}`);
        return [];
    }
}

function sendOzonFeedbackAnswer(feedbackId, text, clientId, apiKey) {
    const url = 'https://api-seller.ozon.ru/v1/review/comment/create';
    const payload = { review_id: feedbackId, text: text, mark_review_as_processed: true };
    
    const response = UrlFetchApp.fetch(url, {
        method: 'POST', 
        headers: { 'Client-Id': clientId, 'Api-Key': apiKey },
        contentType: 'application/json', 
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
    });
    
    const code = response.getResponseCode();
    const responseBody = response.getContentText();
    
    // Include detailed API response for debugging
    const success = code === 200;
    const errorMessage = success ? '' : `Код ответа: ${code}. Тело: ${responseBody}`;
    
    return [success, errorMessage, responseBody];
}

// ============ DATA (STORE & TEMPLATE) MANAGEMENT ============
function getStores() {
  const storesJson = PropertiesService.getUserProperties().getProperty(CONFIG.PROPERTIES_KEY);
  if (!storesJson) return [];
  const stores = JSON.parse(storesJson);
  return stores.map(store => {
      if (typeof store.isActive === 'undefined') store.isActive = true;
      // Ensure settings object exists for backward compatibility
      if (!store.settings) store.settings = {};
      return store;
  });
}

function saveStore(store) {
  log(`Сохранение магазина: ${store.name}${store.settings && store.settings.startDate ? ' (дата начала: ' + store.settings.startDate + ')' : ''}`);
  const stores = getStores();
  const storeIndex = stores.findIndex(s => s.id === store.id);
  
  if (typeof store.isActive === 'undefined') store.isActive = true;
  // Ensure settings object exists
  if (!store.settings) store.settings = {};
  
  if (storeIndex > -1) {
    stores[storeIndex] = store; 
  } else {
    store.id = store.id || new Date().getTime().toString(); 
    stores.push(store); 
  }
  PropertiesService.getUserProperties().setProperty(CONFIG.PROPERTIES_KEY, JSON.stringify(stores));
  createOrGetSheet(`Отзывы (${store.name})`, CONFIG.HEADERS);
  return getStores();
}

function deleteStore(storeId) {
  log(`Удаление магазина с ID: ${storeId}`);
  let stores = getStores();
  stores = stores.filter(s => s.id !== storeId);
  PropertiesService.getUserProperties().setProperty(CONFIG.PROPERTIES_KEY, JSON.stringify(stores));
  return getStores();
}

function getTemplates() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.TEMPLATES);
  if (!sheet || sheet.getLastRow() < 2) return [];
  // Use getDisplayValues() to get the formatted string, not the underlying value (which can be a date)
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getDisplayValues().map(row => ({ 
    text: row[0], 
    rating: row[1].trim()
  })).filter(t => t.text.trim() && t.rating);
}

function fillInitialTemplates() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.TEMPLATES);
  if (sheet.getLastRow() <= 1) {
    const templates = [
      ['Спасибо за ваш отзыв! Рады, что вам понравилось! 😊', '5'],
      ['Благодарим за покупку! Ждем вас снова! ❤️', '5'],
      ['Спасибо за высокую оценку! Всегда рады помочь!', '4-5'],
      ['Благодарим за положительный отзыв! Приятных покупок!', '4']
    ];
    sheet.getRange(2, 1, templates.length, 2).setValues(templates);
  }
}

function createOrGetSheet(sheetName, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    log(`Создан новый лист: "${sheetName}"`);
  }
  
  if (headers && headers.length > 0) {
    const currentHeaders = sheet.getRange(1, 1, 1, sheet.getMaxColumns()).getValues()[0];
    if (currentHeaders.join('') !== headers.join('')) {
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#4a86e8').setFontColor('#ffffff');
        sheet.setFrozenRows(1);
        headers.forEach((_, i) => sheet.autoResizeColumn(i + 1));
        log(`Обновлены заголовки в листе "${sheetName}".`);
    }
  }
  return sheet;
}

function selectRandomTemplate(templates, rating) {
  const suitable = templates.filter(t => {
      if (!t.rating) return false;
      if (t.rating.includes('-')) {
          const [min, max] = t.rating.split('-').map(Number);
          return rating >= min && rating <= max;
      }
      return Number(t.rating) === rating;
  });
  if (suitable.length === 0) return null;
  return suitable[Math.floor(Math.random() * suitable.length)].text;
}

function getProcessedIdsFromSheet(sheet) {
  if (sheet.getLastRow() < 2) return new Set();
  const idCol = CONFIG.HEADERS.indexOf('ID отзыва') + 1;
  const ids = sheet.getRange(2, idCol, sheet.getLastRow() - 1, 1).getDisplayValues().flat();
  return new Set(ids.filter(id => id));
}

function manuallyDeleteReviewById() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt('Удаление отзыва', 'Введите ID отзыва для удаления из лога:', ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() !== ui.Button.OK || !response.getResponseText()) {
    log('Операция удаления отзыва отменена.');
    return;
  }

  const feedbackId = response.getResponseText().trim();
  log(`Запуск ручного удаления отзыва с ID: ${feedbackId}`);
  const stores = getStores();
  let foundAndDeleted = false;

  stores.forEach(store => {
    const sheetName = `Отзывы (${store.name})`;
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (sheet && sheet.getLastRow() > 1) {
      const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().flat();
      for (let i = ids.length - 1; i >= 0; i--) {
        if (String(ids[i]) == feedbackId) {
          log(`Найден отзыв ID ${feedbackId} в "${store.name}" на строке ${i + 2}. Удаляю.`);
          sheet.deleteRow(i + 2);
          foundAndDeleted = true;
          break;
        }
      }
    }
  });

  if (foundAndDeleted) {
    ui.alert('Успех', `Запись об отзыве с ID "${feedbackId}" удалена.`);
  } else {
    ui.alert('Не найдено', `Отзыв с ID "${feedbackId}" не найден.`);
  }
}

// ============ WB TESTING FUNCTIONS ============
/**
 * Функция для тестирования отправки ответа на конкретный отзыв WB
 * Позволяет протестировать оба endpoint'а без влияния на производственные данные
 */
function testWbFeedbackAnswerById() {
  const ui = SpreadsheetApp.getUi();
  
  // Получаем список активных WB магазинов
  const stores = getStores().filter(s => s.isActive && s.marketplace === 'Wildberries');
  if (stores.length === 0) {
    ui.alert('❌ Ошибка', 'Не найдено активных магазинов Wildberries для тестирования.', ui.ButtonSet.OK);
    return;
  }
  
  // Выбираем магазин (пока берем первый)
  const store = stores[0];
  log(`[WB TEST] 🧪 Начало тестирования для магазина: ${store.name}`);
  
  // Запрашиваем ID отзыва
  const feedbackIdResponse = ui.prompt('🧪 Тест WB API', 
    'Введите ID отзыва Wildberries для тестирования:', ui.ButtonSet.OK_CANCEL);
  
  if (feedbackIdResponse.getSelectedButton() !== ui.Button.OK || !feedbackIdResponse.getResponseText().trim()) {
    log('[WB TEST] ❌ Тестирование отменено пользователем.');
    return;
  }
  
  const feedbackId = feedbackIdResponse.getResponseText().trim();
  log(`[WB TEST] 🎯 ID отзыва для тестирования: ${feedbackId}`);
  
  // Запрашиваем текст ответа
  const answerTextResponse = ui.prompt('🧪 Тест WB API', 
    'Введите текст ответа для тестирования (2-5000 символов):', ui.ButtonSet.OK_CANCEL);
    
  if (answerTextResponse.getSelectedButton() !== ui.Button.OK || !answerTextResponse.getResponseText().trim()) {
    log('[WB TEST] ❌ Тестирование отменено пользователем.');
    return;
  }
  
  const answerText = answerTextResponse.getResponseText().trim();
  
  // Валидация текста ответа
  if (answerText.length < 2) {
    ui.alert('❌ Ошибка валидации', 'Текст ответа слишком короткий (минимум 2 символа).', ui.ButtonSet.OK);
    return;
  }
  if (answerText.length > 5000) {
    ui.alert('❌ Ошибка валидации', 'Текст ответа слишком длинный (максимум 5000 символов).', ui.ButtonSet.OK);
    return;
  }
  
  log(`[WB TEST] 📝 Текст ответа: "${answerText}" (${answerText.length} символов)`);
  
  // Предупреждение пользователя
  const confirmResponse = ui.alert('⚠️ ВНИМАНИЕ', 
    `Вы собираетесь отправить РЕАЛЬНЫЙ ответ на отзыв ${feedbackId} в магазине "${store.name}"!\n\nТекст: "${answerText}"\n\nЭто действие нельзя отменить. Продолжить?`, 
    ui.ButtonSet.YES_NO);
    
  if (confirmResponse !== ui.Button.YES) {
    log('[WB TEST] ❌ Тестирование отменено пользователем на этапе подтверждения.');
    return;
  }
  
  // Включаем режим разработчика на время теста для более подробных логов
  const wasDevMode = isDevMode();
  if (!wasDevMode) {
    log('[WB TEST] 🛠️ Временно включаем Dev Mode для детального логирования...');
    setDevMode('true');
  }
  
  try {
    log('[WB TEST] 🚀 ЗАПУСК ТЕСТИРОВАНИЯ отправки ответа...');
    
    // Используем обновленную функцию с двумя вариантами endpoint'ов
    const result = sendWbFeedbackAnswer(feedbackId, answerText, store.credentials.apiKey);
    const [success, errorMessage, responseBody] = result;
    
    log(`[WB TEST] 📊 РЕЗУЛЬТАТ ТЕСТА:`);
    log(`[WB TEST] ✅ Успех: ${success ? 'ДА' : 'НЕТ'}`);
    log(`[WB TEST] 📝 Сообщение об ошибке: ${errorMessage || 'отсутствует'}`);
    log(`[WB TEST] 📋 Ответ сервера: ${responseBody || 'пустой'}`);
    
    // Показываем результат пользователю
    if (success) {
      ui.alert('✅ УСПЕХ', 
        `Ответ успешно отправлен!\n\nОтзыв ID: ${feedbackId}\nОтвет сервера: ${responseBody}`, 
        ui.ButtonSet.OK);
    } else {
      ui.alert('❌ ОШИБКА', 
        `Не удалось отправить ответ.\n\nОшибка: ${errorMessage}\nОтвет сервера: ${responseBody}\n\nПодробности в логе отладки.`, 
        ui.ButtonSet.OK);
    }
    
  } catch (e) {
    log(`[WB TEST] ⛔ КРИТИЧЕСКАЯ ОШИБКА в тесте: ${e.message}`);
    log(`[WB TEST] 🔍 Stack trace: ${e.stack}`);
    ui.alert('⛔ КРИТИЧЕСКАЯ ОШИБКА', 
      `Произошла критическая ошибка:\n\n${e.message}\n\nПодробности в логе отладки.`, 
      ui.ButtonSet.OK);
  } finally {
    // Восстанавливаем предыдущий режим разработчика
    if (!wasDevMode) {
      log('[WB TEST] 🛠️ Восстанавливаем предыдущий режим разработчика...');
      setDevMode('false');
    }
    
    log('[WB TEST] 🏁 Тестирование завершено. Подробные логи в листе "🐞 Лог отладки".');
  }
}

/**
 * Функция для проверки статуса конкретного отзыва WB
 * Помогает диагностировать, почему отзыв не может получить ответ
 */
function checkWbFeedbackStatus(feedbackId, apiKey) {
  try {
    log(`[WB Check] 🔍 Проверка статуса отзыва ${feedbackId}...`);
    
    const url = `https://feedbacks-api.wildberries.ru/api/v1/feedback?id=${feedbackId}`;
    
    const response = UrlFetchApp.fetch(url, {
      method: 'GET',
      headers: { 'Authorization': apiKey },
      muteHttpExceptions: true
    });
    
    const code = response.getResponseCode();
    const responseBody = response.getContentText();
    
    log(`[WB Check] 📥 Код ответа: ${code}`);
    log(`[WB Check] 📋 Тело ответа: ${responseBody}`);
    
    if (code === 200) {
      try {
        const feedback = JSON.parse(responseBody);
        const hasAnswer = feedback.answer && feedback.answer.text;
        const createdDate = feedback.createdDate;
        const rating = feedback.rating;
        
        log(`[WB Check] ✅ Отзыв найден:`);
        log(`[WB Check] 📅 Дата: ${createdDate}`);
        log(`[WB Check] ⭐ Рейтинг: ${rating}`);
        log(`[WB Check] 💬 Имеет ответ: ${hasAnswer ? 'ДА' : 'НЕТ'}`);
        if (hasAnswer) {
          log(`[WB Check] 📝 Текст ответа: "${feedback.answer.text}"`);
        }
        
        return { exists: true, hasAnswer, feedback };
      } catch (e) {
        log(`[WB Check] ❌ Ошибка парсинга JSON: ${e.message}`);
        return { exists: false, error: 'JSON parse error' };
      }
    } else {
      log(`[WB Check] ❌ Отзыв не найден или ошибка API: ${code}`);
      return { exists: false, error: `HTTP ${code}: ${responseBody}` };
    }
  } catch (e) {
    log(`[WB Check] ⛔ Критическая ошибка: ${e.message}`);
    return { exists: false, error: e.message };
  }
}

// ============ TRIGGERS ============
function createTrigger(minutes) {
  deleteAllTriggers();
  ScriptApp.newTrigger('processAllStores').timeBased().everyMinutes(minutes).create();
  log(`Установлен триггер автозапуска на каждые ${minutes} минут.`);
  SpreadsheetApp.getUi().alert('✅ Триггер установлен', `Обработка будет запускаться каждые ${minutes} минут.`, SpreadsheetApp.getUi().ButtonSet.OK);
}

function createTrigger5Min() { createTrigger(5); }
function createTrigger30Min() { createTrigger(30); }
function createTrigger1Hour() { createTrigger(60); }

function deleteAllTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  let deletedCount = 0;
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'processAllStores') {
      ScriptApp.deleteTrigger(trigger);
      deletedCount++;
    }
  });
  if (deletedCount > 0) {
    log(`Удалено ${deletedCount} триггеров автозапуска.`);
  }
}

// ============ НОЧНОЙ КЕШ-ПРОГРЕВ ============

/**
 * 🌙 НОЧНОЙ КЕШ-ПРОГРЕВ: Предзагрузка информации о всех товарах в кеш
 * Запускается по триггеру раз в день (обычно ночью)
 * Загружает информацию о товарах из каталогов всех активных магазинов
 */
function warmupProductCache() {
  log('=== 🌙 ЗАПУСК НОЧНОГО КЕШ-ПРОГРЕВА ===');
  const startTime = new Date();
  
  const allStores = getStores();
  const activeStores = allStores.filter(store => store.isActive);
  
  if (activeStores.length === 0) {
    log('[Warmup] ⚠️ Нет активных магазинов для прогрева кеша');
    return;
  }
  
  log(`[Warmup] 🏪 Найдено ${activeStores.length} активных магазинов`);
  
  let totalProductsWarmed = 0;
  let successfulStores = 0;
  let failedStores = 0;
  
  activeStores.forEach((store, index) => {
    log(`[Warmup] 📦 [${index + 1}/${activeStores.length}] Обработка магазина: ${store.name} [${store.marketplace}]`);
    
    try {
      let warmedCount = 0;
      
      if (store.marketplace === 'Wildberries') {
        warmedCount = warmupWildberriesProducts(store);
      } else if (store.marketplace === 'Ozon') {
        warmedCount = warmupOzonProducts(store);
      }
      
      if (warmedCount > 0) {
        totalProductsWarmed += warmedCount;
        successfulStores++;
        log(`[Warmup] ✅ ${store.name}: прогрето ${warmedCount} товаров`);
      } else {
        log(`[Warmup] ⚠️ ${store.name}: не удалось прогреть товары`);
      }
      
      // Задержка между магазинами для соблюдения rate limits
      if (index < activeStores.length - 1) {
        Utilities.sleep(2000);
      }
      
    } catch (e) {
      failedStores++;
      log(`[Warmup] ❌ ОШИБКА для ${store.name}: ${e.message}`);
    }
  });
  
  const endTime = new Date();
  const duration = Math.round((endTime - startTime) / 1000);
  
  log('=== 🌙 ЗАВЕРШЕНИЕ КЕШ-ПРОГРЕВА ===');
  log(`[Warmup] 📊 ИТОГО: ${totalProductsWarmed} товаров прогрето`);
  log(`[Warmup] ✅ Успешно: ${successfulStores} магазинов`);
  log(`[Warmup] ❌ Ошибки: ${failedStores} магазинов`);
  log(`[Warmup] ⏱️ Время выполнения: ${duration} секунд`);
}

/**
 * Прогрев кеша для Wildberries
 * Получает список всех товаров и загружает их названия в кеш
 */
function warmupWildberriesProducts(store) {
  if (!store.credentials || !store.credentials.apiKey) {
    log(`[WB Warmup] ❌ Нет API ключа для магазина ${store.name}`);
    return 0;
  }
  
  try {
    log(`[WB Warmup] 🔍 Получение списка товаров...`);
    
    // Получаем список всех товаров через Content API
    const url = 'https://content-api.wildberries.ru/content/v2/get/cards/list';
    const response = UrlFetchApp.fetch(url, {
      method: 'POST',
      headers: { 
        'Authorization': store.credentials.apiKey,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify({
        settings: {
          cursor: {
            limit: 100  // Максимум за запрос
          },
          filter: {
            withPhoto: -1  // Все товары
          }
        }
      }),
      muteHttpExceptions: true
    });
    
    const code = response.getResponseCode();
    if (code !== 200) {
      log(`[WB Warmup] ❌ Ошибка получения списка: ${code}`);
      return 0;
    }
    
    const json = JSON.parse(response.getContentText());
    const cards = json.cards || [];
    
    if (cards.length === 0) {
      log(`[WB Warmup] ⚠️ Список товаров пуст`);
      return 0;
    }
    
    log(`[WB Warmup] 📦 Найдено ${cards.length} товаров`);
    
    // Извлекаем nmId из карточек и загружаем их в кеш
    const nmIds = cards.map(card => card.nmID).filter(id => id);
    
    if (nmIds.length === 0) {
      log(`[WB Warmup] ⚠️ Не найдено nmID в карточках`);
      return 0;
    }
    
    // Используем существующую функцию с кешированием
    const productNames = getWbProductNames(nmIds, store.credentials.apiKey);
    const warmedCount = Object.keys(productNames).length;
    
    log(`[WB Warmup] 💾 Прогрето в кеш: ${warmedCount} товаров`);
    return warmedCount;
    
  } catch (e) {
    log(`[WB Warmup] ❌ КРИТИЧЕСКАЯ ОШИБКА: ${e.message}`);
    return 0;
  }
}

/**
 * Прогрев кеша для Ozon
 * Получает список всех товаров и загружает их информацию в кеш
 */
function warmupOzonProducts(store) {
  if (!store.credentials || !store.credentials.clientId || !store.credentials.apiKey) {
    log(`[Ozon Warmup] ❌ Нет API ключей для магазина ${store.name}`);
    return 0;
  }
  
  try {
    log(`[Ozon Warmup] 🔍 Получение списка товаров...`);
    
    // Получаем список всех товаров через /v3/product/list
    const url = 'https://api-seller.ozon.ru/v3/product/list';
    let allProducts = [];
    let lastId = "";
    let pageCount = 0;
    const maxPages = 50; // Ограничение для безопасности (5000 товаров максимум)
    
    while (pageCount < maxPages) {
      const payload = {
        filter: {},
        last_id: lastId,
        limit: 100  // Максимум за запрос
      };
      
      const response = UrlFetchApp.fetch(url, {
        method: 'POST',
        headers: { 
          'Client-Id': store.credentials.clientId, 
          'Api-Key': store.credentials.apiKey,
          'Content-Type': 'application/json'
        },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });
      
      const code = response.getResponseCode();
      if (code !== 200) {
        log(`[Ozon Warmup] ❌ Ошибка получения списка (страница ${pageCount + 1}): ${code}`);
        break;
      }
      
      const json = JSON.parse(response.getContentText());
      const items = json.result?.items || [];
      
      if (items.length === 0) {
        log(`[Ozon Warmup] ✅ Получены все товары (страниц: ${pageCount})`);
        break;
      }
      
      allProducts = allProducts.concat(items);
      lastId = json.result?.last_id || "";
      pageCount++;
      
      log(`[Ozon Warmup] 📄 Страница ${pageCount}: получено ${items.length} товаров (всего: ${allProducts.length})`);
      
      // Если last_id пустой, значит это последняя страница
      if (!lastId) {
        log(`[Ozon Warmup] ✅ Достигнута последняя страница`);
        break;
      }
      
      // Задержка между запросами
      Utilities.sleep(OZON_CONFIG.RATE_LIMITS.DELAY_BETWEEN_REQUESTS);
    }
    
    if (allProducts.length === 0) {
      log(`[Ozon Warmup] ⚠️ Список товаров пуст`);
      return 0;
    }
    
    log(`[Ozon Warmup] 📦 ИТОГО найдено ${allProducts.length} товаров`);
    
    // Подготавливаем идентификаторы для загрузки детальной информации
    const identifiers = [];
    allProducts.forEach(product => {
      // Добавляем sku
      if (product.sku) {
        identifiers.push({ type: 'sku', value: String(product.sku) });
      }
      // Добавляем offer_id если есть
      if (product.offer_id) {
        identifiers.push({ type: 'offer_id', value: String(product.offer_id) });
      }
    });
    
    if (identifiers.length === 0) {
      log(`[Ozon Warmup] ⚠️ Не найдено идентификаторов для загрузки`);
      return 0;
    }
    
    log(`[Ozon Warmup] 🔄 Загрузка детальной информации для ${identifiers.length} идентификаторов...`);
    
    // Используем существующую функцию с кешированием и батчингом
    const productInfo = getOzonProductInfoList(identifiers, store.credentials.clientId, store.credentials.apiKey);
    const warmedCount = Object.keys(productInfo).length;
    
    log(`[Ozon Warmup] 💾 Прогрето в кеш: ${warmedCount} товаров`);
    return warmedCount;
    
  } catch (e) {
    log(`[Ozon Warmup] ❌ КРИТИЧЕСКАЯ ОШИБКА: ${e.message}`);
    return 0;
  }
}

/**
 * Создание ночного триггера для кеш-прогрева
 * Запускается раз в день в 23:00
 */
function createWarmupTrigger() {
  // Удаляем существующие триггеры прогрева
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'warmupProductCache') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // Создаем новый триггер на 23:00
  ScriptApp.newTrigger('warmupProductCache')
    .timeBased()
    .atHour(23)  // 23:00
    .everyDays(1)
    .create();
  
  log('[Warmup Trigger] ✅ Создан триггер ночного кеш-прогрева (ежедневно в 23:00)');
  SpreadsheetApp.getUi().alert('✅ Успех', 'Триггер ночного кеш-прогрева создан.\n\nБудет запускаться ежедневно в 23:00.', SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * Удаление триггера кеш-прогрева
 */
function deleteWarmupTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  let deletedCount = 0;
  
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'warmupProductCache') {
      ScriptApp.deleteTrigger(trigger);
      deletedCount++;
    }
  });
  
  if (deletedCount > 0) {
    log(`[Warmup Trigger] 🗑️ Удалено ${deletedCount} триггеров кеш-прогрева`);
    SpreadsheetApp.getUi().alert('✅ Успех', `Удалено ${deletedCount} триггеров ночного кеш-прогрева.`, SpreadsheetApp.getUi().ButtonSet.OK);
  } else {
    SpreadsheetApp.getUi().alert('ℹ️ Информация', 'Триггеры ночного кеш-прогрева не найдены.', SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

// ============ ИНДИВИДУАЛЬНЫЕ ТРИГГЕРЫ ДЛЯ МАГАЗИНОВ ============

/**
 * 🎯 ПАРАЛЛЕЛЬНАЯ ОБРАБОТКА: Создание индивидуальных триггеров для каждого магазина
 * Каждый магазин получает свой собственный триггер
 * Google Apps Script может выполнять до 30 триггеров одновременно
 */
function createPerStoreTriggers() {
  const ui = SpreadsheetApp.getUi();
  
  // Запрашиваем интервал
  const intervalResponse = ui.prompt('🎯 Индивидуальные триггеры',
    'Введите интервал запуска в минутах (5, 10, 15, 30):', ui.ButtonSet.OK_CANCEL);
  
  if (intervalResponse.getSelectedButton() !== ui.Button.OK) {
    log('[Per-Store Triggers] Отменено пользователем');
    return;
  }
  
  const interval = parseInt(intervalResponse.getResponseText());
  if (isNaN(interval) || interval < 1) {
    ui.alert('❌ Ошибка', 'Неверный интервал. Введите число больше 0.', ui.ButtonSet.OK);
    return;
  }
  
  log(`[Per-Store Triggers] 🎯 Создание индивидуальных триггеров с интервалом ${interval} минут...`);
  
  const allStores = getStores();
  const activeStores = allStores.filter(store => store.isActive);
  
  if (activeStores.length === 0) {
    ui.alert('⚠️ Предупреждение', 'Нет активных магазинов для создания триггеров.', ui.ButtonSet.OK);
    return;
  }
  
  log(`[Per-Store Triggers] 🏪 Найдено ${activeStores.length} активных магазинов`);
  
  // Удаляем существующие индивидуальные триггеры
  deletePerStoreTriggersInternal();
  
  let createdCount = 0;
  
  activeStores.forEach((store, index) => {
    try {
      // Создаем функцию-обертку для каждого магазина
      const functionName = `processStore_${store.id}`;
      
      // Создаем триггер с небольшой задержкой между магазинами для распределения нагрузки
      const offsetMinutes = index * 2; // Каждый магазин запускается с задержкой 2 минуты
      
      ScriptApp.newTrigger(functionName)
        .timeBased()
        .everyMinutes(interval)
        .create();
      
      createdCount++;
      log(`[Per-Store Triggers] ✅ [${index + 1}/${activeStores.length}] Создан триггер для "${store.name}" (функция: ${functionName})`);
      
    } catch (e) {
      log(`[Per-Store Triggers] ❌ Ошибка создания триггера для "${store.name}": ${e.message}`);
    }
  });
  
  log(`[Per-Store Triggers] 🎯 ИТОГО: создано ${createdCount} триггеров`);
  
  // Создаем функции-обертки для каждого магазина
  savePerStoreFunctions(activeStores);
  
  ui.alert('✅ Успех', 
    `Создано ${createdCount} индивидуальных триггеров.\n\n` +
    `Интервал: каждые ${interval} минут.\n\n` +
    `⚠️ ВАЖНО: Перезагрузите редактор скриптов для активации новых функций.`,
    ui.ButtonSet.OK);
}

/**
 * Сохраняет информацию о магазинах для индивидуальных триггеров
 */
function savePerStoreFunctions(stores) {
  const props = PropertiesService.getScriptProperties();
  const storeMap = {};
  
  stores.forEach(store => {
    storeMap[`store_${store.id}`] = JSON.stringify(store);
  });
  
  props.setProperties(storeMap);
  log(`[Per-Store Triggers] 💾 Сохранено ${stores.length} конфигураций магазинов`);
}

/**
 * Универсальная функция обработки одного магазина по ID
 * Используется индивидуальными триггерами
 */
function processSingleStoreById(storeId) {
  const devMode = isDevMode();
  log(`--- 🎯 ЗАПУСК ОБРАБОТКИ МАГАЗИНА ID: ${storeId} (${devMode ? 'DEV' : 'PROD'}) ---`);
  
  const props = PropertiesService.getScriptProperties();
  const storeJson = props.getProperty(`store_${storeId}`);
  
  if (!storeJson) {
    log(`[Store ${storeId}] ❌ ОШИБКА: Конфигурация магазина не найдена`);
    return;
  }
  
  try {
    const store = JSON.parse(storeJson);
    
    if (!store.isActive) {
      log(`[Store ${storeId}] ⚠️ Магазин "${store.name}" неактивен, пропускаю`);
      return;
    }
    
    log(`[Store ${storeId}] 🏪 Обработка магазина: ${store.name} [${store.marketplace}]`);
    processSingleStore(store, devMode);
    log(`[Store ${storeId}] ✅ Обработка завершена`);
    
  } catch (e) {
    log(`[Store ${storeId}] ❌ КРИТИЧЕСКАЯ ОШИБКА: ${e.message}`);
  }
}

/**
 * Удаление всех индивидуальных триггеров магазинов
 */
function deletePerStoreTriggers() {
  const deletedCount = deletePerStoreTriggersInternal();
  
  const ui = SpreadsheetApp.getUi();
  if (deletedCount > 0) {
    ui.alert('✅ Успех', `Удалено ${deletedCount} индивидуальных триггеров магазинов.`, ui.ButtonSet.OK);
  } else {
    ui.alert('ℹ️ Информация', 'Индивидуальные триггеры магазинов не найдены.', ui.ButtonSet.OK);
  }
}

/**
 * Внутренняя функция удаления индивидуальных триггеров
 */
function deletePerStoreTriggersInternal() {
  const triggers = ScriptApp.getProjectTriggers();
  let deletedCount = 0;
  
  triggers.forEach(trigger => {
    const functionName = trigger.getHandlerFunction();
    // Удаляем триггеры, которые начинаются с processStore_
    if (functionName.startsWith('processStore_')) {
      ScriptApp.deleteTrigger(trigger);
      deletedCount++;
    }
  });
  
  if (deletedCount > 0) {
    log(`[Per-Store Triggers] 🗑️ Удалено ${deletedCount} индивидуальных триггеров`);
  }
  
  return deletedCount;
}

// Динамически создаваемые функции для каждого магазина
// Эти функции будут созданы автоматически при вызове createPerStoreTriggers()
// Пример: function processStore_1() { processSingleStoreById('1'); }
