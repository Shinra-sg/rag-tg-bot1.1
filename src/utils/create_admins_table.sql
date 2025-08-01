-- Создание таблицы для хранения администраторов
CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    user_id BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Создание индекса для быстрого поиска по user_id
CREATE INDEX IF NOT EXISTS idx_admins_user_id ON admins(user_id);

-- Создание индекса для быстрого поиска по username
CREATE INDEX IF NOT EXISTS idx_admins_username ON admins(username);

-- Добавление комментария к таблице
COMMENT ON TABLE admins IS 'Таблица для хранения администраторов бота';
COMMENT ON COLUMN admins.username IS 'Username администратора в Telegram';
COMMENT ON COLUMN admins.user_id IS 'ID пользователя в Telegram (может быть null если пользователь еще не заходил в бота)';
COMMENT ON COLUMN admins.created_at IS 'Дата и время добавления администратора';
COMMENT ON COLUMN admins.updated_at IS 'Дата и время последнего обновления записи'; 