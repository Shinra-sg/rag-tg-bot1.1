import pool from "./db";
import fs from "fs";
import path from "path";

export async function setupAdminsTable() {
  try {
    console.log("Создание таблицы admins...");
    
    // Проверяем, существует ли таблица
    const checkResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'admins'
    `);
    
    if (checkResult.rows.length > 0) {
      console.log("✅ Таблица admins уже существует");
      return;
    }
    
    // Читаем SQL файл
    const sqlPath = path.join(__dirname, "create_admins_table.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");
    
    // Выполняем SQL
    await pool.query(sql);
    
    console.log("✅ Таблица admins успешно создана!");
    
  } catch (error) {
    console.error("❌ Ошибка при создании таблицы admins:", error);
  }
} 