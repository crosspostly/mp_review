/**
 * @file config.gs
 * @description Централизованная конфигурация для MP Review Manager
 * @version 2.0.1
 * @date 2025-10-27
 * @updated 2025-10-27 - Триггер для тестирования автодеплоя
 * 
 * АРХИТЕКТУРА:
 * - Все константы и настройки в одном месте
 * - Четкое разделение по функциональности
 * - Легкая конфигурация для разных окружений
 * 
 * ✅ СОВМЕСТИМОСТЬ: Google Apps Script
 * - Все const/let заменены на var (40 замен)
 * - Template literals преобразованы в конкатенацию (30 замен)
 * 
 * 🚀 АВТОДЕПЛОЙ: Настроен через GitHub Actions + clasp
 */

// ============ ОСНОВНАЯ КОНФИГУРАЦИЯ СИСТЕМЫ ============
var CONFIG = {
  // Ключи для PropertiesService
  PROPERTIES_KEY: 'REGISTERED_STORES',
  DEV_MODE_KEY: 'DEV_MODE_ENABLED',
  PROGRESS_KEY: 'PROCESSING_PROGRESS',
  
  // Настройки Google Sheets
  SHEETS: {
    TEMPLATES: 'Шаблоны ответов',
    STORES: 'Stores',
    SETTINGS: 'Settings', 
    LOGS: 'Logs'
  },
  
  // Настройки логирования
  LOG_SHEET_NAME: '🐞 Лог отладки',
  LOG_MAX_ROWS: 2500,
  
  // Фильтры отзывов
  RESPOND_TO_RATINGS: [4, 5],
  MIN_REVIEW_TEXT_LENGTH: 3,
  
  // Лимиты производительности
  MAX_FEEDBACKS_PER_RUN: 50,
  DELAY_BETWEEN_REQUESTS: 1100,
  
  // Заголовки для листов отзывов
  HEADERS: [
    '№', 'ID отзыва', 'Дата отзыва', 'Артикул', 'Название товара', 
    'Ссылка', 'Оценка', 'Текст отзыва', 'Подобранный ответ', 
    'Статус', 'Детали ошибки', 'Время отправки'
  ],
  
  // Статусы обработки отзывов
  STATUS: {
    NEW: 'Новый',
    PENDING: 'Готово к отправке',
    SENT: 'Отправлено',
    ERROR: 'Ошибка'
  },
  
  // Настройки обогащения данных
  ENRICH_PRODUCT_NAMES: false,
  
  // Система памяти прогресса
  PROGRESS: {
    MAX_EXECUTION_TIME: 5.5 * 60 * 1000,    // 5.5 минут
    SAVE_PROGRESS_INTERVAL: 30 * 1000,       // Каждые 30 секунд
    RESET_PROGRESS_AFTER_HOURS: 24           // Сброс старых данных
  }
};

// ============ WILDBERRIES API КОНФИГУРАЦИЯ ============
var WB_CONFIG = {
  MARKETPLACE_NAME: 'Wildberries',
  MARKETPLACE_CODE: 'WB',
  API_BASE_URL: 'https://feedbacks-api.wildberries.ru/api',
  
  ENDPOINTS: {
    GET_FEEDBACKS: '/v1/feedbacks',
    SEND_ANSWER: '/v1/feedbacks'
  },
  
  API_LIMITS: {
    MAX_TAKE: 1000,
    DEFAULT_SKIP: 0,
    RECOMMENDED_TAKE: 100,
    SAFE_TAKE: 500,
    PAGINATION_STEP: 100,
    MAX_PAGES: 10,
    
    // Rate limiting
    REQUESTS_PER_SECOND: 3,
    DELAY_BETWEEN_REQUESTS: 400  // мс между запросами
  },
  
  // Настройки контента
  CONTENT_API: {
    BASE_URL: 'https://content-api.wildberries.ru',
    ENDPOINTS: {
      CARD_LIST: '/content/v2/get/cards/list'
    }
  }
};

// ============ OZON API КОНФИГУРАЦИЯ ============
var OZON_CONFIG = {
  MARKETPLACE_NAME: 'Ozon',
  MARKETPLACE_CODE: 'OZON',
  API_BASE_URL: 'https://api-seller.ozon.ru',
  
  ENDPOINTS: {
    GET_FEEDBACKS: '/v1/review/list',
    SEND_ANSWER: '/v1/review/create-answer',
    PRODUCTS_INFO: '/v2/product/list',
    PRODUCT_INFO: '/v2/product/info'
  },
  
  API_LIMITS: {
    MAX_LIMIT: 1000,
    DEFAULT_LIMIT: 100,
    SAFE_LIMIT: 500,
    MAX_PAGES_STANDARD: 50,
    MAX_PAGES_ADAPTIVE: 200,
    
    // Cursor-based пагинация
    CURSOR_BASED: true,
    
    // Rate limiting
    REQUESTS_PER_SECOND: 50,
    DELAY_BETWEEN_REQUESTS: 500  // мс между запросами
  },
  
  RATE_LIMITS: {
    DELAY_BETWEEN_REQUESTS: 500,
    PAUSE_EVERY_N_PAGES: 10,
    PAUSE_DURATION: 2000
  }
};

// ============ СИСТЕМА ТРИГГЕРОВ ============
var TRIGGER_CONFIG = {
  INTERVAL_MINUTES: 60,           // Интервал запуска триггеров (1 час)
  CACHE_SIZE: 10000,              // Максимальное количество ID в кеше
  
  // Batch размеры для триггеров
  BATCH_SIZE_COLLECT: 100,        // Максимум отзывов за один сбор
  BATCH_SIZE_PREPARE: 50,         // Максимум отзывов за один подбор
  BATCH_SIZE_SEND: 30,            // Максимум отзывов за одну отправку
  
  MAX_EXECUTION_TIME: 4.5 * 60 * 1000,  // 4.5 минуты безопасный запас
  PROPERTIES_KEY: 'REVIEW_IDS_CACHE'
};

// ============ CACHE SYSTEM КОНФИГУРАЦИЯ ============
var CACHE_CONFIG = {
  // Префиксы для ключей в PropertiesService
  PREFIX_REVIEW_IDS: 'reviewIds_',         // reviewIds_ozon_001
  PREFIX_STRIPE_POSITION: 'stripe_position_',  // stripe_position_ozon_001
  PREFIX_STORE_PROGRESS: 'store_progress_',    // store_progress_ozon_001
  
  // Настройки кеша
  MAX_CACHE_SIZE: 10000,          // Максимум ID в одном кеше
  CLEANUP_THRESHOLD: 12000,       // Когда начинать очистку
  STRIPE_PAGES_COUNT: 50,         // Страниц в одной полоске
  MAX_STRIPES: 4,                 // Максимум полосок (4 * 50 = 200 страниц)
  
  // Временные лимиты
  CACHE_TTL_HOURS: 24,            // Время жизни кеша
  PROGRESS_TTL_HOURS: 24          // Время жизни прогресса
};

// ============ СИСТЕМА ЛОГИРОВАНИЯ ============
var LOG_CONFIG = {
  LEVELS: {
    DEBUG: 'DEBUG',
    INFO: 'INFO', 
    WARNING: 'WARNING',
    ERROR: 'ERROR',
    SUCCESS: 'SUCCESS'
  },
  
  CATEGORIES: {
    SYSTEM: 'SYSTEM',
    WB_API: 'WB-API',
    OZON_API: 'OZON-API',
    TRIGGER: 'TRIGGER',
    CACHE: 'CACHE',
    STORE: 'STORE'
  },
  
  // Настройки хранения
  MAX_LOG_ROWS: 5000,
  CLEANUP_ROWS: 1000,
  
  // Форматирование
  DATE_FORMAT: 'dd.MM.yyyy HH:mm:ss',
  TIMEZONE: 'Europe/Moscow'
};

// ============ НАСТРОЙКИ ШАБЛОНОВ ОТВЕТОВ ============
var TEMPLATE_CONFIG = {
  DEFAULT_TEMPLATES: {
    RATING_5: 'Спасибо за отличную оценку! Рады, что товар вам понравился! 🌟',
    RATING_4: 'Благодарим за покупку и хорошую оценку! Будем рады видеть вас снова! 👍',
    RATING_3: 'Спасибо за отзыв! Мы учтем ваше мнение для улучшения качества.',
    RATING_2: 'Извините, что товар не оправдал ожиданий. Свяжитесь с нами для решения вопроса.',
    RATING_1: 'Приносим извинения за неудачную покупку. Обязательно поможем решить проблему!'
  },
  
  // Настройки персонализации
  PERSONALIZATION: {
    USE_PRODUCT_NAME: true,
    USE_REVIEW_TEXT_ANALYSIS: true,
    MAX_TEMPLATE_LENGTH: 500
  }
};

// ============ DEVELOPMENT/PRODUCTION НАСТРОЙКИ ============
var ENV_CONFIG = {
  DEVELOPMENT: {
    API_DELAYS: {
      WB: 1000,   // 1 секунда между запросами
      OZON: 1000
    },
    BATCH_SIZES: {
      COLLECT: 10,
      PREPARE: 5, 
      SEND: 3
    },
    ENABLE_DETAILED_LOGGING: true
  },
  
  PRODUCTION: {
    API_DELAYS: {
      WB: 400,    // Реальные лимиты API
      OZON: 500
    },
    BATCH_SIZES: {
      COLLECT: 100,
      PREPARE: 50,
      SEND: 30  
    },
    ENABLE_DETAILED_LOGGING: false
  }
};

// ============ UTILITY ФУНКЦИИ ДЛЯ КОНФИГУРАЦИИ ============

/**
 * Получает текущую конфигурацию окружения
 * @returns {Object} Конфигурация для текущего окружения
 */
function getEnvironmentConfig() {
  var isDev = isDevMode();
  return isDev ? ENV_CONFIG.DEVELOPMENT : ENV_CONFIG.PRODUCTION;
}

/**
 * Проверяет включен ли режим разработчика
 * @returns {boolean}
 */
function isDevMode() {
  try {
    var props = PropertiesService.getScriptProperties();
    var devMode = props.getProperty(CONFIG.DEV_MODE_KEY);
    return devMode === 'true';
  } catch (error) {
    return false;
  }
}

/**
 * Получает конфигурацию API для маркетплейса
 * @param {string} marketplace - 'Wildberries' или 'Ozon'
 * @returns {Object} Конфигурация API
 */
function getMarketplaceConfig(marketplace) {
  switch (marketplace?.toLowerCase()) {
    case 'wildberries':
    case 'wb':
      return WB_CONFIG;
    case 'ozon':
      return OZON_CONFIG;
    default:
      throw new Error('Неизвестный маркетплейс: ' + marketplace);
  }
}

/**
 * Получает задержку между запросами для маркетплейса
 * @param {string} marketplace - Название маркетплейса
 * @returns {number} Задержка в миллисекундах
 */
function getApiDelay(marketplace) {
  var envConfig = getEnvironmentConfig();
  switch (marketplace?.toLowerCase()) {
    case 'wildberries':
    case 'wb':
      return envConfig.API_DELAYS.WB;
    case 'ozon': 
      return envConfig.API_DELAYS.OZON;
    default:
      return 1000; // По умолчанию 1 секунда
  }
}

/**
 * Получает размер батча для операции
 * @param {string} operation - 'collect', 'prepare', 'send'
 * @returns {number} Размер батча
 */
function getBatchSize(operation) {
  var envConfig = getEnvironmentConfig();
  switch (operation?.toLowerCase()) {
    case 'collect':
      return envConfig.BATCH_SIZES.COLLECT;
    case 'prepare':
      return envConfig.BATCH_SIZES.PREPARE; 
    case 'send':
      return envConfig.BATCH_SIZES.SEND;
    default:
      return 10; // По умолчанию малый батч
  }
}

// ============ API СТАТИСТИКА И МОНИТОРИНГ ============

/**
 * ✅ ДОДЕЛАНО: Получает трекер статистики API с полной функциональностью
 * @returns {Object} Объект трекера со всеми методами
 */
function getApiStatsTracker() {
  return {
    /**
     * Увеличивает счетчик запросов для маркетплейса
     * @param {string} marketplace - 'ozon' или 'wildberries'
     */
    incrementRequests: function(marketplace) {
      try {
        var props = PropertiesService.getScriptProperties();
        var key = 'API_REQUESTS_' + marketplace.toUpperCase();
        var current = parseInt(props.getProperty(key) || '0');
        props.setProperty(key, (current + 1).toString());
        
        logDebug('API Stats: Запросов ' + marketplace + ': ' + current + 1, LOG_CONFIG.CATEGORIES.SYSTEM);
      } catch (error) {
        logWarning('Ошибка записи статистики запросов: ' + error.message, LOG_CONFIG.CATEGORIES.SYSTEM);
      }
    },
    
    /**
     * Увеличивает счетчик ошибок для маркетплейса
     * @param {string} marketplace - 'ozon' или 'wildberries'
     */
    incrementErrors: function(marketplace) {
      try {
        var props = PropertiesService.getScriptProperties();
        var key = 'API_ERRORS_' + marketplace.toUpperCase();
        var current = parseInt(props.getProperty(key) || '0');
        props.setProperty(key, (current + 1).toString());
        
        logWarning('API Stats: Ошибок ' + marketplace + ': ' + current + 1, LOG_CONFIG.CATEGORIES.SYSTEM);
      } catch (error) {
        logWarning('Ошибка записи статистики ошибок: ' + error.message, LOG_CONFIG.CATEGORIES.SYSTEM);
      }
    },
    
    /**
     * Записывает время ответа API
     * @param {string} marketplace - 'ozon' или 'wildberries'
     * @param {number} responseTime - Время ответа в миллисекундах
     */
    recordResponseTime: function(marketplace, responseTime) {
      try {
        var props = PropertiesService.getScriptProperties();
        var key = 'API_AVG_TIME_' + marketplace.toUpperCase();
        var countKey = 'API_TIME_COUNT_' + marketplace.toUpperCase();
        var totalKey = 'API_TOTAL_TIME_' + marketplace.toUpperCase();
        
        var currentAvg = parseFloat(props.getProperty(key) || '0');
        var currentCount = parseInt(props.getProperty(countKey) || '0');
        var currentTotal = parseInt(props.getProperty(totalKey) || '0');
        
        // Вычисляем новое среднее время и общее время
        var newTotal = currentTotal + responseTime;
        var newCount = currentCount + 1;
        var newAvg = newTotal / newCount;
        
        props.setProperty(key, newAvg.toFixed(2));
        props.setProperty(countKey, newCount.toString());
        props.setProperty(totalKey, newTotal.toString());
        
        logDebug('API Stats: Время ' + marketplace + ': ' + responseTime + 'ms (среднее: ' + newAvg.toFixed(2) + 'ms)', LOG_CONFIG.CATEGORIES.SYSTEM);
      } catch (error) {
        logWarning('Ошибка записи времени ответа: ' + error.message, LOG_CONFIG.CATEGORIES.SYSTEM);
      }
    },
    
    /**
     * Получает статистику для маркетплейса
     * @param {string} marketplace - 'ozon' или 'wildberries' или 'all' для общей статистики
     * @returns {Object} Объект со статистикой
     */
    getStats: function(marketplace) {
      try {
        var props = PropertiesService.getScriptProperties();
        
        if (marketplace === 'all') {
          // Общая статистика по всем маркетплейсам
          var ozStats = this.getStats('ozon');
          var wbStats = this.getStats('wildberries');
          
          return {
            total: {
              requests: ozStats.requests + wbStats.requests,
              errors: ozStats.errors + wbStats.errors,
              averageResponseTime: ((ozStats.averageResponseTime * ozStats.requests) + 
                                   (wbStats.averageResponseTime * wbStats.requests)) / 
                                   (ozStats.requests + wbStats.requests) || 0
            },
            ozon: ozStats,
            wildberries: wbStats
          };
        } else {
          // Статистика для конкретного маркетплейса
          var marketplace_upper = marketplace.toUpperCase();
          
          var requests = parseInt(props.getProperty('API_REQUESTS_' + marketplace_upper) || '0');
          var errors = parseInt(props.getProperty('API_ERRORS_' + marketplace_upper) || '0');
          var averageResponseTime = parseFloat(props.getProperty('API_AVG_TIME_' + marketplace_upper) || '0');
          var timeCount = parseInt(props.getProperty('API_TIME_COUNT_' + marketplace_upper) || '0');
          var totalResponseTime = parseInt(props.getProperty('API_TOTAL_TIME_' + marketplace_upper) || '0');
          
          return {
            marketplace: marketplace,
            requests: requests,
            errors: errors,
            averageResponseTime: averageResponseTime,
            totalResponseTime: totalResponseTime,
            timeCount: timeCount,
            // Дополнительные поля для совместимости с getOzonApiStatistics
            lastRequestTime: timeCount > 0 ? new Date() : null
          };
        }
      } catch (error) {
        logError('Ошибка получения статистики API: ' + error.message, LOG_CONFIG.CATEGORIES.SYSTEM);
        return {
          marketplace: marketplace,
          requests: 0,
          errors: 0,
          averageResponseTime: 0,
          totalResponseTime: 0,
          timeCount: 0,
          lastRequestTime: null
        };
      }
    },
    
    /**
     * Очищает статистику API
     * @param {string} marketplace - 'ozon', 'wildberries' или 'all'
     */
    resetStats: function(marketplace) {
      try {
        var props = PropertiesService.getScriptProperties();
        
        if (marketplace === 'all') {
          // Очищаем статистику для всех маркетплейсов
          var __temp_array = ['OZON', 'WILDBERRIES'];
    for (var i = 0; i < __temp_array.length; i++) {
      var mp = __temp_array[i];
            props.deleteProperty('API_REQUESTS_' + mp);
            props.deleteProperty('API_ERRORS_' + mp);
            props.deleteProperty('API_AVG_TIME_' + mp);
            props.deleteProperty('API_TIME_COUNT_' + mp);
            props.deleteProperty('API_TOTAL_TIME_' + mp);
          });
        } else {
          // Очищаем статистику для конкретного маркетплейса
          var marketplace_upper = marketplace.toUpperCase();
          props.deleteProperty('API_REQUESTS_' + marketplace_upper);
          props.deleteProperty('API_ERRORS_' + marketplace_upper);
          props.deleteProperty('API_AVG_TIME_' + marketplace_upper);
          props.deleteProperty('API_TIME_COUNT_' + marketplace_upper);
          props.deleteProperty('API_TOTAL_TIME_' + marketplace_upper);
        }
        
        logInfo('API статистика очищена для: ' + marketplace, LOG_CONFIG.CATEGORIES.SYSTEM);
      } catch (error) {
        logError('Ошибка очистки статистики API: ' + error.message, LOG_CONFIG.CATEGORIES.SYSTEM);
      }
    }
  };
}
# Test autodeploy
# Final test
