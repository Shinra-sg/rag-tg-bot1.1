import { execSync } from "child_process";
import pool from "./db";

async function startWithCleanup() {
  try {
    console.log("🚀 Запуск системы с автоматической очисткой...\n");
    
    // 1. Запуск PostgreSQL
    console.log("1. Запуск PostgreSQL...");
    try {
      execSync("brew services start postgresql@14", { stdio: 'inherit' });
      console.log("✅ PostgreSQL запущен");
    } catch (e) {
      console.log("⚠️ PostgreSQL уже запущен или ошибка запуска");
    }
    
    // 2. Проверка и очистка дубликатов
    console.log("\n2. Проверка дубликатов в базе данных...");
    const duplicatesResult = await pool.query(`
      SELECT COUNT(*) as total, COUNT(DISTINCT content) as unique_count 
      FROM instruction_chunks
    `);
    
    const total = parseInt(duplicatesResult.rows[0].total);
    const unique = parseInt(duplicatesResult.rows[0].unique_count);
    
    if (total > 0) {
      console.log(`   Найдено записей: ${total}, уникальных: ${unique}`);
      
      if (total > unique) {
        console.log("   🧹 Обнаружены дубликаты, выполняем очистку...");
        await cleanDuplicates();
      } else {
        console.log("   ✅ Дубликатов не найдено");
      }
    } else {
      console.log("   📝 Таблица пуста, пропускаем очистку");
    }
    
    // 3. Запуск парсера
    console.log("\n3. Запуск парсера документов...");
    try {
      execSync("ts-node src/data/loadAll.ts", { stdio: 'inherit' });
      console.log("✅ Парсер завершен");
    } catch (e) {
      console.log("❌ Ошибка парсера:", e);
    }
    
    // 4. Генерация эмбеддингов
    console.log("\n4. Генерация эмбеддингов...");
    try {
      execSync("python3 generate_embeddings.py", { stdio: 'inherit' });
      console.log("✅ Эмбеддинги сгенерированы");
    } catch (e) {
      console.log("❌ Ошибка генерации эмбеддингов:", e);
    }
    
    // 5. Тест базы данных
    console.log("\n5. Тестирование базы данных...");
    try {
      execSync("ts-node src/utils/testDb.ts", { stdio: 'inherit' });
      console.log("✅ Тест базы данных пройден");
    } catch (e) {
      console.log("❌ Ошибка теста базы данных:", e);
    }
    
    // 6. Запуск ботов
    console.log("\n6. Запуск ботов...");
    console.log("   🤖 Основной бот и админ-бот запущены в фоне");
    console.log("   💡 Для остановки используйте: pkill -f 'ts-node'");
    
    // Запускаем ботов в фоне
    try {
      execSync("ts-node src/index.ts &", { stdio: 'inherit' });
      execSync("ts-node src/admin-bot/index.ts &", { stdio: 'inherit' });
    } catch (e) {
      console.log("❌ Ошибка запуска ботов:", e);
    }
    
    console.log("\n🎉 Система успешно запущена!");
    console.log("📊 Статистика:");
    
    const finalResult = await pool.query(`
      SELECT 
        COUNT(*) as total_chunks,
        COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) as with_embeddings,
        COUNT(CASE WHEN embedding IS NULL THEN 1 END) as without_embeddings
      FROM instruction_chunks
    `);
    
    const stats = finalResult.rows[0];
    console.log(`   📄 Всего чанков: ${stats.total_chunks}`);
    console.log(`   🔢 С эмбеддингами: ${stats.with_embeddings}`);
    console.log(`   ⚠️ Без эмбеддингов: ${stats.without_embeddings}`);
    
  } catch (error) {
    console.error("❌ Ошибка при запуске системы:", error);
  } finally {
    await pool.end();
  }
}

async function cleanDuplicates() {
  try {
    console.log("   🧹 Очистка дубликатов...");
    
    // Создаем временную таблицу с уникальными записями
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
    const uniqueCount = parseInt(uniqueResult.rows[0].count);
    
    // Очищаем основную таблицу
    await pool.query("DELETE FROM instruction_chunks");
    
    // Вставляем уникальные записи обратно
    await pool.query(`
      INSERT INTO instruction_chunks (id, content, filename, chunk_index, type, source_ref, embedding)
      SELECT id, content, filename, chunk_index, type, source_ref, embedding
      FROM temp_unique_chunks
    `);
    
    // Пересоздаем индексы
    await pool.query("REINDEX TABLE instruction_chunks");
    
    console.log(`   ✅ Очищено дубликатов, осталось ${uniqueCount} уникальных записей`);
    
  } catch (error) {
    console.error("   ❌ Ошибка при очистке дубликатов:", error);
  }
}

// Запускаем систему
startWithCleanup(); 