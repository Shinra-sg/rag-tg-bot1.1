import { parseDocument } from './documentParsers';
import * as path from 'path';

async function testOCRIntegration() {
  console.log('🧪 Тестирование интеграции OCR с системой парсинга...\n');

  const testImagePath = path.join(__dirname, '../data/raw/test_image.jpg');
  
  try {
    console.log(`🖼️ Тестирую обработку изображения: ${testImagePath}`);
    
    // Тестируем полную интеграцию через parseDocument
    const result = await parseDocument(testImagePath);
    
    console.log('✅ Изображение успешно обработано через систему парсинга!');
    console.log(`📝 Извлечено символов: ${result.content.length}`);
    console.log(`📄 Первые 200 символов:`);
    console.log('─'.repeat(50));
    console.log(result.content.substring(0, 200));
    console.log('─'.repeat(50));
    
    console.log('\n📊 Метаданные:');
    console.log(`  - Заголовок: ${result.metadata.title}`);
    console.log(`  - Создан: ${result.metadata.created}`);
    console.log(`  - Изменен: ${result.metadata.modified}`);
    
    console.log('\n✅ Интеграция OCR с системой парсинга работает корректно!');
    
  } catch (error) {
    console.error('❌ Ошибка при тестировании интеграции:', error);
  }
}

// Запускаем тест если файл вызван напрямую
if (require.main === module) {
  testOCRIntegration().catch(console.error);
}

export { testOCRIntegration };
