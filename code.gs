/**
 * @file Code.gs
 * @description Main backend logic for the Multi-Store Auto-Reply Manager.
 */

// ============ GLOBAL CONFIGURATION ============
const CONFIG = {
  PROPERTIES_KEY: 'REGISTERED_STORES',
  DEV_MODE_KEY: 'DEV_MODE_ENABLED',
  PROGRESS_KEY: 'PROCESSING_PROGRESS', // 🚀 NEW: Ключ для хранения прогресса обработки
  SHEETS: {
    TEMPLATES: 'Шаблоны ответов'
  },
  LOG_SHEET_NAME: '🐞 Лог отладки',
  LOG_MAX_ROWS: 2500,
  RESPOND_TO_RATINGS: [4, 5],
  DELAY_BETWEEN_REQUESTS: 1100,
  MAX_FEEDBACKS_PER_RUN: 50,
  MIN_REVIEW_TEXT_LENGTH: 3, // Минимальная длина текста отзыва для обработки
  HEADERS: ['№', 'ID отзыва', 'Дата отзыва', 'Артикул', 'Название товара', 'Ссылка', 'Оценка', 'Текст отзыва', 'Подобранный ответ', 'Статус', 'Детали ошибки', 'Время отправки'],
  STATUS: {
    NEW: 'NEW',                     // Новый отзыв (еще не подобран шаблон)
    PENDING: 'Готово к отправке',   // Шаблон подобран, готов к отправке
    SENT: 'Отправлено',             // Ответ успешно отправлен
    ERROR: 'Ошибка',                // Ошибка при отправке
    MANUAL: 'Ручной ответ',         // Отвечено вручную
    SKIPPED_RATING: 'Пропущено (рейтинг)',
    SKIPPED_PROCESSED: 'Пропущено (уже обработан)',
    SKIPPED_EMPTY: 'Пропущено (пустой отзыв)',
    NO_TEMPLATE: 'Нет шаблона'      // Не найден подходящий шаблон
  },
  // 🚀 NEW: Настройки для системы памяти прогресса
  PROGRESS: {
    MAX_EXECUTION_TIME: 5.5 * 60 * 1000, // 5.5 минут (с запасом до 6-минутного лимита)
    SAVE_PROGRESS_INTERVAL: 30 * 1000,    // Сохранять прогресс каждые 30 секунд
    RESET_PROGRESS_AFTER_HOURS: 24        // Сбрасывать прогресс старше 24 часов
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
    ENABLED: false,          // WB работает по-другому, пагинация не нужна
    SIMPLE_APPROACH: true    // Используем простой подход
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
  menu.addItem('📥 Собрать отзывы Ozon вручную', 'collectOzonReviewsAuto');
  menu.addItem('🤖 Обработать NEW отзывы Ozon (шаблоны)', 'processNewOzonReviews');
  menu.addItem('📤 Отправить PENDING ответы Ozon', 'sendPendingAnswersOzonOnly');
  menu.addSeparator();
  
  const ozonMenu = ui.createMenu('🎯 Автоматизация Ozon');
  ozonMenu.addItem('✅ Настроить триггеры Ozon (2 автомата)', 'setupOzonTriggers');
  ozonMenu.addItem('ℹ️ Проверить статус триггеров Ozon', 'checkOzonTriggersStatus');
  ozonMenu.addItem('❌ Удалить все триггеры Ozon', 'deleteAllOzonTriggers');
  menu.addSubMenu(ozonMenu);
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

// ============ WB - ПРОСТАЯ ПАГИНАЦИЯ ============
// 🚀 ВСЕ СЛОЖНЫЕ ФУНКЦИИ УДАЛЕНЫ! Остается только простая версия в getWbFeedbacks() ниже

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

// ============ 🚀 PROGRESS MEMORY FUNCTIONS ============

/**
 * Получение сохранённого прогресса обработки для всех магазинов
 * @returns {Object} Объект с прогрессом каждого магазина
 */
function getProcessingProgress() {
  try {
    const progressJson = PropertiesService.getUserProperties().getProperty(CONFIG.PROGRESS_KEY);
    if (!progressJson) return {};
    
    const progress = JSON.parse(progressJson);
    const now = Date.now();
    
    // 🧹 Очищаем старый прогресс (старше 24 часов)
    const cleanProgress = {};
    for (const [storeId, storeProgress] of Object.entries(progress)) {
      const age = now - (storeProgress.lastUpdated || 0);
      const maxAge = CONFIG.PROGRESS.RESET_PROGRESS_AFTER_HOURS * 60 * 60 * 1000;
      
      if (age < maxAge) {
        cleanProgress[storeId] = storeProgress;
      } else {
        log(`[Progress] 🧹 Удален старый прогресс для магазина ${storeId} (возраст ${Math.round(age/1000/3600)} часов)`);
      }
    }
    
    // Сохраняем очищенный прогресс
    if (Object.keys(cleanProgress).length !== Object.keys(progress).length) {
      saveProcessingProgress(cleanProgress);
    }
    
    return cleanProgress;
  } catch (e) {
    log(`[Progress] ❌ Ошибка чтения прогресса: ${e.message}`);
    return {};
  }
}

/**
 * Сохранение прогресса обработки для всех магазинов
 * @param {Object} progress - Объект с прогрессом каждого магазина
 */
function saveProcessingProgress(progress) {
  try {
    const progressJson = JSON.stringify(progress);
    PropertiesService.getUserProperties().setProperty(CONFIG.PROGRESS_KEY, progressJson);
    log(`[Progress] 💾 Прогресс сохранён для ${Object.keys(progress).length} магазинов`);
  } catch (e) {
    log(`[Progress] ❌ Ошибка сохранения прогресса: ${e.message}`);
  }
}

/**
 * Получение прогресса обработки для конкретного магазина
 * @param {string} storeId - ID магазина
 * @returns {Object} Прогресс магазина или null
 */
function getStoreProgress(storeId) {
  const allProgress = getProcessingProgress();
  return allProgress[storeId] || null;
}

/**
 * Обновление прогресса обработки для магазина
 * @param {string} storeId - ID магазина
 * @param {Object} storeProgress - Новый прогресс магазина
 */
function updateStoreProgress(storeId, storeProgress) {
  const allProgress = getProcessingProgress();
  allProgress[storeId] = {
    ...storeProgress,
    lastUpdated: Date.now()
  };
  saveProcessingProgress(allProgress);
}

/**
 * Сброс прогресса для магазина (начать сначала)
 * @param {string} storeId - ID магазина
 */
function resetStoreProgress(storeId) {
  const allProgress = getProcessingProgress();
  delete allProgress[storeId];
  saveProcessingProgress(allProgress);
  log(`[Progress] 🔄 Сброшен прогресс для магазина ${storeId}`);
}

/**
 * 🚀 НОВАЯ ФУНКЦИЯ: Определение начальной страницы для продолжения обработки
 * @param {Object} store - Конфигурация магазина
 * @param {boolean} isAnswered - Тип отзывов (отвеченные/неотвеченные)
 * @returns {number} Номер страницы для начала или 0 для начала сначала
 */
function getStartingPageForStore(store, isAnswered) {
  const progress = getStoreProgress(store.id);
  if (!progress) {
    log(`[${store.name}] 🆕 Нет сохранённого прогресса - начинаем с первой страницы`);
    return 0;
  }
  
  // Определяем ключ для типа обработки
  const progressKey = isAnswered ? 'answeredReviews' : 'unansweredReviews';
  const typeProgress = progress[progressKey];
  
  if (!typeProgress) {
    log(`[${store.name}] 🆕 Нет прогресса для ${isAnswered ? 'отвеченных' : 'неотвеченных'} отзывов - начинаем сначала`);
    return 0;
  }
  
  const lastPage = typeProgress.lastProcessedPage || 0;
  const completedAt = typeProgress.completedAt;
  
  // Если обработка завершена менее чем 1 час назад, начинаем сначала
  if (completedAt && (Date.now() - completedAt < 60 * 60 * 1000)) {
    log(`[${store.name}] ✅ Обработка ${isAnswered ? 'отвеченных' : 'неотвеченных'} отзывов завершена недавно - начинаем сначала`);
    return 0;
  }
  
  const nextPage = lastPage + 1;
  log(`[${store.name}] 📖 Продолжаем обработку ${isAnswered ? 'отвеченных' : 'неотвеченных'} отзывов с страницы ${nextPage}`);
  return nextPage;
}

/**
 * 🚀 НОВАЯ ФУНКЦИЯ: Обновление прогресса страниц для магазина
 * @param {Object} store - Конфигурация магазина
 * @param {boolean} isAnswered - Тип отзывов
 * @param {number} pageNumber - Номер обработанной страницы
 * @param {boolean} isCompleted - Завершена ли обработка
 */
function updateStorePageProgress(store, isAnswered, pageNumber, isCompleted = false) {
  const allProgress = getProcessingProgress();
  
  if (!allProgress[store.id]) {
    allProgress[store.id] = { lastUpdated: Date.now() };
  }
  
  const progressKey = isAnswered ? 'answeredReviews' : 'unansweredReviews';
  
  if (!allProgress[store.id][progressKey]) {
    allProgress[store.id][progressKey] = {};
  }
  
  allProgress[store.id][progressKey].lastProcessedPage = pageNumber;
  allProgress[store.id][progressKey].lastUpdated = Date.now();
  
  if (isCompleted) {
    allProgress[store.id][progressKey].completedAt = Date.now();
    log(`[${store.name}] ✅ Завершена обработка ${isAnswered ? 'отвеченных' : 'неотвеченных'} отзывов на странице ${pageNumber}`);
  } else {
    delete allProgress[store.id][progressKey].completedAt; // Удаляем флаг завершения если продолжаем
    if (pageNumber % 5 === 0) { // Логируем каждые 5 страниц
      log(`[${store.name}] 📄 Обработана страница ${pageNumber} (${isAnswered ? 'отвеченные' : 'неотвеченные'} отзывы)`);
    }
  }
  
  allProgress[store.id].lastUpdated = Date.now();
  saveProcessingProgress(allProgress);
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

// ============ SORTING FUNCTIONS ============
/**
 * Sorts a sheet by date column (newest first by default)
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - The sheet to sort
 * @param {boolean} ascending - Whether to sort ascending (oldest first) or descending (newest first)
 */
function sortSheetByDate(sheet, ascending = false) {
  if (sheet.getLastRow() <= 2) return; // Нет данных для сортировки (только заголовок и максимум одна строка данных)
  
  const dateColumnIndex = CONFIG.HEADERS.indexOf('Дата отзыва') + 1;
  if (dateColumnIndex === 0) {
    log('ОШИБКА: Не найден столбец "Дата отзыва" для сортировки.');
    return;
  }
  
  // Сортируем данные (исключая заголовок) по столбцу с датой
  const range = sheet.getRange(2, 1, sheet.getLastRow() - 1, CONFIG.HEADERS.length);
  range.sort([{column: dateColumnIndex, ascending: ascending}]);
  
  const sortOrder = ascending ? 'старые сначала' : 'новые сначала';
  log(`Лист отсортирован по дате (${sortOrder}).`);
}

/**
 * 🚀 НОВАЯ ФУНКЦИЯ: Сортировка листа по дате (старые отзывы сначала)
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - The sheet to sort
 */
function sortSheetByDateOldestFirst(sheet) {
  return sortSheetByDate(sheet, true);
}

/**
 * 🚀 НОВАЯ ФУНКЦИЯ: Применение пользовательских настроек сортировки
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - The sheet to sort
 * @param {Object} store - Store configuration with sorting preferences
 */
function applySortingPreferences(sheet, store) {
  // Проверяем настройки сортировки в конфигурации магазина
  const sortOldestFirst = store.settings?.sortOldestFirst || false;
  
  if (sortOldestFirst) {
    log(`[${store.name}] Применена настройка: сортировка старых отзывов сначала.`);
    sortSheetByDateOldestFirst(sheet);
  } else {
    log(`[${store.name}] Применена стандартная сортировка: новые отзывы сначала.`);
    sortSheetByDate(sheet, false); // Новые сначала (стандартная)
  }
}

/**
 * 🚀 НОВАЯ ФУНКЦИЯ: Обновление порядковых номеров в колонке №
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - Лист для обновления
 */
function updateRowNumbers(sheet) {
  if (sheet.getLastRow() <= 2) return; // Нет данных для нумерации
  
  const numberColumnIndex = CONFIG.HEADERS.indexOf('№') + 1;
  if (numberColumnIndex === 0) {
    log('ПРЕДУПРЕЖДЕНИЕ: Не найдена колонка "№" для обновления порядковых номеров.');
    return;
  }
  
  const dataRowsCount = sheet.getLastRow() - 1; // Исключаем заголовок
  const numbers = [];
  
  // Создаем массив порядковых номеров: 1, 2, 3, ...
  for (let i = 1; i <= dataRowsCount; i++) {
    numbers.push([i]);
  }
  
  // Обновляем колонку с порядковыми номерами
  if (numbers.length > 0) {
    sheet.getRange(2, numberColumnIndex, numbers.length, 1).setValues(numbers);
  }
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
  const emptyReviews = []; // Собираем пустые отзывы для пачкного логирования
  
  const filteredFeedbacks = feedbacks.filter(feedback => {
    const text = (feedback.text || '').trim();
    
    // Skip reviews with no text or very short text
    if (!text || text === '(без текста)' || text.length < CONFIG.MIN_REVIEW_TEXT_LENGTH) {
      // Собираем информацию о пустых отзывах вместо логирования каждого
      emptyReviews.push({
        id: feedback.id,
        text: text || '(нет)',
        date: feedback.createdDate
      });
      return false;
    }
    
    return true;
  });
  
  if (filteredFeedbacks.length !== originalCount) {
    const skippedCount = originalCount - filteredFeedbacks.length;
    log(`[${store.name}] Применен фильтр по содержанию: осталось ${filteredFeedbacks.length} из ${originalCount} отзывов (исключено ${skippedCount} пустых отзывов).`);
    
    // 🚀 УЛУЧШЕНИЕ: Показываем статистику пустых отзывов одной записью
    if (skippedCount > 0) {
      log(`[${store.name}] 📊 Статистика пустых отзывов: всего ${skippedCount}, примеры: ${emptyReviews.slice(0, 3).map(r => `ID ${r.id} ("${r.text}")`).join(', ')}${skippedCount > 3 ? ` и еще ${skippedCount - 3}...` : ''}`);
      
      // В DEV режиме показываем подробности только для первых 10 пустых отзывов
      if (isDevMode() && skippedCount <= 10) {
        log(`[${store.marketplace} DEBUG] Детали пустых отзывов: ${emptyReviews.map(r => `${r.id}("${r.text}")`).join(', ')}`);
      } else if (isDevMode() && skippedCount > 10) {
        log(`[${store.marketplace} DEBUG] Слишком много пустых отзывов (${skippedCount}) для детального логирования. Показаны только примеры выше.`);
      }
    }
  }
  
  return filteredFeedbacks;
}

// ============ ANSWERED REVIEW FILTERING FUNCTION ============
/**
 * Filters out reviews that already have answers from the store
 * @param {Array} feedbacks - Array of feedback objects
 * @param {Object} store - Store configuration
 * @returns {Array} Filtered feedbacks (only those without store answers)
 */
function filterFeedbacksByAnswer(feedbacks, store) {
  const originalCount = feedbacks.length;
  const answeredReviews = []; // Собираем отзывы с ответами для логирования
  
  const filteredFeedbacks = feedbacks.filter(feedback => {
    // Проверяем наличие ответа от магазина
    const hasAnswer = !!(feedback.hasAnswer);
    
    if (hasAnswer) {
      // Собираем информацию об отвеченных отзывах
      answeredReviews.push({
        id: feedback.id,
        date: feedback.createdDate,
        rating: feedback.rating
      });
      return false; // Исключаем отзывы с ответами
    }
    
    return true;
  });
  
  if (filteredFeedbacks.length !== originalCount) {
    const skippedCount = originalCount - filteredFeedbacks.length;
    log(`[${store.name}] Применен фильтр по наличию ответов: осталось ${filteredFeedbacks.length} из ${originalCount} отзывов (исключено ${skippedCount} уже отвеченных).`);
    
    // 🚀 УЛУЧШЕНИЕ: Показываем статистику отвеченных отзывов
    if (skippedCount > 0) {
      log(`[${store.name}] 📊 Статистика отвеченных отзывов: всего ${skippedCount}, примеры: ${answeredReviews.slice(0, 3).map(r => `ID ${r.id} (рейтинг ${r.rating})`).join(', ')}${skippedCount > 3 ? ` и еще ${skippedCount - 3}...` : ''}`);
      
      // В DEV режиме показываем подробности только для первых 5 отвеченных отзывов
      if (isDevMode() && skippedCount <= 5) {
        log(`[${store.marketplace} DEBUG] Детали отвеченных отзывов: ${answeredReviews.map(r => `${r.id}(${r.rating}★)`).join(', ')}`);
      } else if (isDevMode() && skippedCount > 5) {
        log(`[${store.marketplace} DEBUG] Слишком много отвеченных отзывов (${skippedCount}) для детального логирования. Показаны только примеры выше.`);
      }
    }
  }
  
  return filteredFeedbacks;
}

// ============ BATCH PROCESSING FUNCTIONS ============

/**
 * 🚀 НОВАЯ ФУНКЦИЯ: Пачкная обработка отзывов для повышения производительности
 * @param {Array} feedbacks - Массив отзывов для обработки
 * @param {Array} templates - Массив шаблонов ответов
 * @param {Object} store - Конфигурация магазина
 * @param {boolean} devMode - Режим разработчика
 * @returns {Array} Массив результатов обработки
 */
function processFeedbackBatch(feedbacks, templates, store, devMode) {
  log(`[${store.name}] 🚀 ПАЧКНАЯ ОБРАБОТКА: начинаю обработку ${feedbacks.length} отзывов...`);
  
  const results = [];
  let skippedByRating = 0;
  let noTemplateCount = 0;
  let processedCount = 0;
  let sentCount = 0;
  
  feedbacks.forEach(feedback => {
    const rowData = [
      '', // № - будет заполнен автоматически при добавлении в лист
      feedback.id, 
      new Date(feedback.createdDate), 
      feedback.product.id, 
      feedback.product.name, 
      feedback.product.url, 
      feedback.rating, 
      feedback.text
    ];
    
    // Проверка рейтинга
    if (!CONFIG.RESPOND_TO_RATINGS.includes(feedback.rating)) {
      rowData.push('', CONFIG.STATUS.SKIPPED_RATING, `Рейтинг ${feedback.rating} не входит в список для ответа.`, '');
      results.push({
        rowData: rowData,
        logMessage: `[${store.name}] Пропущен отзыв ID: ${feedback.id} (рейтинг ${feedback.rating}). Дата: ${new Date(feedback.createdDate).toLocaleDateString('ru-RU')}`,
        status: CONFIG.STATUS.SKIPPED_RATING
      });
      skippedByRating++;
      return;
    }
    
    // Подбор шаблона
    const template = selectRandomTemplate(templates, feedback.rating);
    if (!template) {
      rowData.push('', CONFIG.STATUS.NO_TEMPLATE, `Не найден подходящий шаблон для рейтинга ${feedback.rating}.`, '');
      results.push({
        rowData: rowData,
        logMessage: `[${store.name}] Нет шаблона для отзыва ID: ${feedback.id} (рейтинг ${feedback.rating}). Дата: ${new Date(feedback.createdDate).toLocaleDateString('ru-RU')}`,
        status: CONFIG.STATUS.NO_TEMPLATE
      });
      noTemplateCount++;
      return;
    }
    
    // Обработка в зависимости от режима
    if (devMode) {
      rowData.push(template, CONFIG.STATUS.PENDING, '', '');
      results.push({
        rowData: rowData,
        logMessage: `[${store.name}] DEV: Подготовлен ответ для отзыва ID: ${feedback.id}. Дата: ${new Date(feedback.createdDate).toLocaleDateString('ru-RU')}`,
        status: CONFIG.STATUS.PENDING
      });
      processedCount++;
    } else {
      // PROD режим: отправляем ответ
      const result = sendAnswer(store, feedback.id, template);
      rowData.push(template, result.status, result.error, result.timestamp);
      results.push({
        rowData: rowData,
        logMessage: `[${store.name}] PROD: Отправлен ответ для ID: ${feedback.id}. Статус: ${result.status}. Дата: ${new Date(feedback.createdDate).toLocaleDateString('ru-RU')}`,
        status: result.status
      });
      if (result.status === CONFIG.STATUS.SENT) {
        sentCount++;
      }
      processedCount++;
    }
  });
  
  // 📊 ИТОГОВАЯ СТАТИСТИКА ПАЧКНОЙ ОБРАБОТКИ
  const statsMessage = devMode 
    ? `[${store.name}] 📊 ПАЧКА ОБРАБОТАНА: подготовлено ${processedCount}, пропущено по рейтингу ${skippedByRating}, нет шаблонов ${noTemplateCount}`
    : `[${store.name}] 📊 ПАЧКА ОБРАБОТАНА: отправлено ${sentCount}/${processedCount}, пропущено по рейтингу ${skippedByRating}, нет шаблонов ${noTemplateCount}`;
  
  log(statsMessage);
  
  return results;
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
  
  // 🚀 ИНТЕЛЛЕКТУАЛЬНАЯ БАТЧЕВАЯ ОБРАБОТКА
  const maxExecutionTime = 5 * 60 * 1000; // 5 минут лимит
  const startTime = Date.now();
  
  // Группируем магазины по платформам для оптимальной обработки
  const wbStores = activeStores.filter(s => s.marketplace === 'Wildberries');
  const ozonStores = activeStores.filter(s => s.marketplace === 'Ozon');
  const otherStores = activeStores.filter(s => s.marketplace !== 'Wildberries' && s.marketplace !== 'Ozon');
  
  log(`📊 Распределение: WB=${wbStores.length}, Ozon=${ozonStores.length}, Другие=${otherStores.length}`);
  
  // Обработка с контролем времени и приоритизацией
  let processedCount = 0;
  const allStoresToProcess = [...wbStores, ...ozonStores, ...otherStores]; // WB и Ozon в приоритете
  
  for (const store of allStoresToProcess) {
    // Проверяем оставшееся время перед каждым магазином
    const elapsedTime = Date.now() - startTime;
    const remainingTime = maxExecutionTime - elapsedTime;
    
    if (remainingTime < 30000) { // Менее 30 секунд осталось
      log(`⏱️ ОСТАНОВКА: осталось ${Math.round(remainingTime/1000)} сек (недостаточно для обработки магазина)`);
      log(`📊 Успешно обработано: ${processedCount}/${activeStores.length} магазинов`);
      
      if (processedCount < activeStores.length) {
        log(`📋 Необработанные магазины: ${activeStores.length - processedCount}`);
        log(`💡 Рекомендация: запустите обработку повторно для оставшихся магазинов`);
      }
      break;
    }
    
    log(`--- Начинаю обработку магазина: ${store.name} [${store.marketplace}] (${processedCount + 1}/${activeStores.length}) ---`);
    log(`⏱️ Времени осталось: ${Math.round(remainingTime/1000)} сек`);
    
    const storeStartTime = Date.now();
    processSingleStore(store, devMode);
    const storeDuration = Date.now() - storeStartTime;
    
    processedCount++;
    log(`--- Завершение обработки магазина: ${store.name} (${Math.round(storeDuration/1000)} сек) ---`);
  }
  
  const totalDuration = Date.now() - startTime;
  log(`--- ОБРАБОТКА ЗАВЕРШЕНА: ${processedCount}/${activeStores.length} магазинов за ${Math.round(totalDuration/1000)} сек ---`);
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
      : collectOzonReviewsIncremental(store);
      
  if (!feedbacks || feedbacks.length === 0) { 
      log(`[${store.name}] Новых отзывов не найдено.`);
      return;
  }
  
  log(`[${store.name}] Найдено всего ${feedbacks.length} необработанных отзывов.`);
  
  // Apply content filter first - remove empty reviews
  feedbacks = filterFeedbacksByContent(feedbacks, store);
  
  // Apply answer filter - remove reviews with existing answers
  feedbacks = filterFeedbacksByAnswer(feedbacks, store);
  
  // Apply date filter
  feedbacks = filterFeedbacksByDate(feedbacks, store);
  
  // Apply rating filter - only 4 and 5 star reviews
  feedbacks = filterFeedbacksByRating(feedbacks, store);
  
  const newFeedbacks = feedbacks.filter(fb => !processedIds.has(fb.id));
  log(`[${store.name}] Из них ${newFeedbacks.length} действительно новых (нет в таблице).`);
  if (newFeedbacks.length === 0) return;

  const rowsToAppend = [];
  
  // 🚀 УЛУЧШЕНИЕ: Пачкная обработка отзывов
  const processingBatch = newFeedbacks.slice(0, CONFIG.MAX_FEEDBACKS_PER_RUN);
  const batchResults = processFeedbackBatch(processingBatch, templates, store, devMode);
  
  batchResults.forEach(result => {
    rowsToAppend.push(result.rowData);
    log(result.logMessage);
    
    // Задержка только в PROD режиме и только для отправленных ответов
    if (!devMode && result.status === CONFIG.STATUS.SENT) {
      Utilities.sleep(CONFIG.DELAY_BETWEEN_REQUESTS);
    }
  });
  
  if (rowsToAppend.length > 0) {
    const startRow = sheet.getLastRow() + 1;
    
    // 🚀 УЛУЧШЕНИЕ: Заполняем порядковые номера перед добавлением
    rowsToAppend.forEach((row, index) => {
      row[0] = startRow + index - 1; // № = номер строки - 1 (исключаем заголовок)
    });
    
    sheet.getRange(startRow, 1, rowsToAppend.length, CONFIG.HEADERS.length).setValues(rowsToAppend);
    
    // 🚀 УЛУЧШЕНИЕ: Применяем пользовательские настройки сортировки
    applySortingPreferences(sheet, store);
    
    // 📊 ПЕРЕСЧЕТ ПОРЯДКОВЫХ НОМЕРОВ после сортировки
    updateRowNumbers(sheet);
    log(`[${store.name}] Обновлены порядковые номера отзывов.`);
  }
}

/**
 * 🚀 УЛУЧШЕННАЯ ФУНКЦИЯ: Пачкная отправка всех подготовленных ответов
 */
function sendPendingAnswers() {
  log('--- 🚀 ЗАПУСК ПАЧКНОЙ ОТПРАВКИ ПОДГОТОВЛЕННЫХ ОТВЕТОВ ---');
  const allStores = getStores().filter(s => s.isActive);
  
  let totalSent = 0;
  let totalSuccess = 0;
  const maxExecutionTime = 4 * 60 * 1000; // 4 минуты лимит (оставляем запас)
  const startTime = Date.now();
  
  for (const store of allStores) {
    // Проверяем оставшееся время
    const elapsedTime = Date.now() - startTime;
    const remainingTime = maxExecutionTime - elapsedTime;
    
    if (remainingTime < 30000) { // Менее 30 секунд
      log(`⏱️ ОСТАНОВКА отправки: осталось ${Math.round(remainingTime/1000)} сек`);
      break;
    }
    
    log(`--- 📤 Обрабатываю магазин: ${store.name} ---`);
    const storeResult = sendPendingAnswersForStore(store);
    
    totalSent += storeResult.sentCount;
    totalSuccess += storeResult.successCount;
    
    log(`--- ✅ Завершено для ${store.name}: отправлено ${storeResult.successCount}/${storeResult.sentCount} ---`);
    
    // Пауза между магазинами для снижения нагрузки
    if (storeResult.sentCount > 0) {
      Utilities.sleep(2000);
    }
  }
  
  const totalDuration = Date.now() - startTime;
  log(`--- 🎯 ПАЧКНАЯ ОТПРАВКА ЗАВЕРШЕНА: ${totalSuccess}/${totalSent} за ${Math.round(totalDuration/1000)} сек ---`);
}

/**
 * 🚀 НОВАЯ ФУНКЦИЯ: Пачкная отправка ответов для одного магазина
 * @param {Object} store - Конфигурация магазина
 * @returns {Object} Результат отправки {sentCount, successCount}
 */
function sendPendingAnswersForStore(store) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(`Отзывы (${store.name})`);
  if (!sheet) {
    log(`[${store.name}] ⚠️ Лист не найден`);
    return { sentCount: 0, successCount: 0 };
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const statusCol = headers.indexOf('Статус') + 1;
  const answerCol = headers.indexOf('Подобранный ответ') + 1;
  const idCol = headers.indexOf('ID отзыва') + 1;
  const errorCol = headers.indexOf('Детали ошибки') + 1;
  const timeCol = headers.indexOf('Время отправки') + 1;
  const dateCol = headers.indexOf('Дата отзыва') + 1;

  if (statusCol === 0) {
    log(`[${store.name}] ❌ Ошибка: не найден столбец "Статус".`);
    return { sentCount: 0, successCount: 0 };
  }

  // 📊 СОБИРАЕМ ПАЧКУ ОТВЕТОВ ДЛЯ ОТПРАВКИ
  const pendingAnswers = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][statusCol - 1] === CONFIG.STATUS.PENDING) {
      pendingAnswers.push({
        rowIndex: i + 1,
        feedbackId: data[i][idCol - 1],
        answerText: data[i][answerCol - 1],
        reviewDate: data[i][dateCol - 1] || new Date()
      });
    }
  }

  if (pendingAnswers.length === 0) {
    log(`[${store.name}] 📭 Нет ответов, ожидающих отправки.`);
    return { sentCount: 0, successCount: 0 };
  }

  log(`[${store.name}] 🚀 ПАЧКА ОТПРАВКИ: найдено ${pendingAnswers.length} ответов для отправки...`);

  // 📤 ПАЧКНАЯ ОТПРАВКА С СТАТИСТИКОЙ
  const results = [];
  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  pendingAnswers.forEach((answer, index) => {
    log(`[${store.name}] 📤 Отправляю ${index + 1}/${pendingAnswers.length}: ID ${answer.feedbackId}`);
    
    const result = sendAnswer(store, answer.feedbackId, answer.answerText);
    
    // Обновляем данные в листе
    sheet.getRange(answer.rowIndex, statusCol).setValue(result.status);
    sheet.getRange(answer.rowIndex, errorCol).setValue(result.error);
    sheet.getRange(answer.rowIndex, timeCol).setValue(result.timestamp);
    
    // Собираем статистику
    if (result.status === CONFIG.STATUS.SENT) {
      successCount++;
      log(`[${store.name}] ✅ Успешно отправлен ответ для ID ${answer.feedbackId}. Дата отзыва: ${new Date(answer.reviewDate).toLocaleDateString('ru-RU')}`);
    } else {
      errorCount++;
      errors.push({
        id: answer.feedbackId,
        error: result.error || 'Неизвестная ошибка'
      });
      log(`[${store.name}] ❌ Ошибка отправки для ID ${answer.feedbackId}: ${result.error || 'неизвестная ошибка'}`);
    }
    
    results.push(result);
    
    // Задержка между запросами
    if (index < pendingAnswers.length - 1) {
      Utilities.sleep(CONFIG.DELAY_BETWEEN_REQUESTS);
    }
  });

  // 📊 ИТОГОВАЯ СТАТИСТИКА ДЛЯ МАГАЗИНА
  const sentCount = pendingAnswers.length;
  log(`[${store.name}] 📊 ИТОГИ ПАЧКНОЙ ОТПРАВКИ: успешно ${successCount}/${sentCount}, ошибок ${errorCount}`);
  
  if (errorCount > 0 && errors.length <= 3) {
    log(`[${store.name}] 🔍 Примеры ошибок: ${errors.slice(0, 3).map(e => `${e.id}(${e.error})`).join(', ')}`);
  } else if (errorCount > 3) {
    log(`[${store.name}] 🔍 Слишком много ошибок (${errorCount}) для детального логирования. Проверьте таблицу.`);
  }
  
  return { sentCount, successCount };
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
 * 🔥 ОКТЯБРЬ 2025: ИСПРАВЛЕНО для WB API v1 (v2 НЕ СУЩЕСТВУЕТ!)
 * Получение отзывов по официальной документации WB v1 API
 * Использует простую пагинацию take/skip с Unix timestamp для дат
 * @param {string} apiKey - WB API ключ
 * @param {boolean} includeAnswered - Включать ли отвеченные отзывы  
 * @param {Object} store - Настройки магазина для фильтрации по дате
 * @returns {Array} Массив всех подходящих отзывов
 */
function getWbFeedbacks(apiKey, includeAnswered = false, store = null) {
    const startTime = Date.now();
    log(`[WB] 🔥 WB API v1 START (includeAnswered=${includeAnswered}) - ИСПРАВЛЕНО v2→v1!`);
    log(`[WB] 📦 Store: ${store?.name || 'null'}`);
    log(`[WB] 🔑 API Key length: ${apiKey?.length || 0} chars`);
    
    const MAX_TAKE = 5000; // Максимум по документации WB API
    const MAX_SKIP = 199990; // Максимум по документации WB API
    let allFeedbacks = [];
    let skip = 0;
    let hasMoreData = true;
    let pageCount = 0;
    let totalRequestTime = 0;
    
    try {
        while (hasMoreData && skip <= MAX_SKIP) {
            pageCount++;
            const pageStartTime = Date.now();
            
            // 🔥 ОКТЯБРЬ 2025: ИСПРАВЛЕНО - используем v1 endpoint с Unix timestamp!
            const url = buildWbApiV1Url(includeAnswered, skip, MAX_TAKE, store);
            
            log(`[WB Request #${pageCount}] 📤 GET ${url}`);
            log(`[WB Request #${pageCount}] 📄 Params: skip=${skip}, take=${MAX_TAKE}`);
            log(`[WB Request #${pageCount}] ⏱️ Requesting...`);
            
            const requestStartTime = Date.now();
            const response = UrlFetchApp.fetch(url, { 
                method: 'GET', 
                headers: { 'Authorization': apiKey }, 
                muteHttpExceptions: true 
            });
            const requestDuration = Date.now() - requestStartTime;
            totalRequestTime += requestDuration;
            
            const responseCode = response.getResponseCode();
            const responseBody = response.getContentText();
            const responseSize = responseBody.length;
            
            log(`[WB Response #${pageCount}] 📥 HTTP ${responseCode} (${requestDuration}ms, ${responseSize} bytes)`);
            
            if (responseCode !== 200) {
                log(`[WB Response #${pageCount}] ❌ ERROR: HTTP ${responseCode}`);
                log(`[WB Response #${pageCount}] 📝 Body preview: ${responseBody.substring(0, 300)}...`);
                
                // Enhanced error diagnostics
                if (responseCode === 401) {
                    log(`[WB Response #${pageCount}] 🔎 401 Unauthorized - Invalid API key`);
                } else if (responseCode === 403) {
                    log(`[WB Response #${pageCount}] 🔎 403 Forbidden - API key lacks permissions`);
                } else if (responseCode === 404) {
                    log(`[WB Response #${pageCount}] 🔎 404 Not Found - Check endpoint URL`);
                } else if (responseCode === 429) {
                    log(`[WB Response #${pageCount}] 🔎 429 Rate Limited - Too many requests`);
                } else if (responseCode >= 500) {
                    log(`[WB Response #${pageCount}] 🔎 ${responseCode} Server Error - WB API issues`);
                }
                break;
            }
            
            let json;
            try {
                json = JSON.parse(responseBody);
                log(`[WB Response #${pageCount}] ✅ Valid JSON parsed`);
                
                // Log response structure in dev mode
                if (isDevMode()) {
                    log(`[WB Response #${pageCount} DEBUG] JSON keys: ${Object.keys(json).join(', ')}`);
                    if (json.data) {
                        log(`[WB Response #${pageCount} DEBUG] data keys: ${Object.keys(json.data).join(', ')}`);
                    }
                }
            } catch (parseError) {
                log(`[WB Response #${pageCount}] ❌ JSON PARSE ERROR: ${parseError.message}`);
                log(`[WB Response #${pageCount}] 📝 Raw body: ${responseBody.substring(0, 500)}`);
                break;
            }
            
            if (json.error) {
                log(`[WB Response #${pageCount}] ❌ API ERROR: ${json.errorText || JSON.stringify(json.error)}`);
                break;
            }
            
            const feedbacks = json.data?.feedbacks || [];
            const feedbacksWithText = feedbacks.filter(fb => fb.text && fb.text.trim() && fb.text.trim() !== '(без текста)');
            
            log(`[WB Response #${pageCount}] 📊 Feedbacks: ${feedbacks.length} total, ${feedbacksWithText.length} with text`);
            
            if (feedbacks.length === 0) {
                log(`[WB Response #${pageCount}] ✅ Empty page - pagination complete`);
                hasMoreData = false;
                break;
            }
            
            // Log sample feedback in dev mode
            if (isDevMode() && feedbacks.length > 0) {
                const sample = feedbacks[0];
                log(`[WB Response #${pageCount} DEBUG] Sample feedback: ID=${sample.id}, rating=${sample.rating}, hasText=${!!sample.text}`);
            }
            
            // Обрабатываем отзывы (убираем пустые)
            feedbacks.forEach(fb => {
                const hasText = fb.text && fb.text.trim() && fb.text.trim() !== '(без текста)';
                if (!hasText) return;
                
                allFeedbacks.push({
                    id: fb.id,
                    createdDate: fb.createdDate,
                    rating: fb.rating || fb.productValuation || 0,
                    text: fb.text,
                    user: 'N/A',
                    hasAnswer: !!(fb.answer && fb.answer.text),
                    product: {
                        id: fb.productDetails?.nmId,
                        name: fb.productDetails?.productName || 'Не указано',
                        url: `https://www.wildberries.ru/catalog/${fb.productDetails?.nmId}/detail.aspx`
                    }
                });
            });
            
            // Переходим к следующей странице
            skip += MAX_TAKE;
            hasMoreData = (feedbacks.length === MAX_TAKE); // Если получили полную страницу, возможно есть еще
            
            const pageDuration = Date.now() - pageStartTime;
            log(`[WB Page #${pageCount}] ⏱️ Completed in ${pageDuration}ms (collected ${feedbacksWithText.length} feedbacks)`);
            
            // 🔥 ОКТЯБРЬ 2025: ОБНОВЛЕНО rate limiting WB API - 333ms (3 req/sec)
            Utilities.sleep(333); // 3 запроса в секунду согласно документации
        }
        
        const totalDuration = Date.now() - startTime;
        const avgRequestTime = pageCount > 0 ? Math.round(totalRequestTime / pageCount) : 0;
        
        log(`[WB] ✅ ЗАВЕРШЕНО: ${allFeedbacks.length} отзывов получено за ${pageCount} запросов`);
        log(`[WB] ⏱️ Общее время: ${totalDuration}ms (среднее время запроса: ${avgRequestTime}ms)`);
        log(`[WB] 📊 Статистика: ${Math.round(allFeedbacks.length / (totalDuration / 1000) * 60)} отзывов/минуту`);
        
        // Фильтрация по дате если есть
        if (store && store.settings && store.settings.startDate) {
            const startDate = new Date(store.settings.startDate);
            const filtered = allFeedbacks.filter(fb => new Date(fb.createdDate) >= startDate);
            log(`[WB] 🗓️ Фильтр по дате ${store.settings.startDate}: осталось ${filtered.length} из ${allFeedbacks.length}`);
            return filtered;
        }
        
        return allFeedbacks;
        
    } catch (e) {
        log(`[WB] ⛔ КРИТИЧЕСКАЯ ОШИБКА: ${e.message}`);
        log(`[WB] 🔍 Stack trace: ${e.stack}`);
        log(`[WB] 📊 Частичный результат: ${allFeedbacks.length} отзывов собрано до ошибки`);
        return allFeedbacks; // Возвращаем что успели получить
    }
}

function sendWbFeedbackAnswer(feedbackId, text, apiKey) {
    log(`[WB API] 🎯 НАЧАЛО отправки ответа для ID ${feedbackId}`);
    log(`[WB API] 📝 Текст ответа: "${text}" (длина: ${text.length} символов)`);
    log(`[WB API] 🔑 API ключ: ${apiKey.substring(0, 15)}... (длина: ${apiKey.length})`);
    
    // 🔥 НОВАЯ СТРАТЕГИЯ: Пробуем ОБА endpoint'а последовательно
    // Вариант 1: ID в URL (текущий подход)
    const result1 = attemptWbFeedbackAnswerMethod1(feedbackId, text, apiKey);
    if (result1[0]) {
        log(`[WB API] ✅ УСПЕХ с Method 1 (ID в URL)!`);
        return result1;
    }
    
    log(`[WB API] ⚠️ Method 1 не сработал, пробуем Method 2...`);
    
    // Вариант 2: ID в теле запроса (альтернативный подход)
    const result2 = attemptWbFeedbackAnswerMethod2(feedbackId, text, apiKey);
    if (result2[0]) {
        log(`[WB API] ✅ УСПЕХ с Method 2 (ID в теле)!`);
        return result2;
    }
    
    log(`[WB API] ❌ ОБА метода не сработали. Возвращаем результат последней попытки.`);
    return result2;
}

/**
 * 🔥 ОКТЯБРЬ 2025: Method 1: ID в URL - правильный v1 endpoint
 * Endpoint: POST /api/v1/feedbacks/answer с ID в URL согласно документации
 */
function attemptWbFeedbackAnswerMethod1(feedbackId, text, apiKey) {
    const url = `https://feedbacks-api.wildberries.ru/api/v1/feedbacks/answer`;
    const payload = { 
        id: feedbackId,  // 🔥 ОКТЯБРЬ 2025: ID в теле запроса для v1 API
        text: text       // Текст ответа
    };
    
    log(`[WB API Method 1] 🚀 URL: ${url}`);
    log(`[WB API Method 1] 📝 Payload: ${JSON.stringify(payload)}`);
    
    return sendWbApiRequest(url, payload, apiKey, "Method 1 (ID в URL)");
}

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

// ======================================================================
// ============================ OZON API ===============================
// ======================================================================
// ВАЖНО: Этот раздел содержит всю логику работы с API Ozon.
// Изменения в других разделах не должны затрагивать эти функции.
// ======================================================================

/**
 * 🚀 ИСПРАВЛЕННАЯ ФУНКЦИЯ: Главная функция получения отзывов Ozon с адаптивной пагинацией
 * Интегрирует новые функции из ozon_functions.gs для правильной работы
 * @param {string} clientId - Ozon Client ID
 * @param {string} apiKey - Ozon API Key
 * @param {boolean} includeAnswered - Whether to include answered reviews
 * @param {Object} store - Store configuration with date filtering and other settings
 * @returns {Array} Array of normalized feedback objects
 */
function getOzonFeedbacks(clientId, apiKey, includeAnswered = false, store = null) {
    log(`[Ozon] 🚀 ЗАПУСК пагинации для получения отзывов (includeAnswered=${includeAnswered})`);
    
    try {
        // Используем правильную пагинацию через last_id
        return getOzonFeedbacksWithProperPagination(clientId, apiKey, includeAnswered, store);
    } catch (e) {
        log(`[Ozon] КРИТИЧЕСКАЯ ОШИБКА в главной функции: ${e.message}`);
        log(`[Ozon] Stack trace: ${e.stack}`);
        return [];
    }
}



/**
 * НОВАЯ РЕАЛИЗАЦИЯ: Ozon API с правильной пагинацией через last_id
 * Решает проблему лимита в 100 отзывов за запрос
 * @param {string} clientId - Ozon Client ID
 * @param {string} apiKey - Ozon API Key  
 * @param {boolean} includeAnswered - Включать ли отвеченные отзывы
 * @param {Object} store - Настройки магазина
 * @returns {Array} Все подходящие отзывы
 */
function getOzonFeedbacksWithProperPagination(clientId, apiKey, includeAnswered, store) {
    const url = 'https://api-seller.ozon.ru/v1/review/list';
    
    let allReviews = [];
    let lastId = "";
    let hasNext = true;
    let pageNumber = 1;
    const limit = OZON_CONFIG.API_LIMITS.MAX_LIMIT; // 100 - максимум
    const maxPages = 15; // ⚡ УМЕНЬШЕНО для предотвращения таймаута (1,500 отзывов за раз)
    const startTime = Date.now(); // Отслеживание времени выполнения  
    const maxExecutionTime = 5 * 60 * 1000; // 5 минут максимум (оставляем запас)
    
    // Базовая структура запроса
    let basePayload = {
        filter: {
            has_text: true,  // Только отзывы с текстом
        },
        sort: {
            type: 'CREATED_AT',  // ✅ ИСПРАВЛЕНО: type вместо field
            order: 'DESC'        // ✅ ИСПРАВЛЕНО: order вместо direction  
        },
        limit: limit
    };
    
    // ✅ ПРАВИЛЬНАЯ настройка фильтра по статусу ответов
    if (includeAnswered) {
        // Получаем ВСЕ отзывы (отвеченные + неотвеченные)
        basePayload.filter.status = ['PENDING', 'PROCESSED', 'MODERATED', 'NEW'];
        log(`[Ozon] 🔄 Режим: ВСЕ отзывы (отвеченные + неотвеченные)`);
    } else {
        // Получаем только неотвеченные отзывы
        basePayload.filter.has_answer = false;
        basePayload.filter.status = ['PENDING', 'MODERATED', 'NEW'];
        log(`[Ozon] 🎯 Режим: только НЕОТВЕЧЕННЫЕ отзывы`);
    }

    // ✅ ФИЛЬТР ПО ДАТЕ из настроек магазина
    if (store && store.settings && store.settings.startDate) {
        const startDate = store.settings.startDate;
        const today = new Date().toISOString().split('T')[0];
        
        basePayload.filter.date_from = formatDateForOzon(startDate);
        basePayload.filter.date_to = formatDateForOzon(today);
        
        log(`[Ozon] 🗓️ Фильтр дат: ${startDate} - ${today}`);
    } else {
        log(`[Ozon] 🗓️ Фильтр по дате НЕ применен - получаем все доступные отзывы`);
    }
    
    // ✅ ГЛАВНЫЙ ЦИКЛ ПАГИНАЦИИ с last_id и контролем времени выполнения
    while (hasNext && pageNumber <= maxPages) {
        // 🚨 КОНТРОЛЬ ВРЕМЕНИ ВЫПОЛНЕНИЯ для предотвращения таймаута
        const elapsedTime = Date.now() - startTime;
        if (elapsedTime > maxExecutionTime) {
            log(`[Ozon] ⏱️ ОСТАНОВКА по времени: выполняется ${Math.round(elapsedTime/1000)} сек (лимит ${Math.round(maxExecutionTime/1000)} сек)`);
            log(`[Ozon] 📊 Успели обработать ${pageNumber - 1} страниц, получено ${allReviews.length} отзывов`);
            break;
        }
        log(`[Ozon] 📄 Запрашиваю страницу ${pageNumber} (last_id: "${lastId}")...`);
        
        const payload = {
            ...basePayload,
            last_id: lastId  // ✅ КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: используем last_id вместо page/offset!
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
            
            log(`[Ozon] 🌐 API ответ страница ${pageNumber}: код ${responseCode}, размер ${responseBody.length} символов`);
            
            if (responseCode !== 200) {
                log(`[Ozon] ❌ ОШИБКА на странице ${pageNumber}: Код ${responseCode}. Тело: ${responseBody.substring(0, 500)}`);
                
                // Специальная обработка типичных ошибок Ozon
                if (responseCode === 401) log(`[Ozon] 🔎 401 Unauthorized - проверьте Client-Id и Api-Key`);
                if (responseCode === 403) log(`[Ozon] 🔎 403 Forbidden - API ключ не имеет прав на чтение отзывов`);
                if (responseCode === 429) log(`[Ozon] 🔎 429 Too Many Requests - превышен лимит 50 RPS`);
                if (responseCode >= 500) log(`[Ozon] 🔎 ${responseCode} Server Error - временные проблемы на стороне Ozon`);
                
                break;
            }
            
            const json = JSON.parse(responseBody);
            
            // 🚨 ЭКСТРЕННАЯ ОТЛАДКА: Показываем структуру ответа
            if (isDevMode() || pageNumber <= 2) {
                log(`[Ozon DEBUG] Страница ${pageNumber} - структура JSON: ${JSON.stringify(Object.keys(json), null, 2)}`);
                if (json.result) {
                    log(`[Ozon DEBUG] json.result содержит: ${JSON.stringify(Object.keys(json.result), null, 2)}`);
                }
            }
            
            // ✅ ИСПРАВЛЕНА обработка структуры ответа - данные в корне JSON!
            let reviews = [];
            let resultData = null;
            
            // ГЛАВНОЕ ИСПРАВЛЕНИЕ: Ozon API возвращает данные в корне, не в json.result!
            if (json.reviews && Array.isArray(json.reviews)) {
                // Структура: { "reviews": [...], "last_id": "...", "has_next": true }
                reviews = json.reviews;
                resultData = json; // Вся структура пагинации в корне!
                log(`[Ozon] ✅ Найдена корневая структура: reviews=${reviews.length}, has_next=${json.has_next}, last_id="${json.last_id}"`);
            } else if (json.result && json.result.reviews) {
                // Альтернативная структура: { "result": { "reviews": [...], "has_next": true } }
                resultData = json.result;
                reviews = json.result.reviews || [];
                log(`[Ozon] ✅ Найдена result структура: reviews=${reviews.length}`);
            } else if (json.data && json.data.reviews) {
                // Еще одна возможная структура: { "data": { "reviews": [...] } }
                resultData = json.data;
                reviews = json.data.reviews;
                log(`[Ozon] ✅ Найдена data структура: reviews=${reviews.length}`);
            } else {
                log(`[Ozon] ❌ Неожиданная структура ответа на странице ${pageNumber}. Ключи: ${Object.keys(json).join(', ')}`);
                // 🚨 ЭКСТРЕННАЯ МЕРА: Показываем полный ответ если структура неожиданная
                if (pageNumber <= 3) {
                    log(`[Ozon EMERGENCY] Первые 1000 символов ответа: ${responseBody.substring(0, 1000)}`);
                }
                break;
            }
            
            if (!Array.isArray(reviews)) {
                log(`[Ozon] ❌ reviews не является массивом на странице ${pageNumber}. Тип: ${typeof reviews}`);
                break;
            }
            
            log(`[Ozon] 📄 Страница ${pageNumber}: получено ${reviews.length} отзывов`);
            
            // ✅ ОБРАБАТЫВАЕМ ОТЗЫВЫ И ДОБАВЛЯЕМ К ОБЩЕМУ СПИСКУ
            const processedReviews = reviews.map(fb => ({
                id: fb.id, 
                createdDate: fb.published_at || fb.created_at, 
                rating: fb.rating,
                text: fb.text || '(без текста)', 
                user: 'Аноним',
                hasAnswer: !!(fb.answer && fb.answer.text) || !!(fb.comment && fb.comment.text) || fb.has_answer === true, // ✅ НОВОЕ: проверка наличия ответа
                product: { 
                    id: fb.sku || fb.offer_id,
                    name: 'Не указано', // Будет обновлено через Product API
                    url: `https://www.ozon.ru/product/${fb.sku || fb.offer_id}`
                }
            }));
            
            allReviews = allReviews.concat(processedReviews);
            
            // ✅ КРИТИЧНО: Проверяем наличие следующей страницы
            if (resultData) {
                hasNext = resultData.has_next || false;
                lastId = resultData.last_id || "";
                
                if (isDevMode()) {
                    log(`[Ozon DEBUG] has_next: ${hasNext}, last_id: "${lastId}"`);
                }
            } else {
                // 🚨 АВАРИЙНАЯ МЕРА: Если lastId пустой 3 раза подряд - СТОП
                if (!lastId && pageNumber > 3) {
                    log(`[Ozon] 🛑 АВАРИЙНАЯ ОСТАНОВКА: last_id пустой ${pageNumber - 1} страниц подряд - возможна ошибка в API или парсинге`);
                    hasNext = false;
                } else {
                    // Если структура не содержит информацию о пагинации, 
                    // проверяем по количеству записей
                    hasNext = (reviews.length === limit);
                    log(`[Ozon] ⚠️ Нет информации о пагинации. Предполагаем has_next = ${hasNext} на основе размера ответа`);
                }
            }
            
            // Если получили меньше записей чем лимит - это последняя страница
            if (reviews.length < limit) {
                log(`[Ozon] ✅ Последняя страница ${pageNumber}: получено ${reviews.length} < ${limit}`);
                hasNext = false;
            }
            
            pageNumber++;
            
            // ✅ RATE LIMITING: Соблюдаем лимит 50 RPS (20мс минимум между запросами)
            Utilities.sleep(25); // 40 RPS для безопасности
            
            // Дополнительная пауза каждые 20 запросов
            if (pageNumber % 20 === 0) {
                log(`[Ozon] 💤 Пауза после ${pageNumber - 1} страниц для стабильности...`);
                Utilities.sleep(1000);
            }
            
        } catch (e) {
            log(`[Ozon] ❌ КРИТИЧЕСКАЯ ОШИБКА на странице ${pageNumber}: ${e.message}`);
            log(`[Ozon] 🔍 Stack trace: ${e.stack}`);
            break;
        }
    }
    
    if (pageNumber > maxPages) {
        log(`[Ozon] ⚠️ ПРЕДУПРЕЖДЕНИЕ: Достигнут максимум страниц (${maxPages}). Возможно есть еще данные.`);
    }
    
    // ✅ ФИНАЛЬНАЯ СОРТИРОВКА (новые отзывы первыми)
    allReviews.sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate));
    
    // ✅ ОБОГАЩЕНИЕ НАЗВАНИЯМИ ТОВАРОВ
    if (allReviews.length > 0 && store && store.credentials) {
        const offerIds = allReviews.map(review => review.product.id).filter(id => id);
        const productNames = getOzonProductNames(offerIds, store.credentials.clientId, store.credentials.apiKey);
        
        if (Object.keys(productNames).length > 0) {
            allReviews.forEach(review => {
                if (productNames[review.product.id]) {
                    review.product.name = productNames[review.product.id];
                }
            });
            log(`[Ozon] 🏷️ Названия товаров обновлены для ${Object.keys(productNames).length} отзывов`);
        }
    }
    
    log(`[Ozon] 🎯 ИТОГО получено ${allReviews.length} отзывов за ${pageNumber - 1} страниц`);
    return allReviews;
}

function sendOzonFeedbackAnswer(feedbackId, text, clientId, apiKey) {
    const url = 'https://api-seller.ozon.ru/v1/review/comment/create';
    const payload = { review_id: feedbackId, text: text, mark_review_as_processed: true };
    
    // 🚀 УЛУЧШЕННОЕ ЛОГИРОВАНИЕ: Запрос
    log(`[Ozon API] 📤 Отправка ответа для отзыва ${feedbackId}`);
    log(`[Ozon API] 🔗 URL: ${url}`);
    log(`[Ozon API] 📝 Текст ответа: "${text}" (${text.length} символов)`);
    log(`[Ozon API] 🔑 Client-Id: ${clientId.substring(0, 8)}...`);
    
    const startTime = Date.now();
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
    const requestDuration = Date.now() - startTime;
    
    const code = response.getResponseCode();
    const responseBody = response.getContentText();
    
    // 🚀 УЛУЧШЕННОЕ ЛОГИРОВАНИЕ: Ответ
    log(`[Ozon API] 📥 Ответ получен: HTTP ${code} (${requestDuration}ms)`);
    log(`[Ozon API] 📋 Размер ответа: ${responseBody.length} символов`);
    
    if (code === 200) {
        log(`[Ozon API] ✅ УСПЕХ: Ответ отправлен для отзыва ${feedbackId}`);
        
        // Пытаемся распарсить ответ для дополнительной информации
        try {
            const responseJson = JSON.parse(responseBody);
            if (responseJson.result && responseJson.result.comment_id) {
                log(`[Ozon API] 💬 ID созданного комментария: ${responseJson.result.comment_id}`);
            }
            log(`[Ozon API] 📄 Полный ответ: ${responseBody}`);
        } catch (e) {
            log(`[Ozon API] 📄 Ответ (не JSON): ${responseBody}`);
        }
    } else {
        log(`[Ozon API] ❌ ОШИБКА: HTTP ${code} для отзыва ${feedbackId}`);
        log(`[Ozon API] 📋 Тело ошибки: ${responseBody}`);
        
        // Детальная диагностика ошибок
        if (code === 400) {
            log(`[Ozon API] 🔍 400 Bad Request - проверьте корректность review_id или текста ответа`);
        } else if (code === 401) {
            log(`[Ozon API] 🔍 401 Unauthorized - проверьте Client-Id и Api-Key`);
        } else if (code === 403) {
            log(`[Ozon API] 🔍 403 Forbidden - нет прав на создание комментариев`);
        } else if (code === 404) {
            log(`[Ozon API] 🔍 404 Not Found - отзыв с ID ${feedbackId} не найден`);
        } else if (code === 409) {
            log(`[Ozon API] 🔍 409 Conflict - возможно, ответ уже был отправлен на этот отзыв`);
        } else if (code === 422) {
            log(`[Ozon API] 🔍 422 Unprocessable Entity - некорректные данные запроса`);
        } else if (code === 429) {
            log(`[Ozon API] 🔍 429 Too Many Requests - превышен лимит запросов`);
        } else if (code >= 500) {
            log(`[Ozon API] 🔍 ${code} Server Error - временные проблемы на стороне Ozon`);
        }
    }
    
    const success = code === 200;
    const errorMessage = success ? '' : `HTTP ${code}: ${responseBody}`;
    
    return [success, errorMessage, responseBody];
}

// --- Ozon инкрементальный сбор и фильтрация дублей ---

function collectOzonReviewsIncremental(store, overlapHours = 24) {
  // 1. Получить lastDate из прогресса
  const progress = getOzonStoreProgress(store.id) || {};
  let fromDate;
  if (progress.lastDate) {
    fromDate = new Date(progress.lastDate);
    fromDate.setHours(fromDate.getHours() - overlapHours);
  } else if (store.settings && store.settings.startDate) {
    fromDate = new Date(store.settings.startDate);
  } else {
    fromDate = null; // Получать все с самого начала
  }
  const toDate = new Date();
  log(`[OzonIncr] Диапазон: ${fromDate ? fromDate.toISOString() : 'начало'} — ${toDate.toISOString()}`);
  // 2. Получить отзывы через getOzonFeedbacks с фильтрами дат
  const feedbacks = getOzonFeedbacks(store.credentials.clientId, store.credentials.apiKey, false, store).filter(fb => {
    if (!fromDate) return true;
    return new Date(fb.createdDate) >= fromDate && new Date(fb.createdDate) <= toDate;
  });
  // 3. Отфильтровать дубли по листу
  const uniqueFeedbacks = filterDuplicateOzonReviews(feedbacks, store);
  // 4. Обновить прогресс (lastDate = newest createdDate в batch)
  const lastDate = uniqueFeedbacks.reduce((max, r) => {
    const d = new Date(r.createdDate);
    return (!max || d>max) ? d : max;
  }, fromDate);
  if (lastDate) updateOzonStoreProgress(store.id, { lastDate: lastDate.toISOString() });
  log(`[OzonIncr] Получено: ${feedbacks.length}, новых: ${uniqueFeedbacks.length}`);
  return uniqueFeedbacks;
}

function filterDuplicateOzonReviews(reviews, store) {
  const sheet = createOrGetSheet(`Отзывы (${store.name})`, CONFIG.HEADERS);
  const existingIds = getProcessedIdsFromSheet(sheet);
  return reviews.filter(r => !existingIds.has(r.id));
}

function getOzonStoreProgress(storeId) {
  const raw = PropertiesService.getScriptProperties().getProperty(`ozon_inc_progress_${storeId}`);
  return raw ? JSON.parse(raw) : {};
}
function updateOzonStoreProgress(storeId, data) {
  const current = getOzonStoreProgress(storeId);
  const next = { ...current, ...data };
  PropertiesService.getScriptProperties().setProperty(`ozon_inc_progress_${storeId}`, JSON.stringify(next));
}

// В универсальной/индивидуальной функции обработки Ozon:
// вместо вызова getOzonFeedbacks для Ozon
// - вызывать collectOzonReviewsIncremental(store)
// - batch сохранить в лист (и обработать)

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
  
  // 🚀 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Проверяем изменения настроек
  let shouldResetProgress = false;
  if (storeIndex > -1) {
    const oldStore = stores[storeIndex];
    
    // Проверяем изменение важных настроек, влияющих на пагинацию
    const oldStartDate = oldStore.settings?.startDate;
    const newStartDate = store.settings?.startDate;
    const oldIncludeAnswered = oldStore.settings?.includeAnswered;
    const newIncludeAnswered = store.settings?.includeAnswered;
    const oldSortOldestFirst = oldStore.settings?.sortOldestFirst;
    const newSortOldestFirst = store.settings?.sortOldestFirst;
    
    if (oldStartDate !== newStartDate) {
      log(`[${store.name}] 📅 ИЗМЕНЕНА дата начала поиска: "${oldStartDate}" → "${newStartDate}"`);
      shouldResetProgress = true;
    }
    
    if (oldIncludeAnswered !== newIncludeAnswered) {
      log(`[${store.name}] 🔄 ИЗМЕНЕНА настройка включения отвеченных: ${oldIncludeAnswered} → ${newIncludeAnswered}`);
      shouldResetProgress = true;
    }
    
    if (oldSortOldestFirst !== newSortOldestFirst) {
      log(`[${store.name}] 📊 ИЗМЕНЕНА настройка сортировки: sortOldestFirst ${oldSortOldestFirst} → ${newSortOldestFirst}`);
      // Сортировка не влияет на пагинацию, но обнуляем для чистоты
      shouldResetProgress = true;
    }
    
    stores[storeIndex] = store; 
  } else {
    store.id = store.id || new Date().getTime().toString(); 
    stores.push(store);
    shouldResetProgress = false; // Новый магазин - нет старого прогресса для сброса
  }
  
  // 🚀 СБРАСЫВАЕМ ПРОГРЕСС при изменении критических настроек
  if (shouldResetProgress) {
    resetStoreProgress(store.id);
    log(`[${store.name}] 🔄 СБРОШЕН прогресс обработки из-за изменения настроек`);
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
  if (idCol === 0) {
    log('ОШИБКА: Не найдена колонка "ID отзыва" для проверки обработанных отзывов.');
    return new Set();
  }
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

// ============ OZON TESTING FUNCTIONS ============
/**
 * Функция для тестирования новой пагинации Ozon API
 * Показывает, как работает правильный last_id пагинация и сколько отзывов можно получить
 */
function testOzonFeedbackPagination() {
  const ui = SpreadsheetApp.getUi();
  
  // Получаем список активных Ozon магазинов
  const stores = getStores().filter(s => s.isActive && s.marketplace === 'Ozon');
  if (stores.length === 0) {
    ui.alert('❌ Ошибка', 'Не найдено активных магазинов Ozon для тестирования.', ui.ButtonSet.OK);
    return;
  }
  
  // Выбираем магазин (пока берем первый)
  const store = stores[0];
  log(`[Ozon TEST] 🧪 Начало тестирования пагинации для магазина: ${store.name}`);
  
  // Выбираем режим тестирования
  const testModeResponse = ui.alert('🧪 Тест Ozon API', 
    'Выберите режим тестирования:\n\n' +
    'ДА = Получить ВСЕ отзывы (отвеченные + неотвеченные)\n' +
    'НЕТ = Получить только неотвеченные отзывы\n' +
    'ОТМЕНА = Выход', 
    ui.ButtonSet.YES_NO_CANCEL);
  
  if (testModeResponse === ui.Button.CANCEL) {
    log('[Ozon TEST] ❌ Тестирование отменено пользователем.');
    return;
  }
  
  const includeAnswered = (testModeResponse === ui.Button.YES);
  log(`[Ozon TEST] 🎯 Режим тестирования: ${includeAnswered ? 'ВСЕ отзывы' : 'только неотвеченные'}`);
  
  // Выбираем лимит страниц для тестирования
  const pageLimitResponse = ui.prompt('🧪 Тест Ozon API', 
    'Сколько страниц максимум запросить?\n(1 страница = до 100 отзывов)\n\nРекомендуется:\n• Для быстрого теста: 1-3\n• Для полноценной проверки: 5-10\n• Для получения ВСЕХ данных: 100', 
    ui.ButtonSet.OK_CANCEL);
    
  if (pageLimitResponse.getSelectedButton() !== ui.Button.OK) {
    log('[Ozon TEST] ❌ Тестирование отменено пользователем.');
    return;
  }
  
  let maxPages;
  try {
    maxPages = parseInt(pageLimitResponse.getResponseText().trim()) || 3;
    if (maxPages < 1) maxPages = 1;
    if (maxPages > 100) maxPages = 100;
  } catch (e) {
    maxPages = 3;
  }
  
  log(`[Ozon TEST] 📊 Лимит страниц для тестирования: ${maxPages}`);
  
  // Включаем режим разработчика на время теста для более подробных логов
  const wasDevMode = isDevMode();
  if (!wasDevMode) {
    log('[Ozon TEST] 🛠️ Временно включаем Dev Mode для детального логирования...');
    setDevMode('true');
  }
  
  try {
    log('[Ozon TEST] 🚀 ЗАПУСК ТЕСТИРОВАНИЯ пагинации Ozon...');
    const startTime = new Date();
    
    // Используем улучшенную функцию с правильной пагинацией
    // Временно ограничиваем количество страниц для теста
    const originalMaxPages = 100;
    // Создаем тестовую версию функции с ограниченным числом страниц
    const testResult = testOzonFeedbacksWithLimitedPages(
      store.credentials.clientId, 
      store.credentials.apiKey, 
      includeAnswered, 
      store, 
      maxPages
    );
    
    const endTime = new Date();
    const duration = Math.round((endTime - startTime) / 1000);
    
    log(`[Ozon TEST] 📊 РЕЗУЛЬТАТ ТЕСТА:`);
    log(`[Ozon TEST] ✅ Получено отзывов: ${testResult.length}`);
    log(`[Ozon TEST] ⏱️ Время выполнения: ${duration} секунд`);
    log(`[Ozon TEST] 📄 Страниц обработано: ${testResult.pagesProcessed || 'неизвестно'}`);
    log(`[Ozon TEST] 🔄 Использована пагинация: ${testResult.usedPagination ? 'ДА (last_id)' : 'НЕТ'}`);
    
    // Показываем детали первых нескольких отзывов
    if (testResult.length > 0) {
      log(`[Ozon TEST] 📝 Примеры отзывов (первые 3):`);
      testResult.slice(0, 3).forEach((review, index) => {
        log(`[Ozon TEST] ${index + 1}. ID: ${review.id}, Дата: ${review.createdDate}, Рейтинг: ${review.rating}, Текст: "${review.text.substring(0, 50)}..."`);
      });
    }
    
    // Показываем результат пользователю
    const resultMessage = 
      `✅ УСПЕШНО ПРОТЕСТИРОВАНО!\n\n` +
      `📊 Получено отзывов: ${testResult.length}\n` +
      `⏱️ Время: ${duration} сек\n` +
      `📄 Страниц: ${testResult.pagesProcessed || 'N/A'}\n` +
      `🔄 Пагинация: ${testResult.usedPagination ? 'last_id (ПРАВИЛЬНО!)' : 'НЕ ИСПОЛЬЗОВАНА'}\n\n` +
      `${testResult.length > 0 ? 'Первый отзыв:\n' + testResult[0].text.substring(0, 100) + '...' : 'Отзывы не найдены'}\n\n` +
      `Подробные логи в "🐞 Лог отладки"`;
      
    ui.alert('🎉 ТЕСТ OZON ПАГИНАЦИИ ЗАВЕРШЕН', resultMessage, ui.ButtonSet.OK);
    
  } catch (e) {
    log(`[Ozon TEST] ⛔ КРИТИЧЕСКАЯ ОШИБКА в тесте: ${e.message}`);
    log(`[Ozon TEST] 🔍 Stack trace: ${e.stack}`);
    ui.alert('⛔ КРИТИЧЕСКАЯ ОШИБКА', 
      `Произошла критическая ошибка:\n\n${e.message}\n\nПодробности в логе отладки.`, 
      ui.ButtonSet.OK);
  } finally {
    // Восстанавливаем предыдущий режим разработчика
    if (!wasDevMode) {
      log('[Ozon TEST] 🛠️ Восстанавливаем предыдущий режим разработчика...');
      setDevMode('false');
    }
    
    log('[Ozon TEST] 🏁 Тестирование завершено. Подробные логи в листе "🐞 Лог отладки".');
  }
}

/**
 * Тестовая версия функции получения отзывов с ограниченным числом страниц
 * Используется только для тестирования, чтобы не нагружать API
 */
function testOzonFeedbacksWithLimitedPages(clientId, apiKey, includeAnswered, store, maxPages) {
  log(`[Ozon TEST] 🎯 Тест пагинации с лимитом ${maxPages} страниц...`);
  
  const url = 'https://api-seller.ozon.ru/v1/review/list';
  
  let allReviews = [];
  let lastId = "";
  let hasNext = true;
  let pageNumber = 1;
  const limit = OZON_CONFIG.API_LIMITS.MAX_LIMIT; // 100
  
  // Базовая структура запроса (копируем из основной функции)
  let basePayload = {
    filter: {
      has_text: true,
    },
    sort: {
      type: 'CREATED_AT',
      order: 'DESC'
    },
    limit: limit
  };
  
  // Настройка фильтра по статусу ответов
  if (includeAnswered) {
    basePayload.filter.status = ['PENDING', 'PROCESSED', 'MODERATED', 'NEW'];
  } else {
    basePayload.filter.has_answer = false;
    basePayload.filter.status = ['PENDING', 'MODERATED', 'NEW'];
  }

  // Фильтр по дате из настроек магазина
  if (store && store.settings && store.settings.startDate) {
    const startDate = store.settings.startDate;
    const today = new Date().toISOString().split('T')[0];
    
    basePayload.filter.date_from = formatDateForOzon(startDate);
    basePayload.filter.date_to = formatDateForOzon(today);
    
    log(`[Ozon TEST] 🗓️ Применен фильтр дат: ${startDate} - ${today}`);
  }
  
  // Главный цикл пагинации (ограниченный)
  while (hasNext && pageNumber <= maxPages) {
    log(`[Ozon TEST] 📄 Тест страницы ${pageNumber}/${maxPages} (last_id: "${lastId}")...`);
    
    const payload = {
      ...basePayload,
      last_id: lastId
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
      
      log(`[Ozon TEST] 🌐 Страница ${pageNumber}: код ${responseCode}, размер ${responseBody.length} символов`);
      
      if (responseCode !== 200) {
        log(`[Ozon TEST] ❌ ОШИБКА на странице ${pageNumber}: Код ${responseCode}`);
        break;
      }
      
      const json = JSON.parse(responseBody);
      
      // Обработка структуры ответа
      let reviews = [];
      let resultData = null;
      
      if (json.result) {
        resultData = json.result;
        reviews = json.result.reviews || [];
      } else if (json.reviews) {
        reviews = json.reviews;
      } else if (json.data && json.data.reviews) {
        resultData = json.data;
        reviews = json.data.reviews;
      }
      
      log(`[Ozon TEST] 📄 Страница ${pageNumber}: получено ${reviews.length} отзывов`);
      
      // Обрабатываем отзывы
      const processedReviews = reviews.map(fb => ({
        id: fb.id, 
        createdDate: fb.published_at || fb.created_at, 
        rating: fb.rating,
        text: fb.text || '(без текста)', 
        user: 'Аноним',
        product: { 
          id: fb.sku || fb.offer_id,
          name: 'Не указано',
          url: `https://www.ozon.ru/product/${fb.sku || fb.offer_id}`
        }
      }));
      
      allReviews = allReviews.concat(processedReviews);
      
      // Проверяем пагинацию
      if (resultData) {
        hasNext = resultData.has_next || false;
        lastId = resultData.last_id || "";
        log(`[Ozon TEST] 📋 has_next: ${hasNext}, last_id: "${lastId}"`);
      } else {
        hasNext = (reviews.length === limit);
        log(`[Ozon TEST] ⚠️ Нет информации о пагинации. Предполагаем has_next = ${hasNext}`);
      }
      
      // Если получили меньше записей чем лимит - последняя страница
      if (reviews.length < limit) {
        log(`[Ozon TEST] ✅ Последняя страница ${pageNumber}: ${reviews.length} < ${limit}`);
        hasNext = false;
      }
      
      pageNumber++;
      
      // Rate limiting для теста (быстрее чем в продакшне)
      Utilities.sleep(50);
      
    } catch (e) {
      log(`[Ozon TEST] ❌ ОШИБКА на странице ${pageNumber}: ${e.message}`);
      break;
    }
  }
  
  // Сортируем результаты
  allReviews.sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate));
  
  // Добавляем метаинформацию о тестировании
  allReviews.pagesProcessed = pageNumber - 1;
  allReviews.usedPagination = (pageNumber > 1);
  
  log(`[Ozon TEST] 🎯 Тест завершен: ${allReviews.length} отзывов за ${allReviews.pagesProcessed} страниц`);
  return allReviews;
}

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

// ============ INDIVIDUAL STORE TRIGGERS ============
/**
 * Создаёт или обновляет индивидуальный триггер для магазина
 * @param {Object} store - объект магазина
 * @param {number} intervalMinutes - интервал в минутах (по умолчанию 240)
 */
function ensureStoreTrigger(store, intervalMinutes = 240) {
  if (!store || !store.id) {
    log(`[Trigger] ❌ Нет данных магазина для создания триггера`);
    return false;
  }
  const functionName = `processStore_${store.id}`;
  try {
    deleteStoreTrigger(store.id); // Удаляем старый прежде
    ScriptApp.newTrigger(functionName)
      .timeBased()
      .everyMinutes(intervalMinutes)
      .create();
    log(`[Trigger] ✅ Триггер создан для "${store.name}" (${functionName}) каждые ${intervalMinutes} минут.`);
    return true;
  } catch (e) {
    log(`[Trigger] ❌ Ошибка создания триггера для "${store.name}": ${e.message}`);
    return false;
  }
}
/**
 * Удаляет индивидуальный триггер для магазина
 * @param {string} storeId
 */
function deleteStoreTrigger(storeId) {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    const fn = `processStore_${storeId}`;
    triggers.forEach(trig => {
      if (trig.getHandlerFunction() === fn) {
        ScriptApp.deleteTrigger(trig);
      }
    });
    log(`[Trigger] 🗑️ Удалён триггер ${fn}`);
    return true;
  } catch(e) {
    log(`[Trigger] ❌ Ошибка удаления триггера для ${storeId}: ${e.message}`);
    return false;
  }
}
/**
 * Синхронизирует индивидуальные триггеры: создаёт для активных, удаляет для неактивных магазинов
 */
function syncAllStoreTriggers() {
  const stores = getStores();
  const active = stores.filter(s=>s.isActive);
  active.forEach(store => ensureStoreTrigger(store));
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trig => {
    const fn = trig.getHandlerFunction();
    if (fn.startsWith('processStore_')) {
      const storeId = fn.substring('processStore_'.length);
      const store = stores.find(s=>s.id===storeId);
      if (!store || !store.isActive) {
        ScriptApp.deleteTrigger(trig);
        log(`[Trigger] 🗑️ Автоматически удалён триггер для неактивного/удалённого магазина: ${storeId}`);
      }
    }
  });
  log(`[Trigger] 🔄 Синхронизация индивидуальных триггеров завершена.`);
}

/**
 * 🔥 ОКТЯБРЬ 2025: Правильное построение URL для WB API v1
 * ❌ ИСПРАВЛЕНО: v2 endpoint НЕ СУЩЕСТВУЕТ для feedbacks!
 * ✅ Используем ТОЛЬКО v1 endpoint с Unix timestamp для дат
 */
function buildWbApiV1Url(includeAnswered, skip, take, store) {
    const baseUrl = 'https://feedbacks-api.wildberries.ru/api/v1/feedbacks';
    const params = [];
    
    // 🔥 ОБЯЗАТЕЛЬНЫЕ параметры (октябрь 2025)
    params.push(`isAnswered=${includeAnswered}`);
    params.push(`take=${take}`);
    params.push(`skip=${skip}`);
    params.push(`order=dateDesc`);
    
    // 🔥 ИСПРАВЛЕНИЕ: Дата в Unix timestamp (секунды, НЕ строка!)
    if (store?.settings?.startDate) {
        try {
            const startDate = new Date(store.settings.startDate);
            const unixTimestamp = Math.floor(startDate.getTime() / 1000); // Конвертируем в секунды
            params.push(`dateFrom=${unixTimestamp}`);
            log(`[WB URL] 📅 Дата Unix timestamp: ${unixTimestamp} (${store.settings.startDate})`);
        } catch (e) {
            log(`[WB URL] ⚠️ Ошибка конвертации даты ${store.settings.startDate}: ${e.message}`);
        }
    }
    
    // 🚀 Фильтр по рейтингу (если есть)
    if (store?.settings?.minRating) {
        params.push(`valuation=${store.settings.minRating}`);
        log(`[WB URL] ⭐ Фильтр по рейтингу: ${store.settings.minRating}`);
    }
    
    // 🚀 Фильтр по товару (если нужен)
    if (store?.settings?.nmId) {
        params.push(`nmId=${store.settings.nmId}`);
        log(`[WB URL] 🛍️ Фильтр по товару: ${store.settings.nmId}`);
    }
    
    const fullUrl = `${baseUrl}?${params.join('&')}`;
    log(`[WB URL] 🔗 Constructed URL: ${fullUrl}`);
    return fullUrl;
}

// ============ OZON TRIGGER MANAGEMENT FUNCTIONS ============

/**
 * ✅ Настроить триггеры Ozon (2 автомата)
 * Создает триггер для автоматического Ozon workflow
 */
function setupOzonTriggers() {
  try {
    log('🎯 Настройка триггеров Ozon...');
    
    // Удаляем старые триггеры Ozon
    deleteAllOzonTriggers();
    
    // Создаем новый триггер для Ozon workflow (запускается каждый час)
    ScriptApp.newTrigger('processOzonWorkflow')
      .timeBased()
      .everyHours(1)
      .create();
    
    const message = '✅ Триггер Ozon настроен!\n\nАвтоматический процесс будет:\n• Подбирать шаблоны для NEW отзывов\n• Отправлять PENDING ответы\n\nЗапуск: каждый час';
    log('✅ Триггер Ozon workflow создан (каждый час)');
    
    SpreadsheetApp.getUi().alert(
      '✅ Триггеры Ozon настроены',
      message,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (error) {
    log(`❌ Ошибка настройки триггеров Ozon: ${error.message}`);
    SpreadsheetApp.getUi().alert(
      '❌ Ошибка',
      `Не удалось настроить триггеры Ozon: ${error.message}`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}

/**
 * ℹ️ Проверить статус триггеров Ozon
 */
function checkOzonTriggersStatus() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    const ozonTriggers = triggers.filter(t => 
      t.getHandlerFunction() === 'processOzonWorkflow'
    );
    
    if (ozonTriggers.length === 0) {
      SpreadsheetApp.getUi().alert(
        'ℹ️ Триггеры НЕ активны',
        'Триггеры Ozon НЕ активны.\n\nДля настройки автоматизации используйте:\n"✅ Настроить триггеры Ozon (2 автомата)"',
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    } else {
      const trigger = ozonTriggers[0];
      let triggerType = 'неизвестно';
      
      try {
        // Определяем тип триггера
        const eventType = trigger.getEventType();
        if (eventType === ScriptApp.EventType.CLOCK) {
          triggerType = 'по времени (каждый час)';
        }
      } catch (e) {
        triggerType = 'временной триггер';
      }
      
      const info = `✅ ТРИГГЕРЫ OZON АКТИВНЫ\n\n` +
                   `Функция: processOzonWorkflow\n` +
                   `Тип: ${triggerType}\n` +
                   `Найдено: ${ozonTriggers.length} триггер(ов)\n\n` +
                   `Автоматизация работает:\n` +
                   `• Подбор шаблонов для NEW отзывов\n` +
                   `• Отправка PENDING ответов\n` +
                   `• Запуск каждый час`;
      
      SpreadsheetApp.getUi().alert(
        '✅ Триггеры АКТИВНЫ',
        info,
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    }
  } catch (error) {
    log(`❌ Ошибка проверки статуса триггеров Ozon: ${error.message}`);
    SpreadsheetApp.getUi().alert(
      '❌ Ошибка',
      `Не удалось проверить статус триггеров: ${error.message}`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}

/**
 * ❌ Удалить все триггеры Ozon
 */
function deleteAllOzonTriggers() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    const ozonFunctions = [
      'processOzonWorkflow',
      'processNewOzonReviews', 
      'sendPendingAnswersOzonOnly',
      'collectOzonReviewsAuto'
    ];
    
    let deletedCount = 0;
    
    triggers.forEach(trigger => {
      const functionName = trigger.getHandlerFunction();
      if (ozonFunctions.includes(functionName)) {
        ScriptApp.deleteTrigger(trigger);
        deletedCount++;
        log(`🗑️ Удален триггер: ${functionName}`);
      }
    });
    
    const message = deletedCount > 0 
      ? `✅ Удалено триггеров Ozon: ${deletedCount}\n\nАвтоматизация Ozon остановлена.`
      : 'ℹ️ Триггеры Ozon не найдены\n\nАвтоматизация уже была отключена.';
    
    log(`🗑️ Удалено триггеров Ozon: ${deletedCount}`);
    
    SpreadsheetApp.getUi().alert(
      deletedCount > 0 ? '✅ Триггеры удалены' : 'ℹ️ Триггеры не найдены',
      message,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (error) {
    log(`❌ Ошибка удаления триггеров Ozon: ${error.message}`);
    SpreadsheetApp.getUi().alert(
      '❌ Ошибка',
      `Не удалось удалить триггеры Ozon: ${error.message}`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}
