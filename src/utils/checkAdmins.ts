import pool from "./db";

async function checkAdmins() {
  try {
    console.log("🔍 Проверка админов в базе данных...\n");
    
    // Проверяем таблицу admins
    const adminsResult = await pool.query("SELECT * FROM admins ORDER BY created_at DESC");
    console.log("Админы в таблице admins:");
    if (adminsResult.rows.length === 0) {
      console.log("  ❌ Таблица admins пуста");
    } else {
      adminsResult.rows.forEach((admin, i) => {
        console.log(`  ${i+1}. @${admin.username} (ID: ${admin.user_id || 'не заходил'}) - ${admin.created_at}`);
      });
    }
    
    // Проверяем admin_ids.json
    const adminIds = require("../admin-bot/admin_ids.json");
    console.log("\nАдмины в admin_ids.json:");
    if (adminIds.length === 0) {
      console.log("  ❌ admin_ids.json пуст");
    } else {
      adminIds.forEach((id: number, i: number) => {
        console.log(`  ${i+1}. ID: ${id}`);
      });
    }
    
    // Проверяем структуру таблицы
    console.log("\nСтруктура таблицы admins:");
    const structureResult = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'admins' 
      ORDER BY ordinal_position
    `);
    structureResult.rows.forEach((col: any) => {
      console.log(`  ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });
    
  } catch (error) {
    console.error("❌ Ошибка при проверке:", error);
  } finally {
    await pool.end();
  }
}

checkAdmins(); 