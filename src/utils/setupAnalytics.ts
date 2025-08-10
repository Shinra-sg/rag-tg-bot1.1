import { setupAnalyticsTables } from "./analytics";

async function main() {
  console.log("🔧 Настройка таблиц аналитики...");
  
  try {
    await setupAnalyticsTables();
    console.log("✅ Таблицы аналитики успешно настроены!");
    
    console.log("\n📊 Созданные таблицы:");
    console.log("• search_logs - логи поисковых запросов");
    console.log("• popular_queries - популярные запросы");
    console.log("• user_favorites - избранные запросы пользователей");
    console.log("• user_search_history - история поиска пользователей");
    
    console.log("\n🎯 Функции аналитики:");
    console.log("• Отслеживание количества запросов");
    console.log("• Популярные вопросы");
    console.log("• История поиска пользователей");
    console.log("• Избранные запросы");
    console.log("• Статистика по типам поиска");
    console.log("• Время ответа");
    
  } catch (error) {
    console.error("❌ Ошибка настройки аналитики:", error);
    process.exit(1);
  }
}

main(); 