import pool from "./db";
import { execSync } from "child_process";

/**
 * Получает эмбеддинг для текста через Python-скрипт
 * @param text
 * @returns number[]
 */
function getQueryEmbedding(text: string): number[] {
  const safeText = text.replace(/"/g, '\\"');
  const output = execSync(`python3 get_query_embedding.py "${safeText}"`).toString();
  return output.trim().split(',').map(Number);
}

/**
 * Векторный поиск по базе инструкций (RAG)
 * @param query Вопрос пользователя
 * @returns Массив из трёх наиболее релевантных уникальных чанков (или меньше, если найдено меньше)
 */
export async function searchInstructions(query: string) {
  // Получаем эмбеддинг запроса
  let embedding: number[];
  try {
    embedding = getQueryEmbedding(query);
  } catch (e) {
    console.error("Ошибка получения эмбеддинга запроса:", e);
    // Fallback на ILIKE
    return fallbackSearch(query);
  }

  // Векторный поиск
  const res = await pool.query(
    `SELECT *, embedding <#> $1 AS distance
     FROM instruction_chunks
     WHERE embedding IS NOT NULL
     ORDER BY distance ASC
     LIMIT 10;`,
    [JSON.stringify(embedding)]
  );

  if (res.rows.length > 0) {
    // Фильтруем только уникальные по content
    const seen = new Set<string>();
    const unique = [];
    for (const chunk of res.rows) {
      if (!seen.has(chunk.content)) {
        seen.add(chunk.content);
        unique.push({
          content: chunk.content,
          filename: chunk.filename,
          source_ref: chunk.source_ref
        });
        if (unique.length >= 3) break;
      }
    }
    return unique;
  }

  // Fallback на ILIKE, если ничего не найдено
  return fallbackSearch(query);
}

async function fallbackSearch(query: string) {
  const res = await pool.query(
    `SELECT * FROM instruction_chunks WHERE content ILIKE $1 LIMIT 10;`,
    [`%${query}%`]
  );
  
  const seen = new Set<string>();
  const unique = [];
  for (const chunk of res.rows) {
    if (!seen.has(chunk.content)) {
      seen.add(chunk.content);
      unique.push({
        content: chunk.content,
        filename: chunk.filename,
        source_ref: chunk.source_ref
      });
      if (unique.length >= 3) break;
    }
  }
  
  return unique;
}
