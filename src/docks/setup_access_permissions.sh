#!/bin/bash

echo "🔧 Настройка системы разграничения доступа к документам..."

# Создание таблиц
echo "📋 Создание таблиц..."
psql -U shinra -d ragbot -f src/utils/create_document_access.sql

# Предоставление прав пользователю ragbot
echo "🔐 Предоставление прав пользователю ragbot..."
psql -U shinra -d ragbot -c "GRANT ALL PRIVILEGES ON TABLE document_access TO ragbot;"
psql -U shinra -d ragbot -c "GRANT ALL PRIVILEGES ON document_access_view TO ragbot;"
psql -U shinra -d ragbot -c "GRANT USAGE, SELECT ON SEQUENCE document_access_id_seq TO ragbot;"
psql -U shinra -d ragbot -c "GRANT ALL PRIVILEGES ON TABLE admins TO ragbot;"
psql -U shinra -d ragbot -c "GRANT USAGE, SELECT ON SEQUENCE admins_id_seq TO ragbot;"
psql -U shinra -d ragbot -c "GRANT ALL PRIVILEGES ON TABLE admin_logs TO ragbot;"
psql -U shinra -d ragbot -c "GRANT USAGE, SELECT ON SEQUENCE admin_logs_id_seq TO ragbot;"

echo "✅ Настройка завершена успешно!"
echo "🧪 Запустите тест: npm run test:access" 