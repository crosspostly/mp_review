/**
 * @file store-manager.gs
 * @description Модуль управления магазинами для MP Review Manager
 * @version 2.0
 * @date 2025-10-26
 * 
 * АРХИТЕКТУРА:
 * - Централизованное управление магазинами
 * - CRUD операции для магазинов
 * - Валидация данных магазинов
 * - Интеграция с Google Sheets и PropertiesService
 */

/**
 * Получает все магазины из системы
 * @returns {Array<Object>} Массив объектов магазинов
 */
function getStores() {
  const timer = new PerformanceTimer('getStores');
  
  try {
    const props = PropertiesService.getScriptProperties();
    const storesJson = props.getProperty(CONFIG.PROPERTIES_KEY);
    
    if (!storesJson) {
      logInfo('Магазины не найдены в PropertiesService', LOG_CONFIG.CATEGORIES.STORE);
      timer.finish();
      return [];
    }
    
    const stores = JSON.parse(storesJson);
    logInfo(`Загружено магазинов: ${stores.length}`, LOG_CONFIG.CATEGORIES.STORE);
    timer.finish();
    return stores;
    
  } catch (error) {
    logError(`Ошибка получения магазинов: ${error.message}`, LOG_CONFIG.CATEGORIES.STORE);
    timer.finish(LOG_CONFIG.LEVELS.ERROR);
    return [];
  }
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
  const timer = new PerformanceTimer('saveStore');
  
  try {
    // Валидация входных данных
    const validation = validateStore(store);
    if (!validation.isValid) {
      logError(`Валидация магазина провалена: ${validation.errors.join(', ')}`, LOG_CONFIG.CATEGORIES.STORE);
      timer.finish(LOG_CONFIG.LEVELS.ERROR);
      return [];
    }
    
    const stores = getStores();
    let isNewStore = true;
    
    // Генерируем ID для нового магазина или находим существующий
    if (!store.id) {
      store.id = generateStoreId(store.marketplace);
      logInfo(`Создается новый магазин с ID: ${store.id}`, LOG_CONFIG.CATEGORIES.STORE);
    } else {
      const existingIndex = stores.findIndex(s => s.id === store.id);
      if (existingIndex !== -1) {
        stores[existingIndex] = store;
        isNewStore = false;
        logInfo(`Обновлен существующий магазин: ${store.name} (${store.id})`, LOG_CONFIG.CATEGORIES.STORE);
      }
    }
    
    if (isNewStore) {
      stores.push(store);
      logInfo(`Добавлен новый магазин: ${store.name} (${store.id})`, LOG_CONFIG.CATEGORIES.STORE);
    }
    
    // Сохраняем обновленный список в PropertiesService
    const props = PropertiesService.getScriptProperties();
    props.setProperty(CONFIG.PROPERTIES_KEY, JSON.stringify(stores));
    
    // Создаем лист для магазина если его нет
    createStoreSheetIfNotExists(store);
    
    logSuccess(`Магазин ${store.name} успешно сохранен`, LOG_CONFIG.CATEGORIES.STORE);
    timer.finish(LOG_CONFIG.LEVELS.SUCCESS);
    
    return stores;
    
  } catch (error) {
    logError(`Ошибка сохранения магазина: ${error.message}`, LOG_CONFIG.CATEGORIES.STORE);
    timer.finish(LOG_CONFIG.LEVELS.ERROR);
    return [];
  }
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
    
    // Сохраняем обновленный список
    const props = PropertiesService.getScriptProperties();
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
    const props = PropertiesService.getScriptProperties();
    
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

/**
 * Тестирует подключение к API для магазина
 * @param {string} storeId - ID магазина для тестирования
 * @returns {Object} Результат тестирования подключения
 */
function testStoreConnection(storeId) {
  const timer = new PerformanceTimer(`testStoreConnection-${storeId}`);
  
  try {
    const store = getStoreById(storeId);
    if (!store) {
      return {
        success: false,
        error: 'Магазин не найден'
      };
    }
    
    logInfo(`Тестирование подключения к ${store.marketplace} для магазина ${store.name}`, LOG_CONFIG.CATEGORIES.STORE);
    
    let testResult = { success: false, error: 'Неподдерживаемый маркетплейс' };
    
    if (store.marketplace === 'Wildberries') {
      // Тестируем WB API
      testResult = testWbConnection(store);
    } else if (store.marketplace === 'Ozon') {
      // Тестируем Ozon API
      testResult = testOzonConnection(store);
    }
    
    const level = testResult.success ? LOG_CONFIG.LEVELS.SUCCESS : LOG_CONFIG.LEVELS.ERROR;
    const message = testResult.success 
      ? `Подключение к ${store.marketplace} успешно`
      : `Ошибка подключения к ${store.marketplace}: ${testResult.error}`;
    
    log(message, level, LOG_CONFIG.CATEGORIES.STORE, { storeId, marketplace: store.marketplace });
    timer.finish(level);
    
    return testResult;
    
  } catch (error) {
    const errorMessage = `Ошибка тестирования магазина ${storeId}: ${error.message}`;
    logError(errorMessage, LOG_CONFIG.CATEGORIES.STORE);
    timer.finish(LOG_CONFIG.LEVELS.ERROR);
    
    return {
      success: false,
      error: errorMessage
    };
  }
}

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
    
    logInfo(`Экспорт конфигурации ${safeStores.length} магазинов`, LOG_CONFIG.CATEGORIES.STORE);
    
    return JSON.stringify(safeStores, null, 2);
    
  } catch (error) {
    logError(`Ошибка экспорта конфигураций магазинов: ${error.message}`, LOG_CONFIG.CATEGORIES.STORE);
    return `{"error": "${error.message}"}`;
  }
}
