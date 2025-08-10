import { hybridSearch, smartSearch } from '../utils/hybridSearch';
import { getSearchAnalytics, getPopularQueries, getUserSearchHistory } from '../utils/analytics';
import { getSupportedFormats, isSupportedFormat } from '../utils/documentParsers';

async function testNewFeatures() {
  console.log('🧪 Тестирование новых функций RAG Bot...\n');

  // Тест 1: Гибридный поиск
  console.log('1️⃣ Тестирование гибридного поиска...');
  try {
    const testQueries = [
      'как настроить VPN',
      'правила безопасности',
      'документы для отпуска'
    ];

    for (const query of testQueries) {
      console.log(`\n   Запрос: "${query}"`);
      const results = await hybridSearch(query, { maxResults: 3 });
      console.log(`   Найдено результатов: ${results.length}`);
      results.forEach((result, i) => {
        console.log(`   ${i + 1}. ${result.filename} (${result.search_type}, скор: ${result.score.toFixed(3)})`);
      });
    }
    console.log('   ✅ Гибридный поиск работает');
  } catch (error) {
    console.error('   ❌ Ошибка гибридного поиска:', error);
  }

  // Тест 2: Аналитика
  console.log('\n2️⃣ Тестирование аналитики...');
  try {
    const analytics = await getSearchAnalytics(30);
    console.log(`   Всего запросов: ${analytics.totalSearches}`);
    console.log(`   Успешных запросов: ${analytics.successfulSearches}`);
    console.log(`   Среднее время ответа: ${Math.round(analytics.averageResponseTime)}ms`);
    console.log(`   Типы поиска:`, analytics.searchTypes);
    console.log('   ✅ Аналитика работает');
  } catch (error) {
    console.error('   ❌ Ошибка аналитики:', error);
  }

  // Тест 3: Популярные запросы
  console.log('\n3️⃣ Тестирование популярных запросов...');
  try {
    const popularQueries = await getPopularQueries(5);
    console.log(`   Найдено популярных запросов: ${popularQueries.length}`);
    popularQueries.forEach((query, i) => {
      console.log(`   ${i + 1}. "${query.query}" (${query.count} раз)`);
    });
    console.log('   ✅ Популярные запросы работают');
  } catch (error) {
    console.error('   ❌ Ошибка популярных запросов:', error);
  }

  // Тест 4: Поддерживаемые форматы
  console.log('\n4️⃣ Тестирование поддерживаемых форматов...');
  try {
    const formats = getSupportedFormats();
    console.log(`   Поддерживаемые форматы: ${formats.join(', ')}`);
    
    const testFiles = [
      'document.pdf',
      'report.xlsx',
      'presentation.pptx',
      'manual.docx',
      'readme.txt',
      'unknown.xyz'
    ];

    testFiles.forEach(file => {
      const supported = isSupportedFormat(file);
      console.log(`   ${file}: ${supported ? '✅' : '❌'}`);
    });
    console.log('   ✅ Поддержка форматов работает');
  } catch (error) {
    console.error('   ❌ Ошибка поддержки форматов:', error);
  }

  // Тест 5: Умный поиск
  console.log('\n5️⃣ Тестирование умного поиска...');
  try {
    const smartQueries = [
      'как настроить VPN для удаленной работы?',
      'правила',
      'что нужно для отпуска'
    ];

    for (const query of smartQueries) {
      console.log(`\n   Умный поиск: "${query}"`);
      const results = await smartSearch(query);
      console.log(`   Найдено результатов: ${results.length}`);
      if (results.length > 0) {
        console.log(`   Тип поиска: ${results[0].search_type}`);
      }
    }
    console.log('   ✅ Умный поиск работает');
  } catch (error) {
    console.error('   ❌ Ошибка умного поиска:', error);
  }

  console.log('\n🎉 Тестирование завершено!');
}

// Запуск тестов
if (require.main === module) {
  testNewFeatures().catch(console.error);
}

export { testNewFeatures }; 