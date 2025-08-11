import pool from "./db";

export interface SearchAnalytics {
  totalSearches: number;
  successfulSearches: number;
  averageResponseTime: number;
  popularQueries: Array<{
    query: string;
    count: number;
    lastUsed: Date;
  }>;
  searchTypes: {
    vector: number;
    keyword: number;
    hybrid: number;
  };
}

export interface UserAnalytics {
  userId: number;
  username?: string;
  totalSearches: number;
  lastSearch: Date;
  favoriteQueries: string[];
}

/**
 * Создает таблицы для аналитики если они не существуют
 */
export async function setupAnalyticsTables() {
  try {
    // Таблица для отслеживания поисков
    await pool.query(`
      CREATE TABLE IF NOT EXISTS search_logs (
        id SERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        username VARCHAR(255),
        query TEXT NOT NULL,
        search_type VARCHAR(50) NOT NULL,
        results_count INTEGER DEFAULT 0,
        response_time_ms INTEGER,
        success BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Таблица для популярных запросов
    await pool.query(`
      CREATE TABLE IF NOT EXISTS popular_queries (
        id SERIAL PRIMARY KEY,
        query_hash VARCHAR(64) UNIQUE NOT NULL,
        query_text TEXT NOT NULL,
        search_count INTEGER DEFAULT 1,
        last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Таблица для избранных запросов пользователей
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_favorites (
        id SERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        query_text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, query_text)
      )
    `);

    // Таблица для истории поиска пользователей
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_search_history (
        id SERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        query_text TEXT NOT NULL,
        results_count INTEGER DEFAULT 0,
        search_type VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Создаем индексы для оптимизации
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_search_logs_user_id ON search_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_search_logs_created_at ON search_logs(created_at);
      CREATE INDEX IF NOT EXISTS idx_popular_queries_count ON popular_queries(search_count DESC);
      CREATE INDEX IF NOT EXISTS idx_user_favorites_user_id ON user_favorites(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_search_history_user_id ON user_search_history(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_search_history_created_at ON user_search_history(created_at DESC);
    `);

    console.log("✅ Таблицы аналитики созданы/обновлены");
  } catch (error) {
    console.error("❌ Ошибка создания таблиц аналитики:", error);
  }
}

/**
 * Логирует поисковый запрос
 */
export async function logSearch(
  userId: number,
  username: string | undefined,
  query: string,
  searchType: 'vector' | 'keyword' | 'hybrid',
  resultsCount: number,
  responseTimeMs: number,
  success: boolean = true
) {
  try {
    // Логируем поиск
    await pool.query(
      `INSERT INTO search_logs (user_id, username, query, search_type, results_count, response_time_ms, success)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, username, query, searchType, resultsCount, responseTimeMs, success]
    );

    // Фильтруем системные команды из популярных запросов
    const trimmedQuery = query.trim();
    const isSystemCommand = /^\/(start|help|about|ask_question|search_history|my_favorites|popular_queries|show_sources|download_|favorite_)/.test(trimmedQuery);
    
    // Обновляем популярные запросы только для не-системных команд
    if (!isSystemCommand && trimmedQuery.length > 0) {
      const queryHash = Buffer.from(trimmedQuery.toLowerCase()).toString('base64').slice(0, 64);
      await pool.query(
        `INSERT INTO popular_queries (query_hash, query_text, search_count, last_used)
         VALUES ($1, $2, 1, CURRENT_TIMESTAMP)
         ON CONFLICT (query_hash) 
         DO UPDATE SET 
           search_count = popular_queries.search_count + 1,
           last_used = CURRENT_TIMESTAMP`,
        [queryHash, trimmedQuery]
      );
    }

    // Добавляем в историю пользователя только для не-системных команд
    if (!isSystemCommand && trimmedQuery.length > 0) {
      await pool.query(
        `INSERT INTO user_search_history (user_id, query_text, results_count, search_type)
         VALUES ($1, $2, $3, $4)`,
        [userId, trimmedQuery, resultsCount, searchType]
      );
    }

    console.log(`📊 Логирован поиск: пользователь ${userId}, запрос "${query}", тип ${searchType}, результатов ${resultsCount}${isSystemCommand ? ' (системная команда)' : ''}`);
  } catch (error) {
    console.error("❌ Ошибка логирования поиска:", error);
  }
}

/**
 * Получает общую аналитику поиска
 */
export async function getSearchAnalytics(days: number = 30): Promise<SearchAnalytics> {
  try {
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);

    // Общая статистика
    const totalStats = await pool.query(
      `SELECT 
         COUNT(*) as total_searches,
         COUNT(CASE WHEN success = true THEN 1 END) as successful_searches,
         AVG(response_time_ms) as avg_response_time
       FROM search_logs 
       WHERE created_at >= $1`,
      [dateFrom]
    );

    // Популярные запросы
    const popularQueries = await pool.query(
      `SELECT query_text, search_count, last_used
       FROM popular_queries 
       WHERE last_used >= $1
       ORDER BY search_count DESC, last_used DESC
       LIMIT 10`,
      [dateFrom]
    );

    // Статистика по типам поиска
    const searchTypes = await pool.query(
      `SELECT search_type, COUNT(*) as count
       FROM search_logs 
       WHERE created_at >= $1
       GROUP BY search_type`,
      [dateFrom]
    );

    const searchTypesMap = {
      vector: 0,
      keyword: 0,
      hybrid: 0
    };

    searchTypes.rows.forEach((row: any) => {
      if (row.search_type in searchTypesMap) {
        searchTypesMap[row.search_type as keyof typeof searchTypesMap] = row.count;
      }
    });

    return {
      totalSearches: parseInt(totalStats.rows[0]?.total_searches || '0'),
      successfulSearches: parseInt(totalStats.rows[0]?.successful_searches || '0'),
      averageResponseTime: parseFloat(totalStats.rows[0]?.avg_response_time || '0'),
      popularQueries: popularQueries.rows.map((row: any) => ({
        query: row.query_text,
        count: row.search_count,
        lastUsed: row.last_used
      })),
      searchTypes: searchTypesMap
    };
  } catch (error) {
    console.error("❌ Ошибка получения аналитики:", error);
    return {
      totalSearches: 0,
      successfulSearches: 0,
      averageResponseTime: 0,
      popularQueries: [],
      searchTypes: { vector: 0, keyword: 0, hybrid: 0 }
    };
  }
}

/**
 * Получает аналитику пользователя
 */
export async function getUserAnalytics(userId: number): Promise<UserAnalytics | null> {
  try {
    // Общая статистика пользователя
    const userStats = await pool.query(
      `SELECT 
         COUNT(*) as total_searches,
         MAX(created_at) as last_search
       FROM search_logs 
       WHERE user_id = $1`,
      [userId]
    );

    // Избранные запросы
    const favorites = await pool.query(
      `SELECT query_text 
       FROM user_favorites 
       WHERE user_id = $1 
       ORDER BY created_at DESC`,
      [userId]
    );

    if (userStats.rows.length === 0) {
      return null;
    }

    return {
      userId,
      totalSearches: parseInt(userStats.rows[0].total_searches),
      lastSearch: userStats.rows[0].last_search,
      favoriteQueries: favorites.rows.map((row: any) => row.query_text)
    };
  } catch (error) {
    console.error("❌ Ошибка получения аналитики пользователя:", error);
    return null;
  }
}

/**
 * Добавляет запрос в избранное пользователя
 */
export async function addToFavorites(userId: number, query: string): Promise<boolean> {
  try {
    await pool.query(
      `INSERT INTO user_favorites (user_id, query_text)
       VALUES ($1, $2)
       ON CONFLICT (user_id, query_text) DO NOTHING`,
      [userId, query.trim()]
    );
    console.log(`⭐ Добавлено в избранное: пользователь ${userId}, запрос "${query}"`);
    return true;
  } catch (error) {
    console.error("❌ Ошибка добавления в избранное:", error);
    return false;
  }
}

/**
 * Удаляет запрос из избранного пользователя
 */
export async function removeFromFavorites(userId: number, query: string): Promise<boolean> {
  try {
    const result = await pool.query(
      `DELETE FROM user_favorites 
       WHERE user_id = $1 AND query_text = $2`,
      [userId, query.trim()]
    );
    console.log(`🗑️ Удалено из избранного: пользователь ${userId}, запрос "${query}"`);
    return (result.rowCount || 0) > 0;
  } catch (error) {
    console.error("❌ Ошибка удаления из избранного:", error);
    return false;
  }
}

/**
 * Получает историю поиска пользователя
 */
export async function getUserSearchHistory(userId: number, limit: number = 10): Promise<Array<{
  query: string;
  resultsCount: number;
  searchType: string;
  createdAt: Date;
}>> {
  try {
    const result = await pool.query(
      `SELECT query_text, results_count, search_type, created_at
       FROM user_search_history 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows.map((row: any) => ({
      query: row.query_text,
      resultsCount: row.results_count,
      searchType: row.search_type,
      createdAt: row.created_at
    }));
  } catch (error) {
    console.error("❌ Ошибка получения истории поиска:", error);
    return [];
  }
}

/**
 * Получает топ популярных запросов
 */
export async function getPopularQueries(limit: number = 10): Promise<Array<{
  query: string;
  count: number;
  lastUsed: Date;
}>> {
  try {
    const result = await pool.query(
      `SELECT query_text, search_count, last_used
       FROM popular_queries 
       ORDER BY search_count DESC, last_used DESC
       LIMIT $1`,
      [limit]
    );

    return result.rows.map((row: any) => ({
      query: row.query_text,
      count: row.search_count,
      lastUsed: row.last_used
    }));
  } catch (error) {
    console.error("❌ Ошибка получения популярных запросов:", error);
    return [];
  }
} 