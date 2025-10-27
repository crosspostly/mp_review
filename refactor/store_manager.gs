/**
 * 🔄 ВОССТАНОВЛЕННАЯ СТАРАЯ РАБОЧАЯ СИСТЕМА УПРАВЛЕНИЯ МАГАЗИНАМИ
 * 
 * Возвращена из code.gs для совместимости с существующим интерфейсом
 * и восстановления функциональности:
 * - Листы создаются по НАЗВАНИЮ магазина, а не ID
 * - Рабочие кнопки "Проверить" и "Загрузить" с логами
 * - Сохранение существующих магазинов
 * - Стабильная система без зависаний
 */

// ============ СТАРЫЕ РАБОЧИЕ ФУНКЦИИ ИЗ CODE.GS ============

function getStores() {
  const storesJson = PropertiesService.getUserProperties().getProperty(CONFIG.PROPERTIES_KEY);
  if (!storesJson) return [];
  const stores = JSON.parse(storesJson);
  return stores.filter(store => store && store.id).map(store => {
      if (typeof store.isActive === 'undefined') store.isActive = true;
      // Ensure settings object exists for backward compatibility
      if (!store.settings) store.settings = {};
      return store;
  });
}

/**
 * Получает только активные магазины
 * @returns {Array<Object>} Массив активных магазинов
 */
function getActiveStores() {
  try {
    const allStores = getStores();
    const activeStores = allStores.filter(store => store.isActive === true);
    
    logInfo(`Активных магазинов: ${activeStores.length} из ${allStores.length}`, LOG_CONFIG.CATEGORIES.STORE);
    return activeStores;
    
  } catch (error) {
    logError(`Ошибка получения активных магазинов: ${error.message}`, LOG_CONFIG.CATEGORIES.STORE);
    return [];
  }
}

/**
 * Получает магазин по ID
 * @param {string} storeId - ID магазина
 * @returns {Object|null} Объект магазина или null
 */
function getStoreById(storeId) {
  try {
    if (!storeId) {
      logWarning('getStoreById: не указан ID магазина', LOG_CONFIG.CATEGORIES.STORE);
      return null;
    }
    
    const stores = getStores();
    const store = stores.find(s => s.id === storeId);
    
    if (!store) {
      logWarning(`Магазин с ID ${storeId} не найден`, LOG_CONFIG.CATEGORIES.STORE);
      return null;
    }
    
    logDebug(`Найден магазин: ${store.name} (${storeId})`, LOG_CONFIG.CATEGORIES.STORE);
    return store;
    
  } catch (error) {
    logError(`Ошибка поиска магазина ${storeId}: ${error.message}`, LOG_CONFIG.CATEGORIES.STORE);
    return null;
  }
}

/**
 * Сохраняет магазин (создает новый или обновляет существующий)
 * @param {Object} store - Объект магазина
 * @returns {Array<Object>} Обновленный список всех магазинов
 */
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
    
    if (typeof oldSortOldestFirst !== 'undefined' && oldSortOldestFirst !== newSortOldestFirst) {
      log(`[${store.name}] 📊 ИЗМЕНЕНА настройка сортировки: sortOldestFirst ${oldSortOldestFirst} → ${newSortOldestFirst}`);
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
  
  // ✅ ИСПРАВЛЕНО: Создаем лист с НАЗВАНИЕМ, а не ID
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(store.name); // ← ПО НАЗВАНИЮ!
    
    if (!sheet) {
      sheet = ss.insertSheet(store.name); // ← ПО НАЗВАНИЮ!
      sheet.getRange(1, 1, 1, CONFIG.HEADERS.length).setValues([CONFIG.HEADERS]);
      sheet.getRange(1, 1, 1, CONFIG.HEADERS.length).setFontWeight('bold');
      sheet.getRange(1, 1, 1, CONFIG.HEADERS.length).setBackground('#e8f0fe');
      log(`📄 Создан лист: "${store.name}"`);
    }
  } catch (e) {
    log(`❌ Ошибка создания листа для ${store.name}: ${e.message}`);
  }
  
  return stores;
}

/**
 * Удаляет магазин из системы
 * @param {string} storeId - ID магазина для удаления
 * @returns {boolean} Успешность операции
 */
function deleteStore(storeId) {
  const timer = new PerformanceTimer('deleteStore');
  
  try {
    if (!storeId) {
      logError('deleteStore: не указан ID магазина', LOG_CONFIG.CATEGORIES.STORE);
      timer.finish(LOG_CONFIG.LEVELS.ERROR);
      return false;
    }
    
    const stores = getStores();
    const storeIndex = stores.findIndex(s => s.id === storeId);
    
    if (storeIndex === -1) {
      logWarning(`Магазин для удаления не найден: ${storeId}`, LOG_CONFIG.CATEGORIES.STORE);
      timer.finish(LOG_CONFIG.LEVELS.WARNING);
      return false;
    }
    
    const storeName = stores[storeIndex].name;
    
    // Удаляем магазин из массива
    stores.splice(storeIndex, 1);
    
    // Сохраняем обновленный список (используем UserProperties как в старой системе)
    const props = PropertiesService.getUserProperties();
    props.setProperty(CONFIG.PROPERTIES_KEY, JSON.stringify(stores));
    
    // Очищаем связанные данные
    cleanupStoreData(storeId);
    
    logSuccess(`Магазин ${storeName} (${storeId}) успешно удален`, LOG_CONFIG.CATEGORIES.STORE);
    timer.finish(LOG_CONFIG.LEVELS.SUCCESS);
    
    return true;
    
  } catch (error) {
    logError(`Ошибка удаления магазина ${storeId}: ${error.message}`, LOG_CONFIG.CATEGORIES.STORE);
    timer.finish(LOG_CONFIG.LEVELS.ERROR);
    return false;
  }
}

/**
 * Валидирует данные магазина
 * @param {Object} store - Объект магазина для валидации
 * @returns {Object} Результат валидации { isValid: boolean, errors: Array }
 */
function validateStore(store) {
  const errors = [];
  
  try {
    // Обязательные поля
    if (!store.name || typeof store.name !== 'string' || store.name.trim().length < 2) {
      errors.push('Название магазина должно содержать минимум 2 символа');
    }
    
    if (!store.marketplace || !['Wildberries', 'Ozon'].includes(store.marketplace)) {
      errors.push('Маркетплейс должен быть "Wildberries" или "Ozon"');
    }
    
    // Валидация credentials в зависимости от маркетплейса
    if (store.marketplace === 'Wildberries') {
      if (!store.credentials?.apiKey || store.credentials.apiKey.length < 10) {
        errors.push('WB API ключ должен содержать минимум 10 символов');
      }
    }
    
    if (store.marketplace === 'Ozon') {
      if (!store.credentials?.clientId || store.credentials.clientId.length < 3) {
        errors.push('Ozon Client ID обязателен');
      }
      if (!store.credentials?.apiKey || store.credentials.apiKey.length < 10) {
        errors.push('Ozon API ключ должен содержать минимум 10 символов');
      }
    }
    
    // Валидация настроек
    if (store.settings) {
      if (store.settings.startDate) {
        const startDate = new Date(store.settings.startDate);
        if (isNaN(startDate.getTime())) {
          errors.push('Некорректный формат даты начала');
        }
      }
      
      if (store.settings.includeAnswered !== undefined && typeof store.settings.includeAnswered !== 'boolean') {
        errors.push('includeAnswered должно быть boolean значением');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors: errors
    };
    
  } catch (error) {
    logError(`Ошибка валидации магазина: ${error.message}`, LOG_CONFIG.CATEGORIES.STORE);
    return {
      isValid: false,
      errors: [`Ошибка валидации: ${error.message}`]
    };
  }
}

/**
 * Генерирует уникальный ID для магазина
 * @param {string} marketplace - Название маркетплейса
 * @returns {string} Уникальный ID магазина
 */
function generateStoreId(marketplace) {
  const prefix = marketplace === 'Wildberries' ? 'wb' : 'ozon';
  const timestamp = Date.now().toString().slice(-6); // Последние 6 цифр timestamp
  const random = Math.floor(Math.random() * 100).toString().padStart(2, '0');
  
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Создает лист для магазина в Google Sheets если не существует
 * @param {Object} store - Объект магазина
 */
function createStoreSheetIfNotExists(store) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(store.id);
    
    if (!sheet) {
      // Создаем новый лист
      sheet = ss.insertSheet(store.id);
      
      // Устанавливаем заголовки
      const headers = [
        'reviewId', 'createdDate', 'rating', 'text', 'product',
        'status', 'processedDate', 'answer', 'errorMsg'
      ];
      
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      
      // Форматирование заголовков
      const headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#e8f0fe');
      
      // Автоширина колонок
      sheet.autoResizeColumns(1, headers.length);
      
      logSuccess(`Создан лист для магазина: ${store.name} (${store.id})`, LOG_CONFIG.CATEGORIES.STORE);
    }
    
  } catch (error) {
    logError(`Ошибка создания листа для магазина ${store.id}: ${error.message}`, LOG_CONFIG.CATEGORIES.STORE);
  }
}

/**
 * Очищает данные магазина при удалении
 * @param {string} storeId - ID магазина
 */
function cleanupStoreData(storeId) {
  try {
    const props = PropertiesService.getUserProperties();
    
    // Удаляем кеш отзывов магазина
    const cacheKey = `${CACHE_CONFIG.PREFIX_REVIEW_IDS}${storeId}`;
    props.deleteProperty(cacheKey);
    
    // Удаляем позицию полоски
    const stripeKey = `${CACHE_CONFIG.PREFIX_STRIPE_POSITION}${storeId}`;
    props.deleteProperty(stripeKey);
    
    // Удаляем прогресс магазина
    const progressKey = `${CACHE_CONFIG.PREFIX_STORE_PROGRESS}${storeId}`;
    props.deleteProperty(progressKey);
    
    logInfo(`Очищены данные для удаленного магазина: ${storeId}`, LOG_CONFIG.CATEGORIES.STORE);
    
  } catch (error) {
    logError(`Ошибка очистки данных магазина ${storeId}: ${error.message}`, LOG_CONFIG.CATEGORIES.STORE);
  }
}

/**
 * Получает статистику по магазинам
 * @returns {Object} Статистика магазинов
 */
function getStoreStatistics() {
  try {
    const stores = getStores();
    const activeStores = stores.filter(s => s.isActive);
    
    const byMarketplace = stores.reduce((acc, store) => {
      acc[store.marketplace] = (acc[store.marketplace] || 0) + 1;
      return acc;
    }, {});
    
    const stats = {
      total: stores.length,
      active: activeStores.length,
      inactive: stores.length - activeStores.length,
      byMarketplace: byMarketplace
    };
    
    logDebug('Статистика магазинов получена', LOG_CONFIG.CATEGORIES.STORE, stats);
    return stats;
    
  } catch (error) {
    logError(`Ошибка получения статистики магазинов: ${error.message}`, LOG_CONFIG.CATEGORIES.STORE);
    return { total: 0, active: 0, inactive: 0, byMarketplace: {}, error: error.message };
  }
}

// УБРАНО: Дублирование функции testStoreConnection - используется версия из main.gs

/**
 * Тестирует подключение к WB API
 * @param {Object} store - Объект магазина
 * @returns {Object} Результат тестирования
 */
function testWbConnection(store) {
  try {
    if (!store.credentials?.apiKey) {
      return { success: false, error: 'Не указан API ключ' };
    }
    
    // Простая проверка - запрос отзывов с лимитом 1
    const url = `${WB_CONFIG.API_BASE_URL}${WB_CONFIG.ENDPOINTS.GET_FEEDBACKS}?take=1&skip=0`;
    
    const response = UrlFetchApp.fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': store.credentials.apiKey
      },
      muteHttpExceptions: true
    });
    
    const responseCode = response.getResponseCode();
    
    if (responseCode === 200) {
      return { success: true, message: 'Подключение успешно' };
    } else {
      return { 
        success: false, 
        error: `HTTP ${responseCode}: ${response.getContentText()}` 
      };
    }
    
  } catch (error) {
    return { 
      success: false, 
      error: error.message 
    };
  }
}

/**
 * Тестирует подключение к Ozon API
 * @param {Object} store - Объект магазина
 * @returns {Object} Результат тестирования
 */
function testOzonConnection(store) {
  try {
    if (!store.credentials?.clientId || !store.credentials?.apiKey) {
      return { success: false, error: 'Не указаны Client ID или API ключ' };
    }
    
    // Простая проверка - запрос отзывов с лимитом 1
    const url = `${OZON_CONFIG.API_BASE_URL}${OZON_CONFIG.ENDPOINTS.GET_FEEDBACKS}`;
    
    const payload = {
      limit: 1,
      with_photos: false
    };
    
    const response = UrlFetchApp.fetch(url, {
      method: 'POST',
      headers: {
        'Client-Id': store.credentials.clientId,
        'Api-Key': store.credentials.apiKey,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
      followRedirects: true
    });
    
    const responseCode = response.getResponseCode();
    
    if (responseCode === 200) {
      return { success: true, message: 'Подключение успешно' };
    } else {
      return { 
        success: false, 
        error: `HTTP ${responseCode}: ${response.getContentText()}` 
      };
    }
    
  } catch (error) {
    return { 
      success: false, 
      error: error.message 
    };
  }
}

/**
 * Алиас для getStores() - для совместимости с UI
 * @returns {Array} Все магазины
 */
function getAllStores() {
  return getStores();
}

/**
 * Экспортирует конфигурации всех магазинов (без API ключей)
 * @returns {string} JSON конфигурация магазинов
 */
function exportStoreConfigs() {
  try {
    const stores = getStores();
    
    // Убираем чувствительные данные для экспорта
    const safeStores = stores.map(store => ({
      id: store.id,
      name: store.name,
      marketplace: store.marketplace,
      isActive: store.isActive,
      settings: store.settings,
      // credentials скрыты для безопасности
      hasCredentials: !!(store.credentials?.apiKey)
    }));
    
    log(`Экспорт конфигурации ${safeStores.length} магазинов`);
    
    return JSON.stringify(safeStores, null, 2);
    
  } catch (error) {
    log(`Ошибка экспорта конфигураций магазинов: ${error.message}`);
    return `{"error": "${error.message}"}`;
  }
}

// ============ ВОССТАНОВЛЕННЫЕ ФУНКЦИИ ИЗ CODE.GS ============

// УБРАНО: Дублирующая функция testStoreConnection - используется версия из main.gs

/**
 * ✅ Вспомогательная функция тестирования WB Content API
 */
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
    log(`[Content API Test] Статус: ${code}`);
    
    return code === 200;
  } catch (e) {
    log(`[Content API Test] Ошибка: ${e.message}`);
    return false;
  }
}

/**
 * ✅ Необходимые функции прогресса из code.gs
 */
function resetStoreProgress(storeId) {
  try {
    const props = PropertiesService.getUserProperties();
    const progressKey = `${CONFIG.PROGRESS_KEY}_${storeId}`;
    props.deleteProperty(progressKey);
    log(`[Progress] 🔄 Сброшен прогресс для магазина: ${storeId}`);
    return true;
  } catch (e) {
    log(`[Progress] ❌ Ошибка сброса прогресса для ${storeId}: ${e.message}`);
    return false;
  }
}
