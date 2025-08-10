import pool from "./db";

/**
 * Очищает старые логи поиска (старше 30 дней)
 */
export async function cleanupOldSearchLogs(daysToKeep: number = 30): Promise<{
  success: boolean;
  deletedCount: number;
  message: string;
}> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await pool.query(
      `DELETE FROM search_logs 
       WHERE created_at < $1`,
      [cutoffDate]
    );

    const deletedCount = result.rowCount || 0;
    console.log(`🧹 Очищено ${deletedCount} старых записей поиска (старше ${daysToKeep} дней)`);

    return {
      success: true,
      deletedCount,
      message: `Очищено ${deletedCount} старых записей поиска`
    };
  } catch (error) {
    console.error("❌ Ошибка очистки старых логов:", error);
    return {
      success: false,
      deletedCount: 0,
      message: `Ошибка очистки: ${error}`
    };
  }
}

/**
 * Очищает старые записи истории поиска пользователей (старше 90 дней)
 */
export async function cleanupOldUserHistory(daysToKeep: number = 90): Promise<{
  success: boolean;
  deletedCount: number;
  message: string;
}> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await pool.query(
      `DELETE FROM user_search_history 
       WHERE created_at < $1`,
      [cutoffDate]
    );

    const deletedCount = result.rowCount || 0;
    console.log(`🧹 Очищено ${deletedCount} старых записей истории пользователей (старше ${daysToKeep} дней)`);

    return {
      success: true,
      deletedCount,
      message: `Очищено ${deletedCount} старых записей истории`
    };
  } catch (error) {
    console.error("❌ Ошибка очистки истории пользователей:", error);
    return {
      success: false,
      deletedCount: 0,
      message: `Ошибка очистки: ${error}`
    };
  }
}

/**
 * Очищает неактивные записи доступа к документам (старше 180 дней)
 */
export async function cleanupInactiveDocumentAccess(daysToKeep: number = 180): Promise<{
  success: boolean;
  deletedCount: number;
  message: string;
}> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await pool.query(
      `DELETE FROM document_access 
       WHERE created_at < $1 AND is_active = FALSE`,
      [cutoffDate]
    );

    const deletedCount = result.rowCount || 0;
    console.log(`🧹 Очищено ${deletedCount} неактивных записей доступа к документам (старше ${daysToKeep} дней)`);

    return {
      success: true,
      deletedCount,
      message: `Очищено ${deletedCount} неактивных записей доступа`
    };
  } catch (error) {
    console.error("❌ Ошибка очистки неактивного доступа:", error);
    return {
      success: false,
      deletedCount: 0,
      message: `Ошибка очистки: ${error}`
    };
  }
}

/**
 * Выполняет полную очистку системы
 */
export async function performFullCleanup(): Promise<{
  success: boolean;
  results: {
    searchLogs: { success: boolean; deletedCount: number; message: string };
    userHistory: { success: boolean; deletedCount: number; message: string };
    documentAccess: { success: boolean; deletedCount: number; message: string };
  };
  totalDeleted: number;
  message: string;
}> {
  console.log("🧹 Начинаем полную очистку системы...");

  const searchLogs = await cleanupOldSearchLogs(30);
  const userHistory = await cleanupOldUserHistory(90);
  const documentAccess = await cleanupInactiveDocumentAccess(180);

  const totalDeleted = searchLogs.deletedCount + userHistory.deletedCount + documentAccess.deletedCount;

  const success = searchLogs.success && userHistory.success && documentAccess.success;

  const message = success 
    ? `Очистка завершена успешно. Удалено ${totalDeleted} записей.`
    : "Очистка завершена с ошибками. Проверьте логи.";

  console.log(`✅ Очистка завершена: ${message}`);

  return {
    success,
    results: {
      searchLogs,
      userHistory,
      documentAccess
    },
    totalDeleted,
    message
  };
}

/**
 * Получает статистику по размеру таблиц
 */
export async function getDatabaseStats(): Promise<{
  searchLogs: number;
  userHistory: number;
  documentAccess: number;
  popularQueries: number;
  userFavorites: number;
  totalSize: string;
}> {
  try {
    const stats = await Promise.all([
      pool.query("SELECT COUNT(*) FROM search_logs"),
      pool.query("SELECT COUNT(*) FROM user_search_history"),
      pool.query("SELECT COUNT(*) FROM document_access"),
      pool.query("SELECT COUNT(*) FROM popular_queries"),
      pool.query("SELECT COUNT(*) FROM user_favorites"),
      pool.query(`
        SELECT pg_size_pretty(pg_total_relation_size('search_logs') + 
                             pg_total_relation_size('user_search_history') + 
                             pg_total_relation_size('document_access') + 
                             pg_total_relation_size('popular_queries') + 
                             pg_total_relation_size('user_favorites')) as total_size
      `)
    ]);

    return {
      searchLogs: parseInt(stats[0].rows[0].count),
      userHistory: parseInt(stats[1].rows[0].count),
      documentAccess: parseInt(stats[2].rows[0].count),
      popularQueries: parseInt(stats[3].rows[0].count),
      userFavorites: parseInt(stats[4].rows[0].count),
      totalSize: stats[5].rows[0].total_size
    };
  } catch (error) {
    console.error("❌ Ошибка получения статистики БД:", error);
    return {
      searchLogs: 0,
      userHistory: 0,
      documentAccess: 0,
      popularQueries: 0,
      userFavorites: 0,
      totalSize: "0 bytes"
    };
  }
}

/**
 * Оптимизирует базу данных (VACUUM и ANALYZE)
 */
export async function optimizeDatabase(): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    console.log("🔧 Начинаем оптимизацию базы данных...");

    // VACUUM для освобождения места
    await pool.query("VACUUM ANALYZE search_logs");
    await pool.query("VACUUM ANALYZE user_search_history");
    await pool.query("VACUUM ANALYZE document_access");
    await pool.query("VACUUM ANALYZE popular_queries");
    await pool.query("VACUUM ANALYZE user_favorites");

    console.log("✅ Оптимизация базы данных завершена");

    return {
      success: true,
      message: "База данных успешно оптимизирована"
    };
  } catch (error) {
    console.error("❌ Ошибка оптимизации БД:", error);
    return {
      success: false,
      message: `Ошибка оптимизации: ${error}`
    };
  }
}

// Экспортируем для использования в других модулях
export default {
  cleanupOldSearchLogs,
  cleanupOldUserHistory,
  cleanupInactiveDocumentAccess,
  performFullCleanup,
  getDatabaseStats,
  optimizeDatabase
};