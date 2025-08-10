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
          [Markup.button.callback("⭐ Добавить в избранное", `favorite_${text.substring(0, 20).replace(/[^a-zA-Zа-яА-Я0-9\s]/g, '')}`)],
          [Markup.button.callback("ℹ️ Помощь", "help"), Markup.button.callback("🤖 О проекте", "about")],
          ...results.map((r) => [Markup.button.callback(`📁 Скачать ${r.filename.substring(0, 20)}`, `download_${r.filename.substring(0, 20).replace(/[^a-zA-Zа-яА-Я0-9\s]/g, '')}`)])
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

  // Обработка добавления в избранное
  bot.action(/^favorite_(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const userId = ctx.from?.id;
      if (!userId) return;
      
      const query = ctx.match[1];
      await addToFavorites(userId, query);
      
      const msg = await ctx.reply(`⭐ *Добавлено в избранное*

Запрос "${query}" успешно добавлен в ваши избранные запросы.

*Что дальше?*
• Просмотреть все избранные запросы
• Задать новый вопрос
• Обратиться к истории поиска`, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback("⭐ Мои избранные", "my_favorites")],
          [Markup.button.callback("🔍 Новый вопрос", "ask_question")],
          [Markup.button.callback("📋 История поиска", "search_history")]
        ])
      });
      
      if (userId) {
        const arr = lastBotMessages.get(userId) || [];
        arr.push(msg.message_id);
        lastBotMessages.set(userId, arr);
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

  // Обработка скачивания документа
  bot.action(/^download_(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const userId = ctx.from?.id;
      if (!userId) return;
      
      const filename = ctx.match[1];
      
      // Проверяем доступ к документу
      const username = ctx.from?.username;
      const hasAccess = username ? await hasAnyAccess(username) : false;
      if (!hasAccess) {
        const msg = await ctx.reply(`⛔️ *Доступ ограничен*

У вас нет доступа к документу "${filename}".

*Для получения доступа:*
• Обратитесь к администратору
• Укажите причину необходимости доступа
• Администратор рассмотрит ваш запрос`, {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback("🔍 Новый вопрос", "ask_question")],
            [Markup.button.callback("ℹ️ Помощь", "help")]
          ])
        });
        
        if (userId) {
          const arr = lastBotMessages.get(userId) || [];
          arr.push(msg.message_id);
          lastBotMessages.set(userId, arr);
        }
        return;
      }
      
      // Здесь должна быть логика скачивания документа
      const msg = await ctx.reply(`📁 *Скачивание документа*

Документ "${filename}" готов к скачиванию.

*Примечание:* Функция скачивания находится в разработке.

*Что дальше?*
• Задать новый вопрос
• Просмотреть другие документы
• Обратиться к помощи`, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback("🔍 Новый вопрос", "ask_question")],
          [Markup.button.callback("📄 Показать источники", "show_sources")],
          [Markup.button.callback("ℹ️ Помощь", "help")]
        ])
      });
      
      if (userId) {
        const arr = lastBotMessages.get(userId) || [];
        arr.push(msg.message_id);
        lastBotMessages.set(userId, arr);
      }
    } catch (error) {
      console.error("Error in download handler:", error);
      try {
        await ctx.answerCbQuery("❌ Ошибка при скачивании документа");
      } catch (e) {
        console.error("Failed to answer callback query:", e);
      }
    }
  });

  // Обработка просмотра избранных запросов
  bot.action("my_favorites", async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const userId = ctx.from?.id;
      if (!userId) return;
      
      // Получаем избранные запросы пользователя
      const userAnalytics = await getUserAnalytics(userId);
      if (!userAnalytics || !userAnalytics.favoriteQueries || userAnalytics.favoriteQueries.length === 0) {
        const msg = await ctx.reply(`⭐ *Мои избранные*

У вас пока нет избранных запросов.

*Как добавить в избранное:*
• Задайте вопрос и нажмите кнопку "⭐ Добавить в избранное"
• Ваши любимые запросы будут сохранены здесь`, {
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

      const favoritesText = userAnalytics.favoriteQueries.map((query: string, i: number) => 
        `${i + 1}. "${query}"`
      ).join('\n');

      const msg = await ctx.reply(`⭐ *Мои избранные*

*Ваши избранные запросы:*
${favoritesText}

*Что дальше?*
• Задать новый вопрос
• Просмотреть историю поиска
• Обратиться к помощи`, {
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
      console.error("Error in my_favorites handler:", error);
      try {
        await ctx.answerCbQuery("❌ Ошибка при получении избранных");
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