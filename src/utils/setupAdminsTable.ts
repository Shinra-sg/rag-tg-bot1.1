import pool from "./db";
import fs from "fs";
import path from "path";

async function setupAdminsTable() {
  try {
    console.log("Создание таблицы admins...");
    
    // Читаем SQL файл
    const sqlPath = path.join(__dirname, "create_admins_table.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");
    
    // Выполняем SQL
    await pool.query(sql);
    
    console.log("✅ Таблица admins успешно создана!");
    
    // Проверяем, что таблица создана
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'admins'
    `);
    
    if (result.rows.length > 0) {
      console.log("✅ Таблица admins существует в базе данных");
    } else {
      console.log("❌ Таблица admins не найдена в базе данных");
    }
    
  } catch (error) {
    console.error("❌ Ошибка при создании таблицы admins:", error);
  } finally {
    await pool.end();
  }
}

// Запускаем скрипт
setupAdminsTable(); 