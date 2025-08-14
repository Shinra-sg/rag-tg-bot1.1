import { 
  getDocumentByOriginalName, 
  documentFileExists, 
  getDocumentFileSize, 
  formatFileSize, 
  getMimeType,
  createDownloadableCopy,
  cleanupTempFiles
} from './documentDownload';

async function testDocumentDownload() {
  console.log('🧪 Тестирование функции скачивания документов...\n');

  // Тест 1: Проверка форматирования размера файла
  console.log('📏 Тест форматирования размера файла:');
  const testSizes = [0, 1024, 1024 * 1024, 1024 * 1024 * 1024];
  testSizes.forEach(size => {
    console.log(`  ${size} байт = ${formatFileSize(size)}`);
  });
  console.log('');

  // Тест 2: Проверка MIME-типов
  console.log('📋 Тест определения MIME-типов:');
  const testFiles = [
    'document.pdf',
    'image.jpg',
    'data.xlsx',
    'presentation.pptx',
    'text.txt',
    'unknown.xyz'
  ];
  testFiles.forEach(file => {
    console.log(`  ${file} = ${getMimeType(file)}`);
  });
  console.log('');

  // Тест 3: Проверка получения документа из БД
  console.log('🔍 Тест получения документа из базы данных:');
  try {
    // Попробуем найти любой документ
    const result = await getDocumentByOriginalName('Instruction.md');
    if (result) {
      console.log(`  ✅ Документ найден: ${result.original_name}`);
      console.log(`  📁 Путь: ${result.filename}`);
      console.log(`  📊 Размер: ${formatFileSize(getDocumentFileSize(result))}`);
      console.log(`  🏷️ Тип: ${result.type}`);
      console.log(`  📅 Загружен: ${new Date(result.uploaded_at).toLocaleString()}`);
      
      // Тест 4: Проверка существования файла
      console.log(`  📂 Файл существует: ${documentFileExists(result) ? '✅ Да' : '❌ Нет'}`);
      
      // Тест 5: Проверка создания временной копии
      if (documentFileExists(result)) {
        console.log('  🔄 Создание временной копии...');
        const tempPath = createDownloadableCopy(result);
        if (tempPath) {
          console.log(`  ✅ Временная копия создана: ${tempPath}`);
          
          // Очистка временных файлов
          console.log('  🗑️ Очистка временных файлов...');
          cleanupTempFiles();
          console.log('  ✅ Временные файлы очищены');
        } else {
          console.log('  ❌ Не удалось создать временную копию');
        }
      }
    } else {
      console.log('  ⚠️ Документ Instruction.md не найден в базе данных');
    }
  } catch (error) {
    console.error('  ❌ Ошибка при тестировании:', error);
  }

  console.log('\n✅ Тестирование завершено!');
}

// Запускаем тест если файл вызван напрямую
if (require.main === module) {
  testDocumentDownload().catch(console.error);
}

export { testDocumentDownload };
