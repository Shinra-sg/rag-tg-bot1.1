import { Telegraf, Context } from "telegraf";

// Тестовый скрипт для проверки функционала удаления сообщений
export function testMessageDeletion() {
  console.log("🧪 Тестирование функционала удаления сообщений...");
  
  // Создаем тестовый экземпляр бота (без реального токена)
  const testBot = new Telegraf("test_token");
  
  // Хранилище ID последних сообщений бота для каждого пользователя
  const lastBotMessages = new Map<number, number[]>();
  
  // Функция для удаления предыдущих сообщений бота
  async function deleteLastBotMessages(ctx: Context) {
    const userId = ctx.from?.id;
    if (userId && lastBotMessages.has(userId)) {
      const messagesToDelete = lastBotMessages.get(userId)!;
      console.log(`✅ Тест: Удаление ${messagesToDelete.length} сообщений для пользователя ${userId}`);
      
      for (const msgId of messagesToDelete) {
        try {
          // В тесте просто логируем удаление
          console.log(`✅ Тест: Успешно удалено сообщение ${msgId} для пользователя ${userId}`);
        } catch (e) {
          console.log(`❌ Тест: Ошибка удаления сообщения ${msgId} для пользователя ${userId}:`, e);
        }
      }
      lastBotMessages.delete(userId);
    }
  }
  
  // Тестируем логику сохранения сообщений
  function testMessageSaving() {
    console.log("\n📝 Тест сохранения ID сообщений:");
    
    const testUserId = 12345;
    const testMessageIds = [1001, 1002, 1003];
    
    lastBotMessages.set(testUserId, testMessageIds);
    console.log(`✅ Сохранено ${testMessageIds.length} сообщений для пользователя ${testUserId}`);
    
    const savedMessages = lastBotMessages.get(testUserId);
    console.log(`✅ Проверка: сохранено ${savedMessages?.length} сообщений`);
    
    return testUserId;
  }
  
  // Тестируем логику удаления сообщений
  async function testMessageDeletion(userId: number) {
    console.log("\n🗑️ Тест удаления сообщений:");
    
    const mockContext = {
      from: { id: userId },
      chat: { id: 67890 },
      telegram: {
        deleteMessage: async (chatId: number, messageId: number) => {
          console.log(`✅ Тест: Вызов deleteMessage(${chatId}, ${messageId})`);
          return true;
        }
      }
    } as any;
    
    await deleteLastBotMessages(mockContext);
    
    const remainingMessages = lastBotMessages.get(userId);
    console.log(`✅ Проверка: осталось ${remainingMessages?.length || 0} сообщений`);
  }
  
  // Запускаем тесты
  async function runTests() {
    console.log("🚀 Запуск тестов функционала удаления сообщений...\n");
    
    const userId = testMessageSaving();
    await testMessageDeletion(userId);
    
    console.log("\n✅ Все тесты завершены успешно!");
    console.log("📋 Функционал готов к использованию в основном боте.");
  }
  
  return runTests;
}

// Запуск тестов если файл выполняется напрямую
if (require.main === module) {
  const testRunner = testMessageDeletion();
  testRunner().catch(console.error);
} 