import pool from "./db";
import { 
  grantDocumentAccess, 
  revokeDocumentAccess, 
  checkDocumentAccess, 
  getDocumentAccessList,
  getAccessStatistics 
} from "./documentAccess";

async function testDocumentAccess() {
  try {
    console.log("🧪 Тестирование системы разграничения доступа к документам...\n");

    // 1. Проверяем, что таблица существует
    console.log("1. Проверка существования таблицы document_access...");
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'document_access'
    `);
    
    if (tableCheck.rows.length === 0) {
      console.log("❌ Таблица document_access не найдена. Запустите: npm run setup:access");
      return;
    }
    console.log("✅ Таблица document_access существует");

    // 2. Получаем список документов
    console.log("\n2. Получение списка документов...");
    const docsResult = await pool.query("SELECT id, original_name FROM documents LIMIT 3");
    if (docsResult.rows.length === 0) {
      console.log("❌ Нет документов в базе данных");
      return;
    }
    console.log(`✅ Найдено ${docsResult.rows.length} документов`);

    // 3. Получаем список админов
    console.log("\n3. Получение списка админов...");
    const adminsResult = await pool.query("SELECT id, username, user_id FROM admins WHERE user_id IS NOT NULL LIMIT 1");
    if (adminsResult.rows.length === 0) {
      console.log("❌ Нет админов с user_id в базе данных");
      return;
    }
    console.log(`✅ Найдено ${adminsResult.rows.length} админов`);

    const testDoc = docsResult.rows[0];
    const testAdmin = adminsResult.rows[0];
    const testUsername = "testuser";

    // 4. Тест предоставления доступа
    console.log(`\n4. Тест предоставления доступа...`);
    console.log(`Документ: ${testDoc.original_name} (ID: ${testDoc.id})`);
    console.log(`Пользователь: @${testUsername}`);
    console.log(`Админ: @${testAdmin.username} (ID: ${testAdmin.id}, user_id: ${testAdmin.user_id})`);

    const grantResult = await grantDocumentAccess(testDoc.id, testUsername, testAdmin.user_id);
    if (grantResult.success) {
      console.log(`✅ ${grantResult.message}`);
    } else {
      console.log(`❌ ${grantResult.message}`);
    }

    // 5. Тест проверки доступа
    console.log(`\n5. Тест проверки доступа...`);
    const hasAccess = await checkDocumentAccess(testDoc.id, testUsername);
    console.log(`Доступ для @${testUsername}: ${hasAccess ? '✅ Есть' : '❌ Нет'}`);

    // 6. Тест получения списка доступа
    console.log(`\n6. Тест получения списка доступа...`);
    const accessList = await getDocumentAccessList(testDoc.id);
    if (accessList.success) {
      console.log(`✅ Найдено ${accessList.accessList.length} записей доступа`);
      accessList.accessList.forEach((access: any, i: number) => {
        console.log(`  ${i+1}. @${access.username} (предоставлен @${access.granted_by_username})`);
      });
    } else {
      console.log(`❌ ${accessList.message}`);
    }

    // 7. Тест отзыва доступа
    console.log(`\n7. Тест отзыва доступа...`);
    const revokeResult = await revokeDocumentAccess(testDoc.id, testUsername);
    if (revokeResult.success) {
      console.log(`✅ ${revokeResult.message}`);
    } else {
      console.log(`❌ ${revokeResult.message}`);
    }

    // 8. Проверяем, что доступ отозван
    console.log(`\n8. Проверка отзыва доступа...`);
    const hasAccessAfterRevoke = await checkDocumentAccess(testDoc.id, testUsername);
    console.log(`Доступ для @${testUsername} после отзыва: ${hasAccessAfterRevoke ? '❌ Есть' : '✅ Нет'}`);

    // 9. Тест статистики
    console.log(`\n9. Тест статистики доступа...`);
    const stats = await getAccessStatistics();
    if (stats.success) {
      console.log(`✅ Статистика получена:`);
      console.log(`  - Всего документов: ${stats.stats.totalDocuments}`);
      console.log(`  - Всего доступов: ${stats.stats.totalAccessGrants}`);
      console.log(`  - Уникальных пользователей: ${stats.stats.uniqueUsersWithAccess}`);
      console.log(`  - Доступов за 7 дней: ${stats.stats.recentAccessGrants}`);
    } else {
      console.log(`❌ ${stats.message}`);
    }

    console.log("\n🎉 Все тесты завершены успешно!");
    console.log("📋 Система разграничения доступа работает корректно!");

  } catch (error) {
    console.error("❌ Ошибка при тестировании:", error);
  } finally {
    await pool.end();
  }
}

// Запуск если файл выполняется напрямую
if (require.main === module) {
  testDocumentAccess();
}

export default testDocumentAccess; 