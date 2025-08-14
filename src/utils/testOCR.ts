import { extractTextFromImage, parseImageDocument, isSupportedImageFormat, getSupportedImageFormats } from './ocrParser';
import * as path from 'path';

async function testOCR() {
  console.log('🧪 Тестирование OCR функциональности...\n');

  // Тест 1: Проверка поддерживаемых форматов
  console.log('📋 Поддерживаемые форматы изображений:');
  const formats = getSupportedImageFormats();
  formats.forEach(format => console.log(`  - ${format}`));
  console.log('');

  // Тест 2: Проверка функции определения формата
  console.log('🔍 Тест определения форматов:');
  const testFiles = [
    'test.jpg',
    'document.png',
    'image.bmp',
    'file.pdf',
    'text.txt'
  ];

  testFiles.forEach(file => {
    const isImage = isSupportedImageFormat(file);
    console.log(`  ${file}: ${isImage ? '✅ Изображение' : '❌ Не изображение'}`);
  });
  console.log('');

  // Тест 3: Проверка OCR (если есть тестовое изображение)
  const testImagePath = path.join(__dirname, '../data/raw/test_image.jpg');
  
  try {
    if (require('fs').existsSync(testImagePath)) {
      console.log('🖼️ Тест OCR с реальным изображением:');
      console.log(`  Путь: ${testImagePath}`);
      
      const ocrResult = await extractTextFromImage(testImagePath);
      
      if (ocrResult.success) {
        console.log(`  ✅ OCR успешен методом: ${ocrResult.method}`);
        console.log(`  📝 Распознано символов: ${ocrResult.text?.length || 0}`);
        console.log(`  📄 Первые 100 символов: ${ocrResult.text?.substring(0, 100)}...`);
      } else {
        console.log(`  ❌ OCR ошибка: ${ocrResult.error}`);
      }
    } else {
      console.log('⚠️ Тестовое изображение не найдено. Создайте файл data/raw/test_image.jpg для полного теста.');
    }
  } catch (error) {
    console.error('❌ Ошибка при тестировании OCR:', error);
  }

  console.log('\n✅ Тестирование завершено!');
}

// Запускаем тест если файл вызван напрямую
if (require.main === module) {
  testOCR().catch(console.error);
}

export { testOCR };
