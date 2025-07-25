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

export function startAdminBot() {
  const bot = new Telegraf(token as string);

  bot.start((ctx: Context) => {
    if (!isAdmin(ctx)) {
      ctx.reply("⛔️ Доступ только для администраторов.");
      return;
    }
    ctx.reply(
      "👋 Добро пожаловать в админ-бота!",
      Markup.keyboard([
        ["Загрузить документ"],
        ["Удалить документ"],
        ["Категории"],
        ["Список документов"]
      ]).resize()
    );
  });

  bot.hears(["/menu", "Меню"], (ctx: Context) => {
    if (!isAdmin(ctx)) {
      ctx.reply("⛔️ Доступ только для администраторов.");
      return;
    }
    ctx.reply(
      "Выберите действие:",
      Markup.keyboard([
        ["Загрузить документ"],
        ["Удалить документ"],
        ["Категории"],
        ["Список документов"]
      ]).resize()
    );
  });

  // Заглушки для будущих функций
  bot.hears("Загрузить документ", (ctx: Context) => {
    if (!isAdmin(ctx)) return;
    ctx.reply("Функция загрузки документа скоро будет доступна.");
  });
  bot.hears("Удалить документ", (ctx: Context) => {
    if (!isAdmin(ctx)) return;
    ctx.reply("Функция удаления документа скоро будет доступна.");
  });
  bot.hears("Категории", (ctx: Context) => {
    if (!isAdmin(ctx)) return;
    ctx.reply("Функция управления категориями скоро будет доступна.");
  });
  bot.hears("Список документов", (ctx: Context) => {
    if (!isAdmin(ctx)) return;
    ctx.reply("Функция просмотра списка документов скоро будет доступна.");
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

  bot.on("text", async (ctx: Context) => {
    if (!isAdmin(ctx)) return;
    if (!ctx.message || !('text' in ctx.message)) return;
    const state = uploadStates.get(ctx.from!.id);
    if (!state) return; // не в процессе загрузки

    if (state.step === "awaiting_category") {
      const catName = ctx.message.text.trim();
      if (catName === "+ Создать новую категорию") {
        uploadStates.set(ctx.from!.id, { ...state, step: "awaiting_new_category" });
        await ctx.reply("Введите название новой категории:");
        return;
      }
      // Проверяем, существует ли категория
      const catRes = await pool.query("SELECT id FROM categories WHERE name = $1 AND parent_id IS NULL", [catName]);
      let categoryId;
      if (catRes.rows.length > 0) {
        categoryId = catRes.rows[0].id;
      } else {
        await ctx.reply("⛔️ Такой категории нет. Выберите из списка или создайте новую.");
        return;
      }
      // Добавляем запись о документе в базу
      const ext = state.filename?.split('.').pop()?.toLowerCase() || "unknown";
      const type = ext === "pdf" ? "pdf" : ext === "md" ? "md" : "unknown";
      await pool.query(
        "INSERT INTO documents (filename, category_id, type, uploader_id, original_name) VALUES ($1, $2, $3, $4, $5)",
        [state.filePath, categoryId, type, ctx.from?.id, state.filename]
      );
      uploadStates.delete(ctx.from!.id);
      await ctx.reply(`✅ Документ '${state.filename}' загружен в категорию '${catName}'.\nТип: ${type}\nКатегория: ${catName}`,
        Markup.removeKeyboard());
      return;
    }
    if (state.step === "awaiting_new_category") {
      const newCat = ctx.message.text.trim();
      if (!newCat) {
        await ctx.reply("⛔️ Название не может быть пустым. Введите ещё раз:");
        return;
      }
      // Создаём новую категорию
      const ins = await pool.query("INSERT INTO categories (name) VALUES ($1) RETURNING id", [newCat]);
      const categoryId = ins.rows[0].id;
      // Добавляем запись о документе в базу
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
  });

  bot.launch();
  console.log("Админ-бот запущен");
}
