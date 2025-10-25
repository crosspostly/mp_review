#!/bin/bash

# 🗑️ Скрипт для удаления устаревших удаленных веток
# Выполняйте ПОСЛЕ слияния PR cleanup/remove-outdated-content в main

echo "🗑️ Удаление устаревших удаленных веток..."
echo ""
echo "⚠️  ВНИМАНИЕ: Эти ветки будут удалены НАВСЕГДА!"
echo "Убедитесь, что все нужные изменения уже в main."
echo ""
read -p "Продолжить? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "Отменено."
    exit 1
fi

echo ""
echo "🔄 Начинаем удаление..."
echo ""

# Список веток для удаления
branches=(
    "cursor/develop-implementation-plan-d6a3"
    "cursor/fix-wb-api-and-ozon-trigger-errors-f88b"
    "cursor/investigate-missing-google-sheets-menu-3a89"
    "cursor/update-and-compare-script-files-and-documentation-490b"
    "working"
)

# Счетчики
deleted=0
failed=0

# Удаляем каждую ветку
for branch in "${branches[@]}"
do
    echo "🗑️  Удаление ветки: $branch"
    if git push origin --delete "$branch" 2>&1; then
        echo "   ✅ Удалена: $branch"
        ((deleted++))
    else
        echo "   ❌ Ошибка при удалении: $branch"
        ((failed++))
    fi
    echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Итоги:"
echo "   ✅ Удалено: $deleted веток"
if [ $failed -gt 0 ]; then
    echo "   ❌ Ошибок: $failed"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $deleted -eq ${#branches[@]} ]; then
    echo "🎉 Все ветки успешно удалены!"
else
    echo "⚠️  Некоторые ветки не удалены. Проверьте ошибки выше."
fi

echo ""
echo "🔄 Обновление локального репозитория..."
git fetch --prune

echo ""
echo "✅ Готово!"
