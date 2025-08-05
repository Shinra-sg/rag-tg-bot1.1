# Устранение неполадок

## 🔴 Ошибка: "Conflict: terminated by other getUpdates request"

### Описание
```
TelegramError: 409: Conflict: terminated by other getUpdates request; make sure that only one bot instance is running
```

### Причина
Несколько экземпляров бота с одним токеном пытаются получать обновления одновременно.

### Решение
```bash
# 1. Остановка всех процессов
npm run stop:all
pkill -f "rag-telegram-bot"

# 2. Проверка процессов
ps aux | grep -E "(ts-node|node)" | grep -E "(index|bot)" | grep -v grep

# 3. Перезапуск
npm run start:bot      # Основной бот
npm run start:admin    # Админ бот
```

## 🔴 Ошибка: "permission denied for table admin_logs"

### Описание
```
error: permission denied for table admin_logs
```

### Причина
Пользователь `ragbot` не имеет прав на таблицу `admin_logs`.

### Решение
```bash
# Предоставление прав
psql -U shinra -d ragbot -c "GRANT ALL PRIVILEGES ON TABLE admin_logs TO ragbot;"
psql -U shinra -d ragbot -c "GRANT USAGE, SELECT ON SEQUENCE admin_logs_id_seq TO ragbot;"

# Или автоматическая настройка
./setup_access_permissions.sh
```

## 🔴 Ошибка: "Администратор не найден"

### Описание
При попытке предоставить доступ система отвечает "Администратор не найден".

### Причина
1. Пользователь не добавлен в таблицу `admins`
2. Неправильная проверка ID в функции `grantDocumentAccess`

### Решение
```bash
# 1. Проверка админов в БД
psql -U shinra -d ragbot -c "SELECT * FROM admins;"

# 2. Добавление пользователя (если отсутствует)
psql -U shinra -d ragbot -c "INSERT INTO admins (username, user_id) VALUES ('username', user_id);"

# 3. Тестирование системы
npm run test:access
```

## 🔴 Ошибка: "BOT_TOKEN is not defined"

### Описание
```
BOT_TOKEN is not defined in .env
```

### Причина
Отсутствует или неправильно настроен файл `.env`.

### Решение
```bash
# 1. Проверка .env файла
cat .env | grep BOT_TOKEN

# 2. Убедитесь, что токены указаны
BOT_TOKEN=your_bot_token_here
ADMIN_BOT_TOKEN=your_admin_bot_token_here

# 3. Перезапуск
npm run stop:all
npm run start:bot
```

## 🔴 Ошибка: "Connection to database failed"

### Описание
```
Connection to database failed
```

### Причина
PostgreSQL не запущен или неправильные параметры подключения.

### Решение
```bash
# 1. Запуск PostgreSQL
brew services start postgresql@14

# 2. Проверка статуса
brew services list | grep postgresql

# 3. Тест подключения
npm run test:db
```

## 📋 Полезные команды

### Диагностика
```bash
# Проверка процессов
ps aux | grep -E "(ts-node|node)" | grep -E "(index|bot)" | grep -v grep

# Проверка базы данных
npm run test:db

# Проверка системы доступа
npm run test:access

# Проверка таблиц
psql -U shinra -d ragbot -c "\dt+"
```

### Перезапуск
```bash
# Полная остановка
npm run stop:all

# Запуск по отдельности
npm run start:bot      # Основной бот
npm run start:admin    # Админ бот

# Полный запуск (если работает)
npm run start:all:clean
```

### Настройка прав
```bash
# Автоматическая настройка всех прав
./setup_access_permissions.sh

# Ручная настройка
psql -U shinra -d ragbot -c "GRANT ALL PRIVILEGES ON TABLE document_access TO ragbot;"
psql -U shinra -d ragbot -c "GRANT ALL PRIVILEGES ON TABLE admins TO ragbot;"
psql -U shinra -d ragbot -c "GRANT ALL PRIVILEGES ON TABLE admin_logs TO ragbot;"
```

## 🆘 Если ничего не помогает

1. **Перезагрузите систему**
2. **Проверьте все токены** в `.env`
3. **Пересоздайте ботов** в Telegram BotFather
4. **Проверьте права пользователя** `ragbot` на все таблицы
5. **Запустите тесты** для диагностики

## 📊 Статус системы

### Проверка работоспособности
```bash
# Все тесты должны проходить
npm run test:access
npm run test:db

# Боты должны быть запущены
ps aux | grep -E "ts-node.*(index|admin)" | grep -v grep
```

### Ожидаемый вывод
- ✅ Таблица document_access существует
- ✅ Найдено X документов
- ✅ Найдено X админов
- ✅ Все тесты завершены успешно
- ✅ 2 процесса ts-node (основной бот + админ бот) 