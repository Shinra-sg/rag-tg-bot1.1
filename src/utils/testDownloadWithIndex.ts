import { 
  getDocumentByOriginalName, 
  documentFileExists, 
  getDocumentFileSize, 
  formatFileSize, 
  getMimeType,
  createDownloadableCopy,
  cleanupTempFiles
} from './documentDownload';

// Симуляция результатов поиска
const mockSearchResults = [
  {
    content: "Содержимое документа 1",
    filename: "lab_1.pdf",
    source_ref: "lab_1.pdf",
    score: 0.95,
    search_type: 'vector' as const
  },
  {
    content: "Содержимое документа 2", 
    filename: "Instruction.md",
    source_ref: "Instruction.md",
    score: 0.87,
    search_type: 'vector' as const
  },
  {
    content: "Содержимое документа 3",
    filename: "tems.docx", 
    source_ref: "tems.docx",
    score: 0.82,
    search_type: 'vector' as const
  }
];

async function testDownloadWithIndex() {
  console.log('🧪 Тестирование скачивания с использованием индексов...\n');

  // Симуляция userSearchResults
  const userSearchResults = new Map();
  userSearchResults.set(12345, mockSearchResults);

  console.log('📋 Доступные документы:');
  mockSearchResults.forEach((result, index) => {
    console.log(`  [${index}] ${result.filename}`);
  });
  console.log('');

  // Тестируем скачивание каждого документа по индексу
  for (let index = 0; index < mockSearchResults.length; index++) {
    console.log(`🔍 Тест скачивания документа [${index}]:`);
    
    const userResults = userSearchResults.get(12345);
    if (!userResults || !userResults[index]) {
      console.log(`  ❌ Документ с индексом ${index} не найден`);
      continue;
    }

    const result = userResults[index];
    const filename = result.filename;
    
    console.log(`  📄 Файл: ${filename}`);
    
    // Получаем информацию о документе из БД
    const documentInfo = await getDocumentByOriginalName(filename);
    if (!documentInfo) {
      console.log(`  ❌ Документ "${filename}" не найден в базе данных`);
      continue;
    }
    
    console.log(`  ✅ Документ найден в БД: ${documentInfo.original_name}`);
    console.log(`  📁 Путь: ${documentInfo.filename}`);
    console.log(`  📊 Размер: ${formatFileSize(getDocumentFileSize(documentInfo))}`);
    console.log(`  🏷️ Тип: ${documentInfo.type}`);
    
    // Проверяем существование файла
    if (!documentFileExists(documentInfo)) {
      console.log(`  ❌ Файл не существует на сервере`);
      continue;
    }
    
    console.log(`  ✅ Файл существует на сервере`);
    
    // Тестируем создание временной копии
    const tempPath = createDownloadableCopy(documentInfo);
    if (tempPath) {
      console.log(`  ✅ Временная копия создана: ${tempPath}`);
      
      // Очищаем временные файлы
      cleanupTempFiles();
      console.log(`  🗑️ Временные файлы очищены`);
    } else {
      console.log(`  ❌ Не удалось создать временную копию`);
    }
    
    console.log('');
  }

  console.log('✅ Тестирование завершено!');
}

// Запускаем тест если файл вызван напрямую
if (require.main === module) {
  testDownloadWithIndex().catch(console.error);
}

export { testDownloadWithIndex };
