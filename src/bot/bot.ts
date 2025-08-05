import { Telegraf, Context, Markup } from "telegraf";
import { searchInstructions } from "../utils/search";
import { searchInstructionsWithAccess, hasAnyAccess } from "../utils/searchWithAccess";
import { askLLM } from "../utils/generateAnswer";
import { formatSearchResults, formatSummary } from "../utils/formatSources";
import { formatSearchResultsPlain, formatSummaryPlain } from "../utils/formatSourcesPlain";

export function startBot() {
  const token = process.env.BOT_TOKEN;
  if (!token) throw new Error("BOT_TOKEN is not defined in .env");

  const bot = new Telegraf(token);
  
  // Хранилище результатов поиска для каждого пользователя
  const userSearchResults = new Map<number, any[]>();
  
  // Хранилище ID последних сообщений бота для каждого пользователя
  const lastBotMessages = new Map<number, number[]>();
  
  // Функция для логирования действий
  function logAction(action: string, userId?: number, details?: any) {
    console.log(`[${new Date().toISOString()}] Action: ${action}, User: ${userId}, Details:`, details);
  }
  
  // Функция для удаления предыдущих сообщений бота
  async function deleteLastBotMessages(ctx: Context) {
    const userId = ctx.from?.id;
    if (userId && lastBotMessages.has(userId)) {
      const messagesToDelete = lastBotMessages.get(userId)!;
      console.log(`[${new Date().toISOString()}] Deleting ${messagesToDelete.length} messages for user ${userId}`);
      
      for (const msgId of messagesToDelete) {
        try {
          await ctx.telegram.deleteMessage(ctx.chat!.id, msgId);
          console.log(`[${new Date().toISOString()}] Successfully deleted message ${msgId} for user ${userId}`);
        } catch (e) {
          console.log(`[${new Date().toISOString()}] Failed to delete message ${msgId} for user ${userId}:`, e);
        }
      }
      lastBotMessages.delete(userId);
    }
  }

  bot.start(async (ctx: Context) => {
    await deleteLastBotMessages(ctx);
    const msg = await ctx.reply(
      "Привет! Я помогу найти нужную инструкцию.",
      Markup.keyboard([
        ["Задать вопрос"],
        ["Помощь", "О проекте"]
      ]).resize()
    );
    const userId = ctx.from?.id;
    if (userId) {
      lastBotMessages.set(userId, [msg.message_id]);
    }
  });

  bot.hears("Помощь", async (ctx: Context) => {
    await deleteLastBotMessages(ctx);
    const msg = await ctx.reply(
      "ℹ️ Просто напишите свой вопрос, и я попробую найти ответ в инструкциях. Если не получится — напишите в поддержку."
    );
    const userId = ctx.from?.id;
    if (userId) {
      lastBotMessages.set(userId, [msg.message_id]);
    }
  });

  bot.hears("О проекте", async (ctx: Context) => {
    await deleteLastBotMessages(ctx);
    const msg = await ctx.reply(
      "🤖 Этот бот помогает сотрудникам быстро находить информацию в PDF и Markdown-инструкциях компании с помощью ИИ."
    );
    const userId = ctx.from?.id;
    if (userId) {
      lastBotMessages.set(userId, [msg.message_id]);
    }
  });

  bot.hears("Задать вопрос", async (ctx: Context) => {
    await deleteLastBotMessages(ctx);
    const msg = await ctx.reply(
      "Пожалуйста, напишите свой вопрос текстом."
    );
    const userId = ctx.from?.id;
    if (userId) {
      lastBotMessages.set(userId, [msg.message_id]);
    }
  });

  bot.command("help", async (ctx: Context) => {
    await deleteLastBotMessages(ctx);
    const msg = await ctx.reply(
      "ℹ️ Просто напишите свой вопрос, и я попробую найти ответ в инструкциях."
    );
    const userId = ctx.from?.id;
    if (userId) {
      lastBotMessages.set(userId, [msg.message_id]);
    }
  });

  bot.on("text", async (ctx: Context) => {
    const userId = ctx.from?.id;
    const messageText = ctx.message && "text" in ctx.message ? ctx.message.text : "";
    logAction("text_message", userId, { text: messageText.substring(0, 50) + "..." });
    // Удаляем старые сообщения бота для этого пользователя
    if (userId) {
      if (lastBotMessages.has(userId)) {
        console.log(`[${new Date().toISOString()}] Deleting previous bot messages for user ${userId} before processing new query`);
        for (const msgId of lastBotMessages.get(userId)!) {
          try {
            await ctx.telegram.deleteMessage(ctx.chat!.id, msgId);
          } catch (e) {
            // Сообщение уже удалено или не найдено — игнорируем ошибку
            console.log(`[${new Date().toISOString()}] Message ${msgId} already deleted or not found for user ${userId}`);
          }
        }
        lastBotMessages.delete(userId);
      }
    }

    const msg = ctx.message;
    if (!msg || !("text" in msg)) {
      const errorMsg = await ctx.reply("Пожалуйста, отправьте текстовое сообщение.", Markup.inlineKeyboard([
        [Markup.button.callback("Задать вопрос", "ask_question")],
        [Markup.button.callback("Помощь", "help"), Markup.button.callback("О проекте", "about")]
      ]));
      if (userId) {
        lastBotMessages.set(userId, [errorMsg.message_id]);
      }
      return;
    }

    const text = msg.text;
    const processingMsg = await ctx.reply(`🔍 Обрабатываю запрос: "${text}"`, Markup.removeKeyboard());
    const processingMsgId = processingMsg.message_id;

    // Проверяем доступ пользователя к документам
    const username = ctx.from?.username;
    let results;
    
    if (username) {
      // Проверяем, есть ли у пользователя доступ к любым документам
      const hasAccess = await hasAnyAccess(username);
      if (!hasAccess) {
        await ctx.reply("🔒 У вас нет доступа к документам. Обратитесь к администратору для получения доступа.", 
          Markup.inlineKeyboard([
            [Markup.button.callback("Задать вопрос", "ask_question")],
            [Markup.button.callback("Помощь", "help"), Markup.button.callback("О проекте", "about")]
          ]));
        if (userId) {
          lastBotMessages.set(userId, [processingMsgId]);
        }
        return;
      }
      
      // Используем поиск с проверкой доступа
      results = await searchInstructionsWithAccess(text, username);
    } else {
      // Если username не указан, используем обычный поиск (для обратной совместимости)
      results = await searchInstructions(text);
    }
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
      const sentMessages: number[] = [processingMsgId];
      
      // Сохраняем результаты поиска для пользователя
      if (userId) {
        userSearchResults.set(userId, results);
      }
      
      // Показываем краткую сводку источников
      let summaryMsg;
      try {
        const summary = formatSummary(results);
        summaryMsg = await ctx.reply(summary, { parse_mode: 'Markdown' });
      } catch (error) {
        console.log("Markdown parsing error in summary, using plain format:", error);
        const summary = formatSummaryPlain(results);
        summaryMsg = await ctx.reply(summary);
      }
      sentMessages.push(summaryMsg.message_id);
      
      const msg1 = await ctx.reply(answer, Markup.inlineKeyboard([
        [Markup.button.callback("Задать вопрос", "ask_question")],
        [Markup.button.callback("Показать источники", "show_sources")],
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
        if (!fs.existsSync(filePath)) return `**#${i+1}**\n*${r.content.trim().split(/[.!?]/)[0]}*\n\n📄 **Источник:** ${r.filename} (${r.source_ref})`;
        let fullText = "";
        try {
          fullText = fs.readFileSync(filePath, "utf-8");
        } catch {
          return `**#${i+1}**\n*${r.content.trim().split(/[.!?]/)[0]}*\n\n📄 **Источник:** ${r.filename} (${r.source_ref})`;
        }
        const sentences: string[] = fullText.match(/[^.!?\n]+[.!?\n]+/g) || [fullText];
        let idx = sentences.findIndex((s: string) => s.includes(r.content.trim().slice(0, 10)));
        if (idx === -1) return `**#${i+1}**\n*${r.content.trim().split(/[.!?]/)[0]}*\n\n📄 **Источник:** ${r.filename} (${r.source_ref})`;
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
        return `**#${i+1}**\n${contextText}\n\n📕 **Источник:** ${r.filename} (${r.source_ref})`;
      }));
      // Полные источники теперь показываются по кнопке "Показать источники"
      // --- Конец изменений ---
      if (userId) {
        lastBotMessages.set(userId, sentMessages);
      }
    } else {
      const fallbackMsg = await ctx.reply("Ответ не найден. [fallback]", Markup.inlineKeyboard([
        [Markup.button.callback("Задать вопрос", "ask_question")],
        [Markup.button.callback("Помощь", "help"), Markup.button.callback("О проекте", "about")]
      ]));
      if (userId) {
        lastBotMessages.set(userId, [fallbackMsg.message_id]);
      }
    }
  });

  // Обработка нажатий на кнопки inline keyboard
  bot.action("ask_question", async (ctx) => {
    try {
      logAction("ask_question", ctx.from?.id);
      await deleteLastBotMessages(ctx);
      await ctx.answerCbQuery();
      const msg = await ctx.reply("Пожалуйста, напишите свой вопрос текстом.", Markup.removeKeyboard());
      const userId = ctx.from?.id;
      if (userId) {
        lastBotMessages.set(userId, [msg.message_id]);
      }
    } catch (error) {
      console.error("Error in ask_question handler:", error);
      try {
        await ctx.answerCbQuery("❌ Ошибка при обработке запроса");
      } catch (e) {
        console.error("Failed to answer callback query:", e);
      }
    }
  });
  bot.action("help", async (ctx) => {
    try {
      await deleteLastBotMessages(ctx);
      await ctx.answerCbQuery();
      const msg = await ctx.reply("ℹ️ Просто напишите свой вопрос, и я попробую найти ответ в инструкциях.");
      const userId = ctx.from?.id;
      if (userId) {
        lastBotMessages.set(userId, [msg.message_id]);
      }
    } catch (error) {
      console.error("Error in help handler:", error);
      try {
        await ctx.answerCbQuery("❌ Ошибка при показе справки");
      } catch (e) {
        console.error("Failed to answer callback query:", e);
      }
    }
  });
  bot.action("about", async (ctx) => {
    try {
      await deleteLastBotMessages(ctx);
      await ctx.answerCbQuery();
      const msg = await ctx.reply("🤖 Этот бот помогает сотрудникам быстро находить информацию в PDF и Markdown-инструкциях компании с помощью ИИ.");
      const userId = ctx.from?.id;
      if (userId) {
        lastBotMessages.set(userId, [msg.message_id]);
      }
    } catch (error) {
      console.error("Error in about handler:", error);
      try {
        await ctx.answerCbQuery("❌ Ошибка при показе информации");
      } catch (e) {
        console.error("Failed to answer callback query:", e);
      }
    }
  });
  
  bot.action("show_sources", async (ctx) => {
    try {
      logAction("show_sources", ctx.from?.id);
      await ctx.answerCbQuery();
      const userId = ctx.from?.id;
      
      if (userId && userSearchResults.has(userId)) {
        const results = userSearchResults.get(userId)!;
        
        try {
          // Пробуем с Markdown
          const formattedSources = formatSearchResults(results);
          const sourcesMsg = await ctx.reply(formattedSources, { parse_mode: 'Markdown' });
          if (userId) {
            const arr = lastBotMessages.get(userId) || [];
            arr.push(sourcesMsg.message_id);
            lastBotMessages.set(userId, arr);
          }
        } catch (error) {
          // Если ошибка - используем plain версию
          console.log("Markdown parsing error, using plain format:", error);
          const formattedSources = formatSearchResultsPlain(results);
          const sourcesMsg = await ctx.reply(formattedSources);
          if (userId) {
            const arr = lastBotMessages.get(userId) || [];
            arr.push(sourcesMsg.message_id);
            lastBotMessages.set(userId, arr);
          }
        }
      } else {
        const errorMsg = await ctx.reply("❌ Нет сохраненных результатов поиска. Выполните поиск заново.");
        if (userId) {
          const arr = lastBotMessages.get(userId) || [];
          arr.push(errorMsg.message_id);
          lastBotMessages.set(userId, arr);
        }
      }
    } catch (error) {
      console.error("Error in show_sources handler:", error);
      try {
        await ctx.answerCbQuery("❌ Произошла ошибка при показе источников");
      } catch (e) {
        console.error("Failed to answer callback query:", e);
      }
    }
  });

  // Обработка скачивания исходных файлов
  const path = require("path");
  const fs = require("fs");
  bot.action(/download_(.+)/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const filename = decodeURIComponent(ctx.match[1]);
      const filePath = path.join(__dirname, "../data/raw", filename);
      const userId = ctx.from?.id;
      
      if (fs.existsSync(filePath)) {
        const docMsg = await ctx.replyWithDocument({ source: filePath, filename });
        if (userId) {
          const arr = lastBotMessages.get(userId) || [];
          arr.push(docMsg.message_id);
          lastBotMessages.set(userId, arr);
        }
      } else {
        const errMsg = await ctx.reply("❌ Файл не найден на сервере.");
        if (userId) {
          const arr = lastBotMessages.get(userId) || [];
          arr.push(errMsg.message_id);
          lastBotMessages.set(userId, arr);
        }
      }
    } catch (error) {
      console.error("Error in download handler:", error);
      try {
        await ctx.answerCbQuery("❌ Ошибка при скачивании файла");
      } catch (e) {
        console.error("Failed to answer callback query:", e);
      }
    }
  });

  bot.launch();
  console.log("Бот запущен");
}