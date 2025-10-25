// Исправленные функции без экранированных символов

/**
 * 🚀 НОВАЯ ФУНКЦИЯ: Промежуточное сохранение отзывов в таблицу
 * Предотвращает потерю данных при длительной обработке
 * @param {Array} reviewsBuffer - Буфер накопленных отзывов для сохранения
 * @param {Object} store - Конфигурация магазина
 * @param {boolean} forceFlush - Принудительное сохранение даже небольшого буфера
 * @returns {number} Количество сохраненных отзывов
 */
function saveReviewsBuffer(reviewsBuffer, store, forceFlush = false) {
  const MIN_BUFFER_SIZE = 20; // Минимальный размер буфера для сохранения
  
  if (reviewsBuffer.length === 0) {
    return 0;
  }
  
  if (!forceFlush && reviewsBuffer.length < MIN_BUFFER_SIZE) {
    log(`[${store.name}] 💾 Буфер содержит ${reviewsBuffer.length} отзывов (< ${MIN_BUFFER_SIZE}) - ждем накопления`);
    return 0;
  }
  
  try {
    const sheet = createOrGetSheet(`Отзывы (${store.name})`, CONFIG.HEADERS);
    const startRow = sheet.getLastRow() + 1;
    
    // Подготавливаем данные для сохранения
    const rowsToSave = reviewsBuffer.map((review, index) => [
      startRow + index - 1, // № строки
      review.id,
      new Date(review.createdDate),
      review.product?.id || 'Не указано',
      review.product?.name || 'Не указано',
      review.product?.url || '',
      review.rating,
      review.text,
      '', // Подобранный ответ (пока пустой)
      CONFIG.STATUS.NEW, // Статус
      '', // Детали ошибки
      '' // Время отправки
    ]);
    
    // Сохраняем в таблицу
    sheet.getRange(startRow, 1, rowsToSave.length, CONFIG.HEADERS.length).setValues(rowsToSave);
    
    // Обновляем порядковые номера
    updateRowNumbers(sheet);
    
    log(`[${store.name}] 💾 ПРОМЕЖУТОЧНОЕ СОХРАНЕНИЕ: ${reviewsBuffer.length} отзывов сохранено в строки ${startRow}-${startRow + rowsToSave.length - 1}`);
    
    // Очищаем буфер
    reviewsBuffer.length = 0;
    
    return rowsToSave.length;
  } catch (e) {
    log(`[${store.name}] ❌ ОШИБКА промежуточного сохранения: ${e.message}`);
    return 0;
  }
}

/**
 * 🚀 НОВАЯ ФУНКЦИЯ: Интеллектуальное управление буфером отзывов
 * Автоматически сохраняет буфер при достижении лимитов
 * @param {Array} reviewsBuffer - Буфер накопленных отзывов
 * @param {Array} newReviews - Новые отзывы для добавления в буфер
 * @param {Object} store - Конфигурация магазина
 * @param {number} pagesSinceLastSave - Количество страниц с последнего сохранения
 * @returns {Object} Статистика: {saved: число_сохраненных, bufferSize: размер_буфера}
 */
function manageReviewsBuffer(reviewsBuffer, newReviews, store, pagesSinceLastSave = 0) {
  const MAX_BUFFER_SIZE = 100; // Максимальный размер буфера
  const PAGES_SAVE_INTERVAL = 20; // Сохранять каждые 20 страниц
  
  // Добавляем новые отзывы в буфер
  if (newReviews && newReviews.length > 0) {
    reviewsBuffer.push(...newReviews);
  }
  
  let savedCount = 0;
  
  // Условия для автоматического сохранения:
  // 1. Буфер переполнен (≥100 отзывов)
  // 2. Прошло много страниц (≥20) с последнего сохранения
  const shouldSave = 
    reviewsBuffer.length >= MAX_BUFFER_SIZE || 
    pagesSinceLastSave >= PAGES_SAVE_INTERVAL;
  
  if (shouldSave) {
    const reason = reviewsBuffer.length >= MAX_BUFFER_SIZE ? 
      `буфер переполнен (${reviewsBuffer.length} ≥ ${MAX_BUFFER_SIZE})` :
      `прошло ${pagesSinceLastSave} страниц`;
    
    log(`[${store.name}] 🔄 АВТОСОХРАНЕНИЕ: ${reason}`);
    savedCount = saveReviewsBuffer(reviewsBuffer, store, true);
  }
  
  return {
    saved: savedCount,
    bufferSize: reviewsBuffer.length
  };
}
