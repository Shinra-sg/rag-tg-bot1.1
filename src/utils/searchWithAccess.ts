import pool from "./db";
import { execSync } from "child_process";
import { checkDocumentAccess } from "./documentAccess";

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
 * Векторный поиск по базе инструкций с проверкой доступа (RAG)
 * @param query Вопрос пользователя
 * @param username Username пользователя для проверки доступа
 * @returns Массив из трёх наиболее релевантных уникальных чанков (или меньше, если найдено меньше)
 */
export async function searchInstructionsWithAccess(query: string, username?: string) {
  // Если username не предоставлен, возвращаем пустой результат
  if (!username) {
    console.log("🔒 Поиск заблокирован: username не предоставлен");
    return [];
  }

  // Получаем эмбеддинг запроса
  let embedding: number[];
  try {
    embedding = getQueryEmbedding(query);
  } catch (e) {
    console.error("Ошибка получения эмбеддинга запроса:", e);
    // Fallback на ILIKE с проверкой доступа
    return fallbackSearchWithAccess(query, username);
  }

  // Векторный поиск с проверкой доступа
  const res = await pool.query(
    `SELECT ic.*, ic.embedding <#> $1 AS distance, d.id as document_id
     FROM instruction_chunks ic
     JOIN documents d ON ic.filename = d.original_name OR ic.filename = SUBSTRING(d.filename FROM '([^/]+)$')
     WHERE ic.embedding IS NOT NULL
     ORDER BY distance ASC
     LIMIT 20;`,
    [JSON.stringify(embedding)]
  );

  if (res.rows.length > 0) {
    // Фильтруем по доступу и уникальности
    const seen = new Set<string>();
    const unique = [];
    
    for (const chunk of res.rows) {
      // Проверяем доступ к документу
      const hasAccess = await checkDocumentAccess(chunk.document_id, username);
      if (!hasAccess) {
        console.log(`🔒 Доступ к документу ${chunk.document_id} заблокирован для @${username}`);
        continue;
      }

      // Проверяем уникальность контента
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
    
    console.log(`✅ Найдено ${unique.length} доступных результатов для @${username}`);
    return unique;
  }

  // Fallback на ILIKE с проверкой доступа, если ничего не найдено
  return fallbackSearchWithAccess(query, username);
}

async function fallbackSearchWithAccess(query: string, username: string) {
  const res = await pool.query(
    `SELECT ic.*, d.id as document_id
     FROM instruction_chunks ic
     JOIN documents d ON ic.filename = d.original_name OR ic.filename = SUBSTRING(d.filename FROM '([^/]+)$')
     WHERE ic.content ILIKE $1
     LIMIT 20;`,
    [`%${query}%`]
  );
  
  const seen = new Set<string>();
  const unique = [];
  
  for (const chunk of res.rows) {
    // Проверяем доступ к документу
    const hasAccess = await checkDocumentAccess(chunk.document_id, username);
    if (!hasAccess) {
      console.log(`🔒 Доступ к документу ${chunk.document_id} заблокирован для @${username}`);
      continue;
    }

    // Проверяем уникальность контента
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
  
  console.log(`✅ Fallback: найдено ${unique.length} доступных результатов для @${username}`);
  return unique;
}

/**
 * Получает список доступных документов для пользователя
 * @param username Username пользователя
 * @returns Массив доступных документов
 */
export async function getAvailableDocuments(username: string) {
  try {
    const res = await pool.query(`
      SELECT DISTINCT d.id, d.original_name, d.filename, d.type, c.name as category
      FROM documents d
      LEFT JOIN categories c ON d.category_id = c.id
      INNER JOIN document_access da ON d.id = da.document_id
      WHERE da.username = $1 AND da.is_active = TRUE
      ORDER BY d.uploaded_at DESC
    `, [username.startsWith('@') ? username.slice(1) : username]);

    return res.rows;
  } catch (error) {
    console.error("Ошибка при получении доступных документов:", error);
    return [];
  }
}

/**
 * Проверяет, есть ли у пользователя доступ к любым документам
 * @param username Username пользователя
 * @returns true если есть доступ хотя бы к одному документу
 */
export async function hasAnyAccess(username: string): Promise<boolean> {
  try {
    // По умолчанию все документы закрыты для всех пользователей
    // Доступ предоставляется только через таблицу document_access
    const res = await pool.query(`
      SELECT 1 FROM document_access 
      WHERE username = $1 AND is_active = TRUE 
      LIMIT 1
    `, [username.startsWith('@') ? username.slice(1) : username]);

    return res.rows.length > 0;
  } catch (error) {
    console.error("Ошибка при проверке доступа:", error);
    return false; // По умолчанию доступ запрещен
  }
} 