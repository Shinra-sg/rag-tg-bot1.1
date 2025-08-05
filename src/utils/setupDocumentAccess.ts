import pool from "./db";
import fs from "fs";
import path from "path";

async function setupDocumentAccess() {
  try {
    console.log("🔧 Настройка системы разграничения доступа к документам...");
    
    // Читаем SQL файл
    const sqlPath = path.join(__dirname, "create_document_access.sql");
    const sqlContent = fs.readFileSync(sqlPath, "utf-8");
    
    // Выполняем SQL команды
    await pool.query(sqlContent);
    
    console.log("✅ Таблица document_access создана успешно!");
    console.log("✅ Индексы созданы успешно!");
    console.log("✅ Представление document_access_view создано успешно!");
    
    // Проверяем, что таблица создана
    const checkResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'document_access'
    `);
    
    if (checkResult.rows.length > 0) {
      console.log("✅ Проверка: таблица document_access существует");
    } else {
      console.log("❌ Ошибка: таблица document_access не найдена");
    }
    
    // Проверяем представление
    const viewResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_schema = 'public' 
      AND table_name = 'document_access_view'
    `);
    
    if (viewResult.rows.length > 0) {
      console.log("✅ Проверка: представление document_access_view существует");
    } else {
      console.log("❌ Ошибка: представление document_access_view не найдено");
    }
    
    console.log("\n🎉 Система разграничения доступа настроена успешно!");
    console.log("📋 Теперь вы можете:");
    console.log("   - Предоставлять доступ к документам по username");
    console.log("   - Отзывать доступ к документам");
    console.log("   - Просматривать список пользователей с доступом");
    console.log("   - Основной бот будет проверять доступ перед показом документов");
    
  } catch (error) {
    console.error("❌ Ошибка при настройке системы доступа:", error);
  } finally {
    await pool.end();
  }
}

// Запуск если файл выполняется напрямую
if (require.main === module) {
  setupDocumentAccess();
}

export default setupDocumentAccess; 