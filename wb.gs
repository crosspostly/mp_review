// ============================================================================
// 🔥 ОКТЯБРЬ 2025: Правильное построение URL для WB API v1
// ❌ ИСПРАВЛЕНО: v2 endpoint НЕ СУЩЕСТВУЕТ для feedbacks!
// ✅ Используем ТОЛЬКО v1 endpoint с Unix timestamp для дат
// ============================================================================

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

// ============================================================================
// 🔥 ОКТЯБРЬ 2025: ИСПРАВЛЕНО для WB API v1 
// Получение отзывов по официальной документации WB v1 API
// Использует простую пагинацию take/skip с Unix timestamp для дат
// ============================================================================

/**
 * @param {string} apiKey - WB API ключ
 * @param {boolean} includeAnswered - Включать ли отвеченные отзывы  
 * @param {Object} store - Настройки магазина для фильтрации по дате
 * @returns {Array} Массив всех подходящих отзывов
 */
function getWbFeedbacks(apiKey, includeAnswered = false, store = null) {
    const startTime = Date.now();
    log(`[WB] 🔥 WB API v1 START (includeAnswered=${includeAnswered}) - v1!`);
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
            
            // 🔥 ОКТЯБРЬ 2025: используем v1 endpoint с Unix timestamp!
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
            
            // 🔴 НОВОЕ ЛОГИРОВАНИЕ #1: Информация о Response объекте
            if (isDevMode()) {
                log(`[WB Response #${pageCount} DEBUG] Response object info:`);
                log(`[WB Response #${pageCount} DEBUG]   Status: ${responseCode}`);
                log(`[WB Response #${pageCount} DEBUG]   Body length: ${responseSize} bytes`);
                log(`[WB Response #${pageCount} DEBUG]   First 300 chars: ${responseBody.substring(0, 300)}`);
            }
            
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
                
                // 🔴 НОВОЕ ЛОГИРОВАНИЕ #2: Структура JSON (in dev mode)
                if (isDevMode()) {
                    log(`[WB Response #${pageCount} DEBUG] JSON structure:`);
                    const rootKeys = Object.keys(json);
                    log(`[WB Response #${pageCount} DEBUG]   Root keys: ${rootKeys.join(', ')}`);
                    
                    if (json.data) {
                        const dataKeys = Object.keys(json.data);
                        log(`[WB Response #${pageCount} DEBUG]   data keys: ${dataKeys.join(', ')}`);
                        
                        // 🔴 НОВОЕ ЛОГИРОВАНИЕ #3: Значение каждого ключа (200 символов макс)
                        for (const k of dataKeys) {
                            let val = '';
                            try {
                                if (typeof json.data[k] === 'string') {
                                    val = json.data[k];
                                } else if (typeof json.data[k] === 'number' || typeof json.data[k] === 'boolean') {
                                    val = json.data[k].toString();
                                } else if (Array.isArray(json.data[k])) {
                                    val = `[Array: ${json.data[k].length} items]`;
                                } else if (typeof json.data[k] === 'object') {
                                    val = `[Object: ${Object.keys(json.data[k]).join(', ')}]`;
                                } else {
                                    val = String(json.data[k]);
                                }
                            } catch (e) {
                                val = '[ERROR parsing value]';
                            }
                            
                            const truncated = val.substring(0, 200);
                            const suffix = val.length > 200 ? ' ...[TRUNCATED]' : '';
                            log(`[WB Response #${pageCount} DEBUG]   data.${k} = "${truncated}"${suffix}`);
                        }
                    }
                }
                
            } catch (parseError) {
                log(`[WB Response #${pageCount}] ❌ JSON PARSE ERROR: ${parseError.message}`);
                log(`[WB Response #${pageCount}] 📝 Raw body: ${responseBody.substring(0, 500)}`);
                break;
            }
            
            if (json.error) {
                log(`[WB Response #${pageCount}] ❌ API Error: ${json.errorText || json.error}`);
                break;
            }
            
            const feedbacks = json.data?.feedbacks || [];
            
            // 🔥 ДОПОЛНИТЕЛЬНАЯ АНАЛИТИКА: Проверяем countUnanswered и другие счетчики
            const countUnanswered = json.data?.countUnanswered || 0;
            const countArchive = json.data?.countArchive || 0;
            
            log(`[WB Response #${pageCount}] 📊 Feedbacks: ${feedbacks.length} total`);
            log(`[WB Response #${pageCount}] 📈 Счетчики: неотвеченных=${countUnanswered}, архив=${countArchive}`);
            
            // Проверяем соответствие между счетчиками и данными
            if (countUnanswered > 0 && feedbacks.length === 0 && !includeAnswered) {
                log(`[WB Response #${pageCount}] 🤔 НЕСООТВЕТСТВИЕ: countUnanswered=${countUnanswered}, но feedbacks=0. Возможна проблема с фильтром дат!`);
            }
            
            if (feedbacks.length === 0) {
                log(`[WB Response #${pageCount}] ✅ Empty page - pagination complete`);
                hasMoreData = false;
                break;
            }
            
            // 🔴 НОВОЕ ЛОГИРОВАНИЕ #4: Sample feedback в dev mode
            if (isDevMode() && feedbacks.length > 0) {
                const sample = feedbacks;
                const sampleStr = JSON.stringify(sample).substring(0, 200);
                log(`[WB Response #${pageCount} DEBUG] Sample feedback: ${sampleStr}...`);
            }
            
            // Обрабатываем отзывы (убираем пустые)
            const newFeedbacks = feedbacks.map(fb => ({
                id: fb.id,
                createdDate: fb.createdDate,
                rating: fb.rating || fb.productValuation || 0,
                text: fb.text || '(без текста)',
                user: 'N/A',
                hasAnswer: !!(fb.answer && fb.answer.text),
                product: {
                    id: fb.productDetails?.nmId,
                    name: fb.productDetails?.productName || 'Не указано',
                    url: `https://www.wildberries.ru/catalog/${fb.productDetails?.nmId}/detail.aspx`
                }
            }));

            allFeedbacks.push(...newFeedbacks);
            
            // Переходим к следующей странице
            skip += MAX_TAKE;
            hasMoreData = (feedbacks.length === MAX_TAKE); // Если получили полную страницу, возможно есть еще
            
            const pageDuration = Date.now() - pageStartTime;
            log(`[WB Page #${pageCount}] ⏱️ Completed in ${pageDuration}ms (collected ${feedbacks.length} feedbacks)`);

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

// ============================================================================
// Helper функции для dev mode
// ============================================================================

function isDevMode() {
    try {
        return PropertiesService.getUserProperties().getProperty('DEV_MODE') === 'true';
    } catch (e) {
        return false;
    }
}

function enableDevMode() {
    PropertiesService.getUserProperties().setProperty('DEV_MODE', 'true');
    log('✅ DEV MODE ВКЛЮЧЕН - Будут логироваться все JSON данные!');
}

function disableDevMode() {
    PropertiesService.getUserProperties().setProperty('DEV_MODE', 'false');
    log('✅ DEV MODE ВЫКЛЮЧЕН');
}

// ============================================================================
// 🔥 ОКТЯБРЬ 2025: Правильный метод отправки ответа WB API v1
// По официальной документации: https://dev.wildberries.ru/openapi/user-communication
// Endpoint: POST /api/v1/feedbacks/answer
// Body: { "id": "feedbackId", "text": "ответ" }
// ============================================================================

/**
 * @param {string} feedbackId - ID отзыва (обязательно)
 * @param {string} text - Текст ответа 2-5000 символов (обязательно)
 * @param {string} apiKey - WB API ключ (обязательно)
 * @returns {boolean} true если успешно отправлено
 */
function sendWbFeedbackAnswer(feedbackId, text, apiKey) {
    const methodName = "WB /api/v1/feedbacks/answer";
    
    try {
        // ✅ ВАЛИДАЦИЯ ВХОДНЫХ ДАННЫХ
        if (!feedbackId || typeof feedbackId !== 'string') {
            log(`[${methodName}] ❌ Ошибка: feedbackId не может быть пустым`);
            return false;
        }
        
        if (!text || text.length < 2 || text.length > 5000) {
            log(`[${methodName}] ❌ Ошибка: text должен быть от 2 до 5000 символов (текущая длина: ${text?.length || 0})`);
            return false;
        }
        
        if (!apiKey || typeof apiKey !== 'string') {
            log(`[${methodName}] ❌ Ошибка: apiKey не может быть пустым`);
            return false;
        }
        
        // ✅ ПОСТРОЕНИЕ ЗАПРОСА
        const url = 'https://feedbacks-api.wildberries.ru/api/v1/feedbacks/answer';
        const payload = { 
            id: feedbackId,
            text: text
        };
        
        log(`[${methodName}] 📤 Отправка ответа на отзыв: ${feedbackId}`);
        log(`[${methodName}] 📝 Текст: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`);
        log(`[${methodName}] 🔗 URL: ${url}`);
        
        if (isDevMode()) {
            log(`[${methodName} DEBUG] Payload: ${JSON.stringify(payload)}`);
            log(`[${methodName} DEBUG] Headers: Authorization: ${apiKey.substring(0, 20)}..., Content-Type: application/json`);
        }
        
        // ✅ ОТПРАВКА ЗАПРОСА
        const requestStartTime = Date.now();
        const response = UrlFetchApp.fetch(url, {
            method: 'POST',
            headers: { 
                'Authorization': apiKey,
                'Content-Type': 'application/json'
            },
            payload: JSON.stringify(payload),
            muteHttpExceptions: true
        });
        const requestDuration = Date.now() - requestStartTime;
        
        // ✅ ОБРАБОТКА ОТВЕТА
        const code = response.getResponseCode();
        const responseBody = response.getContentText();
        
        log(`[${methodName}] 📥 HTTP ${code} (${requestDuration}ms)`);
        
        if (responseBody && responseBody.length > 0) {
            log(`[${methodName}] 📝 Ответ сервера: ${responseBody.substring(0, 200)}${responseBody.length > 200 ? '...' : ''}`);
        }
        
        // ✅ АНАЛИЗ КОДОВ ОТВЕТА
        const success = (code === 200 || code === 201 || code === 204);
        
        if (success) {
            log(`[${methodName}] ✅ УСПЕШНО: Ответ отправлен`);
            
            if (code === 200) log(`[${methodName}] ℹ️ 200 OK - Ответ отправлен и сервер вернул данные`);
            if (code === 201) log(`[${methodName}] ℹ️ 201 Created - Ответ успешно создан`);
            if (code === 204) log(`[${methodName}] ℹ️ 204 No Content - Операция успешна, данных не возвращено`);
            
            return true;
        }
        
        // ❌ ОБРАБОТКА ОШИБОК
        log(`[${methodName}] ❌ ОШИБКА: HTTP ${code}`);
        
        if (code === 400) {
            log(`[${methodName}] 🔎 400 Bad Request - Неверный формат запроса или данные`);
            log(`[${methodName}] 🔍 Проверьте:`);
            log(`[${methodName}]   • ID отзыва: ${feedbackId}`);
            log(`[${methodName}]   • Текст ответа: ${text.length} символов`);
            log(`[${methodName}]   • Content-Type header установлен`);
        } else if (code === 401) {
            log(`[${methodName}] 🔎 401 Unauthorized - API ключ неверный или истёк`);
            log(`[${methodName}] 🔍 Проверьте: API Key (текущий: ${apiKey.substring(0, 20)}...)`);
        } else if (code === 403) {
            log(`[${methodName}] 🔎 403 Forbidden - Нет прав или отзыв уже отвечен`);
            log(`[${methodName}] 🔍 Возможные причины:`);
            log(`[${methodName}]   • API ключ не имеет нужных прав`);
            log(`[${methodName}]   • Отзыв уже отвечен (проверьте hasAnswer)`);
            log(`[${methodName}]   • Магазин в чёрном списке WB`);
        } else if (code === 404) {
            log(`[${methodName}] 🔎 404 Not Found - Отзыв не найден или неверный endpoint`);
            log(`[${methodName}] 🔍 Проверьте:`);
            log(`[${methodName}]   • Существует ли отзыв с ID: ${feedbackId}`);
            log(`[${methodName}]   • URL endpoint: ${url}`);
        } else if (code === 422) {
            log(`[${methodName}] 🔎 422 Unprocessable Entity - Некорректные данные`);
            log(`[${methodName}] 🔍 Проверьте:`);
            log(`[${methodName}]   • Длина текста: ${text.length} символов (должно 2-5000)`);
            log(`[${methodName}]   • Текст не содержит спама/запрещённых символов`);
            log(`[${methodName}]   • Статус отзыва позволяет ответить`);
        } else if (code === 429) {
            log(`[${methodName}] 🔎 429 Too Many Requests - Превышен лимит`);
            log(`[${methodName}] 🔍 Лимит WB: 3 запроса в секунду (333ms между запросами)`);
            log(`[${methodName}] ⏳ Рекомендация: ждите перед повторной попыткой`);
        } else if (code >= 500) {
            log(`[${methodName}] 🔎 ${code} Server Error - Проблема на стороне WB`);
            log(`[${methodName}] ⏳ Это временная ошибка, попробуйте позже`);
        }
        
        if (isDevMode()) {
            log(`[${methodName} DEBUG] Полное тело ответа: ${responseBody}`);
        }
        
        return false;
        
    } catch (e) {
        const criticalError = `КРИТИЧЕСКАЯ ОШИБКА: ${e.message}`;
        log(`[${methodName}] ⛔ ${criticalError}`);
        log(`[${methodName}] 🔍 Stack trace: ${e.stack}`);
        return false;
    }
}

// ============================================================================
// ✅ КОНЕЦ WB.gs - ВСЕ ФУНКЦИИ ГОТОВЫ
// ============================================================================
