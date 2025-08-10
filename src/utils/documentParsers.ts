import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

export interface ParsedDocument {
  content: string;
  metadata: {
    title?: string;
    author?: string;
    pages?: number;
    created?: Date;
    modified?: Date;
  };
}

/**
 * Парсер для Excel файлов (.xlsx, .xls)
 */
export async function parseExcel(filePath: string): Promise<ParsedDocument> {
  try {
    // Используем Python скрипт для парсинга Excel
    const output = execSync(`python3 parse_excel.py "${filePath}"`, { 
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024 // 10MB
    });
    
    const result = JSON.parse(output);
    return {
      content: result.content,
      metadata: {
        title: result.metadata?.title,
        author: result.metadata?.author,
        pages: result.metadata?.sheets,
        created: result.metadata?.created ? new Date(result.metadata.created) : undefined,
        modified: result.metadata?.modified ? new Date(result.metadata.modified) : undefined
      }
    };
  } catch (error) {
    console.error(`❌ Ошибка парсинга Excel файла ${filePath}:`, error);
    throw new Error(`Не удалось обработать Excel файл: ${error}`);
  }
}

/**
 * Парсер для Word файлов (.docx, .doc)
 */
export async function parseWord(filePath: string): Promise<ParsedDocument> {
  try {
    // Используем Python скрипт для парсинга Word
    const output = execSync(`python3 parse_word.py "${filePath}"`, { 
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024 // 10MB
    });
    
    const result = JSON.parse(output);
    return {
      content: result.content,
      metadata: {
        title: result.metadata?.title,
        author: result.metadata?.author,
        pages: result.metadata?.pages,
        created: result.metadata?.created ? new Date(result.metadata.created) : undefined,
        modified: result.metadata?.modified ? new Date(result.metadata.modified) : undefined
      }
    };
  } catch (error) {
    console.error(`❌ Ошибка парсинга Word файла ${filePath}:`, error);
    throw new Error(`Не удалось обработать Word файл: ${error}`);
  }
}

/**
 * Парсер для PowerPoint файлов (.pptx, .ppt)
 */
export async function parsePowerPoint(filePath: string): Promise<ParsedDocument> {
  try {
    // Используем Python скрипт для парсинга PowerPoint
    const output = execSync(`python3 parse_powerpoint.py "${filePath}"`, { 
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024 // 10MB
    });
    
    const result = JSON.parse(output);
    return {
      content: result.content,
      metadata: {
        title: result.metadata?.title,
        author: result.metadata?.author,
        pages: result.metadata?.slides,
        created: result.metadata?.created ? new Date(result.metadata.created) : undefined,
        modified: result.metadata?.modified ? new Date(result.metadata.modified) : undefined
      }
    };
  } catch (error) {
    console.error(`❌ Ошибка парсинга PowerPoint файла ${filePath}:`, error);
    throw new Error(`Не удалось обработать PowerPoint файл: ${error}`);
  }
}

/**
 * Парсер для текстовых файлов (.txt)
 */
export async function parseText(filePath: string): Promise<ParsedDocument> {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const stats = fs.statSync(filePath);
    
    return {
      content,
      metadata: {
        created: stats.birthtime,
        modified: stats.mtime
      }
    };
  } catch (error) {
    console.error(`❌ Ошибка парсинга текстового файла ${filePath}:`, error);
    throw new Error(`Не удалось обработать текстовый файл: ${error}`);
  }
}

/**
 * Универсальный парсер документов
 */
export async function parseDocument(filePath: string): Promise<ParsedDocument> {
  const ext = path.extname(filePath).toLowerCase();
  
  switch (ext) {
    case '.xlsx':
    case '.xls':
      return await parseExcel(filePath);
    
    case '.docx':
    case '.doc':
      return await parseWord(filePath);
    
    case '.pptx':
    case '.ppt':
      return await parsePowerPoint(filePath);
    
    case '.txt':
      return await parseText(filePath);
    
    case '.pdf':
      // Используем существующий PDF парсер
      const { parsePDF } = await import('../data/pdfParser');
      const pdfContent = await parsePDF(filePath);
      return {
        content: pdfContent,
        metadata: {
          title: path.basename(filePath),
          created: new Date(),
          modified: new Date()
        }
      };
    
    case '.md':
      // Используем существующий Markdown парсер
      const { parseMarkdown } = await import('../data/mdParser');
      const mdContent = await parseMarkdown(filePath);
      return {
        content: Array.isArray(mdContent) ? mdContent.join('\n') : mdContent,
        metadata: {
          title: path.basename(filePath),
          created: new Date(),
          modified: new Date()
        }
      };
    
    default:
      throw new Error(`Неподдерживаемый формат файла: ${ext}`);
  }
}

/**
 * Получает список поддерживаемых форматов
 */
export function getSupportedFormats(): string[] {
  return [
    '.pdf',    // PDF документы
    '.md',     // Markdown файлы
    '.txt',    // Текстовые файлы
    '.xlsx',   // Excel файлы (новый)
    '.xls',    // Excel файлы (старый формат)
    '.docx',   // Word документы (новый)
    '.doc',    // Word документы (старый формат)
    '.pptx',   // PowerPoint презентации (новый)
    '.ppt'     // PowerPoint презентации (старый формат)
  ];
}

/**
 * Проверяет, поддерживается ли формат файла
 */
export function isSupportedFormat(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return getSupportedFormats().includes(ext);
} 