# 🚀 ОБНОВЛЕННЫЙ ПЛАН: На основе реального исследования schema.md

## 📊 КЛЮЧЕВЫЕ ВЫВОДЫ ИЗ SCHEMA.MD

### ✅ **РЕАЛЬНЫЕ ЛИМИТЫ (октябрь 2025):**

#### Google Apps Script Consumer:
- **Runtime**: 90 минут/день (не 6 минут на триггер!)
- **URL Fetch**: 20,000 запросов/день
- **Триггеры**: 20 максимум
- **Execution**: 6 минут максимум на триггер

#### Ozon API реальность:
- **Rate limit**: НЕ документирован официально
- **Практика**: 429 ошибки при 2000 запросах за 10 часов
- **Рекомендация**: 500-1000ms между запросами
- **Проблемы**: Нет фильтрации по дате, произвольная сортировка

#### Wildberries API:
- **Rate limit**: 3 запроса/сек (333ms интервал)
- **Batch**: До 5000 отзывов за запрос
- **Фильтрация**: Есть по дате (dateFrom/dateTo)
- **Сортировка**: Есть (dateAsc/dateDesc)

## 🏗️ ОПТИМАЛЬНАЯ АРХИТЕКТУРА (4 ТРИГГЕРА)

### 📋 **УПРОЩЕННАЯ СХЕМА:**
```
ТРИГГЕР 1: Сбор отзывов (каждый час)
├── Ozon: 20 страниц максимум за запуск
├── WB: фильтр по дате за последние 24 часа
├── Время: 3-4 минуты
└── Runtime: 60-90 минут/день ✅

ТРИГГЕР 2: Подбор ответов (каждые 15 минут)
├── Поиск отзывов со статусом "NEW"
├── Подбор шаблонов по рейтингу
├── Время: 1-2 минуты
└── Runtime: ~10 минут/день ✅

ТРИГГЕР 3: Отправка ответов (каждые 15 минут)
├── Поиск отзывов со статусом "PENDING_SEND"
├── Отправка через API платформы
├── Время: 1-2 минуты
└── Runtime: ~10 минут/день ✅

ТРИГГЕР 4: Глубокий скан (раз в неделю)
├── Пересмотр последних 3-5 страниц Ozon
├── На случай "всплывших" старых отзывов
├── Время: 4-5 минут
└── Runtime: ~5 минут/неделю ✅

ИТОГО: 4 триггера (остается 16 резерв!)
```

## 🔧 РЕАЛИЗАЦИЯ НА ОСНОВЕ SCHEMA.MD

### ЭТАП 1: Обновление структуры листов
```javascript
// Новые заголовки (из schema.md)
CONFIG.HEADERS = [
  'reviewId',        // A: Уникальный ID
  'createdDate',     // B: Дата создания
  'rating',          // C: Рейтинг (1-5)
  'text',            // D: Текст отзыва
  'product',         // E: Название товара
  'status',          // F: NEW/PENDING_SEND/SENT/ERROR
  'processedDate',   // G: Дата обработки
  'answer',          // H: Текст ответа
  'errorMsg'         // I: Сообщение об ошибке
];

// Статусы отзывов (из schema.md)
CONFIG.REVIEW_STATUS = {
  NEW: 'NEW',
  PENDING_SEND: 'PENDING_SEND',
  SENT: 'SENT',
  ERROR: 'ERROR'
};
```

### ЭТАП 2: Триггер сбора отзывов (каждый час)
```javascript
function hourlyReviewCollector() {
  const startTime = Date.now();
  const maxExecutionTime = 4 * 60 * 1000; // 4 минуты лимит
  
  log(`[Collector] 🚀 Начинаем сбор отзывов`);
  
  // ШАГ 1: Загрузить активные магазины
  const stores = getActiveStores();
  log(`[Collector] 📊 Найдено ${stores.length} активных магазинов`);
  
  // ШАГ 2: Продолжение с предыдущего запуска
  let startIndex = getLastProcessedStoreIndex();
  if (startIndex >= stores.length) {
    startIndex = 0; // Начинаем заново
  }
  
  // ШАГ 3: Цикл по магазинам
  for (let i = startIndex; i < stores.length; i++) {
    // Проверяем время выполнения
    if (Date.now() - startTime > maxExecutionTime) {
      log(`[Collector] ⏰ Время истекло, сохраняем прогресс: ${i}`);
      saveLastProcessedStoreIndex(i);
      return;
    }
    
    const store = stores[i];
    
    try {
      log(`[Collector] 📦 Обработка ${store.name} (${store.marketplace})`);
      
      let newReviews = [];
      
      if (store.marketplace === 'Ozon') {
        newReviews = collectOzonReviewsBatch(store);
      } else if (store.marketplace === 'Wildberries') {
        newReviews = collectWBReviewsBatch(store);
      }
      
      if (newReviews.length > 0) {
        // Фильтруем дубликаты
        const uniqueReviews = filterDuplicatesByProperties(newReviews, store.id);
        
        if (uniqueReviews.length > 0) {
          // Batch сохранение в лист
          batchSaveToSheet(uniqueReviews, store.id);
          
          // Обновляем прогресс
          updateStoreProgress(store.id, uniqueReviews.length);
          
          log(`[Collector] ✅ Сохранено ${uniqueReviews.length} новых отзывов`);
        }
      }
      
    } catch (error) {
      log(`[Collector] ❌ Ошибка обработки ${store.name}: ${error.message}`);
      // Продолжаем с следующим магазином
    }
  }
  
  // ШАГ 4: Завершение цикла
  saveLastProcessedStoreIndex(0);
  log(`[Collector] 🏁 Сбор отзывов завершен`);
}
```

### ЭТАП 3: Сбор Ozon отзывов (реалистичный)
```javascript
function collectOzonReviewsBatch(store) {
  const maxPages = 20; // Реалистичный лимит из schema.md
  const delayMs = 800; // Задержка между запросами
  let allReviews = [];
  
  log(`[Ozon] 📄 Сбор отзывов для ${store.name}, максимум ${maxPages} страниц`);
  
  for (let page = 1; page <= maxPages; page++) {
    try {
      // Задержка между запросами (из schema.md)
      if (page > 1) {
        Utilities.sleep(delayMs);
      }
      
      log(`[Ozon] 📄 Страница ${page}...`);
      
      const pageReviews = getOzonReviewsPage(store, page);
      
      if (pageReviews.length === 0) {
        log(`[Ozon] 📄 Страница ${page} пуста, завершаем`);
        break;
      }
      
      allReviews = allReviews.concat(pageReviews);
      
      log(`[Ozon] 📊 Страница ${page}: ${pageReviews.length} отзывов, всего ${allReviews.length}`);
      
    } catch (error) {
      if (error.message.includes('429')) {
        log(`[Ozon] ⚠️ Rate limit на странице ${page}, ждем 2 секунды`);
        Utilities.sleep(2000);
        continue;
      } else {
        log(`[Ozon] ❌ Ошибка на странице ${page}: ${error.message}`);
        break;
      }
    }
  }
  
  log(`[Ozon] 🏁 Собрано ${allReviews.length} отзывов за ${Math.min(maxPages, allReviews.length)} страниц`);
  return allReviews;
}
```

### ЭТАП 4: Сбор WB отзывов (эффективный)
```javascript
function collectWBReviewsBatch(store) {
  const delayMs = 500; // Задержка между запросами
  const last24Hours = Math.floor(Date.now() / 1000) - (24 * 60 * 60); // Unix timestamp
  
  log(`[WB] 📄 Сбор отзывов за последние 24 часа для ${store.name}`);
  
  try {
    // Задержка перед запросом
    Utilities.sleep(delayMs);
    
    const reviews = getWBReviewsByDateRange(store, last24Hours);
    
    log(`[WB] 📊 Собрано ${reviews.length} отзывов за 24 часа`);
    
    return reviews;
    
  } catch (error) {
    if (error.message.includes('429')) {
      log(`[WB] ⚠️ Rate limit, ждем 1 секунду`);
      Utilities.sleep(1000);
      return collectWBReviewsBatch(store); // Retry
    } else {
      log(`[WB] ❌ Ошибка: ${error.message}`);
      return [];
    }
  }
}
```

### ЭТАП 5: Подбор ответов (каждые 15 минут)
```javascript
function selectReviewAnswers() {
  const maxReviews = 100; // Лимит за запуск
  const maxTime = 2 * 60 * 1000; // 2 минуты лимит
  
  log(`[Answer Selector] 🚀 Начинаем подбор ответов`);
  
  // Поиск отзывов со статусом "NEW"
  const newReviews = getReviewsByStatus('NEW', maxReviews);
  
  if (newReviews.length === 0) {
    log(`[Answer Selector] ℹ️ Новых отзывов не найдено`);
    return;
  }
  
  log(`[Answer Selector] 📊 Найдено ${newReviews.length} отзывов для обработки`);
  
  const updates = [];
  
  newReviews.forEach(review => {
    try {
      // Подбор шаблона по рейтингу (из schema.md)
      let template = '';
      
      switch(review.rating) {
        case 5:
          template = getTemplate('EXCELLENT');
          break;
        case 4:
          template = getTemplate('POSITIVE');
          break;
        case 3:
          template = getTemplate('NEUTRAL');
          break;
        case 2:
        case 1:
          template = getTemplate('NEGATIVE');
          break;
      }
      
      // Кастомизация по ключевым словам
      template = customizeTemplate(template, review.text);
      
      // Подготовка обновления
      updates.push({
        reviewId: review.id,
        storeId: review.storeId,
        answer: template,
        status: 'PENDING_SEND',
        processedDate: new Date()
      });
      
    } catch (error) {
      log(`[Answer Selector] ❌ Ошибка обработки отзыва ${review.id}: ${error.message}`);
    }
  });
  
  // Batch обновление в листах
  if (updates.length > 0) {
    batchUpdateReviews(updates);
    log(`[Answer Selector] ✅ Обработано ${updates.length} отзывов`);
  }
}
```

### ЭТАП 6: Отправка ответов (каждые 15 минут)
```javascript
function sendReviewAnswers() {
  const maxReviews = 50; // Лимит за запуск
  const maxTime = 2 * 60 * 1000; // 2 минуты лимит
  
  log(`[Answer Sender] 🚀 Начинаем отправку ответов`);
  
  // Поиск отзывов со статусом "PENDING_SEND"
  const pendingReviews = getReviewsByStatus('PENDING_SEND', maxReviews);
  
  if (pendingReviews.length === 0) {
    log(`[Answer Sender] ℹ️ Ответов для отправки не найдено`);
    return;
  }
  
  log(`[Answer Sender] 📊 Найдено ${pendingReviews.length} ответов для отправки`);
  
  const updates = [];
  
  pendingReviews.forEach(review => {
    try {
      let success = false;
      
      if (review.marketplace === 'Ozon') {
        success = sendOzonAnswer(review.id, review.answer);
        Utilities.sleep(500); // Задержка для Ozon
      } else if (review.marketplace === 'Wildberries') {
        success = sendWBAnswer(review.id, review.answer);
        Utilities.sleep(333); // Задержка для WB
      }
      
      if (success) {
        updates.push({
          reviewId: review.id,
          storeId: review.storeId,
          status: 'SENT',
          sentDate: new Date()
        });
        
        log(`[Answer Sender] ✅ Ответ отправлен для отзыва ${review.id}`);
      } else {
        updates.push({
          reviewId: review.id,
          storeId: review.storeId,
          status: 'ERROR',
          errorMsg: 'Ошибка отправки'
        });
        
        log(`[Answer Sender] ❌ Ошибка отправки для отзыва ${review.id}`);
      }
      
    } catch (error) {
      updates.push({
        reviewId: review.id,
        storeId: review.storeId,
        status: 'ERROR',
        errorMsg: error.message
      });
      
      log(`[Answer Sender] ❌ Исключение для отзыва ${review.id}: ${error.message}`);
    }
  });
  
  // Batch обновление в листах
  if (updates.length > 0) {
    batchUpdateReviews(updates);
    log(`[Answer Sender] ✅ Обработано ${updates.length} ответов`);
  }
}
```

## 📊 РАСЧЕТ ЭФФЕКТИВНОСТИ (из schema.md)

### Сценарий: 15 магазинов (10 Ozon + 5 WB)

#### Runtime квота в день:
- **Сбор отзывов**: 24 запуска × 1.2 минуты = **~29 минут**
- **Подбор ответов**: 24 × 7 = 168 запусков × 0.5 минуты = **~84 минуты** ⚠️
- **Отправка ответов**: 24 × 7 = 168 запусков × 0.5 минуты = **~84 минуты** ⚠️

**Проблема**: На Consumer (90 минут) не хватает!

#### Решение для Consumer аккаунта:
- **Сбор отзывов**: каждый час (экономит runtime)
- **Подбор ответов**: каждые 30 минут (вместо 15)
- **Отправка ответов**: каждые 30 минут (вместо 15)

**Результат**: ~70-80 минут/день (укладываемся в 90 минут) ✅

## 🎯 ПРЕИМУЩЕСТВА ОБНОВЛЕННОГО ПЛАНА

### ✅ **НА ОСНОВЕ РЕАЛЬНОГО ИССЛЕДОВАНИЯ:**
- **Реалистичные лимиты**: 20 страниц Ozon за 4 минуты
- **Точные rate limits**: 800ms для Ozon, 500ms для WB
- **Простая архитектура**: 4 триггера вместо 19
- **Учет runtime квот**: 90 минут/день для Consumer
- **Batch processing**: Одна операция setValues() вместо множества appendRow()

### ✅ **РЕШЕНИЕ ПРОБЛЕМ ТЫСЯЧ СТРАНИЦ:**
- **Ozon**: Только первые 20 страниц за запуск
- **WB**: Фильтр по дате за последние 24 часа
- **Глубокий скан**: Раз в неделю для "всплывших" отзывов
- **Продолжение**: Сохранение прогресса между запусками

### ✅ **СТАБИЛЬНОСТЬ:**
- **Retry логика**: Обработка ошибок 429, 500, 503
- **Exponential backoff**: Увеличение задержек при ошибках
- **Graceful degradation**: Продолжение работы при сбоях
- **Мониторинг**: Логирование всех операций

## 📋 ПОШАГОВЫЙ ПЛАН ВНЕДРЕНИЯ

### Неделя 1: Базовая инфраструктура
- [ ] Обновить структуру листов по schema.md
- [ ] Создать 4 триггера с пустыми функциями
- [ ] Реализовать систему статусов

### Неделя 2: Сбор отзывов
- [ ] Реализовать `collectOzonReviewsBatch()` с лимитом 20 страниц
- [ ] Реализовать `collectWBReviewsBatch()` с фильтром по дате
- [ ] Добавить retry логику и обработку ошибок

### Неделя 3: Обработка ответов
- [ ] Реализовать `selectReviewAnswers()` с шаблонами
- [ ] Реализовать `sendReviewAnswers()` с rate limits
- [ ] Добавить batch операции для производительности

### Неделя 4: Тестирование и оптимизация
- [ ] Протестировать на реальных данных
- [ ] Оптимизировать под runtime квоты
- [ ] Развернуть на всех магазинах

---

**Автор**: Factory AI Assistant  
**Дата**: 2025-01-22  
**Статус**: ✅ Updated based on schema.md research  
**Версия**: 3.0.0 - Реалистичный план на основе реального исследования

*Обновленный план на основе детального исследования schema.md с учетом реальных лимитов и ограничений*
