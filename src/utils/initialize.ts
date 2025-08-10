import pool from "./db";
import { setupAnalyticsTables } from "./analytics";

/**
 * Инициализирует все необходимые таблицы и компоненты системы
 */
export async function initializeSystem() {
  console.log("🚀 Инициализация системы RAG Telegram Bot...");
  
  try {
    // 1. Проверяем подключение к базе данных
    console.log("📊 Проверка подключения к базе данных...");
    await pool.query("SELECT 1");
    console.log("✅ Подключение к базе данных установлено");

    // 2. Создаем таблицы аналитики
    console.log("📈 Настройка таблиц аналитики...");
    await setupAnalyticsTables();
    console.log("✅ Таблицы аналитики настроены");

    // 3. Создаем таблицы для управления админами
    console.log("👥 Настройка системы управления админами...");
    try {
      const { setupAdminsTable } = await import("./setupAdminsTable");
      await setupAdminsTable();
      console.log("✅ Система управления админами настроена");
    } catch (error) {
      console.warn("⚠️ Ошибка настройки системы админов:", error);
    }

    // 4. Создаем таблицы для разграничения доступа к документам
    console.log("🔐 Настройка системы доступа к документам...");
    try {
      const setupDocumentAccess = (await import("./setupDocumentAccess")).default;
      await setupDocumentAccess();
      console.log("✅ Система доступа настроена");
    } catch (error) {
      console.warn("⚠️ Ошибка настройки системы доступа:", error);
    }

    // 5. Проверяем наличие основных таблиц
    console.log("🔍 Проверка основных таблиц...");
    const requiredTables = [
      'instruction_chunks',
      'documents', 
      'categories',
      'search_logs',
      'popular_queries',
      'user_favorites',
      'user_search_history',
      'document_access',
      'admins'
    ];

    for (const table of requiredTables) {
      try {
        const result = await pool.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = $1
        `, [table]);
        
        if (result.rows.length > 0) {
          console.log(`✅ Таблица ${table} существует`);
        } else {
          console.log(`⚠️ Таблица ${table} не найдена`);
        }
      } catch (error) {
        console.log(`⚠️ Ошибка проверки таблицы ${table}:`, error);
      }
    }

    // 6. Проверяем наличие данных
    console.log("📋 Проверка наличия данных...");
    try {
      const chunksCount = await pool.query("SELECT COUNT(*) FROM instruction_chunks");
      const documentsCount = await pool.query("SELECT COUNT(*) FROM documents");
      
      console.log(`📄 Найдено чанков: ${chunksCount.rows[0].count}`);
      console.log(`📁 Найдено документов: ${documentsCount.rows[0].count}`);
    } catch (error) {
      console.warn("⚠️ Ошибка проверки данных:", error);
    }

    console.log("\n🎉 Система успешно инициализирована!");
    console.log("🤖 Бот готов к работе!");
    
  } catch (error) {
    console.error("❌ Ошибка инициализации системы:", error);
    throw error;
  }
}

/**
 * Проверяет готовность системы к работе
 */
export async function checkSystemHealth(): Promise<{
  healthy: boolean;
  issues: string[];
  stats: {
    chunks: number;
    documents: number;
    users: number;
  };
}> {
  const issues: string[] = [];
  const stats = {
    chunks: 0,
    documents: 0,
    users: 0
  };

  try {
    // Проверяем подключение к БД
    await pool.query("SELECT 1");
    
    // Проверяем основные таблицы
    const tables = ['instruction_chunks', 'documents', 'search_logs'];
    for (const table of tables) {
      try {
        const result = await pool.query(`SELECT COUNT(*) FROM ${table}`);
        
        if (table === 'instruction_chunks') stats.chunks = parseInt(result.rows[0].count);
        if (table === 'documents') stats.documents = parseInt(result.rows[0].count);
      } catch (error) {
        issues.push(`Ошибка доступа к таблице ${table}: ${error}`);
      }
    }

    // Проверяем количество пользователей
    try {
      const usersResult = await pool.query(`
        SELECT COUNT(DISTINCT user_id) FROM search_logs
      `);
      stats.users = parseInt(usersResult.rows[0].count);
    } catch (error) {
      // Таблица может не существовать
      stats.users = 0;
    }

    // Проверяем наличие данных
    if (stats.chunks === 0) {
      issues.push("Нет данных в таблице instruction_chunks");
    }
    
    if (stats.documents === 0) {
      issues.push("Нет документов в системе");
    }

    return {
      healthy: issues.length === 0,
      issues,
      stats
    };

  } catch (error) {
    issues.push(`Ошибка подключения к базе данных: ${error}`);
    return {
      healthy: false,
      issues,
      stats
    };
  }
}

// Запуск если файл выполняется напрямую
if (require.main === module) {
  initializeSystem().then(() => {
    console.log("✅ Инициализация завершена");
    process.exit(0);
  }).catch((error) => {
    console.error("❌ Ошибка инициализации:", error);
    process.exit(1);
  });
}

// Экспортируем для использования в других модулях
export default initializeSystem; 