import { config } from "dotenv";

try {
  config();

  (async () => {
    const { startBot } = await import("./bot/bot");
    try {
      await startBot();
    } catch (err: unknown) {
      console.error("❌ Ошибка при запуске бота (async):", err);
      console.dir(err, { depth: null });
    }
  })();

} catch (err: unknown) {
  console.error("❌ Ошибка при синхронном выполнении:", err);
  console.dir(err, { depth: null });
}