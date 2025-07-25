import fs from "fs";
// @ts-ignore
import pdfParse from "pdf-parse";

/**
 * Парсит PDF-файл и возвращает его текст.
 * @param filePath Путь к PDF-файлу
 * @returns Текст из PDF
 */
export async function parsePDF(filePath: string): Promise<string> {
  const buffer = await fs.promises.readFile(filePath);
  const data = await pdfParse(buffer);
  return data.text;
}