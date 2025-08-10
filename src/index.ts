import { config } from "dotenv";
import { initializeSystem, checkSystemHealth } from "./utils/initialize";

try {
  config();

  (async () => {
    console.log("🚀 Запуск RAG Telegram Bot...");
    
    try {
      // Инициализируем систему
      await initializeSystem();
      
      // Проверяем здоровье системы
      const health = await checkSystemHealth();
      if (!health.healthy) {
        console.warn("⚠️ Обнаружены проблемы в системе:");
        health.issues.forEach(issue => console.warn(`  - ${issue}`));
      } else {
        console.log("✅ Система готова к работе");
        console.log(`📊 Статистика: ${health.stats.chunks} чанков, ${health.stats.documents} документов, ${health.stats.users} пользователей`);
      }
      
      // Запускаем бота
      const { startBot } = await import("./bot/bot");
      await startBot();
      
      // Запускаем дашборд (если включен)
      if (process.env.ENABLE_DASHBOARD === 'true') {
        console.log("📊 Запуск дашборда...");
        const { startDashboard } = await import("./dashboard/dashboard");
        startDashboard();
      }
      
    } catch (err: unknown) {
      console.error("❌ Ошибка при запуске бота:", err);
      console.dir(err, { depth: null });
      process.exit(1);
    }
  })();

} catch (err: unknown) {
  console.error("❌ Ошибка при синхронном выполнении:", err);
  console.dir(err, { depth: null });
  process.exit(1);
}