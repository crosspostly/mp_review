# 🚀 Руководство по развертыванию

## 📋 Предварительные требования

### 1. Google аккаунт
- Активный Google аккаунт с доступом к Google Sheets
- Разрешения на создание Google Apps Script проектов

### 2. API ключи маркетплейсов

#### Wildberries API
1. Перейдите в [Личный кабинет WB](https://seller.wildberries.ru/)
2. Раздел "Настройки" → "API"
3. Создайте новый API ключ
4. Скопируйте ключ для использования

#### Ozon API
1. Перейдите в [Личный кабинет Ozon](https://seller.ozon.ru/)
2. Раздел "Настройки" → "API"
3. Создайте приложение и получите:
   - Client ID
   - API Key
4. Скопируйте данные для использования

### 3. Google Sheets
- Создайте новую Google Таблицу
- Настройте права доступа (если нужно)

## 🛠️ Пошаговая установка

### Шаг 1: Создание Google Apps Script проекта

1. Откройте [script.google.com](https://script.google.com/)
2. Нажмите "Новый проект"
3. Переименуйте проект: "Система обработки отзывов"

### Шаг 2: Добавление файлов

Создайте следующие файлы в проекте:

#### `code.gs` - Основная логика
```javascript
// Скопируйте содержимое из файла code.gs
```

#### `ozon_functions.gs` - Функции Ozon
```javascript
// Скопируйте содержимое из файла ozon_functions.gs
```

#### `tests.gs` - Единая система тестирования
```javascript
// Скопируйте содержимое из файла tests.gs
// Содержит: unit тесты, UI тесты, интеграционные тесты
```

#### `api_fixes.gs` - Исправления API
```javascript
// Скопируйте содержимое из файла api_fixes.gs
// Содержит: WB API v2, Ozon API исправления, GAS оптимизации
```

#### `api_testing.gs` - Тестирование реальных API
```javascript
// Скопируйте содержимое из файла api_testing.gs
// Содержит: тестирование с логированием, сравнение версий API
```

### Шаг 3: Настройка Google Sheets

1. Откройте вашу Google Таблицу
2. Перейдите в "Расширения" → "Apps Script"
3. Удалите код по умолчанию
4. Скопируйте все файлы из проекта Apps Script

### Шаг 4: Первоначальная настройка

1. В редакторе Apps Script выполните функцию `initialSetup()`
2. Включите режим разработчика: `enableDevMode()`
3. Запустите быстрые тесты: `runQuickComprehensiveTests()`

### Шаг 5: Настройка магазинов

1. В Google Sheets откройте меню "Настройки"
2. Добавьте магазины с API ключами:

#### Для Wildberries:
```javascript
const wbStore = {
  id: "wb-store-1",
  name: "Мой магазин WB",
  marketplace: "wb",
  isActive: true,
  credentials: {
    apiKey: "ваш-wb-api-ключ"
  },
  settings: {
    startDate: "2024-01-01",
    minRating: 3,
    sortOldestFirst: false
  }
};
```

#### Для Ozon:
```javascript
const ozonStore = {
  id: "ozon-store-1",
  name: "Мой магазин Ozon",
  marketplace: "ozon",
  isActive: true,
  credentials: {
    clientId: "ваш-ozon-client-id",
    apiKey: "ваш-ozon-api-ключ"
  },
  settings: {
    startDate: "2024-01-01",
    minRating: 3,
    sortOldestFirst: false
  }
};
```

### Шаг 6: Настройка триггеров

1. Выполните функцию `setupSmartTriggers()`
2. Проверьте создание триггера: `listAllStoreTriggers()`
3. При необходимости настройте интервал: `setTriggerInterval(storeId, minutes)`

## 🧪 Тестирование после установки

### 1. Базовые тесты
```javascript
// Запустите в редакторе Apps Script
runQuickComprehensiveTests();
```

### 2. Тестирование реальных API с логированием
```javascript
// Запустите в редакторе Apps Script
runFullApiTesting();
```

### 3. Сравнение WB API v1 vs v2
```javascript
// Запустите в редакторе Apps Script
const comparison = compareWbApiVersions("ваш-wb-api-ключ", store);
```

### 4. Тест производительности
```javascript
// Запустите в редакторе Apps Script
runPerformanceTests();
```

### 5. Тест API подключений
```javascript
// Тест WB API v1
testWbApiV1WithLogging("ваш-wb-api-ключ", store);

// Тест WB API v2
testWbApiV2WithLogging("ваш-wb-api-ключ", store);

// Тест Ozon API
testOzonProductApiAccess("ваш-ozon-client-id", "ваш-ozon-api-ключ");
```

## ⚙️ Конфигурация системы

### Настройки в Google Sheets

1. Откройте меню "Настройки" в Google Sheets
2. Настройте параметры системы:

```javascript
const CONFIG = {
  LOG_MAX_ROWS: 1000,           // Максимум строк в логе
  MAX_EXECUTION_TIME: 300000,   // Максимальное время выполнения (мс)
  RATE_LIMIT_DELAY: 350,        // Задержка между запросами (мс)
  RETRY_ATTEMPTS: 3,            // Количество попыток при ошибках
  CACHE_TTL_MINUTES: 60         // Время жизни кэша (минуты)
};
```

### Настройки магазинов

Для каждого магазина можно настроить:

- **startDate** - дата начала сбора отзывов
- **minRating** - минимальный рейтинг для обработки
- **sortOldestFirst** - сортировка старых отзывов первыми
- **nmId** - фильтр по конкретному товару (только WB)

## 🔄 Миграция и обновления

### Обновление до WB API v2
```javascript
// Выполните в редакторе Apps Script
migrateToWbApiV2();
```

### Обновление Ozon API
```javascript
// Выполните в редакторе Apps Script
migrateToOzonApiFixed();
```

### Полная миграция системы
```javascript
// Выполните в редакторе Apps Script
performFullMigration();
```

## 📊 Мониторинг и обслуживание

### Ежедневные проверки

1. **Проверка логов**
   ```javascript
   // Откройте лог-лист
   toggleLogSheet();
   ```

2. **Проверка статуса триггеров**
   ```javascript
   // Проверьте статус триггеров
   showTriggerStatus();
   ```

3. **Проверка целостности системы**
   ```javascript
   // Запустите проверку целостности
   runTriggerIntegrityCheck();
   ```

### Еженедельные проверки

1. **Полное тестирование**
   ```javascript
   runComprehensiveTests();
   ```

2. **Очистка логов**
   ```javascript
   // Очистите старые логи
   clearOldLogs();
   ```

3. **Проверка производительности**
   ```javascript
   runPerformanceTests();
   ```

### Ежемесячные проверки

1. **Обновление API ключей**
2. **Проверка лимитов API**
3. **Оптимизация настроек**

## 🚨 Устранение неполадок

### Проблемы с API

#### Ошибка 401 (Unauthorized)
```javascript
// Проверьте API ключи
testWbContentApiAccess(apiKey);
testOzonProductApiAccess(clientId, apiKey);
```

#### Ошибка 429 (Rate Limit)
```javascript
// Увеличьте задержку между запросами
const CONFIG = {
  RATE_LIMIT_DELAY: 500 // увеличить до 500мс
};
```

### Проблемы с триггерами

#### Триггеры не выполняются
```javascript
// Проверьте целостность триггеров
validateTriggerIntegrity();

// Синхронизируйте триггеры
syncAllStoreTriggers();
```

#### Превышение лимита триггеров
```javascript
// Используйте умную систему триггеров
setupSmartTriggers();
```

### Проблемы с производительностью

#### Медленная работа
```javascript
// Запустите тест производительности
runPerformanceTests();

// Очистите кэш
PropertiesService.getScriptProperties().deleteAllProperties();
```

#### Превышение времени выполнения
```javascript
// Уменьшите объем обрабатываемых данных
const CONFIG = {
  MAX_EXECUTION_TIME: 240000 // 4 минуты
};
```

## 📞 Поддержка

### Логи и диагностика

1. **Включите режим разработчика**
   ```javascript
   enableDevMode();
   ```

2. **Запустите диагностику**
   ```javascript
   runQuickComprehensiveTests();
   ```

3. **Проверьте логи**
   ```javascript
   toggleLogSheet();
   ```

### Создание отчета об ошибке

При создании Issue включите:

1. Версию Google Apps Script
2. Версию браузера
3. Логи ошибок
4. Конфигурацию магазинов (без API ключей)
5. Шаги для воспроизведения

### Контакты

- GitHub Issues: [Создать Issue](https://github.com/your-repo/issues)
- Email: support@your-domain.com

## 🔒 Безопасность

### Защита API ключей

1. **Никогда не делитесь API ключами**
2. **Используйте переменные окружения** (если возможно)
3. **Регулярно обновляйте ключи**
4. **Мониторьте использование API**

### Резервное копирование

1. **Регулярно экспортируйте код**
2. **Сохраняйте конфигурацию**
3. **Делайте резервные копии данных**

## 📈 Оптимизация

### Рекомендации по производительности

1. **Используйте фильтрацию на уровне API**
2. **Настройте правильные интервалы триггеров**
3. **Очищайте старые данные**
4. **Мониторьте использование ресурсов**

### Масштабирование

1. **Разделите магазины по времени обработки**
2. **Используйте разные триггеры для разных типов магазинов**
3. **Настройте приоритеты обработки**

---

**✅ После выполнения всех шагов ваша система будет готова к работе!**