import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface OCRResult {
  success: boolean;
  text?: string;
  method?: string;
  error?: string;
  metadata?: {
    image_size?: [number, number];
    image_mode?: string;
    image_format?: string;
    detected_blocks?: number;
    confidence_scores?: number[];
  };
}

export interface ParsedImageDocument {
  content: string;
  metadata: {
    filename: string;
    original_filename: string;
    file_size: number;
    image_size?: [number, number];
    ocr_method: string;
    confidence_score?: number;
    processing_date: string;
  };
}

/**
 * Распознает текст с изображения используя Python OCR скрипт
 */
export async function extractTextFromImage(imagePath: string): Promise<OCRResult> {
  try {
    console.log(`🔍 Начинаю OCR обработку: ${imagePath}`);
    
    // Проверяем существование файла
    if (!fs.existsSync(imagePath)) {
      return {
        success: false,
        error: `Файл не найден: ${imagePath}`
      };
    }
    
    // Запускаем Python OCR скрипт
    const result = execSync(`python3 ocr_parser.py "${imagePath}"`, {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer для больших изображений
    });
    
    // Очищаем результат от возможных отладочных сообщений
    const cleanResult = result.trim();
    const jsonStart = cleanResult.indexOf('{');
    const jsonEnd = cleanResult.lastIndexOf('}') + 1;
    
    if (jsonStart === -1 || jsonEnd === 0) {
      throw new Error('Не удалось найти JSON в ответе Python скрипта');
    }
    
    const jsonString = cleanResult.substring(jsonStart, jsonEnd);
    
    // Парсим JSON результат
    const ocrResult: OCRResult = JSON.parse(jsonString);
    
    if (ocrResult.success) {
      console.log(`✅ OCR успешно завершен методом: ${ocrResult.method}`);
      console.log(`📝 Распознано символов: ${ocrResult.text?.length || 0}`);
    } else {
      console.error(`❌ OCR ошибка: ${ocrResult.error}`);
    }
    
    return ocrResult;
    
  } catch (error) {
    console.error(`❌ Ошибка при OCR обработке:`, error);
    return {
      success: false,
      error: `Ошибка выполнения OCR: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Обрабатывает изображение и возвращает структурированный документ
 */
export async function parseImageDocument(imagePath: string, originalFilename: string): Promise<ParsedImageDocument | null> {
  try {
    console.log(`🖼️ Обрабатываю изображение: ${originalFilename}`);
    
    // Получаем информацию о файле
    const stats = fs.statSync(imagePath);
    
    // Выполняем OCR
    const ocrResult = await extractTextFromImage(imagePath);
    
    if (!ocrResult.success || !ocrResult.text) {
      console.error(`❌ Не удалось распознать текст с изображения: ${originalFilename}`);
      return null;
    }
    
    // Создаем структурированный документ
    const parsedDocument: ParsedImageDocument = {
      content: ocrResult.text,
      metadata: {
        filename: path.basename(imagePath),
        original_filename: originalFilename,
        file_size: stats.size,
        image_size: ocrResult.metadata?.image_size,
        ocr_method: ocrResult.method || 'unknown',
        confidence_score: ocrResult.metadata?.confidence_scores?.[0] || 0,
        processing_date: new Date().toISOString()
      }
    };
    
    console.log(`✅ Изображение успешно обработано: ${originalFilename}`);
    console.log(`📊 Размер файла: ${(stats.size / 1024).toFixed(2)} KB`);
    console.log(`📝 Распознано символов: ${ocrResult.text.length}`);
    
    return parsedDocument;
    
  } catch (error) {
    console.error(`❌ Ошибка при обработке изображения ${originalFilename}:`, error);
    return null;
  }
}

/**
 * Проверяет, поддерживается ли формат изображения
 */
export function isSupportedImageFormat(filename: string): boolean {
  const supportedFormats = ['.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.tif', '.webp'];
  const ext = path.extname(filename).toLowerCase();
  return supportedFormats.includes(ext);
}

/**
 * Получает список поддерживаемых форматов изображений
 */
export function getSupportedImageFormats(): string[] {
  return ['.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.tif', '.webp'];
}

/**
 * Сохраняет распознанный текст в файл для дальнейшей обработки
 */
export function saveOCRResultToFile(parsedDocument: ParsedImageDocument, outputDir: string): string {
  try {
    // Создаем директорию если не существует
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Создаем имя файла на основе оригинального
    const baseName = path.parse(parsedDocument.metadata.original_filename).name;
    const outputPath = path.join(outputDir, `${baseName}_ocr.txt`);
    
    // Сохраняем текст
    fs.writeFileSync(outputPath, parsedDocument.content, 'utf8');
    
    // Сохраняем метаданные в отдельный JSON файл
    const metadataPath = path.join(outputDir, `${baseName}_ocr_metadata.json`);
    fs.writeFileSync(metadataPath, JSON.stringify(parsedDocument.metadata, null, 2), 'utf8');
    
    console.log(`💾 OCR результат сохранен: ${outputPath}`);
    return outputPath;
    
  } catch (error) {
    console.error(`❌ Ошибка при сохранении OCR результата:`, error);
    throw error;
  }
}
