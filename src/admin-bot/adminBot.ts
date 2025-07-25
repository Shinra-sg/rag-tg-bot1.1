import { Telegraf, Context, Markup } from "telegraf";
import dotenv from "dotenv";
dotenv.config();
import path from "path";
import fs from "fs";
import pool from "../utils/db";
import adminIds from "./admin_ids.json";

const token = process.env.ADMIN_BOT_TOKEN;
if (!token) throw new Error("ADMIN_BOT_TOKEN is not defined in .env");

function isAdmin(ctx: Context) {
  return ctx.from && adminIds.includes(ctx.from.id);
}

const PAGE_SIZE = 10;

// --- Логирование действий админов ---
async function logAdminAction(ctx: Context, action: string, object_type: string, object_id: number | null, object_name: string | null, details: string = "") {
  try {
    await pool.query(
      `INSERT INTO admin_logs (admin_id, admin_username, action, object_type, object_id, object_name, details) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [ctx.from?.id, ctx.from?.username ?? null, action, object_type, object_id, object_name, details]
    );
  } catch (e) {
    console.error("Ошибка логирования действия:", e);
  }
}

export function startAdminBot() {
  const bot = new Telegraf(token as string);

  // --- Подтверждение удаления ---
  const confirmStates = new Map<number, { type: 'document' | 'category'; id: number; name: string }>();

  const MAIN_MENU = Markup.keyboard([
    ["Загрузить документ", "Удалить документ", "Переместить документ"],
    ["Категории", "Список документов", "Поиск документов"]
  ]).resize();

  bot.start((ctx: Context) => {
    if (!isAdmin(ctx)) {
      ctx.reply("⛔️ Доступ только для администраторов.");
      return;
    }
    ctx.reply(
      "👋 Добро пожаловать в админ-бота!",
      MAIN_MENU
    );
  });

  bot.hears(["/menu", "Меню"], (ctx: Context) => {
    if (!isAdmin(ctx)) {
      ctx.reply("⛔️ Доступ только для администраторов.");
      return;
    }
    ctx.reply(
      "Выберите действие:",
      MAIN_MENU
    );
  });

  // --- Пагинация для документов и поиска ---
  type PaginationState = {
    type: 'documents' | 'search';
    page: number;
    query?: string;
    total: number;
  };
  const paginationStates = new Map<number, PaginationState>();

  // Модификация списка документов с пагинацией
  bot.hears("Список документов", async (ctx: Context) => {
    if (!isAdmin(ctx)) return;
    const page = 0;
    const res = await pool.query(`SELECT COUNT(*) FROM documents`);
    const total = parseInt(res.rows[0].count, 10);
    await showDocumentsPage(ctx, page, total);
    paginationStates.set(ctx.from!.id, { type: 'documents', page, total });
  });

  async function showDocumentsPage(ctx: Context, page: number, total: number) {
    const offset = page * PAGE_SIZE;
    const res = await pool.query(`
      SELECT d.id, d.original_name, d.type, d.uploaded_at, d.uploader_id, c.name AS category
      FROM documents d
      LEFT JOIN categories c ON d.category_id = c.id
      ORDER BY d.uploaded_at DESC
      LIMIT $1 OFFSET $2
    `, [PAGE_SIZE, offset]);
    if (res.rows.length === 0) {
      await ctx.reply("Документов пока нет.");
      return;
    }
    const list = res.rows.map((doc, i) =>
      `#${offset + i + 1}  ${doc.original_name || doc.filename}\n` +
      `Категория: ${doc.category || "—"}\n` +
      `Тип: ${doc.type}\n` +
      `Загружен: ${new Date(doc.uploaded_at).toLocaleString()}\n` +
      `Uploader ID: ${doc.uploader_id}`
    ).join("\n\n");
    const buttons = [];
    if (page > 0) buttons.push("⬅️ Назад");
    if ((offset + PAGE_SIZE) < total) buttons.push("➡️ Далее");
    await ctx.reply(list, buttons.length ? Markup.keyboard([buttons, ["Меню"]]).oneTime().resize() : Markup.keyboard([["Меню"]]).oneTime().resize());
  }

  // Модификация поиска с пагинацией
  bot.hears("Поиск документов", async (ctx: Context) => {
    if (!isAdmin(ctx)) return;
    await ctx.reply("Введите поисковый запрос (название, категория или uploader_id):");
    searchStates.set(ctx.from!.id, { step: "awaiting_query" });
  });

  // --- Сценарий загрузки документа ---
  const uploadStates = new Map<number, { step: string; filename?: string; filePath?: string }>();

  bot.hears("Загрузить документ", async (ctx: Context) => {
    if (!isAdmin(ctx)) return;
    uploadStates.set(ctx.from!.id, { step: "awaiting_file" });
    await ctx.reply("Пожалуйста, отправьте PDF или Markdown файл.");
  });

  bot.on("document", async (ctx: Context) => {
    if (!isAdmin(ctx)) return;
    if (!ctx.message || !('document' in ctx.message)) return;
    const state = uploadStates.get(ctx.from!.id);
    if (!state || state.step !== "awaiting_file") return;

    const file = ctx.message.document;
    const ext = path.extname(file.file_name || "").toLowerCase();
    if (ext !== ".pdf" && ext !== ".md") {
      await ctx.reply("⛔️ Поддерживаются только PDF и Markdown (.md) файлы.");
      return;
    }

    // Скачиваем файл
    const fileLink = await ctx.telegram.getFileLink(file.file_id);
    const rawDir = path.join(__dirname, "../data/raw");
    if (!fs.existsSync(rawDir)) fs.mkdirSync(rawDir, { recursive: true });
    const filePath = path.join(rawDir, file.file_name || `file_${Date.now()}${ext}`);
    const res = await fetch(fileLink.href);
    const buffer = await res.arrayBuffer();
    fs.writeFileSync(filePath, Buffer.from(buffer));

    uploadStates.set(ctx.from!.id, { step: "awaiting_category", filename: file.file_name, filePath });

    // Получаем список категорий первого уровня
    const catRes = await pool.query("SELECT id, name FROM categories WHERE parent_id IS NULL ORDER BY name");
    const categories = catRes.rows;
    const buttons = categories.map((c: any) => [c.name]);
    buttons.push(["+ Создать новую категорию"]);
    await ctx.reply(
      "Выберите категорию для документа или создайте новую:",
      Markup.keyboard(buttons).oneTime().resize()
    );
  });

  // --- Удаление документа ---
  type DeleteState = { step: string; docs?: any[] };
  const deleteStates = new Map<number, DeleteState>();

  bot.hears("Удалить документ", async (ctx: Context) => {
    if (!isAdmin(ctx)) {
      console.log("Не админ:", ctx.from?.id);
      return;
    }
    console.log("Команда 'Удалить документ' получена от", ctx.from?.id);
    await ctx.reply("Обработка удаления документа...");
    deleteStates.set(ctx.from!.id, { step: "awaiting_doc_number" });
    try {
      const res = await pool.query(`
        SELECT d.id, d.original_name, d.filename, d.type, d.uploaded_at, c.name AS category
        FROM documents d
        LEFT JOIN categories c ON d.category_id = c.id
        ORDER BY d.uploaded_at DESC
        LIMIT 20
      `);
      if (res.rows.length === 0) {
        await ctx.reply("Документов для удаления нет.");
        deleteStates.delete(ctx.from!.id);
        return;
      }
      const list = res.rows.map((doc, i) =>
        `#${i+1}  ${doc.original_name || doc.filename}\nКатегория: ${doc.category || "—"}\nТип: ${doc.type}`
      ).join("\n\n");
      await ctx.reply(
        "Выберите номер документа для удаления (отправьте число):\n\n" + list
      );
      // Сохраняем список документов для пользователя
      deleteStates.set(ctx.from!.id, { step: "awaiting_doc_number", docs: res.rows });
    } catch (e) {
      console.error("Ошибка при получении списка документов для удаления:", e);
      await ctx.reply("Ошибка при получении списка документов.");
      deleteStates.delete(ctx.from!.id);
    }
  });

  // --- Управление категориями ---
  type CategoryState = { step: string; categories?: any[]; selectedId?: number };
  const categoryStates = new Map<number, CategoryState>();

  // Обработчик для 'Категории' (множественное число)
  bot.hears("Категории", async (ctx: Context) => {
    if (!isAdmin(ctx)) return;
    try {
      const res = await pool.query("SELECT id, name FROM categories ORDER BY name");
      if (res.rows.length === 0) {
        await ctx.reply("Категорий пока нет. Хотите создать новую?", Markup.keyboard([["+ Создать категорию"], ["Меню"]]).oneTime().resize());
        categoryStates.set(ctx.from!.id, { step: "awaiting_create" });
        return;
      }
      const list = res.rows.map((cat, i) => `#${i+1}  ${cat.name}`).join("\n");
      await ctx.reply(
        "Список категорий:\n" + list,
        Markup.keyboard([
          ["+ Создать категорию", "- Удалить категорию", "✏️ Переименовать категорию"],
          ["Меню"]
        ]).oneTime().resize()
      );
      categoryStates.set(ctx.from!.id, { step: "main", categories: res.rows });
    } catch (e) {
      console.error("Ошибка при получении категорий:", e);
      await ctx.reply("Ошибка при получении категорий.");
    }
  });

  // --- Перемещение документа между категориями ---
  type MoveState = { step: string; docs?: any[]; categories?: any[]; selectedDocId?: number };
  const moveStates = new Map<number, MoveState>();

  bot.hears("Переместить документ", async (ctx: Context) => {
    if (!isAdmin(ctx)) return;
    try {
      const res = await pool.query(`
        SELECT d.id, d.original_name, d.filename, d.type, c.name AS category
        FROM documents d
        LEFT JOIN categories c ON d.category_id = c.id
        ORDER BY d.uploaded_at DESC
        LIMIT 20
      `);
      if (res.rows.length === 0) {
        await ctx.reply("Документов для перемещения нет.");
        return;
      }
      const list = res.rows.map((doc, i) =>
        `#${i+1}  ${doc.original_name || doc.filename}\nКатегория: ${doc.category || "—"}\nТип: ${doc.type}`
      ).join("\n\n");
      await ctx.reply(
        "Выберите номер документа для перемещения (отправьте число):\n\n" + list
      );
      moveStates.set(ctx.from!.id, { step: "awaiting_doc_number", docs: res.rows });
    } catch (e) {
      console.error("Ошибка при получении списка документов для перемещения:", e);
      await ctx.reply("Ошибка при получении списка документов.");
    }
  });

  // --- Поиск по документам ---
  type SearchState = { step: string };
  const searchStates = new Map<number, SearchState>();

  bot.on("text", async (ctx: Context) => {
    if (!isAdmin(ctx)) return;
    if (!ctx.message || !("text" in ctx.message)) return;
    const text = ctx.message.text.trim();

    // --- Пагинация ---
    const pagState = paginationStates.get(ctx.from!.id);
    if (pagState) {
      if (text === "➡️ Далее") {
        const nextPage = pagState.page + 1;
        if (pagState.type === 'documents') {
          await showDocumentsPage(ctx, nextPage, pagState.total);
          paginationStates.set(ctx.from!.id, { ...pagState, page: nextPage });
          return;
        }
        if (pagState.type === 'search' && pagState.query) {
          await showSearchPage(ctx, pagState.query, nextPage, pagState.total);
          paginationStates.set(ctx.from!.id, { ...pagState, page: nextPage });
          return;
        }
      }
      if (text === "⬅️ Назад" && pagState.page > 0) {
        const prevPage = pagState.page - 1;
        if (pagState.type === 'documents') {
          await showDocumentsPage(ctx, prevPage, pagState.total);
          paginationStates.set(ctx.from!.id, { ...pagState, page: prevPage });
          return;
        }
        if (pagState.type === 'search' && pagState.query) {
          await showSearchPage(ctx, pagState.query, prevPage, pagState.total);
          paginationStates.set(ctx.from!.id, { ...pagState, page: prevPage });
          return;
        }
      }
    }

    // --- Поиск с пагинацией ---
    const searchState = searchStates.get(ctx.from!.id);
    if (searchState && searchState.step === "awaiting_query") {
      const query = text;
      if (!query) {
        await ctx.reply("Пустой запрос. Введите поисковый запрос:");
        return;
      }
      const countRes = await pool.query(`
        SELECT COUNT(*) FROM documents d
        LEFT JOIN categories c ON d.category_id = c.id
        WHERE d.original_name ILIKE $1 OR d.filename ILIKE $1 OR c.name ILIKE $1 OR CAST(d.uploader_id AS TEXT) ILIKE $1
      `, [`%${query}%`]);
      const total = parseInt(countRes.rows[0].count, 10);
      await showSearchPage(ctx, query, 0, total);
      paginationStates.set(ctx.from!.id, { type: 'search', page: 0, query, total });
      searchStates.delete(ctx.from!.id);
      return;
    }

    // 1. Удаление документа
    const delState = deleteStates.get(ctx.from!.id);
    if (delState && delState.step === "awaiting_doc_number" && delState.docs) {
      const num = parseInt(text, 10);
      const docs = delState.docs;
      if (!num || num < 1 || num > docs.length) {
        await ctx.reply("Некорректный номер. Пожалуйста, отправьте число из списка.");
        return;
      }
      const doc = docs[num - 1];
      // Запрашиваем подтверждение
      await ctx.reply(`Вы уверены, что хотите удалить документ '${doc.original_name || doc.filename}'?`, Markup.keyboard([["Да"], ["Нет"]]).oneTime().resize());
      confirmStates.set(ctx.from!.id, { type: 'document', id: doc.id, name: doc.original_name || doc.filename });
      deleteStates.delete(ctx.from!.id);
      return;
    }

    // 2. Загрузка документа (категории и новая категория)
    const state = uploadStates.get(ctx.from!.id);
    if (state) {
      if (state.step === "awaiting_category") {
        const catName = text;
        if (catName === "+ Создать новую категорию") {
          uploadStates.set(ctx.from!.id, { ...state, step: "awaiting_new_category" });
          await ctx.reply("Введите название новой категории:");
          return;
        }
        const catRes = await pool.query("SELECT id FROM categories WHERE name = $1 AND parent_id IS NULL", [catName]);
        let categoryId;
        if (catRes.rows.length > 0) {
          categoryId = catRes.rows[0].id;
        } else {
          await ctx.reply("⛔️ Такой категории нет. Выберите из списка или создайте новую.");
          return;
        }
        const ext = state.filename?.split('.').pop()?.toLowerCase() || "unknown";
        const type = ext === "pdf" ? "pdf" : ext === "md" ? "md" : "unknown";
        await pool.query(
          "INSERT INTO documents (filename, category_id, type, uploader_id, original_name) VALUES ($1, $2, $3, $4, $5)",
          [state.filePath, categoryId, type, ctx.from?.id, state.filename]
        );
        uploadStates.delete(ctx.from!.id);
        await ctx.reply(`✅ Документ '${state.filename}' загружен в категорию '${catName}'.\nТип: ${type}\nКатегория: ${catName}`,
          Markup.removeKeyboard());
        await logAdminAction(ctx, "upload_document", "document", null, state.filename ?? null, `category: ${catName}`);
        return;
      }
      if (state.step === "awaiting_new_category") {
        const newCat = text;
        if (!newCat) {
          await ctx.reply("⛔️ Название не может быть пустым. Введите ещё раз:");
          return;
        }
        const ins = await pool.query("INSERT INTO categories (name) VALUES ($1) RETURNING id", [newCat]);
        const categoryId = ins.rows[0].id;
        const ext2 = state.filename?.split('.').pop()?.toLowerCase() || "unknown";
        const type2 = ext2 === "pdf" ? "pdf" : ext2 === "md" ? "md" : "unknown";
        await pool.query(
          "INSERT INTO documents (filename, category_id, type, uploader_id, original_name) VALUES ($1, $2, $3, $4, $5)",
          [state.filePath, categoryId, type2, ctx.from?.id, state.filename]
        );
        uploadStates.delete(ctx.from!.id);
        await ctx.reply(`✅ Категория '${newCat}' создана и документ '${state.filename}' загружен.\nТип: ${type2}\nКатегория: ${newCat}`,
          Markup.removeKeyboard());
        return;
      }
    }

    // --- Перемещение документа ---
    const moveState = moveStates.get(ctx.from!.id);
    if (moveState) {
      if (moveState.step === "awaiting_doc_number" && moveState.docs) {
        const num = parseInt(text, 10);
        const docs = moveState.docs;
        if (!num || num < 1 || num > docs.length) {
          await ctx.reply("Некорректный номер. Пожалуйста, отправьте число из списка.");
          return;
        }
        const doc = docs[num - 1];
        // Получаем список категорий
        const catRes = await pool.query("SELECT id, name FROM categories ORDER BY name");
        if (catRes.rows.length === 0) {
          await ctx.reply("Нет категорий для перемещения.");
          moveStates.delete(ctx.from!.id);
          return;
        }
        const list = catRes.rows.map((cat, i) => `#${i+1}  ${cat.name}`).join("\n");
        await ctx.reply("Выберите номер новой категории для документа:\n" + list);
        moveStates.set(ctx.from!.id, { step: "awaiting_cat_number", docs, categories: catRes.rows, selectedDocId: doc.id });
        return;
      }
      if (moveState.step === "awaiting_cat_number" && moveState.categories && moveState.selectedDocId) {
        const num = parseInt(text, 10);
        const cats = moveState.categories;
        if (!num || num < 1 || num > cats.length) {
          await ctx.reply("Некорректный номер. Пожалуйста, отправьте число из списка.");
          return;
        }
        const cat = cats[num - 1];
        const doc = moveState.docs?.find((d: any) => d.id === moveState.selectedDocId);
        await pool.query("UPDATE documents SET category_id = $1 WHERE id = $2", [cat.id, moveState.selectedDocId]);
        await ctx.reply(`✅ Документ перемещён в категорию '${cat.name}'!`);
        await logAdminAction(ctx, "move_document", "document", moveState.selectedDocId, doc ? (doc.original_name || doc.filename) : null, `to_category: ${cat.name}`);
        moveStates.delete(ctx.from!.id);
        return;
      }
    }

    // --- Категории ---
    const catState = categoryStates.get(ctx.from!.id);
    if (catState) {
      const text = ctx.message.text.trim();
      console.log("catState:", catState, "text:", text);
      if ((catState.step === "main" || catState.step === "awaiting_create") && text.includes("Создать категорию")) {
        console.log("Переход к созданию категории, text:", text);
        await ctx.reply("Введите название новой категории:");
        categoryStates.set(ctx.from!.id, { step: "creating" });
        return;
      }
      if (catState.step === "creating") {
        if (!text) {
          await ctx.reply("⛔️ Название не может быть пустым. Введите ещё раз:");
          return;
        }
        try {
          await pool.query("INSERT INTO categories (name) VALUES ($1)", [text]);
          await ctx.reply(`✅ Категория '${text}' создана!`, Markup.keyboard([["Меню"]]).oneTime().resize());
          await logAdminAction(ctx, "create_category", "category", null, text);
        } catch (e) {
          await ctx.reply("Ошибка при создании категории. Возможно, такая уже есть.");
        }
        categoryStates.delete(ctx.from!.id);
        return;
      }
      if (catState.step === "main" && text.startsWith("-")) {
        // Удаление категории
        const cats = catState.categories || [];
        if (cats.length === 0) {
          await ctx.reply("Нет категорий для удаления.");
          categoryStates.delete(ctx.from!.id);
          return;
        }
        const list = cats.map((cat, i) => `#${i+1}  ${cat.name}`).join("\n");
        await ctx.reply("Введите номер категории для удаления:\n" + list);
        categoryStates.set(ctx.from!.id, { step: "deleting", categories: cats });
        return;
      }
      if (catState.step === "deleting") {
        const cats = catState.categories || [];
        const num = parseInt(text, 10);
        if (!num || num < 1 || num > cats.length) {
          await ctx.reply("Некорректный номер. Пожалуйста, отправьте число из списка.");
          return;
        }
        const cat = cats[num - 1];
        // Проверяем, есть ли документы в категории
        const docs = await pool.query("SELECT 1 FROM documents WHERE category_id = $1 LIMIT 1", [cat.id]);
        if (docs.rows.length > 0) {
          await ctx.reply("⛔️ В категории есть документы. Сначала удалите или переместите их.");
          categoryStates.delete(ctx.from!.id);
          return;
        }
        // Запрашиваем подтверждение
        await ctx.reply(`Вы уверены, что хотите удалить категорию '${cat.name}'?`, Markup.keyboard([["Да"], ["Нет"]]).oneTime().resize());
        confirmStates.set(ctx.from!.id, { type: 'category', id: cat.id, name: cat.name });
        categoryStates.delete(ctx.from!.id);
        return;
      }
      if (catState.step === "main" && text.startsWith("✏️")) {
        // Переименование категории
        const cats = catState.categories || [];
        if (cats.length === 0) {
          await ctx.reply("Нет категорий для переименования.");
          categoryStates.delete(ctx.from!.id);
          return;
        }
        const list = cats.map((cat, i) => `#${i+1}  ${cat.name}`).join("\n");
        await ctx.reply("Введите номер категории для переименования:\n" + list);
        categoryStates.set(ctx.from!.id, { step: "renaming", categories: cats });
        return;
      }
      if (catState.step === "renaming") {
        const cats = catState.categories || [];
        const num = parseInt(text, 10);
        if (!num || num < 1 || num > cats.length) {
          await ctx.reply("Некорректный номер. Пожалуйста, отправьте число из списка.");
          return;
        }
        categoryStates.set(ctx.from!.id, { step: "renaming_new_name", categories: cats, selectedId: cats[num - 1].id });
        await ctx.reply("Введите новое название для категории:");
        return;
      }
      if (catState.step === "renaming_new_name" && catState.selectedId) {
        if (!text) {
          await ctx.reply("⛔️ Название не может быть пустым. Введите ещё раз:");
          return;
        }
        await pool.query("UPDATE categories SET name = $1 WHERE id = $2", [text, catState.selectedId]);
        await ctx.reply(`✅ Категория переименована в '${text}'!`, Markup.keyboard([["Меню"]]).oneTime().resize());
        await logAdminAction(ctx, "rename_category", "category", catState.selectedId, text);
        categoryStates.delete(ctx.from!.id);
        return;
      }
      // Если пользователь нажал "Меню" — сбросить состояние
      if (text === "Меню") {
        categoryStates.delete(ctx.from!.id);
        await ctx.reply("Главное меню:", Markup.keyboard([
          ["Загрузить документ"],
          ["Удалить документ"],
          ["Категории"],
          ["Список документов"]
        ]).resize());
        return;
      }
    }

    // --- Подтверждение удаления ---
    if (confirmStates.has(ctx.from!.id)) {
      if (text === "Да") {
        const conf = confirmStates.get(ctx.from!.id)!;
        if (conf.type === 'document') {
          // Удаляем документ
          const res = await pool.query("SELECT filename FROM documents WHERE id = $1", [conf.id]);
          await pool.query("DELETE FROM documents WHERE id = $1", [conf.id]);
          if (res.rows.length && fs.existsSync(res.rows[0].filename)) {
            fs.unlinkSync(res.rows[0].filename);
          }
          await ctx.reply(`Документ '${conf.name}' удалён.`, Markup.keyboard([["Меню"]]).oneTime().resize());
          await logAdminAction(ctx, "delete_document", "document", conf.id, conf.name);
        } else if (conf.type === 'category') {
          await pool.query("DELETE FROM categories WHERE id = $1", [conf.id]);
          await ctx.reply(`Категория '${conf.name}' удалена!`, Markup.keyboard([["Меню"]]).oneTime().resize());
          await logAdminAction(ctx, "delete_category", "category", conf.id, conf.name);
        }
        confirmStates.delete(ctx.from!.id);
        return;
      } else if (text === "Нет") {
        await ctx.reply("Удаление отменено.", Markup.keyboard([["Меню"]]).oneTime().resize());
        confirmStates.delete(ctx.from!.id);
        return;
      }
    }

    // Универсальный логгер для диагностики текстовых сообщений
    bot.on("text", (ctx) => {
      if (!isAdmin(ctx)) return;
      if (ctx.message && "text" in ctx.message) {
        console.log("Текстовое сообщение:", ctx.message.text);
      }
    });
  });

  bot.launch();
  console.log("Админ-бот запущен");
}

async function showSearchPage(ctx: Context, query: string, page: number, total: number) {
  const offset = page * PAGE_SIZE;
  const res = await pool.query(`
    SELECT d.id, d.original_name, d.filename, d.type, d.uploaded_at, d.uploader_id, c.name AS category
    FROM documents d
    LEFT JOIN categories c ON d.category_id = c.id
    WHERE d.original_name ILIKE $1 OR d.filename ILIKE $1 OR c.name ILIKE $1 OR CAST(d.uploader_id AS TEXT) ILIKE $1
    ORDER BY d.uploaded_at DESC
    LIMIT $2 OFFSET $3
  `, [`%${query}%`, PAGE_SIZE, offset]);
  if (res.rows.length === 0) {
    await ctx.reply("Ничего не найдено по вашему запросу.");
    return;
  }
  const list = res.rows.map((doc, i) =>
    `#${offset + i + 1}  ${doc.original_name || doc.filename}\nКатегория: ${doc.category || "—"}\nТип: ${doc.type}\nЗагружен: ${new Date(doc.uploaded_at).toLocaleString()}\nUploader ID: ${doc.uploader_id}`
  ).join("\n\n");
  const buttons = [];
  if (page > 0) buttons.push("⬅️ Назад");
  if ((offset + PAGE_SIZE) < total) buttons.push("➡️ Далее");
  await ctx.reply(list, buttons.length ? Markup.keyboard([buttons, ["Меню"]]).oneTime().resize() : Markup.keyboard([["Меню"]]).oneTime().resize());
}
