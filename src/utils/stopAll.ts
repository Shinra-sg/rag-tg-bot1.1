import { execSync } from "child_process";

function stopAll() {
  try {
    console.log("🛑 Остановка всех процессов системы...\n");
    
    // Останавливаем все процессы ts-node
    console.log("1. Остановка ботов...");
    try {
      execSync("pkill -f 'ts-node'", { stdio: 'inherit' });
      console.log("✅ Боты остановлены");
    } catch (e) {
      console.log("⚠️ Процессы ts-node уже остановлены или не найдены");
    }
    
    // Останавливаем PostgreSQL (опционально)
    console.log("\n2. Остановка PostgreSQL (опционально)...");
    console.log("   💡 Для остановки PostgreSQL выполните: brew services stop postgresql@14");
    console.log("   💡 Для перезапуска PostgreSQL выполните: brew services restart postgresql@14");
    
    // Останавливаем Ollama (опционально)
    console.log("\n3. Остановка Ollama (опционально)...");
    console.log("   💡 Для остановки Ollama выполните: pkill -f 'ollama'");
    
    console.log("\n✅ Все процессы остановлены!");
    console.log("📋 Доступные команды:");
    console.log("   🚀 npm run start:all:clean - запуск с очисткой");
    console.log("   🚀 npm run start:all - запуск с nodemon");
    console.log("   🤖 npm run start:bot - только основной бот");
    console.log("   👨‍💼 npm run start:admin - только админ-бот");
    
  } catch (error) {
    console.error("❌ Ошибка при остановке процессов:", error);
  }
}

stopAll(); 