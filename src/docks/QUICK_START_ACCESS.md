# Быстрый старт: Система разграничения доступа

## 🚀 Быстрая настройка (5 минут)

### 1. Настройка базы данных
```bash
# Автоматическая настройка (рекомендуется)
./setup_access_permissions.sh

# Или ручная настройка:
# Создание таблиц (выполняется под пользователем shinra)
psql -U shinra -d ragbot -f src/utils/create_document_access.sql

# Предоставление прав пользователю ragbot
psql -U shinra -d ragbot -c "GRANT ALL PRIVILEGES ON TABLE document_access TO ragbot;"
psql -U shinra -d ragbot -c "GRANT ALL PRIVILEGES ON document_access_view TO ragbot;"
psql -U shinra -d ragbot -c "GRANT USAGE, SELECT ON SEQUENCE document_access_id_seq TO ragbot;"
psql -U shinra -d ragbot -c "GRANT ALL PRIVILEGES ON TABLE admins TO ragbot;"
psql -U shinra -d ragbot -c "GRANT USAGE, SELECT ON SEQUENCE admins_id_seq TO ragbot;"
```

### 2. Тестирование системы
```bash
npm run test:access
```

### 3. Запуск системы
```bash
npm run start:all:clean
```

## 📱 Использование

### Для администраторов

1. **Откройте админ бота** в Telegram
2. **Выберите "Управление доступом"**
3. **Предоставьте доступ**:
   - "Предоставить доступ" → Выберите документ → Введите username
4. **Проверьте доступ**:
   - "Список доступа" → Выберите документ → Просмотрите список

### Для пользователей

1. **Убедитесь, что у вас есть username** в Telegram
2. **Обратитесь к администратору** для получения доступа
3. **Используйте основной бот** - система автоматически проверит ваш доступ

## 🔧 Основные команды

```bash
# Настройка системы доступа
npm run setup:access

# Тестирование системы
npm run test:access

# Запуск админ бота
npm run start:admin

# Запуск основного бота
npm run start:bot

# Полный запуск системы
npm run start:all:clean
```

## ⚠️ Важные моменты

- **Username обязателен**: Пользователи без username не смогут получить доступ
- **Администраторы**: Должны быть добавлены в систему через админ бота
- **Документы**: Требуют явного предоставления доступа
- **Безопасность**: Все действия логируются и аудируются

## 🆘 Поддержка

- **Проблемы с доступом**: Проверьте, предоставлен ли доступ через админ бота
- **Ошибки в логах**: Запустите `npm run test:access` для диагностики
- **Вопросы**: Обратитесь к полной документации `DOCUMENT_ACCESS_SYSTEM.md` 