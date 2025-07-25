import path from "path";
import fs from "fs";
import { parsePDF } from "./pdfParser";
import { parseMarkdown } from "./mdParser";
import pool from "../utils/db";

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err, err && err.stack);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});

console.log("🚀 Старт парсинга документов...");

const RAW_DIR = path.join(__dirname, "raw");
const PARSED_DIR = path.join(__dirname, "parsed");

function splitTextToChunks(text: string, chunkSize = 400, overlap = 50): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start += chunkSize - overlap;
  }
  return chunks;
}

// Проверка, что папка для сохранения есть
if (!fs.existsSync(PARSED_DIR)) {
  fs.mkdirSync(PARSED_DIR);
}

async function parseDocuments() {
  try {
    const files = fs.readdirSync(RAW_DIR);
    console.log("📂 Найдено файлов:", files);

    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      const fullPath = path.join(RAW_DIR, file);
      let text = "";
      let type = "";
      let sourceRefs: string[] = [];

      try {
        if (ext === ".pdf") {
          console.log(`📄 Обрабатываю PDF: ${file}`);
          text = await parsePDF(fullPath);
          type = "pdf";
          // Для PDF source_ref можно сделать по страницам, если есть разметка, иначе пусто
        } else if (ext === ".md") {
          console.log(`📝 Обрабатываю Markdown: ${file}`);
          const lines = await parseMarkdown(fullPath);
          text = lines.join("\n");
          type = "md";
        } else {
          console.log(`⏭️ Пропускаю файл: ${file}`);
          continue;
        }

        // Разбиваем на чанки
        const chunks = splitTextToChunks(text, 400, 50);
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const source_ref = type === "md" ? `абзац ${i + 1}` : `стр. ${i + 1}`;
          // Сохраняем в базу
          await pool.query(
            "INSERT INTO instruction_chunks (filename, chunk_index, content, type, source_ref) VALUES ($1, $2, $3, $4, $5)",
            [file, i, chunk, type, source_ref]
          );
        }

        // Старое сохранение в файл (можно оставить для отладки)
        const outPath = path.join(PARSED_DIR, `${file}.txt`);
        fs.writeFileSync(outPath, text);
        console.log(`✅ Сохранено в файл: ${outPath}`);
      } catch (error) {
        console.error(`❌ Ошибка при обработке файла ${file}:`, error);
        if (error instanceof Error && error.stack) {
          console.error(error.stack);
        }
      }
    }
  } catch (err) {
    console.error("❌ Фатальная ошибка при парсинге документов:", err);
    if (err instanceof Error && err.stack) {
      console.error(err.stack);
    }
  }
}

parseDocuments();