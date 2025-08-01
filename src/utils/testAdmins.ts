import pool from "./db";

// Импортируем функции из adminBot.ts
async function testAdminFunctions() {
  try {
    console.log("🧪 Тестирование функций управления админами...\n");

    // Тест 1: Добавление админа
    console.log("1. Тест добавления админа...");
    const addResult = await addAdminByUsername("test_admin");
    console.log("Результат:", addResult);
    
    // Тест 2: Попытка добавить того же админа (должна вернуть ошибку)
    console.log("\n2. Тест добавления дубликата...");
    const addDuplicateResult = await addAdminByUsername("test_admin");
    console.log("Результат:", addDuplicateResult);
    
    // Тест 3: Список админов
    console.log("\n3. Тест получения списка админов...");
    const listResult = await listAdmins();
    console.log("Результат:", listResult);
    
    // Тест 4: Удаление админа
    console.log("\n4. Тест удаления админа...");
    const removeResult = await removeAdminByUsername("test_admin");
    console.log("Результат:", removeResult);
    
    // Тест 5: Попытка удалить несуществующего админа
    console.log("\n5. Тест удаления несуществующего админа...");
    const removeNonExistentResult = await removeAdminByUsername("non_existent_admin");
    console.log("Результат:", removeNonExistentResult);
    
    // Тест 6: Финальный список админов
    console.log("\n6. Финальный список админов...");
    const finalListResult = await listAdmins();
    console.log("Результат:", finalListResult);
    
    console.log("\n✅ Все тесты завершены!");
    
  } catch (error) {
    console.error("❌ Ошибка при тестировании:", error);
  } finally {
    await pool.end();
  }
}

// Функции для работы с админами (скопированы из adminBot.ts)
async function addAdminByUsername(username: string): Promise<{ success: boolean; message: string }> {
  try {
    const cleanUsername = username.startsWith('@') ? username.slice(1) : username;
    if (!cleanUsername) {
      return { success: false, message: "Username не может быть пустым" };
    }

    const existingRes = await pool.query("SELECT id FROM admins WHERE username = $1", [cleanUsername]);
    if (existingRes.rows.length > 0) {
      return { success: false, message: `Админ с username @${cleanUsername} уже существует` };
    }

    await pool.query("INSERT INTO admins (username, user_id) VALUES ($1, $2)", [cleanUsername, null]);
    return { success: true, message: `Админ @${cleanUsername} успешно добавлен` };
  } catch (e) {
    console.error("Ошибка добавления админа:", e);
    return { success: false, message: "Ошибка при добавлении админа" };
  }
}

async function removeAdminByUsername(username: string): Promise<{ success: boolean; message: string }> {
  try {
    const cleanUsername = username.startsWith('@') ? username.slice(1) : username;
    if (!cleanUsername) {
      return { success: false, message: "Username не может быть пустым" };
    }

    const res = await pool.query("DELETE FROM admins WHERE username = $1 RETURNING id", [cleanUsername]);
    if (res.rows.length === 0) {
      return { success: false, message: `Админ с username @${cleanUsername} не найден` };
    }

    return { success: true, message: `Админ @${cleanUsername} успешно удален` };
  } catch (e) {
    console.error("Ошибка удаления админа:", e);
    return { success: false, message: "Ошибка при удалении админа" };
  }
}

async function listAdmins(): Promise<{ success: boolean; admins: any[]; message?: string }> {
  try {
    const res = await pool.query("SELECT username, user_id, created_at FROM admins ORDER BY created_at DESC");
    return { success: true, admins: res.rows };
  } catch (e) {
    console.error("Ошибка получения списка админов:", e);
    return { success: false, admins: [], message: "Ошибка при получении списка админов" };
  }
}

// Запускаем тесты
testAdminFunctions(); 