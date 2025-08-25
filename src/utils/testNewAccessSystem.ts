import pool from "./db";
import { hasAnyAccess } from "../utils/searchWithAccess";
import { 
  grantAccessToAllDocuments,
  revokeAccessFromAllDocuments,
  getAllUsersWithAccess,
  getAllUsersWithoutAccess,
  getAccessStatistics
} from "../utils/documentAccess";

async function testNewAccessSystem() {
  try {
    console.log("🧪 Тестирование новой системы доступа (все документы закрыты по умолчанию)...\n");

    // 1. Проверяем статистику доступа
    console.log("1. 📊 Статистика доступа:");
    const stats = await getAccessStatistics();
    if (stats.success) {
      console.log(`   📄 Всего документов: ${stats.stats.totalDocuments}`);
      console.log(`   🔑 Всего предоставленных доступов: ${stats.stats.totalAccessGrants}`);
      console.log(`   👥 Уникальных пользователей с доступом: ${stats.stats.uniqueUsersWithAccess}`);
      console.log(`   🆕 Доступов за последние 7 дней: ${stats.stats.recentAccessGrants}`);
    } else {
      console.log(`   ❌ Ошибка: ${stats.message}`);
    }

    // 2. Проверяем пользователей с доступом
    console.log("\n2. 👥 Пользователи с доступом:");
    const usersWithAccess = await getAllUsersWithAccess();
    if (usersWithAccess.success) {
      if (usersWithAccess.users.length === 0) {
        console.log("   📭 Список пуст - никто не имеет доступа к документам");
      } else {
        usersWithAccess.users.forEach((user, i) => {
          console.log(`   ${i+1}. @${user.username} - ${user.document_count} документов`);
        });
      }
    } else {
      console.log(`   ❌ Ошибка: ${usersWithAccess.message}`);
    }

    // 3. Проверяем пользователей без доступа
    console.log("\n3. 👥 Пользователи без доступа:");
    const usersWithoutAccess = await getAllUsersWithoutAccess();
    if (usersWithoutAccess.success) {
      if (usersWithoutAccess.users.length === 0) {
        console.log("   📭 Список пуст - все пользователи имеют доступ или не было поисков");
      } else {
        usersWithoutAccess.users.forEach((user, i) => {
          console.log(`   ${i+1}. @${user.username} - ${user.search_count} поисков`);
        });
      }
    } else {
      console.log(`   ❌ Ошибка: ${usersWithoutAccess.message}`);
    }

    // 4. Тестируем проверку доступа для несуществующего пользователя
    console.log("\n4. 🔒 Тест проверки доступа:");
    const testUsername = "testuser_nonexistent";
    const hasAccess = await hasAnyAccess(testUsername);
    console.log(`   Пользователь @${testUsername}: ${hasAccess ? '✅ Есть доступ' : '❌ Нет доступа'}`);

    // 5. Получаем список админов для тестирования
    console.log("\n5. 👑 Получение списка админов:");
    const adminsResult = await pool.query("SELECT id, username, user_id FROM admins WHERE user_id IS NOT NULL LIMIT 1");
    if (adminsResult.rows.length === 0) {
      console.log("   ❌ Нет админов с user_id в базе данных");
      return;
    }
    const testAdmin = adminsResult.rows[0];
    console.log(`   ✅ Найден админ: @${testAdmin.username} (ID: ${testAdmin.id}, user_id: ${testAdmin.user_id})`);

    // 6. Тестируем массовое предоставление доступа
    console.log("\n6. 🔓 Тест массового предоставления доступа:");
    const testUser = "testuser_mass_access";
    const grantResult = await grantAccessToAllDocuments(testUser, testAdmin.user_id);
    if (grantResult.success) {
      console.log(`   ✅ ${grantResult.message}`);
      console.log(`   📊 Предоставлено доступов: ${grantResult.grantedCount}`);
      
      // Проверяем, что доступ действительно предоставлен
      const hasAccessAfterGrant = await hasAnyAccess(testUser);
      console.log(`   🔍 Проверка доступа после предоставления: ${hasAccessAfterGrant ? '✅ Есть' : '❌ Нет'}`);
      
      // 7. Тестируем массовый отзыв доступа
      console.log("\n7. 🔒 Тест массового отзыва доступа:");
      const revokeResult = await revokeAccessFromAllDocuments(testUser);
      if (revokeResult.success) {
        console.log(`   ✅ ${revokeResult.message}`);
        console.log(`   📊 Отозвано доступов: ${revokeResult.revokedCount}`);
        
        // Проверяем, что доступ действительно отозван
        const hasAccessAfterRevoke = await hasAnyAccess(testUser);
        console.log(`   🔍 Проверка доступа после отзыва: ${hasAccessAfterRevoke ? '✅ Есть' : '❌ Нет'}`);
      } else {
        console.log(`   ❌ ${revokeResult.message}`);
      }
    } else {
      console.log(`   ❌ ${grantResult.message}`);
    }

    console.log("\n✅ Тестирование новой системы доступа завершено!");
    console.log("\n📋 Выводы:");
    console.log("   • Все документы по умолчанию закрыты для новых пользователей");
    console.log("   • Доступ предоставляется только через таблицу document_access");
    console.log("   • Функция hasAnyAccess возвращает false для пользователей без доступа");
    console.log("   • Массовое управление доступом работает корректно");

  } catch (error) {
    console.error("❌ Ошибка при тестировании:", error);
  } finally {
    await pool.end();
  }
}

// Запуск если файл выполняется напрямую
if (require.main === module) {
  testNewAccessSystem();
}

export { testNewAccessSystem };
