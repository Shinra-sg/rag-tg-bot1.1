import pool from "./db";

async function checkDuplicates() {
  try {
    console.log("🔍 Проверка дубликатов в таблице instruction_chunks...\n");
    
    // Проверяем общее количество записей
    const totalResult = await pool.query("SELECT COUNT(*) FROM instruction_chunks");
    console.log(`1. Общее количество записей: ${totalResult.rows[0].count}`);
    
    // Проверяем уникальные содержимые
    const uniqueContentResult = await pool.query("SELECT COUNT(DISTINCT content) FROM instruction_chunks");
    console.log(`2. Уникальных содержимых: ${uniqueContentResult.rows[0].count}`);
    
    // Находим дубликаты по содержимому
    const duplicatesResult = await pool.query(`
      SELECT content, COUNT(*) as count 
      FROM instruction_chunks 
      GROUP BY content 
      HAVING COUNT(*) > 1 
      ORDER BY count DESC 
      LIMIT 10
    `);
    
    console.log(`3. Найдено ${duplicatesResult.rows.length} содержимых с дубликатами:`);
    duplicatesResult.rows.forEach((row, i) => {
      console.log(`   ${i+1}. Количество дубликатов: ${row.count}`);
      console.log(`      Содержание: ${row.content.substring(0, 100)}...`);
      console.log("");
    });
    
    // Проверяем дубликаты по filename + content
    const fileContentDuplicatesResult = await pool.query(`
      SELECT filename, content, COUNT(*) as count 
      FROM instruction_chunks 
      GROUP BY filename, content 
      HAVING COUNT(*) > 1 
      ORDER BY count DESC 
      LIMIT 5
    `);
    
    console.log(`4. Дубликаты по файлу + содержимому:`);
    fileContentDuplicatesResult.rows.forEach((row, i) => {
      console.log(`   ${i+1}. Файл: ${row.filename}, Дубликатов: ${row.count}`);
      console.log(`      Содержание: ${row.content.substring(0, 80)}...`);
      console.log("");
    });
    
    // Проверяем записи с одинаковым содержимым но разными файлами
    const sameContentDiffFilesResult = await pool.query(`
      SELECT content, COUNT(DISTINCT filename) as file_count, 
             array_agg(DISTINCT filename) as files
      FROM instruction_chunks 
      GROUP BY content 
      HAVING COUNT(DISTINCT filename) > 1 
      ORDER BY file_count DESC 
      LIMIT 5
    `);
    
    console.log(`5. Одинаковое содержимое в разных файлах:`);
    sameContentDiffFilesResult.rows.forEach((row, i) => {
      console.log(`   ${i+1}. Файлов: ${row.file_count}`);
      console.log(`      Файлы: ${row.files.join(', ')}`);
      console.log(`      Содержание: ${row.content.substring(0, 80)}...`);
      console.log("");
    });
    
    // Проверяем записи без эмбеддингов
    const noEmbeddingsResult = await pool.query(`
      SELECT filename, COUNT(*) as count 
      FROM instruction_chunks 
      WHERE embedding IS NULL 
      GROUP BY filename 
      ORDER BY count DESC 
      LIMIT 5
    `);
    
    console.log(`6. Записи без эмбеддингов по файлам:`);
    noEmbeddingsResult.rows.forEach((row, i) => {
      console.log(`   ${i+1}. Файл: ${row.filename}, Записей без эмбеддингов: ${row.count}`);
    });
    
  } catch (error) {
    console.error("❌ Ошибка при проверке дубликатов:", error);
  } finally {
    await pool.end();
  }
}

checkDuplicates(); 