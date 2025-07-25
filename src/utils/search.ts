import pool from "./db";
// import { execSync } from "child_process";

// /**
//  * Получает эмбеддинг для текста через Python-скрипт
//  * @param text
//  * @returns number[]
//  */
// function getQueryEmbedding(text: string): number[] {
//   const safeText = text.replace(/"/g, '\"');
//   const output = execSync(`python3 get_query_embedding.py \"${safeText}\"`).toString();
//   return output.trim().split(',').map(Number);
// }

/**
 * Поиск по подстроке (ILIKE) до 3 уникальных совпадений
 * @param query Вопрос пользователя
 * @returns Массив из трёх наиболее релевантных уникальных чанков (или меньше, если найдено меньше)
 */
export async function searchInstructions(query: string) {
  const res = await pool.query(
    `SELECT * FROM instruction_chunks WHERE content ILIKE $1;`,
    [`%${query}%`]
  );
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
