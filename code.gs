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
  menu.addItem('🗑️ Удалить отзыв по ID', 'manuallyDeleteReviewById');
  menu.addSeparator();
  const devMenu = ui.createMenu('🛠️ Режим разработчика');
  devMenu.addItem('Включить', 'enableDevMode');
  devMenu.addItem('Выключить', 'disableDevMode');
  menu.addSubMenu(devMenu);
  
  const triggerSubMenu = ui.createMenu('🔄 Управление автозапуском');
  triggerSubMenu.addItem('Установить автозапуск (5 мин)', 'createTrigger5Min');
  triggerSubMenu.addItem('Установить автозапуск (30 мин)', 'createTrigger30Min');
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
    
    // Убираем дубликаты
    const uniqueOfferIds = [...new Set(offerIds)];
    log(`[Ozon Products] 🏷️ Запрашиваю названия для ${uniqueOfferIds.length} товаров...`);
    
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
        
        // Добавляем фильтрацию по дате только если есть настройка startDate у магазина
        if (store && store.settings && store.settings.startDate) {
            const startDate = store.settings.startDate; // Формат: YYYY-MM-DD
            const today = new Date().toISOString().split('T')[0]; // Сегодняшняя дата в YYYY-MM-DD
            
            const dateFrom = getUnixTimestamp(startDate);
            const dateTo = getUnixTimestamp(today);
            
            url += `&dateFrom=${dateFrom}&dateTo=${dateTo}`;
            log(`[WB] 🗓️ Применен фильтр дат магазина: ${startDate} - ${today} (Unix: ${dateFrom} - ${dateTo})`);
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

  const rowsToAppend = [];
  
  newFeedbacks.slice(0, CONFIG.MAX_FEEDBACKS_PER_RUN).forEach(feedback => {
    let rowData = [
        feedback.id, new Date(feedback.createdDate), feedback.product.id, 
        feedback.product.name, feedback.product.url, feedback.rating, 
        feedback.text
      ];

    if (!CONFIG.RESPOND_TO_RATINGS.includes(feedback.rating)) {
      rowData.push('', CONFIG.STATUS.SKIPPED_RATING, `Рейтинг ${feedback.rating} не входит в список для ответа.`, '');
      rowsToAppend.push(rowData);
      log(`[${store.name}] Пропущен отзыв ID: ${feedback.id} (рейтинг ${feedback.rating}). Ссылка: ${feedback.product.url}`);
      return;
    }
      
    const template = selectRandomTemplate(templates, feedback.rating);
    if (!template) {
      rowData.push('', CONFIG.STATUS.NO_TEMPLATE, `Не найден подходящий шаблон для рейтинга ${feedback.rating}.`, '');
      rowsToAppend.push(rowData);
      log(`[${store.name}] Нет шаблона для отзыва ID: ${feedback.id} (рейтинг ${feedback.rating}). Ссылка: ${feedback.product.url}`);
      return;
    }

    if (devMode) {
      rowData.push(template, CONFIG.STATUS.PENDING, '', '');
      rowsToAppend.push(rowData);
      log(`[${store.name}] DEV: Подготовлен ответ для отзыва ID: ${feedback.id}. Ссылка: ${feedback.product.url}`);
    } else {
      // Production mode: send answer immediately
      const result = sendAnswer(store, feedback.id, template);
      rowData.push(template, result.status, result.error, result.timestamp);
      rowsToAppend.push(rowData);
      log(`[${store.name}] PROD: Отправлен ответ для ID: ${feedback.id}. Статус: ${result.status}. Ссылка: ${feedback.product.url}`);
      Utilities.sleep(CONFIG.DELAY_BETWEEN_REQUESTS);
    }
  });
  
  if (rowsToAppend.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAppend.length, CONFIG.HEADERS.length).setValues(rowsToAppend);
    
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

// ======================================================================
// ======================== WILDBERRIES API ============================
// ======================================================================
// ВАЖНО: Этот раздел содержит всю логику работы с API Wildberries.
// Изменения в других разделах не должны затрагивать эти функции.
// ======================================================================

/**
 * ГЛАВНАЯ ФУНКЦИЯ WB: Получение отзывов с ПОЛНОЙ пагинацией
 * Теперь использует новые функции с пагинацией "до победного"!
 * @param {string} apiKey - WB API ключ
 * @param {boolean} includeAnswered - Включать ли отвеченные отзывы
 * @param {Object} store - Настройки магазина для фильтрации по дате
 * @returns {Array} Массив всех подходящих отзывов
 */
function getWbFeedbacks(apiKey, includeAnswered = false, store = null) {
    log(`[WB] 🔄 ПЕРЕКЛЮЧЕНИЕ НА ПОЛНУЮ ПАГИНАЦИЮ! (включая отвеченные: ${includeAnswered})`);
    
    // ВАЖНО: Теперь используем новые функции с полной пагинацией!
    return getWbFeedbacksWithFullPagination(apiKey, includeAnswered, store);
}

function sendWbFeedbackAnswer(feedbackId, text, apiKey) {
    // ✅ ИСПРАВЛЕН WB API endpoint для отправки ответов на отзывы
    const url = `https://feedbacks-api.wildberries.ru/api/v1/feedbacks/answer`;
    const payload = { 
        id: feedbackId,  // ID отзыва в payload
        text: text 
    };
    
    log(`[WB API] 🚀 Отправка ответа: POST ${url}, payload: ${JSON.stringify(payload)}`);
    
    const response = UrlFetchApp.fetch(url, {
        method: 'POST',  // ✅ ИСПРАВЛЕН метод на POST 
        headers: { 
            'Authorization': apiKey,
            'Content-Type': 'application/json'
        },
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

// ======================================================================
// ============================ OZON API ===============================
// ======================================================================
// ВАЖНО: Этот раздел содержит всю логику работы с API Ozon.
// Изменения в других разделах не должны затрагивать эти функции.
// ======================================================================

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

    // ✅ ИСПРАВЛЕНО: Используем настройки даты из конфига магазина
    if (store && store.settings && store.settings.startDate) {
        const startDate = store.settings.startDate; // Формат: YYYY-MM-DD
        const today = new Date().toISOString().split('T')[0]; // Сегодняшняя дата в YYYY-MM-DD
        
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
        
        // ✅ ОБОГАЩАЕМ НАЗВАНИЯМИ ТОВАРОВ из Product API
        if (processedReviews.length > 0 && store && store.credentials) {
            const offerIds = processedReviews.map(review => review.product.id).filter(id => id);
            const productNames = getOzonProductNames(offerIds, store.credentials.clientId, store.credentials.apiKey);
            
            if (Object.keys(productNames).length > 0) {
                processedReviews.forEach(review => {
                    if (productNames[review.product.id]) {
                        review.product.name = productNames[review.product.id];
                    }
                });
                log(`[Ozon] 🏷️ Названия товаров обновлены для ${Object.keys(productNames).length} отзывов`);
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
