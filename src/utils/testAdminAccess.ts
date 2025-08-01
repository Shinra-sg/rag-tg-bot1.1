import pool from "./db";

// Импортируем функции из adminBot.ts
async function testAdminAccess() {
  try {
    console.log("🧪 Тестирование функции isAdminFromDB...\n");

    // Тест 1: Проверка админа из admin_ids.json
    console.log("1. Тест админа из admin_ids.json...");
    const adminIds = require("../admin-bot/admin_ids.json");
    const testAdminId = adminIds[0]; // Берем первый ID из списка
    
    const mockCtx1 = {
      from: { id: testAdminId, username: "test_admin_from_json" }
    };
    
    const result1 = await isAdminFromDB(mockCtx1 as any);
    console.log(`   ID ${testAdminId}: ${result1 ? "✅ Доступ разрешен" : "❌ Доступ запрещен"}`);
    
    // Тест 2: Проверка админа из базы данных
    console.log("\n2. Тест админа из базы данных...");
    const adminsResult = await pool.query("SELECT username FROM admins LIMIT 1");
    if (adminsResult.rows.length > 0) {
      const testUsername = adminsResult.rows[0].username;
      console.log(`   Проверяем username: @${testUsername}`);
      
      // Сначала проверим, что админ есть в базе
      const adminInDb = await isAdminInDB(12345); // Тестовый ID
      console.log(`   Админ в БД с ID 12345: ${adminInDb ? "✅ Есть" : "❌ Нет"}`);
      
      // Теперь проверим через функцию isAdminFromDB
      const mockCtx2 = {
        from: { id: 12345, username: testUsername }
      };
      
      const result2 = await isAdminFromDB(mockCtx2 as any);
      console.log(`   Результат isAdminFromDB: ${result2 ? "✅ Доступ разрешен" : "❌ Доступ запрещен"}`);
    } else {
      console.log("   ❌ Нет админов в базе данных для тестирования");
    }
    
    // Тест 3: Проверка несуществующего пользователя
    console.log("\n3. Тест несуществующего пользователя...");
    const mockCtx3 = {
      from: { id: 999999, username: "non_existent_user" }
    };
    
    const result3 = await isAdminFromDB(mockCtx3 as any);
    console.log(`   Несуществующий пользователь: ${result3 ? "❌ Доступ разрешен (неправильно)" : "✅ Доступ запрещен (правильно)"}`);
    
    // Тест 4: Проверка без ctx.from
    console.log("\n4. Тест без ctx.from...");
    const mockCtx4 = {
      from: null
    };
    
    const result4 = await isAdminFromDB(mockCtx4 as any);
    console.log(`   Без ctx.from: ${result4 ? "❌ Доступ разрешен (неправильно)" : "✅ Доступ запрещен (правильно)"}`);
    
    console.log("\n✅ Все тесты завершены!");
    
  } catch (error) {
    console.error("❌ Ошибка при тестировании:", error);
  } finally {
    await pool.end();
  }
}

// Функции из adminBot.ts
async function isAdminInDB(userId: number): Promise<boolean> {
  try {
    const res = await pool.query("SELECT id FROM admins WHERE user_id = $1", [userId]);
    return res.rows.length > 0;
  } catch (e) {
    console.error("Ошибка проверки админа в БД:", e);
    return false;
  }
}

async function isAdminFromDB(ctx: any): Promise<boolean> {
  if (!ctx.from) return false;
  
  // Сначала проверяем старый способ (для обратной совместимости)
  const adminIds = require("../admin-bot/admin_ids.json");
  if (adminIds.includes(ctx.from.id)) return true;
  
  // Затем проверяем через БД
  return await isAdminInDB(ctx.from.id);
}

// Запускаем тесты
testAdminAccess(); 