import pool from "./db";

async function cleanDuplicates() {
  try {
    console.log("🧹 Очистка дубликатов в таблице instruction_chunks...\n");
    
    // Проверяем количество записей до очистки
    const beforeResult = await pool.query("SELECT COUNT(*) FROM instruction_chunks");
    console.log(`1. Записей до очистки: ${beforeResult.rows[0].count}`);
    
    // Создаем временную таблицу с уникальными записями
    console.log("2. Создание временной таблицы с уникальными записями...");
    await pool.query(`
      CREATE TEMP TABLE temp_unique_chunks AS
      SELECT DISTINCT ON (content) 
        id,
        content,
        filename,
        chunk_index,
        type,
        source_ref,
        embedding
      FROM instruction_chunks
      ORDER BY content, id
    `);
    
    const uniqueResult = await pool.query("SELECT COUNT(*) FROM temp_unique_chunks");
    console.log(`   Уникальных записей: ${uniqueResult.rows[0].count}`);
    
    // Очищаем основную таблицу
    console.log("3. Очистка основной таблицы...");
    await pool.query("DELETE FROM instruction_chunks");
    
    // Вставляем уникальные записи обратно
    console.log("4. Вставка уникальных записей...");
    await pool.query(`
      INSERT INTO instruction_chunks (id, content, filename, chunk_index, type, source_ref, embedding)
      SELECT id, content, filename, chunk_index, type, source_ref, embedding
      FROM temp_unique_chunks
    `);
    
    // Проверяем результат
    const afterResult = await pool.query("SELECT COUNT(*) FROM instruction_chunks");
    console.log(`5. Записей после очистки: ${afterResult.rows[0].count}`);
    
    const removed = parseInt(beforeResult.rows[0].count) - parseInt(afterResult.rows[0].count);
    console.log(`6. Удалено дубликатов: ${removed}`);
    
    // Проверяем эмбеддинги
    const embeddingsResult = await pool.query("SELECT COUNT(*) FROM instruction_chunks WHERE embedding IS NOT NULL");
    console.log(`7. Записей с эмбеддингами: ${embeddingsResult.rows[0].count}`);
    
    const noEmbeddingsResult = await pool.query("SELECT COUNT(*) FROM instruction_chunks WHERE embedding IS NULL");
    console.log(`8. Записей без эмбеддингов: ${noEmbeddingsResult.rows[0].count}`);
    
    // Пересоздаем индексы
    console.log("9. Пересоздание индексов...");
    await pool.query("REINDEX TABLE instruction_chunks");
    
    console.log("\n✅ Очистка завершена!");
    
  } catch (error) {
    console.error("❌ Ошибка при очистке дубликатов:", error);
  } finally {
    await pool.end();
  }
}

cleanDuplicates(); 