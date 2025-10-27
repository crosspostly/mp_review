# 🚀 Настройка автодеплоя в Google Apps Script через clasp

## ✅ Что уже настроено

Все файлы конфигурации созданы и готовы к работе:

- ✅ `.clasp.json` - конфигурация проекта с вашим Script ID
- ✅ `.claspignore` - список игнорируемых файлов
- ✅ `appsscript.json` - манифест Apps Script
- ✅ `.github/workflows/deploy-gas.yml` - workflow автодеплоя

## 🔑 Что нужно сделать ВАМ

### Шаг 1: Получить OAuth токен clasp

**На своем компьютере:**

1. Установите clasp глобально (если еще не установлен):
   ```bash
   npm install -g @google/clasp
   ```

2. Авторизуйтесь в clasp:
   ```bash
   clasp login
   ```
   
   Это откроет браузер для авторизации Google. Войдите под своим аккаунтом.

3. После успешной авторизации, найдите файл `.clasprc.json`:
   - **Mac/Linux**: `~/.clasprc.json`
   - **Windows**: `%USERPROFILE%\.clasprc.json`

4. Скопируйте **ВСЁ содержимое** этого файла

### Шаг 2: Добавить секрет CLASP_CREDENTIALS в GitHub

1. Откройте ваш репозиторий на GitHub: https://github.com/crosspostly/mp_review

2. Перейдите в **Settings** (⚙️ справа вверху)

3. В левом меню выберите **Secrets and variables** → **Actions**

4. Нажмите **New repository secret**

5. Заполните:
   - **Name**: `CLASP_CREDENTIALS`
   - **Value**: Вставьте содержимое файла `.clasprc.json` которое вы скопировали
   
   Пример содержимого `.clasprc.json`:
   ```json
   {
     "token": {
       "access_token": "ya29.a0AfB_by...",
       "refresh_token": "1//09...",
       "scope": "https://www.googleapis.com/auth/...",
       "token_type": "Bearer",
       "expiry_date": 1234567890000
     },
     "oauth2ClientSettings": {
       "clientId": "1072944905499-vm2v2i5dvn0a0d2o4ca36i1vge8cvbn0.apps.googleusercontent.com",
       "clientSecret": "v6V3fKV_zWU7iw1DrzzqOjh7",
       "redirectUri": "http://localhost"
     },
     "isLocalCreds": false
   }
   ```

6. Нажмите **Add secret**

**Вот и всё!** 🎉 После этого шага автодеплой заработает автоматически!

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
