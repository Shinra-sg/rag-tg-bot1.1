import { Telegraf, Context, Markup } from "telegraf";
import { searchInstructions } from "../utils/search";
import { askLLM } from "../utils/generateAnswer";

export function startBot() {
  const token = process.env.BOT_TOKEN;
  if (!token) throw new Error("BOT_TOKEN is not defined in .env");

  const bot = new Telegraf(token);

  bot.start((ctx: Context) => ctx.reply(
    "Привет! Я помогу найти нужную инструкцию.",
    Markup.keyboard([
      ["Задать вопрос"],
      ["Помощь", "О проекте"]
    ]).resize()
  ));

  bot.hears("Помощь", (ctx: Context) => ctx.reply(
    "ℹ️ Просто напишите свой вопрос, и я попробую найти ответ в инструкциях. Если не получится — напишите в поддержку."
  ));

  bot.hears("О проекте", (ctx: Context) => ctx.reply(
    "🤖 Этот бот помогает сотрудникам быстро находить информацию в PDF и Markdown-инструкциях компании с помощью ИИ."
  ));

  bot.hears("Задать вопрос", (ctx: Context) => ctx.reply(
    "Пожалуйста, напишите свой вопрос текстом."
  ));

  bot.command("help", (ctx: Context) => ctx.reply(
    "ℹ️ Просто напишите свой вопрос, и я попробую найти ответ в инструкциях."
  ));

  bot.on("text", async (ctx: Context) => {
    const msg = ctx.message;
    if (!msg || !("text" in msg)) {
      await ctx.reply("Пожалуйста, отправьте текстовое сообщение.");
      return;
    }

    const text = msg.text;
    await ctx.reply(`🔍 Обрабатываю запрос: "${text}"`, Markup.removeKeyboard());

    const results = await searchInstructions(text);
    if (results && results.length > 0) {
      // Формируем контекст для Ollama
      const context = results.map((r, i) => `Фрагмент #${i+1}: ${r.content}`).join("\n\n");
      const prompt = `Ты — помощник по внутренним инструкциям компании. Используй только приведённые ниже фрагменты для ответа на вопрос пользователя. Если ответа нет в этих фрагментах — так и скажи. Сформулируй короткое пояснение или резюме на основе найденных фрагментов, не добавляй ничего от себя. Полный текст инструкции будет приведён ниже.\n\nФрагменты:\n${context}\n\nВопрос: ${text}\n\nКраткий ответ:`;
      let answer = "";
      try {
        answer = await askLLM(prompt, "deepseek-r1");
        // Удаляем размышления <think>...</think> из ответа
        answer = answer.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
      } catch (e) {
        answer = "Ошибка генерации ответа ИИ.";
      }
      await ctx.reply(answer); // Краткий ИИ-ответ

      // Затем отправляем цитаты с источниками
      const reply = results.map((r, i) =>
        `#${i+1}\n${r.content}\nИсточник: ${r.filename} (${r.source_ref})`
      ).join("\n\n");
      await ctx.reply(reply); // Только цитаты
    } else {
      await ctx.reply("Ответ не найден. [fallback]");
    }
  });

  bot.launch();
  console.log("Бот запущен");
}