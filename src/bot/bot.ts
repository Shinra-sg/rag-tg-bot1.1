import { Telegraf, Context, Markup } from "telegraf";
import { searchInstructions } from "../utils/search";
import { searchInstructionsWithAccess, hasAnyAccess } from "../utils/searchWithAccess";
import { hybridSearch, smartSearch, SearchResult } from "../utils/hybridSearch";
import { askLLM } from "../utils/generateAnswer";
import { formatSearchResults, formatSummary } from "../utils/formatSources";
import { formatSearchResultsPlain, formatSummaryPlain } from "../utils/formatSourcesPlain";
import { 
  logSearch, 
  getUserAnalytics, 
  addToFavorites, 
  removeFromFavorites, 
  getUserSearchHistory,
  getPopularQueries 
} from "../utils/analytics";
import { performFullCleanup, getDatabaseStats } from "../utils/cleanup";

export function startBot() {
  const token = process.env.BOT_TOKEN;
  if (!token) throw new Error("BOT_TOKEN is not defined in .env");

  const bot = new Telegraf(token);
  
  // Хранилище результатов поиска для каждого пользователя
  const userSearchResults = new Map<number, SearchResult[]>();
  
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
      console.log(`[${new Date().toISOString()}] 🗑️ Удаление ${messagesToDelete.length} сообщений для пользователя ${userId}`);
      
      let deletedCount = 0;
      for (const msgId of messagesToDelete) {
        try {
          await ctx.telegram.deleteMessage(ctx.chat!.id, msgId);
          deletedCount++;
          console.log(`[${new Date().toISOString()}] ✅ Удалено сообщение ${msgId} для пользователя ${userId}`);
        } catch (e) {
          // Сообщение уже удалено или не найдено — игнорируем ошибку
          console.log(`[${new Date().toISOString()}] ⚠️ Сообщение ${msgId} уже удалено или не найдено для пользователя ${userId}`);
        }
      }
      
      console.log(`[${new Date().toISOString()}] 📊 Удалено ${deletedCount}/${messagesToDelete.length} сообщений для пользователя ${userId}`);
      lastBotMessages.delete(userId);
    }
  }

  // Функция для периодической очистки системы
  async function scheduleCleanup() {
    // Очистка каждые 24 часа
    setInterval(async () => {
      try {
        console.log("🧹 Запуск плановой очистки системы...");
        const cleanupResult = await performFullCleanup();
        
        if (cleanupResult.success) {
          console.log(`✅ Плановая очистка завершена: ${cleanupResult.message}`);
        } else {
          console.warn(`⚠️ Плановая очистка завершена с ошибками: ${cleanupResult.message}`);
        }
        
        // Получаем статистику после очистки
        const stats = await getDatabaseStats();
        console.log(`📊 Статистика после очистки: ${stats.totalSize} общий размер`);
        
      } catch (error) {
        console.error("❌ Ошибка при плановой очистке:", error);
      }
    }, 24 * 60 * 60 * 1000); // 24 часа
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
        console.log(`[${new Date().toISOString()}] 🗑️ Удаление предыдущих сообщений бота для пользователя ${userId} перед обработкой нового запроса`);
        await deleteLastBotMessages(ctx);
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
    const startTime = Date.now();
    
    const processingMsg = await ctx.reply(`🔍 *Обрабатываю ваш запрос...*

*Запрос:* "${text}"

⏳ Ищу релевантную информацию в документах...`, {
      parse_mode: 'Markdown',
      ...Markup.removeKeyboard()
    });
    const processingMsgId = processingMsg.message_id;

    try {
      // Проверяем доступ пользователя к документам
      const username = ctx.from?.username;
      let results: SearchResult[] | null = null;
      let searchType: 'vector' | 'keyword' | 'hybrid' = 'hybrid';
      
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
        
        // Используем гибридный поиск с проверкой доступа
        try {
          const hybridResults = await hybridSearch(text, { maxResults: 5 });
          results = hybridResults;
          searchType = hybridResults[0]?.search_type || 'hybrid';
        } catch (e) {
          console.error("❌ Ошибка гибридного поиска, fallback на обычный:", e);
          const fallbackResults = await searchInstructionsWithAccess(text, username);
          results = fallbackResults.map(r => ({
            content: r.content,
            filename: r.filename,
            source_ref: r.source_ref,
            score: 1.0,
            search_type: 'vector' as const
          }));
          searchType = 'vector';
        }
      } else {
        // Если username не указан, используем гибридный поиск
        try {
          const hybridResults = await hybridSearch(text, { maxResults: 5 });
          results = hybridResults;
          searchType = hybridResults[0]?.search_type || 'hybrid';
        } catch (e) {
          console.error("❌ Ошибка гибридного поиска, fallback на обычный:", e);
          const fallbackResults = await searchInstructions(text);
          results = fallbackResults.map(r => ({
            content: r.content,
            filename: r.filename,
            source_ref: r.source_ref,
            score: 1.0,
            search_type: 'vector' as const
          }));
          searchType = 'vector';
        }
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
          console.error("❌ Ошибка генерации ответа ИИ:", e);
          answer = "Ошибка генерации ответа ИИ. Попробуйте переформулировать вопрос.";
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
          console.log("⚠️ Ошибка Markdown в сводке, используем plain формат:", error);
          const summary = formatSummaryPlain(results);
          summaryMsg = await ctx.reply(summary);
        }
        sentMessages.push(summaryMsg.message_id);
        
        // Логируем аналитику
        const responseTime = Date.now() - startTime;
        if (userId) {
          await logSearch(userId, username, text, searchType, results.length, responseTime, true);
        }

        const msg1 = await ctx.reply(answer, Markup.inlineKeyboard([
          [Markup.button.callback("🔍 Новый вопрос", "ask_question")],
          [Markup.button.callback("📄 Показать источники", "show_sources")],
          [Markup.button.callback("⭐ Добавить в избранное", `favorite_${encodeURIComponent(text)}`)],
          [Markup.button.callback("ℹ️ Помощь", "help"), Markup.button.callback("🤖 О проекте", "about")],
          ...results.map((r) => [Markup.button.callback(`📁 Скачать ${r.filename}`, `download_${encodeURIComponent(r.filename)}`)])
        ]));
        sentMessages.push(msg1.message_id);

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
    } catch (error) {
      console.error("❌ Ошибка при обработке запроса:", error);
      const errorMsg = await ctx.reply(`❌ *Произошла ошибка*

При обработке вашего запроса произошла ошибка.

*Что делать:*
• Попробуйте повторить запрос
• Обратитесь к администратору, если проблема повторяется
• Используйте кнопку "ℹ️ Помощь" для получения справки`, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback("🔍 Задать вопрос", "ask_question")],
          [Markup.button.callback("ℹ️ Помощь", "help")]
        ])
      });
      if (userId) {
        lastBotMessages.set(userId, [errorMsg.message_id]);
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

  // Обработка добавления в избранное
  bot.action(/favorite_(.+)/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const query = decodeURIComponent(ctx.match[1]);
      const userId = ctx.from?.id;
      
      if (userId) {
        const success = await addToFavorites(userId, query);
        if (success) {
          const msg = await ctx.reply(`⭐ *Добавлено в избранное!*

Запрос "${query}" успешно добавлен в ваше избранное.

*Что дальше:*
• Используйте "📋 История поиска" для просмотра избранного
• Повторите поиск в любое время`, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.callback("📋 История поиска", "search_history")],
              [Markup.button.callback("🔍 Новый вопрос", "ask_question")]
            ])
          });
          const arr = lastBotMessages.get(userId) || [];
          arr.push(msg.message_id);
          lastBotMessages.set(userId, arr);
        } else {
          await ctx.reply("❌ Ошибка при добавлении в избранное");
        }
      }
    } catch (error) {
      console.error("Error in favorite handler:", error);
      try {
        await ctx.answerCbQuery("❌ Ошибка при добавлении в избранное");
      } catch (e) {
        console.error("Failed to answer callback query:", e);
      }
    }
  });

  // Обработка истории поиска
  bot.action("search_history", async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const userId = ctx.from?.id;
      
      if (userId) {
        const history = await getUserSearchHistory(userId, 5);
        const analytics = await getUserAnalytics(userId);
        
        if (history.length === 0) {
          const msg = await ctx.reply(`📋 *История поиска*

У вас пока нет истории поиска.

*Начните поиск:*
• Задайте вопрос для поиска информации
• Ваши запросы будут сохраняться здесь`, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.callback("🔍 Новый вопрос", "ask_question")],
              [Markup.button.callback("ℹ️ Помощь", "help")]
            ])
          });
          const arr = lastBotMessages.get(userId) || [];
          arr.push(msg.message_id);
          lastBotMessages.set(userId, arr);
          return;
        }

        const historyText = history.map((item, i) => 
          `${i + 1}. "${item.query}" (${item.resultsCount} результатов, ${item.searchType})`
        ).join('\n');

        const analyticsText = analytics ? 
          `\n*Ваша статистика:*
• Всего запросов: ${analytics.totalSearches}
• Избранных запросов: ${analytics.favoriteQueries.length}
• Последний поиск: ${analytics.lastSearch ? new Date(analytics.lastSearch).toLocaleDateString() : 'Нет'}` : '';

        const msg = await ctx.reply(`📋 *История поиска*${analyticsText}

*Последние запросы:*
${historyText}

*Избранные запросы:*
${analytics?.favoriteQueries.length ? analytics.favoriteQueries.slice(0, 3).map(q => `• "${q}"`).join('\n') : 'Нет избранных запросов'}`, {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback("🔍 Новый вопрос", "ask_question")],
            [Markup.button.callback("📊 Популярные запросы", "popular_queries")],
            [Markup.button.callback("ℹ️ Помощь", "help")]
          ])
        });
        const arr = lastBotMessages.get(userId) || [];
        arr.push(msg.message_id);
        lastBotMessages.set(userId, arr);
      }
    } catch (error) {
      console.error("Error in search_history handler:", error);
      try {
        await ctx.answerCbQuery("❌ Ошибка при получении истории");
      } catch (e) {
        console.error("Failed to answer callback query:", e);
      }
    }
  });

  // Обработка популярных запросов
  bot.action("popular_queries", async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const userId = ctx.from?.id;
      
      const popularQueries = await getPopularQueries(10);
      
      if (popularQueries.length === 0) {
        const msg = await ctx.reply(`📊 *Популярные запросы*

Пока нет популярных запросов.

*Будьте первым:*
• Задайте вопрос для поиска информации
• Ваш запрос может стать популярным!`, {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback("🔍 Новый вопрос", "ask_question")],
            [Markup.button.callback("📋 История поиска", "search_history")]
          ])
        });
        if (userId) {
          const arr = lastBotMessages.get(userId) || [];
          arr.push(msg.message_id);
          lastBotMessages.set(userId, arr);
        }
        return;
      }

      const popularText = popularQueries.map((item, i) => 
        `${i + 1}. "${item.query}" (${item.count} раз)`
      ).join('\n');

      const msg = await ctx.reply(`📊 *Популярные запросы*

*Топ-10 популярных запросов:*
${popularText}

*Хотите попробовать один из них?*
Просто скопируйте и отправьте любой запрос!`, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback("🔍 Новый вопрос", "ask_question")],
          [Markup.button.callback("📋 История поиска", "search_history")],
          [Markup.button.callback("ℹ️ Помощь", "help")]
        ])
      });
      if (userId) {
        const arr = lastBotMessages.get(userId) || [];
        arr.push(msg.message_id);
        lastBotMessages.set(userId, arr);
      }
    } catch (error) {
      console.error("Error in popular_queries handler:", error);
      try {
        await ctx.answerCbQuery("❌ Ошибка при получении популярных запросов");
      } catch (e) {
        console.error("Failed to answer callback query:", e);
      }
    }
  });

  bot.launch();
  console.log("🤖 Бот запущен");
  
  // Запускаем периодическую очистку
  scheduleCleanup();
  console.log("🧹 Периодическая очистка запланирована (каждые 24 часа)");
  
  // Обработка graceful shutdown
  process.once('SIGINT', () => {
    console.log("🛑 Получен сигнал SIGINT, останавливаем бота...");
    bot.stop('SIGINT');
  });
  
  process.once('SIGTERM', () => {
    console.log("🛑 Получен сигнал SIGTERM, останавливаем бота...");
    bot.stop('SIGTERM');
  });
}