import { checkSystemHealth } from "./initialize";
import { getDatabaseStats } from "./cleanup";
import { getSearchAnalytics } from "./analytics";

/**
 * Тестирует всю систему
 */
export async function testSystem(): Promise<{
  success: boolean;
  results: {
    health: any;
    database: any;
    analytics: any;
  };
  issues: string[];
}> {
  console.log("🧪 Тестирование системы...");
  
  const issues: string[] = [];
  const results: {
    health: any;
    database: any;
    analytics: any;
  } = {
    health: null,
    database: null,
    analytics: null
  };

  try {
    // 1. Тестируем здоровье системы
    console.log("🔍 Тестирование здоровья системы...");
    try {
      results.health = await checkSystemHealth();
      if (results.health && !results.health.healthy) {
        results.health.issues.forEach((issue: string) => issues.push(`Health: ${issue}`));
      }
      console.log("✅ Тест здоровья системы завершен");
    } catch (error) {
      issues.push(`Health: ${error}`);
      console.error("❌ Ошибка теста здоровья системы:", error);
    }

    // 2. Тестируем базу данных
    console.log("🗄️ Тестирование базы данных...");
    try {
      results.database = await getDatabaseStats();
      if (results.database && results.database.searchLogs === 0 && results.database.userHistory === 0) {
        issues.push("Database: Нет данных в таблицах аналитики");
      }
      console.log("✅ Тест базы данных завершен");
    } catch (error) {
      issues.push(`Database: ${error}`);
      console.error("❌ Ошибка теста базы данных:", error);
    }

    // 3. Тестируем аналитику
    console.log("📊 Тестирование аналитики...");
    try {
      results.analytics = await getSearchAnalytics(7);
      if (results.analytics && results.analytics.totalSearches === 0) {
        issues.push("Analytics: Нет данных о поисковых запросах за последние 7 дней");
      }
      console.log("✅ Тест аналитики завершен");
    } catch (error) {
      issues.push(`Analytics: ${error}`);
      console.error("❌ Ошибка теста аналитики:", error);
    }

    const success = issues.length === 0;
    
    if (success) {
      console.log("🎉 Все тесты пройдены успешно!");
    } else {
      console.warn("⚠️ Обнаружены проблемы:");
      issues.forEach(issue => console.warn(`  - ${issue}`));
    }

    return {
      success,
      results,
      issues
    };

  } catch (error) {
    console.error("❌ Ошибка при тестировании системы:", error);
    issues.push(`Критическая ошибка: ${error}`);
    
    return {
      success: false,
      results: {
        health: null,
        database: null,
        analytics: null
      },
      issues
    };
  }
}

/**
 * Тестирует конкретный компонент системы
 */
export async function testComponent(component: 'health' | 'database' | 'analytics' | 'all'): Promise<{
  success: boolean;
  result: any;
  issues: string[];
}> {
  console.log(`🧪 Тестирование компонента: ${component}`);
  
  const issues: string[] = [];
  let result: any = {};

  try {
    switch (component) {
      case 'health':
        result = await checkSystemHealth();
        if (!result.healthy) {
          result.issues.forEach((issue: string) => issues.push(issue));
        }
        break;
        
      case 'database':
        result = await getDatabaseStats();
        if (result.searchLogs === 0 && result.userHistory === 0) {
          issues.push("Нет данных в таблицах аналитики");
        }
        break;
        
      case 'analytics':
        result = await getSearchAnalytics(7);
        if (result.totalSearches === 0) {
          issues.push("Нет данных о поисковых запросах за последние 7 дней");
        }
        break;
        
      case 'all':
        const allResults = await testSystem();
        return {
          success: allResults.success,
          result: allResults.results,
          issues: allResults.issues
        };
    }

    const success = issues.length === 0;
    
    if (success) {
      console.log(`✅ Тест компонента ${component} пройден успешно`);
    } else {
      console.warn(`⚠️ Проблемы в компоненте ${component}:`);
      issues.forEach(issue => console.warn(`  - ${issue}`));
    }

    return {
      success,
      result,
      issues
    };

  } catch (error) {
    console.error(`❌ Ошибка при тестировании компонента ${component}:`, error);
    issues.push(`Критическая ошибка: ${error}`);
    
    return {
      success: false,
      result: null,
      issues
    };
  }
}

// Запуск тестов если файл выполняется напрямую
if (require.main === module) {
  testSystem().then((result) => {
    if (result.success) {
      console.log("\n🎉 Все тесты пройдены успешно!");
      process.exit(0);
    } else {
      console.log("\n❌ Обнаружены проблемы:");
      result.issues.forEach(issue => console.log(`  - ${issue}`));
      process.exit(1);
    }
  }).catch((error) => {
    console.error("❌ Критическая ошибка при тестировании:", error);
    process.exit(1);
  });
}

export default testSystem;