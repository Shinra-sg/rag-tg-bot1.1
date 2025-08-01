import pool from "./db";
import { searchInstructions } from "./search";

async function checkSearchData() {
  try {
    console.log("🔍 Проверка данных для поиска...\n");
    
    // Проверяем таблицу instruction_chunks
    console.log("1. Проверка таблицы instruction_chunks:");
    const chunksResult = await pool.query("SELECT COUNT(*) FROM instruction_chunks");
    console.log(`   Всего чанков: ${chunksResult.rows[0].count}`);
    
    if (parseInt(chunksResult.rows[0].count) > 0) {
      const sampleResult = await pool.query("SELECT content, filename, source_ref FROM instruction_chunks LIMIT 3");
      console.log("   Примеры чанков:");
      sampleResult.rows.forEach((chunk, i) => {
        console.log(`   ${i+1}. Файл: ${chunk.filename}`);
        console.log(`      Содержание: ${chunk.content.substring(0, 100)}...`);
        console.log(`      Источник: ${chunk.source_ref}`);
        console.log("");
      });
    } else {
      console.log("   ❌ Таблица instruction_chunks пуста!");
    }
    
    // Проверяем эмбеддинги
    console.log("2. Проверка эмбеддингов:");
    const embeddingsResult = await pool.query("SELECT COUNT(*) FROM instruction_chunks WHERE embedding IS NOT NULL");
    console.log(`   Чанков с эмбеддингами: ${embeddingsResult.rows[0].count}`);
    
    const noEmbeddingsResult = await pool.query("SELECT COUNT(*) FROM instruction_chunks WHERE embedding IS NULL");
    console.log(`   Чанков без эмбеддингов: ${noEmbeddingsResult.rows[0].count}`);
    
    // Тестируем поиск
    console.log("\n3. Тестирование поиска:");
    const testQueries = [
      "лабораторная работа",
      "виртуальная машина", 
      "инструкция",
      "настройка"
    ];
    
    for (const query of testQueries) {
      console.log(`\n   Запрос: "${query}"`);
      try {
        const results = await searchInstructions(query);
        console.log(`   Найдено результатов: ${results.length}`);
        if (results.length > 0) {
          results.forEach((result, i) => {
            console.log(`     ${i+1}. Файл: ${result.filename}`);
            console.log(`        Содержание: ${result.content.substring(0, 80)}...`);
          });
        } else {
          console.log("     ❌ Результатов не найдено");
        }
      } catch (error) {
        console.log(`     ❌ Ошибка поиска: ${error}`);
      }
    }
    
    // Проверяем уникальность результатов
    console.log("\n4. Проверка уникальности результатов:");
    const allResults = await searchInstructions("лабораторная");
    const uniqueContents = new Set(allResults.map(r => r.content));
    console.log(`   Всего результатов: ${allResults.length}`);
    console.log(`   Уникальных содержимых: ${uniqueContents.size}`);
    
    if (allResults.length !== uniqueContents.size) {
      console.log("   ⚠️ Обнаружены дубликаты в результатах!");
    } else {
      console.log("   ✅ Дубликатов не найдено");
    }
    
  } catch (error) {
    console.error("❌ Ошибка при проверке:", error);
  } finally {
    await pool.end();
  }
}

checkSearchData(); 