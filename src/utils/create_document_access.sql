-- Создание таблицы для разграничения доступа к документам
CREATE TABLE IF NOT EXISTS document_access (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL,
    username VARCHAR(255) NOT NULL,
    granted_by INTEGER, -- ID админа, который выдал доступ (может быть NULL на начальном этапе)
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Ограничения
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    
    -- Уникальный индекс для предотвращения дублирования
    UNIQUE(document_id, username)
);

-- Создание индексов для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_document_access_document_id ON document_access(document_id);
CREATE INDEX IF NOT EXISTS idx_document_access_username ON document_access(username);
CREATE INDEX IF NOT EXISTS idx_document_access_active ON document_access(is_active);

-- Добавление комментариев
COMMENT ON TABLE document_access IS 'Таблица для разграничения доступа к документам по username';
COMMENT ON COLUMN document_access.document_id IS 'ID документа';
COMMENT ON COLUMN document_access.username IS 'Username пользователя, которому предоставлен доступ';
COMMENT ON COLUMN document_access.granted_by IS 'ID администратора, который выдал доступ';
COMMENT ON COLUMN document_access.granted_at IS 'Дата и время предоставления доступа';
COMMENT ON COLUMN document_access.is_active IS 'Активен ли доступ (можно отозвать)';

-- Создание представления для удобного просмотра доступа (без зависимости от admins)
CREATE OR REPLACE VIEW document_access_view AS
SELECT 
    da.id,
    da.document_id,
    d.original_name as document_name,
    da.username,
    da.granted_by,
    da.granted_at,
    da.is_active
FROM document_access da
JOIN documents d ON da.document_id = d.id
ORDER BY da.granted_at DESC; 