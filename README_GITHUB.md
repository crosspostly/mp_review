# 🤖 Система автоматической обработки отзывов для Wildberries и Ozon

[![Google Apps Script](https://img.shields.io/badge/Google%20Apps%20Script-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://script.google.com/)
[![Wildberries API](https://img.shields.io/badge/Wildberries%20API-FF6B35?style=for-the-badge&logo=wildberries&logoColor=white)](https://feedbacks-api.wildberries.ru/)
[![Ozon API](https://img.shields.io/badge/Ozon%20API-005BFF?style=for-the-badge&logo=ozon&logoColor=white)](https://api.ozon.ru/)

## 📋 Описание

Комплексная система для автоматической обработки отзывов с маркетплейсов Wildberries и Ozon. Включает в себя:

- 🔄 **Автоматическую обработку отзывов** с использованием Google Apps Script
- 📊 **Анализ и фильтрацию** отзывов по различным критериям
- 🤖 **Автоматические ответы** на отзывы с использованием шаблонов
- ⚡ **Систему триггеров** для регулярного выполнения
- 🧪 **Комплексное тестирование** всех функций
- 📈 **Мониторинг и логирование** всех операций

## 🚀 Возможности

### Основные функции
- ✅ Получение отзывов с WB и Ozon API
- ✅ Фильтрация по дате, рейтингу, содержанию
- ✅ Автоматические ответы на отзывы
- ✅ Система шаблонов ответов
- ✅ Управление магазинами
- ✅ Ночное обновление названий товаров
- ✅ Система прогресса и восстановления

### API интеграции
- 🛒 **Wildberries API v2** - последняя версия с встроенной фильтрацией
- 📦 **Ozon API** - с правильной cursor-based пагинацией
- 🔄 **Retry логика** с exponential backoff
- ⚡ **Rate limiting** для соблюдения лимитов API

### Система тестирования
- 🧪 **Unit тесты** для всех функций
- 🔗 **Integration тесты** для полных циклов
- 📊 **Performance тесты** для оптимизации
- 🔒 **Security тесты** для защиты данных
- ✅ **API compliance тесты** для соответствия документации

## 📁 Структура проекта

```
📦 Система обработки отзывов
├── 📄 code.gs                          # Основная логика системы
├── 📄 ozon_functions.gs                # Функции для работы с Ozon API
├── 📄 tests.gs                         # Базовые unit тесты
├── 📄 comprehensive_tests.gs           # Комплексные тесты
├── 📄 test_functions.gs                # Функции для запуска тестов
├── 📄 api_fixes_implementation.gs      # Исправления API на основе документации
├── 📄 API_DOCUMENTATION_ANALYSIS.md    # Анализ документации API
├── 📄 README_GITHUB.md                 # Документация для GitHub
└── 📄 StoreManagerSidebar.html         # UI для управления магазинами
```

## 🛠️ Установка и настройка

### 1. Создание Google Apps Script проекта

1. Перейдите на [script.google.com](https://script.google.com/)
2. Создайте новый проект
3. Скопируйте содержимое файлов в соответствующие файлы проекта

### 2. Настройка Google Sheets

1. Создайте новую Google Таблицу
2. Откройте редактор скриптов (Расширения → Apps Script)
3. Скопируйте код из файлов проекта
4. Сохраните проект

### 3. Настройка API ключей

1. Получите API ключи для WB и Ozon
2. Используйте меню "Настройки" в Google Sheets
3. Добавьте магазины с соответствующими ключами

### 4. Первый запуск

1. Выполните функцию `initialSetup()`
2. Включите режим разработчика: `enableDevMode()`
3. Запустите тесты: `runAllTests()`

## 📖 Использование

### Основные функции

#### Обработка отзывов
```javascript
// Обработка всех магазинов
processAllStores();

// Обработка конкретного магазина
processSingleStore(store, devMode);

// Обработка по ID магазина
processSingleStoreById(storeId);
```

#### Управление магазинами
```javascript
// Получение списка магазинов
const stores = getStores();

// Сохранение магазина
saveStore(store);

// Удаление магазина
deleteStore(storeId);
```

#### Система триггеров
```javascript
// Синхронизация всех триггеров
syncAllStoreTriggers();

// Создание триггера для магазина
ensureStoreTrigger(store, intervalMinutes);

// Удаление триггера
deleteStoreTrigger(storeId);
```

### Тестирование

#### Запуск всех тестов
```javascript
// Комплексное тестирование
runComprehensiveTests();

// Быстрые тесты
runQuickComprehensiveTests();

// Тесты производительности
runPerformanceTests();
```

#### Тестирование API
```javascript
// Тест WB API v2
testWbApiV2Compliance();

// Тест Ozon API
testOzonApiCompliance();

// Тест обработки ошибок
testApiErrorHandling();
```

## 🔧 Конфигурация

### Настройки магазина
```javascript
const store = {
  id: "unique-store-id",
  name: "Название магазина",
  marketplace: "wb", // или "ozon"
  isActive: true,
  credentials: {
    apiKey: "your-api-key", // для WB
    clientId: "your-client-id", // для Ozon
    apiKey: "your-api-key" // для Ozon
  },
  settings: {
    startDate: "2024-01-01",
    minRating: 3,
    sortOldestFirst: false
  }
};
```

### Настройки системы
```javascript
const CONFIG = {
  LOG_MAX_ROWS: 1000,
  MAX_EXECUTION_TIME: 300000, // 5 минут
  RATE_LIMIT_DELAY: 350, // мс между запросами
  RETRY_ATTEMPTS: 3
};
```

## 📊 Мониторинг и логирование

### Уровни логирования
- 🔍 **DEBUG** - подробная отладочная информация
- ℹ️ **INFO** - общая информация
- ⚠️ **WARNING** - предупреждения
- ❌ **ERROR** - ошибки
- ✅ **SUCCESS** - успешные операции

### Просмотр логов
1. Включите режим разработчика: `enableDevMode()`
2. Откройте лог-лист: `toggleLogSheet()`
3. Просматривайте логи в консоли Google Apps Script

## 🧪 Тестирование

### Типы тестов

#### Unit тесты
- Тестирование отдельных функций
- Проверка входных и выходных данных
- Валидация обработки ошибок

#### Integration тесты
- Тестирование полных циклов обработки
- Проверка взаимодействия компонентов
- Тестирование системы прогресса

#### Performance тесты
- Измерение времени выполнения
- Тестирование с большими объемами данных
- Проверка использования памяти

#### Security тесты
- Валидация входных данных
- Защита API ключей
- Проверка rate limiting

### Запуск тестов

```javascript
// Все тесты
runComprehensiveTests();

// Критические тесты
runQuickComprehensiveTests();

// Тесты производительности
runPerformanceTests();
```

## 🔒 Безопасность

### Защита данных
- ✅ API ключи не попадают в логи
- ✅ Валидация всех входных данных
- ✅ Rate limiting для предотвращения блокировок
- ✅ Retry логика с exponential backoff

### Ограничения Google Apps Script
- Максимум 20 триггеров на скрипт
- Максимум 5 минут выполнения
- Максимум 100 МБ памяти
- Максимум 100 запросов UrlFetchApp за выполнение

## 📈 Производительность

### Оптимизации
- 🚀 Использование WB API v2 с встроенной фильтрацией
- 🚀 Правильная cursor-based пагинация для Ozon
- 🚀 Кэширование часто используемых данных
- 🚀 Умная система триггеров (один вместо множества)
- 🚀 Batch операции для работы с Google Sheets

### Мониторинг
- ⏱️ Время выполнения функций
- 📊 Количество обработанных отзывов
- 🔄 Использование API запросов
- 💾 Использование памяти

## 🐛 Устранение неполадок

### Частые проблемы

#### Ошибки API
```javascript
// Проверка API ключей
testWbContentApiAccess(apiKey);
testOzonProductApiAccess(clientId, apiKey);
```

#### Проблемы с триггерами
```javascript
// Проверка целостности триггеров
validateTriggerIntegrity();

// Синхронизация триггеров
syncAllStoreTriggers();
```

#### Проблемы с производительностью
```javascript
// Тест производительности
runPerformanceTests();

// Очистка кэша
PropertiesService.getScriptProperties().deleteAllProperties();
```

### Логи и отладка

1. Включите режим разработчика: `enableDevMode()`
2. Запустите проблемную функцию
3. Проверьте логи в консоли или лог-листе
4. Используйте `runQuickComprehensiveTests()` для диагностики

## 🤝 Вклад в проект

### Как внести изменения

1. Создайте форк репозитория
2. Создайте ветку для новой функции: `git checkout -b feature/new-feature`
3. Внесите изменения и добавьте тесты
4. Запустите все тесты: `runComprehensiveTests()`
5. Создайте Pull Request

### Стандарты кода

- Используйте JSDoc для документирования функций
- Добавляйте логирование для отладки
- Покрывайте новые функции тестами
- Следуйте принципам DRY и KISS

## 📄 Лицензия

Этот проект распространяется под лицензией MIT. См. файл [LICENSE](LICENSE) для подробностей.

## 📞 Поддержка

Если у вас возникли вопросы или проблемы:

1. Проверьте [Issues](https://github.com/your-repo/issues)
2. Создайте новый Issue с подробным описанием
3. Приложите логи и конфигурацию

## 🙏 Благодарности

- Google Apps Script за платформу
- Wildberries за API
- Ozon за API
- Сообществу разработчиков за вклад

---

**⭐ Если проект был полезен, поставьте звезду!**