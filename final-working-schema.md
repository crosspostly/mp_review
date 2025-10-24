unction buildWbApiV1Url(includeAnswered, skip, take, dateFromStr = null) {
    const baseUrl = 'https://feedbacks-api.wildberries.ru/api/v1/feedbacks';
    const params = [
        `isAnswered=${includeAnswered}`,
        `take=${take}`,
        `skip=${skip}`,
        `order=dateDesc`
    ];
    
    // ✅ ИСПРАВЛЕНО: dateFrom должен быть Unix timestamp (секунды), НЕ строка!
    if (dateFromStr) {
        try {
            const dateObj = new Date(dateFromStr);
            const unixTimestamp = Math.floor(dateObj.getTime() / 1000); // Конвертируем в секунды
            params.push(`dateFrom=${unixTimestamp}`);
            log(`[WB V1] 📅 Добавлен фильтр dateFrom: ${dateFromStr} → Unix ${unixTimestamp}`);
        } catch (e) {
            log(`[WB V1] ⚠️ Не удалось преобразовать дату: ${dateFromStr}`);\n        }\n    }\n    \n    return `${baseUrl}?${params.join('&')}`;\n}
