# 🚀 Настройка автодеплоя в Google Apps Script через clasp

## ✅ Что уже настроено

Все файлы конфигурации созданы и готовы к работе:

- ✅ `.clasp.json` - конфигурация проекта с вашим Script ID
- ✅ `.claspignore` - список игнорируемых файлов
- ✅ `appsscript.json` - манифест Apps Script
- ✅ `.github/workflows/deploy-gas.yml` - workflow автодеплоя

## 🔑 Что нужно сделать ВАМ

### Шаг 1: Добавить секрет CLASP_CREDENTIALS в GitHub

1. Откройте ваш репозиторий на GitHub: https://github.com/crosspostly/mp_review

2. Перейдите в **Settings** (⚙️ справа вверху)

3. В левом меню выберите **Secrets and variables** → **Actions**

4. Нажмите **New repository secret**

5. Заполните:
   - **Name**: `CLASP_CREDENTIALS`
   - **Value**: Вставьте ВЕСЬ JSON который вы получили для Service Account
   
   ```json
   {
     "type": "service_account",
     "project_id": "crosspostly",
     "private_key_id": "...",
     "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
     "client_email": "pusk-453@crosspostly.iam.gserviceaccount.com",
     ...
   }
   ```

6. Нажмите **Add secret**

### Шаг 2: Дать доступ Service Account к вашему Apps Script проекту

1. Откройте ваш Google Apps Script проект: https://script.google.com

2. Нажмите **⚙️ Project Settings** (слева внизу)

3. Прокрутите вниз до раздела **Google Cloud Platform (GCP) Project**

4. Нажмите **Change project**

5. Введите Project Number проекта `crosspostly` (найдите его в Google Cloud Console)

6. **ИЛИ** добавьте Service Account напрямую:
   - Откройте **Share** (справа вверху в Apps Script)
   - Добавьте email: `pusk-453@crosspostly.iam.gserviceaccount.com`
   - Права: **Editor**

### Шаг 3: Включить Google Apps Script API

1. Перейдите в Google Cloud Console: https://console.cloud.google.com

2. Выберите проект **crosspostly**

3. Перейдите в **APIs & Services** → **Library**

4. Найдите **Google Apps Script API**

5. Нажмите **ENABLE**

---

## 🎯 Как это работает

После настройки:

### Автоматический деплой
При каждом push в ветку `main` с изменениями в папке `refactor/`:
1. 🔄 GitHub Actions автоматически запустится
2. 📦 Установит clasp
3. 🔑 Авторизуется через Service Account
4. 📤 Загрузит код в Google Apps Script
5. ✅ Покажет статус в разделе Actions

### Ручной деплой
Вы можете запустить деплой вручную:
1. Откройте репозиторий на GitHub
2. Перейдите в **Actions**
3. Выберите **🚀 Deploy to Google Apps Script**
4. Нажмите **Run workflow**

---

## 📋 Что загружается

Из вашего репозитория в Apps Script загружается:
- ✅ Все файлы из папки `refactor/` (*.gs, *.html)
- ✅ `appsscript.json` (манифест)
- ❌ Документация, README, GitHub Actions (игнорируются)

---

## 🔍 Проверка работы

После того как вы добавите секрет `CLASP_CREDENTIALS`:

1. Смержите этот PR в main
2. Перейдите в **Actions** на GitHub
3. Дождитесь выполнения workflow **🚀 Deploy to Google Apps Script**
4. Проверьте ваш Apps Script проект - код должен обновиться!

---

## 🐛 Troubleshooting

### Ошибка: "User has not enabled the Apps Script API"
**Решение**: Включите Google Apps Script API в Google Cloud Console (см. Шаг 3)

### Ошибка: "Permission denied"
**Решение**: Дайте Service Account доступ Editor к вашему Apps Script проекту (см. Шаг 2)

### Ошибка: "Invalid credentials"
**Решение**: Проверьте, что в секрет `CLASP_CREDENTIALS` скопирован ВЕСЬ JSON без изменений

### Ошибка: "Project not found"
**Решение**: Убедитесь, что Script ID правильный в `.clasp.json`

---

## 📞 Поддержка

Если что-то не работает:
1. Проверьте логи в GitHub Actions
2. Убедитесь, что все три шага выше выполнены
3. Проверьте, что Service Account имеет доступ к проекту

---

## 🎉 Готово!

После настройки вы больше НЕ БУДЕТЕ копировать код вручную! 
Просто делайте push в main - и код автоматически загрузится в Google Apps Script! 🚀
