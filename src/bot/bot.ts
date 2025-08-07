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
    const welcomeMessage = `🎯 *Добро пожаловать в AI-помощник!*

Я — ваш персональный ассистент для поиска информации в корпоративных документах.

*Что я умею:*
• 🔍 Быстро находить нужную информацию
• 🤖 Генерировать краткие ответы на основе документов
• 📄 Показывать источники и цитаты
• 📁 Предоставлять доступ к исходным файлам

*Как использовать:*
Просто напишите ваш вопрос, и я найду релевантную информацию в инструкциях компании.

*Доступные команды:*
• /help — справка
• /about — о проекте`;

    const msg = await ctx.reply(welcomeMessage, {
      parse_mode: 'Markdown',
      ...Markup.keyboard([
        ["🔍 Задать вопрос"],
        ["ℹ️ Помощь", "🤖 О проекте"]
      ]).resize()
    });
    const userId = ctx.from?.id;
    if (userId) {
      lastBotMessages.set(userId, [msg.message_id]);
    }
  });

  bot.hears("Помощь", async (ctx: Context) => {
    await deleteLastBotMessages(ctx);
    const helpMessage = `ℹ️ *Справка по использованию AI-помощника*

*Как задать вопрос:*
1. Нажмите "🔍 Задать вопрос" или просто напишите ваш вопрос
2. Я найду релевантную информацию в документах
3. Предоставлю краткий ответ с источниками

*Примеры вопросов:*
• "Как настроить VPN?"
• "Правила безопасности при работе"
• "Процедура отпуска"
• "Документы для оформления"

*Дополнительные возможности:*
• 📄 "Показать источники" — полный текст найденных фрагментов
• 📁 "Скачать файл" — доступ к исходным документам
• 🔄 "Задать вопрос" — новый поиск

*Если не нашел ответ:*
Обратитесь к администратору для уточнения запроса или добавления новых документов.`;

    const msg = await ctx.reply(helpMessage, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback("🔍 Задать вопрос", "ask_question")],
        [Markup.button.callback("🤖 О проекте", "about")]
      ])
    });
    const userId = ctx.from?.id;
    if (userId) {
      lastBotMessages.set(userId, [msg.message_id]);
    }
  });

  bot.hears("О проекте", async (ctx: Context) => {
    await deleteLastBotMessages(ctx);
    const aboutMessage = `🤖 *О проекте AI-помощника*

*Назначение:*
Этот бот помогает сотрудникам быстро находить нужную информацию в корпоративных документах с помощью искусственного интеллекта.

*Технологии:*
• 🔍 Векторный поиск (RAG)
• 🤖 Локальная модель ИИ (Ollama)
• 📊 PostgreSQL с расширением pgvector
• 📄 Поддержка PDF и Markdown

*Возможности:*
• Мгновенный поиск по документам
• Семантический анализ запросов
• Генерация кратких ответов
• Доступ к исходным файлам
• Разграничение доступа к документам

*Разработка:*
Проект создан для повышения эффективности работы сотрудников и быстрого доступа к корпоративной информации.`;

    const msg = await ctx.reply(aboutMessage, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback("🔍 Задать вопрос", "ask_question")],
        [Markup.button.callback("ℹ️ Помощь", "help")]
      ])
    });
    const userId = ctx.from?.id;
    if (userId) {
      lastBotMessages.set(userId, [msg.message_id]);
    }
  });

  bot.hears("Задать вопрос", async (ctx: Context) => {
    await deleteLastBotMessages(ctx);
    const askMessage = `🔍 *Задайте ваш вопрос*

Просто напишите ваш вопрос, и я найду релевантную информацию в корпоративных документах.

*Примеры вопросов:*
• "Как настроить VPN для удаленной работы?"
• "Какие документы нужны для оформления отпуска?"
• "Правила безопасности при работе с данными"
• "Процедура получения доступа к системе"

*Советы для лучшего поиска:*
• Используйте ключевые слова
• Задавайте конкретные вопросы
• Указывайте контекст, если необходимо

*Готов к поиску!* 🚀`;

    const msg = await ctx.reply(askMessage, {
      parse_mode: 'Markdown',
      ...Markup.removeKeyboard()
    });
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
      const errorMsg = await ctx.reply(`❌ *Ошибка ввода*

Пожалуйста, отправьте текстовое сообщение с вашим вопросом.

*Примеры вопросов:*
• "Как настроить VPN?"
• "Правила безопасности"
• "Документы для отпуска"`, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback("🔍 Задать вопрос", "ask_question")],
          [Markup.button.callback("ℹ️ Помощь", "help"), Markup.button.callback("🤖 О проекте", "about")]
        ])
      });
      if (userId) {
        lastBotMessages.set(userId, [errorMsg.message_id]);
      }
      return;
    }

    const text = msg.text;
    const processingMsg = await ctx.reply(`🔍 *Обрабатываю ваш запрос...*

*Запрос:* "${text}"

⏳ Ищу релевантную информацию в документах...`, {
      parse_mode: 'Markdown',
      ...Markup.removeKeyboard()
    });
    const processingMsgId = processingMsg.message_id;

    // Проверяем доступ пользователя к документам
    const username = ctx.from?.username;
    let results;
    
    if (username) {
      // Проверяем, есть ли у пользователя доступ к любым документам
      const hasAccess = await hasAnyAccess(username);
      if (!hasAccess) {
        const noAccessMessage = `🔒 *Доступ к документам ограничен*

У вас нет доступа к корпоративным документам.

*Для получения доступа:*
1. Обратитесь к администратору системы
2. Укажите ваш username: @${username}
3. Администратор предоставит доступ к нужным документам

*Что делать дальше:*
• Нажмите "ℹ️ Помощь" для получения справки
• Обратитесь к администратору для получения доступа`;

        await ctx.reply(noAccessMessage, {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback("ℹ️ Помощь", "help")],
            [Markup.button.callback("🤖 О проекте", "about")]
          ])
        });
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
        [Markup.button.callback("🔍 Новый вопрос", "ask_question")],
        [Markup.button.callback("📄 Показать источники", "show_sources")],
        [Markup.button.callback("ℹ️ Помощь", "help"), Markup.button.callback("🤖 О проекте", "about")],
        ...results.map((r, i) => [Markup.button.callback(`📁 Скачать ${r.filename}`, `download_${encodeURIComponent(r.filename)}`)])
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
      const fallbackMsg = await ctx.reply(`🔍 *Результаты поиска*

*Запрос:* "${text}"

❌ *Информация не найдена*

К сожалению, в документах не найдена информация по вашему запросу.

*Возможные причины:*
• Запрос слишком специфичный
• Информация может быть в других документах
• Необходимо переформулировать вопрос

*Что делать:*
• Попробуйте переформулировать вопрос
• Используйте другие ключевые слова
• Обратитесь к администратору для добавления документов`, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback("🔍 Задать вопрос", "ask_question")],
          [Markup.button.callback("ℹ️ Помощь", "help"), Markup.button.callback("🤖 О проекте", "about")]
        ])
      });
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
      const askMessage = `🔍 *Задайте ваш вопрос*

Просто напишите ваш вопрос, и я найду релевантную информацию в корпоративных документах.

*Примеры вопросов:*
• "Как настроить VPN для удаленной работы?"
• "Какие документы нужны для оформления отпуска?"
• "Правила безопасности при работе с данными"
• "Процедура получения доступа к системе"

*Советы для лучшего поиска:*
• Используйте ключевые слова
• Задавайте конкретные вопросы
• Указывайте контекст, если необходимо

*Готов к поиску!* 🚀`;

      const msg = await ctx.reply(askMessage, {
        parse_mode: 'Markdown',
        ...Markup.removeKeyboard()
      });
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
      const helpMessage = `ℹ️ *Справка по использованию AI-помощника*

*Как задать вопрос:*
1. Нажмите "🔍 Задать вопрос" или просто напишите ваш вопрос
2. Я найду релевантную информацию в документах
3. Предоставлю краткий ответ с источниками

*Примеры вопросов:*
• "Как настроить VPN?"
• "Правила безопасности при работе"
• "Процедура отпуска"
• "Документы для оформления"

*Дополнительные возможности:*
• 📄 "Показать источники" — полный текст найденных фрагментов
• 📁 "Скачать файл" — доступ к исходным документам
• 🔄 "Задать вопрос" — новый поиск

*Если не нашел ответ:*
Обратитесь к администратору для уточнения запроса или добавления новых документов.`;

      const msg = await ctx.reply(helpMessage, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback("🔍 Задать вопрос", "ask_question")],
          [Markup.button.callback("🤖 О проекте", "about")]
        ])
      });
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
      const aboutMessage = `🤖 *О проекте AI-помощника*

*Назначение:*
Этот бот помогает сотрудникам быстро находить нужную информацию в корпоративных документах с помощью искусственного интеллекта.

*Технологии:*
• 🔍 Векторный поиск (RAG)
• 🤖 Локальная модель ИИ (Ollama)
• 📊 PostgreSQL с расширением pgvector
• 📄 Поддержка PDF и Markdown

*Возможности:*
• Мгновенный поиск по документам
• Семантический анализ запросов
• Генерация кратких ответов
• Доступ к исходным файлам
• Разграничение доступа к документам

*Разработка:*
Проект создан для повышения эффективности работы сотрудников и быстрого доступа к корпоративной информации.`;

      const msg = await ctx.reply(aboutMessage, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback("🔍 Задать вопрос", "ask_question")],
          [Markup.button.callback("ℹ️ Помощь", "help")]
        ])
      });
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
        const noResultsMsg = `❌ *Нет сохраненных результатов*

У вас нет сохраненных результатов поиска.

*Что делать:*
• Выполните новый поиск, задав вопрос
• Используйте кнопку "🔍 Новый вопрос"`;

        const errorMsg = await ctx.reply(noResultsMsg, {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback("🔍 Новый вопрос", "ask_question")],
            [Markup.button.callback("ℹ️ Помощь", "help")]
          ])
        });
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
        const errMsg = await ctx.reply(`❌ *Файл не найден*

Файл "${filename}" не найден на сервере.

*Возможные причины:*
• Файл был удален или перемещен
• Ошибка в пути к файлу
• Файл еще не загружен в систему

*Что делать:*
• Обратитесь к администратору
• Попробуйте другой файл из результатов поиска`);
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