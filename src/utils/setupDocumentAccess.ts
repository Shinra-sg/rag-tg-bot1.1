import pool from "./db";
import fs from "fs";
import path from "path";

async function setupDocumentAccess() {
  try {
    console.log("🔧 Настройка системы разграничения доступа к документам...");
    
    // Проверяем, существует ли таблица
    const checkResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'document_access'
    `);
    
    if (checkResult.rows.length > 0) {
      console.log("✅ Таблица document_access уже существует");
      
      // Проверяем представление
      const viewResult = await pool.query(`
        SELECT table_name 
        FROM information_schema.views 
        WHERE table_schema = 'public' 
        AND table_name = 'document_access_view'
      `);
      
      if (viewResult.rows.length > 0) {
        console.log("✅ Представление document_access_view уже существует");
      } else {
        console.log("⚠️ Представление document_access_view не найдено, создаем...");
        // Создаем только представление
        const viewSql = `
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
        `;
        await pool.query(viewSql);
        console.log("✅ Представление document_access_view создано");
      }
      return;
    }
    
    // Читаем SQL файл
    const sqlPath = path.join(__dirname, "create_document_access.sql");
    const sqlContent = fs.readFileSync(sqlPath, "utf-8");
    
    // Выполняем SQL команды
    await pool.query(sqlContent);
    
    console.log("✅ Таблица document_access создана успешно!");
    console.log("✅ Индексы созданы успешно!");
    console.log("✅ Представление document_access_view создано успешно!");
    
    console.log("\n🎉 Система разграничения доступа настроена успешно!");
    console.log("📋 Теперь вы можете:");
    console.log("   - Предоставлять доступ к документам по username");
    console.log("   - Отзывать доступ к документам");
    console.log("   - Просматривать список пользователей с доступом");
    console.log("   - Основной бот будет проверять доступ перед показом документов");
    
  } catch (error) {
    console.error("❌ Ошибка при настройке системы доступа:", error);
  }
}

// Запуск если файл выполняется напрямую
if (require.main === module) {
  setupDocumentAccess();
}

export default setupDocumentAccess; 