/**
 * @file config.gs
 * @description Централизованная конфигурация для MP Review Manager
 * @version 2.0
 * @date 2025-10-26
 * 
 * АРХИТЕКТУРА:
 * - Все константы и настройки в одном месте
 * - Четкое разделение по функциональности
 * - Легкая конфигурация для разных окружений
 */

// ============ ОСНОВНАЯ КОНФИГУРАЦИЯ СИСТЕМЫ ============
const CONFIG = {
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
const WB_CONFIG = {
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
const OZON_CONFIG = {
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
const TRIGGER_CONFIG = {
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
const CACHE_CONFIG = {
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
const LOG_CONFIG = {
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
const TEMPLATE_CONFIG = {
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
const ENV_CONFIG = {
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
  const isDev = isDevMode();
  return isDev ? ENV_CONFIG.DEVELOPMENT : ENV_CONFIG.PRODUCTION;
}

/**
 * Проверяет включен ли режим разработчика
 * @returns {boolean}
 */
function isDevMode() {
  try {
    const props = PropertiesService.getScriptProperties();
    const devMode = props.getProperty(CONFIG.DEV_MODE_KEY);
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
      throw new Error(`Неизвестный маркетплейс: ${marketplace}`);
  }
}

/**
 * Получает задержку между запросами для маркетплейса
 * @param {string} marketplace - Название маркетплейса
 * @returns {number} Задержка в миллисекундах
 */
function getApiDelay(marketplace) {
  const envConfig = getEnvironmentConfig();
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
  const envConfig = getEnvironmentConfig();
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
