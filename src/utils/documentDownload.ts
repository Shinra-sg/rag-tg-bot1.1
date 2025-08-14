import * as fs from 'fs';
import * as path from 'path';
import pool from './db';

export interface DocumentInfo {
  id: number;
  filename: string;
  original_name: string;
  type: string;
  uploaded_at: Date;
  category?: string;
}

/**
 * Получает информацию о документе по ID
 */
export async function getDocumentById(documentId: number): Promise<DocumentInfo | null> {
  try {
    const result = await pool.query(`
      SELECT d.id, d.filename, d.original_name, d.type, d.uploaded_at, c.name AS category
      FROM documents d
      LEFT JOIN categories c ON d.category_id = c.id
      WHERE d.id = $1
    `, [documentId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('Ошибка при получении документа:', error);
    return null;
  }
}

/**
 * Получает информацию о документе по оригинальному имени
 */
export async function getDocumentByOriginalName(originalName: string): Promise<DocumentInfo | null> {
  try {
    const result = await pool.query(`
      SELECT d.id, d.filename, d.original_name, d.type, d.uploaded_at, c.name AS category
      FROM documents d
      LEFT JOIN categories c ON d.category_id = c.id
      WHERE d.original_name = $1
    `, [originalName]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('Ошибка при получении документа по имени:', error);
    return null;
  }
}

/**
 * Проверяет существование файла документа
 */
export function documentFileExists(documentInfo: DocumentInfo): boolean {
  try {
    // Если filename содержит только имя файла, добавляем путь к raw директории
    let filePath = documentInfo.filename;
    if (!filePath.includes('/') && !filePath.includes('\\')) {
      filePath = path.join(__dirname, '../data/raw', filePath);
    }
    return fs.existsSync(filePath);
  } catch (error) {
    console.error('Ошибка при проверке существования файла:', error);
    return false;
  }
}

/**
 * Получает размер файла документа
 */
export function getDocumentFileSize(documentInfo: DocumentInfo): number {
  try {
    if (!documentFileExists(documentInfo)) {
      return 0;
    }
    // Если filename содержит только имя файла, добавляем путь к raw директории
    let filePath = documentInfo.filename;
    if (!filePath.includes('/') && !filePath.includes('\\')) {
      filePath = path.join(__dirname, '../data/raw', filePath);
    }
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch (error) {
    console.error('Ошибка при получении размера файла:', error);
    return 0;
  }
}

/**
 * Форматирует размер файла в читаемый вид
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Б';
  
  const k = 1024;
  const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Получает MIME-тип файла по расширению
 */
export function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  
  const mimeTypes: { [key: string]: string } = {
    '.pdf': 'application/pdf',
    '.md': 'text/markdown',
    '.txt': 'text/plain',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.doc': 'application/msword',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.bmp': 'image/bmp',
    '.tiff': 'image/tiff',
    '.tif': 'image/tiff',
    '.webp': 'image/webp'
  };
  
  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Создает временную копию файла для скачивания
 */
export function createDownloadableCopy(documentInfo: DocumentInfo): string | null {
  try {
    if (!documentFileExists(documentInfo)) {
      return null;
    }
    
    // Создаем временную директорию если её нет
    const tempDir = path.join(__dirname, '../../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Создаем временный файл с оригинальным именем
    const tempPath = path.join(tempDir, documentInfo.original_name);
    
    // Определяем правильный путь к исходному файлу
    let sourcePath = documentInfo.filename;
    if (!sourcePath.includes('/') && !sourcePath.includes('\\')) {
      sourcePath = path.join(__dirname, '../data/raw', sourcePath);
    }
    
    // Копируем файл
    fs.copyFileSync(sourcePath, tempPath);
    
    return tempPath;
  } catch (error) {
    console.error('Ошибка при создании копии файла:', error);
    return null;
  }
}

/**
 * Очищает временные файлы старше 1 часа
 */
export function cleanupTempFiles(): void {
  try {
    const tempDir = path.join(__dirname, '../../temp');
    if (!fs.existsSync(tempDir)) {
      return;
    }
    
    const files = fs.readdirSync(tempDir);
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    
    files.forEach(file => {
      const filePath = path.join(tempDir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.mtime.getTime() < oneHourAgo) {
        fs.unlinkSync(filePath);
        console.log(`🗑️ Удален временный файл: ${file}`);
      }
    });
  } catch (error) {
    console.error('Ошибка при очистке временных файлов:', error);
  }
}
