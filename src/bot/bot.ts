import { Telegraf, Context, Markup } from "telegraf";
import { searchInstructions } from "../utils/search";
import { askLLM } from "../utils/generateAnswer";

export function startBot() {
  const token = process.env.BOT_TOKEN;
  if (!token) throw new Error("BOT_TOKEN is not defined in .env");

  const bot = new Telegraf(token);
  // --- Весь код, связанный с удалением сообщений, закомментирован ---
  // const lastBotMessages = new Map<number, number[]>();
  // async function deleteLastBotMessages(ctx: Context) {
  //   const userId = ctx.from?.id;
  //   if (userId && lastBotMessages.has(userId)) {
  //     for (const msgId of lastBotMessages.get(userId)!) {
  //       try {
  //         await ctx.telegram.deleteMessage(ctx.chat!.id, msgId);
  //       } catch (e) {}
  //     }
  //     lastBotMessages.delete(userId);
  //   }
  // }

  bot.start(async (ctx: Context) => {
    // await deleteLastBotMessages(ctx);
    const msg = await ctx.reply(
      "Привет! Я помогу найти нужную инструкцию.",
      Markup.keyboard([
        ["Задать вопрос"],
        ["Помощь", "О проекте"]
      ]).resize()
    );
    const userId = ctx.from?.id;
    if (userId) {
      // lastBotMessages.set(userId, [msg.message_id]);
    }
  });

  bot.hears("Помощь", async (ctx: Context) => {
    // await deleteLastBotMessages(ctx);
    const msg = await ctx.reply(
      "ℹ️ Просто напишите свой вопрос, и я попробую найти ответ в инструкциях. Если не получится — напишите в поддержку."
    );
    const userId = ctx.from?.id;
    if (userId) {
      // lastBotMessages.set(userId, [msg.message_id]);
    }
  });

  bot.hears("О проекте", async (ctx: Context) => {
    // await deleteLastBotMessages(ctx);
    const msg = await ctx.reply(
      "🤖 Этот бот помогает сотрудникам быстро находить информацию в PDF и Markdown-инструкциях компании с помощью ИИ."
    );
    const userId = ctx.from?.id;
    if (userId) {
      // lastBotMessages.set(userId, [msg.message_id]);
    }
  });

  bot.hears("Задать вопрос", async (ctx: Context) => {
    // await deleteLastBotMessages(ctx);
    const msg = await ctx.reply(
      "Пожалуйста, напишите свой вопрос текстом."
    );
    const userId = ctx.from?.id;
    if (userId) {
      // lastBotMessages.set(userId, [msg.message_id]);
    }
  });

  bot.command("help", async (ctx: Context) => {
    // await deleteLastBotMessages(ctx);
    const msg = await ctx.reply(
      "ℹ️ Просто напишите свой вопрос, и я попробую найти ответ в инструкциях."
    );
    const userId = ctx.from?.id;
    if (userId) {
      // lastBotMessages.set(userId, [msg.message_id]);
    }
  });

  bot.on("text", async (ctx: Context) => {
    const userId = ctx.from?.id;
    // Удаляем старые сообщения бота для этого пользователя
    if (userId) {
      // if (lastBotMessages.has(userId)) {
      //   for (const msgId of lastBotMessages.get(userId)!) {
      //     try {
      //       await ctx.telegram.deleteMessage(ctx.chat!.id, msgId);
      //     } catch (e) {
      //       // Сообщение уже удалено или не найдено — игнорируем ошибку
      //     }
      //   }
      //   lastBotMessages.delete(userId);
      // }
    }

    const msg = ctx.message;
    if (!msg || !("text" in msg)) {
      await ctx.reply("Пожалуйста, отправьте текстовое сообщение.", Markup.inlineKeyboard([
        [Markup.button.callback("Задать вопрос", "ask_question")],
        [Markup.button.callback("Помощь", "help"), Markup.button.callback("О проекте", "about")]
      ]));
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
      const sentMessages: number[] = [];
      const msg1 = await ctx.reply(answer, Markup.inlineKeyboard([
        [Markup.button.callback("Задать вопрос", "ask_question")],
        [Markup.button.callback("Помощь", "help"), Markup.button.callback("О проекте", "about")],
        ...results.map((r, i) => [Markup.button.callback(`Скачать файл #${i+1}`, `download_${encodeURIComponent(r.filename)}`)])
      ]));
      sentMessages.push(msg1.message_id);

      // --- Весь код, связанный с выделением и parse_mode, закомментирован ---
      // Гугл-стиль: показываем контекст вокруг найденного чанка
      function highlightKey(text: string, key: string): string {
        const cleanKey = key.replace(/\n/g, ' ').trim();
        // Не выделяем слишком короткие или подозрительные фразы
        if (cleanKey.length < 3 || !/[a-zA-Zа-яА-Я0-9]/.test(cleanKey)) {
          // Экранируем спецсимволы в тексте, чтобы Telegram не ругался
          return text.replace(/([_\*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
        }
        // Экранируем спецсимволы кроме * в ключе
        const safeKey = cleanKey.replace(/([_\[\]()~`>#+\-=|{}.!])/g, '\\$1');
        // Если ключ найден — выделяем, иначе просто экранируем всё предложение
        if (text.includes(cleanKey)) {
          return text.replace(cleanKey, `*${safeKey}*`);
        }
        // Если не нашли ключ — экранируем всё предложение
        return text.replace(/([_\*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
      }
      let googleStyleBlocks = await Promise.all(results.map(async (r, i) => {
        const path = require("path");
        const fs = require("fs");
        const filePath = path.join(__dirname, "../data/raw", r.filename);
        if (!fs.existsSync(filePath)) return `#${i+1}\n*${r.content.trim().split(/[.!?]/)[0]}*\nИсточник: ${r.filename} (${r.source_ref})`;
        let fullText = "";
        try {
          fullText = fs.readFileSync(filePath, "utf-8");
        } catch {
          return `#${i+1}\n*${r.content.trim().split(/[.!?]/)[0]}*\nИсточник: ${r.filename} (${r.source_ref})`;
        }
        const sentences: string[] = fullText.match(/[^.!?\n]+[.!?\n]+/g) || [fullText];
        let idx = sentences.findIndex((s: string) => s.includes(r.content.trim().slice(0, 10)));
        if (idx === -1) return `#${i+1}\n*${r.content.trim().split(/[.!?]/)[0]}*\nИсточник: ${r.filename} (${r.source_ref})`;
        const before = idx > 0 ? sentences[idx-1].trim() : "";
        const after = idx < sentences.length-1 ? sentences[idx+1].trim() : "";
        const keyPhrase = r.content.trim().split(/[.!?]/)[0];
        let main = highlightKey(sentences[idx].trim(), keyPhrase);
        // Формируем компактный блок с источником
        let contextText = [before, main, after].filter(Boolean).join(" ").trim();
        // Если контекст пустой или подозрительный — показываем весь чанк
        if (!contextText || contextText.length < 10 || /^\W+$/.test(contextText)) {
          contextText = r.content.trim();
          // Если и чанк подозрительный — пишем "_Фрагмент не найден_"
          if (!contextText || contextText.length < 5 || /^\W+$/.test(contextText)) {
            contextText = "_Фрагмент не найден_";
          }
        }
        return `#${i+1}\n${contextText}\nИсточник: ${r.filename} (${r.source_ref})`;
      }));
      const reply = results.map((r, i) =>
        `#${i+1}\n${r.content}\nИсточник: ${r.filename} (${r.source_ref})`
      ).join("\n\n");
      await ctx.reply(reply); // Просто текст, без Markdown
      // --- Конец изменений ---
      if (userId) {
        // lastBotMessages.set(userId, sentMessages);
      }
    } else {
      await ctx.reply("Ответ не найден. [fallback]", Markup.inlineKeyboard([
        [Markup.button.callback("Задать вопрос", "ask_question")],
        [Markup.button.callback("Помощь", "help"), Markup.button.callback("О проекте", "about")]
      ]));
    }
  });

  // Обработка нажатий на кнопки inline keyboard
  bot.action("ask_question", async (ctx) => {
    // await deleteLastBotMessages(ctx);
    await ctx.answerCbQuery();
    const msg = await ctx.reply("Пожалуйста, напишите свой вопрос текстом.", Markup.removeKeyboard());
    const userId = ctx.from?.id;
    if (userId) {
      // lastBotMessages.set(userId, [msg.message_id]);
    }
  });
  bot.action("help", async (ctx) => {
    // await deleteLastBotMessages(ctx);
    await ctx.answerCbQuery();
    const msg = await ctx.reply("ℹ️ Просто напишите свой вопрос, и я попробую найти ответ в инструкциях.");
    const userId = ctx.from?.id;
    if (userId) {
      // lastBotMessages.set(userId, [msg.message_id]);
    }
  });
  bot.action("about", async (ctx) => {
    // await deleteLastBotMessages(ctx);
    await ctx.answerCbQuery();
    const msg = await ctx.reply("🤖 Этот бот помогает сотрудникам быстро находить информацию в PDF и Markdown-инструкциях компании с помощью ИИ.");
    const userId = ctx.from?.id;
    if (userId) {
      // lastBotMessages.set(userId, [msg.message_id]);
    }
  });

  // Обработка скачивания исходных файлов
  const path = require("path");
  const fs = require("fs");
  bot.action(/download_(.+)/, async (ctx) => {
    await ctx.answerCbQuery();
    const filename = decodeURIComponent(ctx.match[1]);
    const filePath = path.join(__dirname, "../data/raw", filename);
    const userId = ctx.from?.id;
    if (fs.existsSync(filePath)) {
      const docMsg = await ctx.replyWithDocument({ source: filePath, filename });
      if (userId) {
        // const arr = lastBotMessages.get(userId) || [];
        // arr.push(docMsg.message_id);
        // lastBotMessages.set(userId, arr);
      }
    } else {
      const errMsg = await ctx.reply("Файл не найден на сервере.");
      if (userId) {
        // const arr = lastBotMessages.get(userId) || [];
        // arr.push(errMsg.message_id);
        // lastBotMessages.set(userId, arr);
      }
    }
  });

  bot.launch();
  console.log("Бот запущен");
}