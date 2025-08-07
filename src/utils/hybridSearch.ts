import pool from "./db";
import { execSync } from "child_process";

interface SearchResult {
  content: string;
  filename: string;
  source_ref: string;
  score: number;
  search_type: 'vector' | 'keyword' | 'hybrid';
}

interface HybridSearchOptions {
  vectorWeight?: number;
  keywordWeight?: number;
  maxResults?: number;
  minScore?: number;
}

/**
 * Получает эмбеддинг для текста через Python-скрипт
 */
function getQueryEmbedding(text: string): number[] {
  const safeText = text.replace(/"/g, '\\"');
  const output = execSync(`python3 get_query_embedding.py "${safeText}"`).toString();
  return output.trim().split(',').map(Number);
}

/**
 * Векторный поиск
 */
async function vectorSearch(query: string, limit: number = 20): Promise<SearchResult[]> {
  try {
    const embedding = getQueryEmbedding(query);
    const res = await pool.query(
      `SELECT *, embedding <#> $1 AS distance
       FROM instruction_chunks
       WHERE embedding IS NOT NULL
       ORDER BY distance ASC
       LIMIT $2;`,
      [JSON.stringify(embedding), limit]
    );

    return res.rows.map((row: any) => ({
      content: row.content,
      filename: row.filename,
      source_ref: row.source_ref,
      score: 1 / (1 + row.distance), // Нормализуем расстояние в скор (0-1)
      search_type: 'vector' as const
    }));
  } catch (e) {
    console.error("Ошибка векторного поиска:", e);
    return [];
  }
}

/**
 * Ключевой поиск (ILIKE)
 */
async function keywordSearch(query: string, limit: number = 20): Promise<SearchResult[]> {
  try {
    // Разбиваем запрос на ключевые слова
    const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 2);
    
    if (keywords.length === 0) {
      return [];
    }

    // Создаем условие для поиска по всем ключевым словам
    const conditions = keywords.map((_, i) => `content ILIKE $${i + 1}`).join(' AND ');
    const values = keywords.map(k => `%${k}%`);

    const res = await pool.query(
      `SELECT *, 
              (LENGTH(content) - LENGTH(REPLACE(LOWER(content), $1, ''))) / LENGTH($1) as keyword_count
       FROM instruction_chunks 
       WHERE ${conditions}
       ORDER BY keyword_count DESC, LENGTH(content) ASC
       LIMIT $${keywords.length + 1};`,
      [...values, limit]
    );

    return res.rows.map((row: any) => ({
      content: row.content,
      filename: row.filename,
      source_ref: row.source_ref,
      score: Math.min(1, row.keyword_count / keywords.length), // Нормализуем скор
      search_type: 'keyword' as const
    }));
  } catch (e) {
    console.error("Ошибка ключевого поиска:", e);
    return [];
  }
}

/**
 * Гибридный поиск - комбинация векторного и ключевого поиска
 */
export async function hybridSearch(
  query: string, 
  options: HybridSearchOptions = {}
): Promise<SearchResult[]> {
  const {
    vectorWeight = 0.7,
    keywordWeight = 0.3,
    maxResults = 3,
    minScore = 0.1
  } = options;

  console.log(`🔍 Гибридный поиск: "${query}" (веса: вектор=${vectorWeight}, ключи=${keywordWeight})`);

  // Выполняем оба типа поиска параллельно
  const [vectorResults, keywordResults] = await Promise.all([
    vectorSearch(query, maxResults * 3),
    keywordSearch(query, maxResults * 3)
  ]);

  // Объединяем результаты
  const combinedResults = new Map<string, SearchResult>();

  // Добавляем векторные результаты
  for (const result of vectorResults) {
    const key = `${result.filename}:${result.source_ref}`;
    if (!combinedResults.has(key)) {
      result.score *= vectorWeight;
      combinedResults.set(key, result);
    }
  }

  // Добавляем ключевые результаты
  for (const result of keywordResults) {
    const key = `${result.filename}:${result.source_ref}`;
    if (combinedResults.has(key)) {
      // Если результат уже есть, комбинируем скори
      const existing = combinedResults.get(key)!;
      existing.score = existing.score * vectorWeight + result.score * keywordWeight;
      existing.search_type = 'hybrid';
    } else {
      result.score *= keywordWeight;
      combinedResults.set(key, result);
    }
  }

  // Сортируем по скору и возвращаем топ результаты
  const sortedResults = Array.from(combinedResults.values())
    .filter(result => result.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);

  console.log(`✅ Гибридный поиск: найдено ${sortedResults.length} результатов`);
  
  return sortedResults;
}

/**
 * Улучшенный поиск с автоматическим выбором стратегии
 */
export async function smartSearch(query: string): Promise<SearchResult[]> {
  // Определяем тип запроса
  const isSpecificQuery = query.length > 20 || query.includes('?') || query.includes('как') || query.includes('что');
  
  if (isSpecificQuery) {
    // Для специфичных запросов используем гибридный поиск
    return hybridSearch(query, { vectorWeight: 0.6, keywordWeight: 0.4 });
  } else {
    // Для коротких запросов используем ключевой поиск
    const keywordResults = await keywordSearch(query, 3);
    if (keywordResults.length > 0) {
      return keywordResults;
    }
    // Если ключевой поиск не дал результатов, пробуем векторный
    return vectorSearch(query, 3);
  }
}

/**
 * Поиск с фильтрацией по категориям
 */
export async function searchWithFilters(
  query: string, 
  filters: {
    categories?: string[];
    fileTypes?: string[];
    dateFrom?: Date;
    dateTo?: Date;
  } = {}
): Promise<SearchResult[]> {
  const { categories, fileTypes, dateFrom, dateTo } = filters;
  
  // Базовый гибридный поиск
  const results = await hybridSearch(query, { maxResults: 20 });
  
  // Применяем фильтры
  let filteredResults = results;
  
  if (fileTypes && fileTypes.length > 0) {
    filteredResults = filteredResults.filter(result => 
      fileTypes.some(type => result.filename.toLowerCase().endsWith(type.toLowerCase()))
    );
  }
  
  // TODO: Добавить фильтрацию по категориям и датам когда будет соответствующая структура БД
  
  return filteredResults.slice(0, 3);
} 