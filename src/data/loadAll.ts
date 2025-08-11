import path from "path";
import fs from "fs";
import { parseDocument, getSupportedFormats, isSupportedFormat } from "../utils/documentParsers";
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
      const fullPath = path.join(RAW_DIR, file);
      const ext = path.extname(file).toLowerCase();
      
      // Проверяем, поддерживается ли формат
      if (!isSupportedFormat(fullPath)) {
        console.log(`⏭️ Пропускаю неподдерживаемый файл: ${file} (${ext})`);
        continue;
      }

      try {
        console.log(`📄 Обрабатываю файл: ${file} (${ext})`);
        
        // Используем универсальный парсер
        const parsedDoc = await parseDocument(fullPath);
        const text = parsedDoc.content;
        
        // Определяем тип файла
        let type = ext.slice(1); // убираем точку
        if (ext === '.md') type = 'markdown';
        if (ext === '.txt') type = 'text';
        if (['.xlsx', '.xls'].includes(ext)) type = 'excel';
        if (['.docx', '.doc'].includes(ext)) type = 'word';
        if (['.pptx', '.ppt'].includes(ext)) type = 'powerpoint';

        // Разбиваем на чанки
        const chunks = splitTextToChunks(text, 400, 50);
        console.log(`📊 Разбито на ${chunks.length} чанков`);
        
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          let sourceRef = '';
          
          // Определяем source_ref в зависимости от типа файла
          switch (type) {
            case 'markdown':
              sourceRef = `абзац ${i + 1}`;
              break;
            case 'excel':
              sourceRef = `лист ${i + 1}`;
              break;
            case 'word':
              sourceRef = `страница ${i + 1}`;
              break;
            case 'powerpoint':
              sourceRef = `слайд ${i + 1}`;
              break;
            case 'pdf':
              sourceRef = `стр. ${i + 1}`;
              break;
            default:
              sourceRef = `часть ${i + 1}`;
          }
          
          // Сохраняем в базу
          await pool.query(
            "INSERT INTO instruction_chunks (filename, chunk_index, content, type, source_ref) VALUES ($1, $2, $3, $4, $5)",
            [file, i, chunk, type, sourceRef]
          );
        }

        // Сохраняем в файл для отладки
        const outPath = path.join(PARSED_DIR, `${file}.txt`);
        fs.writeFileSync(outPath, text);
        console.log(`✅ Сохранено в файл: ${outPath}`);
        
        // Логируем метаданные если есть
        if (parsedDoc.metadata) {
          console.log(`📋 Метаданные:`, {
            title: parsedDoc.metadata.title,
            author: parsedDoc.metadata.author,
            pages: parsedDoc.metadata.pages,
            created: parsedDoc.metadata.created,
            modified: parsedDoc.metadata.modified
          });
        }
        
      } catch (error) {
        console.error(`❌ Ошибка при обработке файла ${file}:`, error);
        if (error instanceof Error && error.stack) {
          console.error(error.stack);
        }
      }
    }
    
    console.log("✅ Парсер завершен");
  } catch (err) {
    console.error("❌ Фатальная ошибка при парсинге документов:", err);
    if (err instanceof Error && err.stack) {
      console.error(err.stack);
    }
  }
}

parseDocuments();