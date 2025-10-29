/**
 * @file ozon_functions.gs  
 * @description ПОЛНОСТЬЮ ИСПРАВЛЕННЫЕ функции для работы с Ozon API
 * Решает проблему ошибки 422 "Invalid request" и обеспечивает правильную пагинацию
 */

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
    ENABLED: true,           // Ozon API поддерживает пагинацию через last_id
    TYPE: 'last_id_based'    // Используем last_id вместо offset
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
    PROCESSED: 'PROCESSED',
    NEW: 'NEW',
    PENDING: 'PENDING',
    MODERATED: 'MODERATED'
  },
  REQUIRED_TEXT_FIELDS: ['text'], // Поля, которые должны содержать текст
  PRODUCT_URL_TEMPLATE: 'https://www.ozon.ru/product/{sku}'
};

/**
 * 🚀 ПОЛНОСТЬЮ ИСПРАВЛЕННАЯ ФУНКЦИЯ: Получение отзывов Ozon с правильной структурой запроса
 * Исправляет ошибку 422 "Invalid request" путем использования правильного формата
 * @param {string} clientId - Ozon Client ID
 * @param {string} apiKey - Ozon API Key  
 * @param {boolean} includeAnswered - Включать ли отвеченные отзывы
 * @param {Object} store - Настройки магазина
 * @returns {Array} Все подходящие отзывы
 */
function getOzonFeedbacksFixed(clientId, apiKey, includeAnswered, store) {
    log(`[Ozon] 🚀 ИСПРАВЛЕННАЯ версия API (includeAnswered=${includeAnswered})`);
    
    const url = 'https://api-seller.ozon.ru/v1/review/list';
    
    let allReviews = [];
    let lastId = "";
    let hasNext = true;
    let pageNumber = 1;
    const limit = OZON_CONFIG.API_LIMITS.MAX_LIMIT; // 100 - максимум
    const maxPages = 15; // Лимит страниц для предотвращения таймаута
    const startTime = Date.now();
    const maxExecutionTime = 4 * 60 * 1000; // 4 минуты максимум
    
    // ✅ ИСПРАВЛЕНА базовая структура запроса согласно документации Ozon API
    let basePayload = {
        limit: limit,
        // ❌ УДАЛЕНО: has_text - этот параметр не поддерживается в текущей версии API
        // filter: { has_text: true },
        sort: {
            type: 'CREATED_AT',  // ✅ ИСПРАВЛЕНО: используем правильное поле
            order: 'DESC'        // ✅ ИСПРАВЛЕНО: order вместо direction  
        }
        // ❌ УДАЛЕНО: filter объект на верхнем уровне, добавляем его отдельно
    };
    
    // ✅ ПРАВИЛЬНАЯ настройка фильтров
    if (includeAnswered) {
        // Получаем ВСЕ отзывы (не фильтруем по has_answer)
        log(`[Ozon] 🔄 Режим: ВСЕ отзывы (отвеченные + неотвеченные)`);
        // Не добавляем фильтр has_answer
    } else {
        // Получаем только неотвеченные отзывы
        basePayload.filter = {
            has_answer: false
        };
        log(`[Ozon] 🎯 Режим: только НЕОТВЕЧЕННЫЕ отзывы`);
    }

    // ✅ ИСПРАВЛЕН фильтр по дате из настроек магазина
    if (store && store.settings && store.settings.startDate) {
        const startDate = store.settings.startDate;
        const today = new Date().toISOString().split('T')[0];
        
        // Добавляем фильтр по дате в правильном формате
        if (!basePayload.filter) basePayload.filter = {};
        basePayload.filter.date = {
            from: formatDateForOzon(startDate),
            to: formatDateForOzon(today)
        };
        
        log(`[Ozon] 🗓️ Фильтр дат: ${startDate} - ${today}`);
    } else {
        log(`[Ozon] 🗓️ Фильтр по дате НЕ применен - получаем все доступные отзывы`);
    }
    
    // ✅ ГЛАВНЫЙ ЦИКЛ ПАГИНАЦИИ с правильной обработкой ошибок
    while (hasNext && pageNumber <= maxPages) {
        // 🚨 КОНТРОЛЬ ВРЕМЕНИ ВЫПОЛНЕНИЯ
        const elapsedTime = Date.now() - startTime;
        if (elapsedTime > maxExecutionTime) {
            log(`[Ozon] ⏱️ ОСТАНОВКА по времени: ${Math.round(elapsedTime/1000)} сек`);
            break;
        }
        
        log(`[Ozon] 📄 Страница ${pageNumber} (last_id: "${lastId}")...`);
        
        const payload = {
            ...basePayload,
            last_id: lastId  // ✅ КЛЮЧЕВОЕ: используем last_id для пагинации
        };
        
        // 🔍 ДЕТАЛЬНОЕ ЛОГИРОВАНИЕ ЗАПРОСА для отладки
        if (isDevMode() || pageNumber <= 2) {
            log(`[Ozon DEBUG] Payload страница ${pageNumber}: ${JSON.stringify(payload, null, 2)}`);
        }
        
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
            
            log(`[Ozon] 🌐 Страница ${pageNumber}: код ${responseCode}, размер ${responseBody.length} символов`);
            
            // ✅ ДЕТАЛЬНАЯ ОБРАБОТКА ОШИБОК
            if (responseCode !== 200) {
                log(`[Ozon] ❌ ОШИБКА на странице ${pageNumber}: Код ${responseCode}`);
                log(`[Ozon] 📥 Тело ошибки: ${responseBody.substring(0, 1000)}`);
                
                // Специальная диагностика типичных ошибок
                if (responseCode === 400) {
                    log(`[Ozon] 🔎 400 Bad Request - проверьте структуру запроса`);
                    // Показываем структуру запроса при ошибке 400
                    log(`[Ozon] 🔍 Запрос, вызвавший ошибку: ${JSON.stringify(payload, null, 2)}`);
                }
                if (responseCode === 401) log(`[Ozon] 🔎 401 Unauthorized - проверьте Client-Id и Api-Key`);
                if (responseCode === 403) log(`[Ozon] 🔎 403 Forbidden - API ключ не имеет прав на чтение отзывов`);
                if (responseCode === 422) {
                    log(`[Ozon] 🔎 422 Unprocessable Entity - ошибка в параметрах запроса`);
                    // Пытаемся парсить детали ошибки
                    try {
                        const errorJson = JSON.parse(responseBody);
                        log(`[Ozon] 🔍 Детали ошибки 422: ${JSON.stringify(errorJson, null, 2)}`);
                    } catch (e) {
                        log(`[Ozon] 🔍 Не удалось парсить детали ошибки 422`);
                    }
                }
                if (responseCode === 429) log(`[Ozon] 🔎 429 Too Many Requests - превышен лимит 50 RPS`);
                if (responseCode >= 500) log(`[Ozon] 🔎 ${responseCode} Server Error - временные проблемы на стороне Ozon`);
                
                break;
            }
            
            const json = JSON.parse(responseBody);
            
            // 🚨 ДЕТАЛЬНАЯ ОТЛАДКА структуры ответа
            if (isDevMode() || pageNumber <= 2) {
                log(`[Ozon DEBUG] Структура ответа страница ${pageNumber}: ${JSON.stringify(Object.keys(json), null, 2)}`);
                if (json.result) {
                    log(`[Ozon DEBUG] json.result содержит: ${JSON.stringify(Object.keys(json.result), null, 2)}`);
                }
            }
            
            // ✅ ИСПРАВЛЕНА обработка структуры ответа - поддержка разных форматов
            let reviews = [];
            let resultData = null;
            
            // Пробуем разные возможные структуры ответа Ozon API
            if (json.reviews && Array.isArray(json.reviews)) {
                // Структура: { "reviews": [...], "last_id": "...", "has_next": true }
                reviews = json.reviews;
                resultData = json;
                log(`[Ozon] ✅ Корневая структура: reviews=${reviews.length}, has_next=${json.has_next}, last_id="${json.last_id}"`);
            } else if (json.result && json.result.reviews) {
                // Структура: { "result": { "reviews": [...], "has_next": true } }
                resultData = json.result;
                reviews = json.result.reviews || [];
                log(`[Ozon] ✅ Result структура: reviews=${reviews.length}`);
            } else if (json.data && json.data.reviews) {
                // Структура: { "data": { "reviews": [...] } }
                resultData = json.data;
                reviews = json.data.reviews;
                log(`[Ozon] ✅ Data структура: reviews=${reviews.length}`);
            } else {
                log(`[Ozon] ❌ Неожиданная структура ответа на странице ${pageNumber}`);
                log(`[Ozon] 🔍 Доступные ключи: ${Object.keys(json).join(', ')}`);
                
                // Показываем образец ответа для диагностики
                if (pageNumber <= 3) {
                    log(`[Ozon EMERGENCY] Образец ответа: ${responseBody.substring(0, 1500)}`);
                }
                break;
            }
            
            if (!Array.isArray(reviews)) {
                log(`[Ozon] ❌ reviews не является массивом. Тип: ${typeof reviews}`);
                break;
            }
            
            log(`[Ozon] 📄 Страница ${pageNumber}: получено ${reviews.length} отзывов`);
            
            // ✅ ОБРАБАТЫВАЕМ ОТЗЫВЫ И ДОБАВЛЯЕМ К ОБЩЕМУ СПИСКУ
            const processedReviews = reviews.map(fb => ({
                id: fb.id, 
                createdDate: fb.published_at || fb.created_at || fb.date, 
                rating: fb.rating,
                text: fb.text || '(без текста)', 
                user: 'Аноним',
                hasAnswer: !!(fb.answer && fb.answer.text) || !!(fb.comment && fb.comment.text) || fb.has_answer === true,
                product: { 
                    id: fb.sku || fb.offer_id || fb.product_id,
                    name: fb.product_name || 'Не указано',
                    url: `https://www.ozon.ru/product/${fb.sku || fb.offer_id || fb.product_id}`
                }
            }));
            
            allReviews = allReviews.concat(processedReviews);
            
            // ✅ ПРАВИЛЬНАЯ обработка пагинации
            if (resultData) {
                hasNext = resultData.has_next || false;
                lastId = resultData.last_id || "";
                
                if (isDevMode()) {
                    log(`[Ozon DEBUG] Пагинация: has_next=${hasNext}, last_id="${lastId}"`);
                }
            } else {
                // Fallback: определяем по количеству записей
                hasNext = (reviews.length === limit);
                log(`[Ozon] ⚠️ Нет данных пагинации. Предполагаем has_next=${hasNext}`);
            }
            
            // Если получили меньше записей чем лимит - последняя страница
            if (reviews.length < limit) {
                log(`[Ozon] ✅ Последняя страница ${pageNumber}: ${reviews.length} < ${limit}`);
                hasNext = false;
            }
            
            pageNumber++;
            
            // ✅ RATE LIMITING: соблюдаем лимиты API
            Utilities.sleep(25); // ~40 RPS для безопасности
            
            // Дополнительная пауза каждые 20 запросов
            if (pageNumber % 20 === 0) {
                log(`[Ozon] 💤 Пауза после ${pageNumber - 1} страниц...`);
                Utilities.sleep(1000);
            }
            
        } catch (e) {
            log(`[Ozon] ❌ КРИТИЧЕСКАЯ ОШИБКА на странице ${pageNumber}: ${e.message}`);
            log(`[Ozon] 🔍 Stack trace: ${e.stack}`);
            break;
        }
    }
    
    if (pageNumber > maxPages) {
        log(`[Ozon] ⚠️ ЛИМИТ СТРАНИЦ: остановились на ${maxPages} страницах. Возможно есть еще данные.`);
    }
    
    // ✅ ФИНАЛЬНАЯ СОРТИРОВКА (новые отзывы первыми)
    allReviews.sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate));
    
    log(`[Ozon] 🎯 ИТОГО получено ${allReviews.length} отзывов за ${pageNumber - 1} страниц`);
    return allReviews;
}

/**
 * 🚀 ИСПРАВЛЕННАЯ ФУНКЦИЯ: Отправка ответа на отзыв Ozon
 * @param {string} feedbackId - ID отзыва
 * @param {string} text - Текст ответа
 * @param {string} clientId - Ozon Client ID
 * @param {string} apiKey - Ozon API Key
 * @returns {Array} [success, errorMessage, responseBody]
 */
function sendOzonFeedbackAnswerFixed(feedbackId, text, clientId, apiKey) {
    log(`[Ozon] 🎯 ОТПРАВКА ответа для ID ${feedbackId}`);
    log(`[Ozon] 📝 Текст: "${text}" (${text.length} символов)`);
    
    const url = 'https://api-seller.ozon.ru/v1/review/comment/create';
    
    // ✅ ИСПРАВЛЕНА структура запроса согласно документации
    const payload = { 
        review_id: feedbackId,  // ID отзыва
        text: text,             // Текст ответа
        mark_review_as_processed: true  // Отметить отзыв как обработанный
    };
    
    try {
        log(`[Ozon] 📤 Отправка POST запроса...`);
        log(`[Ozon] 📋 Payload: ${JSON.stringify(payload)}`);
        
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
        const responseBody = response.getContentText();
        
        // 🔍 ДЕТАЛЬНОЕ ЛОГИРОВАНИЕ
        log(`[Ozon] 📥 Код ответа: ${code}`);
        log(`[Ozon] 📥 Тело ответа: "${responseBody}"`);
        
        if (isDevMode()) {
            const headers = response.getAllHeaders();
            log(`[Ozon DEBUG] Заголовки ответа: ${JSON.stringify(headers, null, 2)}`);
        }
        
        // ✅ АНАЛИЗ РЕЗУЛЬТАТА
        const success = (code === 200 || code === 201 || code === 204);
        let errorMessage = '';
        
        if (success) {
            log(`[Ozon] ✅ УСПЕХ: Код ${code}`);
            if (code === 200) log(`[Ozon] ℹ️ 200 OK - Ответ отправлен успешно`);
            if (code === 201) log(`[Ozon] ℹ️ 201 Created - Ответ создан успешно`);
            if (code === 204) log(`[Ozon] ℹ️ 204 No Content - Операция выполнена`);
        } else {
            errorMessage = `Код ${code}. Ответ: ${responseBody}`;
            log(`[Ozon] ❌ НЕУДАЧА: ${errorMessage}`);
            
            // 🔍 ДИАГНОСТИКА типичных ошибок
            if (code === 400) log(`[Ozon] 🔎 400 Bad Request - проверьте ID отзыва и текст`);
            if (code === 401) log(`[Ozon] 🔎 401 Unauthorized - проверьте Client-Id и Api-Key`);
            if (code === 403) log(`[Ozon] 🔎 403 Forbidden - нет прав или отзыв уже отвечен`);
            if (code === 404) log(`[Ozon] 🔎 404 Not Found - отзыв не найден`);
            if (code === 422) {
                log(`[Ozon] 🔎 422 Unprocessable Entity - проверьте данные`);
                // Пытаемся извлечь детали ошибки
                try {
                    const errorJson = JSON.parse(responseBody);
                    if (errorJson.message) {
                        log(`[Ozon] 🔍 Сообщение об ошибке: ${errorJson.message}`);
                    }
                    if (errorJson.details) {
                        log(`[Ozon] 🔍 Детали ошибки: ${JSON.stringify(errorJson.details)}`);
                    }
                } catch (parseError) {
                    log(`[Ozon] 🔍 Не удалось парсить детали ошибки`);
                }
            }
            if (code === 429) log(`[Ozon] 🔎 429 Too Many Requests - превышен лимит запросов`);
            if (code >= 500) log(`[Ozon] 🔎 ${code} Server Error - проблемы на стороне Ozon`);
        }
        
        return [success, errorMessage, responseBody];
        
    } catch (e) {
        const criticalError = `КРИТИЧЕСКАЯ ОШИБКА: ${e.message}`;
        log(`[Ozon] ⛔ ${criticalError}`);
        log(`[Ozon] 🔍 Stack trace: ${e.stack}`);
        return [false, criticalError, e.message];
    }
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
 * 🚀 НОВАЯ ФУНКЦИЯ: Получение названий товаров по offer_id через Product API
 * @param {Array} offerIds - Массив offer_id товаров
 * @param {string} clientId - Ozon Client ID
 * @param {string} apiKey - Ozon API ключ
 * @returns {Object} Справочник {offer_id: название}
 */
function getOzonProductNames(offerIds, clientId, apiKey) {
    if (!offerIds || offerIds.length === 0) return {};
    
    // Убираем дубликаты и фильтруем невалидные offer_id
    const uniqueOfferIds = [...new Set(offerIds)].filter(id => {
        // Фильтруем только строковые offer_id и исключаем числовые sku
        if (!id || typeof id !== 'string') return false;
        // Исключаем чисто числовые ID (это sku, не offer_id)
        if (/^\d+$/.test(id)) return false;
        return true;
    });
    
    log(`[Ozon Products] 🏷️ Запрашиваю названия для ${uniqueOfferIds.length} товаров...`);
    
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
 * 🚀 НОВАЯ ФУНКЦИЯ: Тестирование доступа к Ozon Product API
 * @param {string} clientId - Ozon Client ID
 * @param {string} apiKey - Ozon API Key
 * @returns {boolean} Результат теста
 */
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

/**
 * 🚀 НОВАЯ ФУНКЦИЯ: Проверка совместимости с isDevMode
 * Эта функция нужна если isDevMode определена в другом файле
 */
function isDevMode() {
    try {
        return PropertiesService.getUserProperties().getProperty('DEV_MODE_ENABLED') === 'true';
    } catch (e) {
        return false; // Fallback если функция недоступна
    }
}

/**
 * 🚀 НОВАЯ ФУНКЦИЯ: Логирование совместимое с основной системой
 * @param {string} message - Сообщение для лога
 */
function log(message) {
    try {
        // Пытаемся использовать основную функцию логирования
        if (typeof window !== 'undefined' && window.log) {
            window.log(message);
        } else {
            // Fallback на console.log
            console.log(`${new Date().toISOString()} - ${message}`);
        }
    } catch (e) {
        console.log(message); // Простейший fallback
    }
}