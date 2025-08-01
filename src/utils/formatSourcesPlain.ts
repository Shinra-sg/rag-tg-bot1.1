interface SearchResult {
  content: string;
  filename: string;
  source_ref: string;
}

export function formatSearchResultsPlain(results: SearchResult[]): string {
  if (!results || results.length === 0) {
    return "❌ Информация не найдена";
  }

  return results.map((result, index) => {
    // Очищаем контент от лишних пробелов и переносов
    const cleanContent = result.content
      .replace(/\n+/g, '\n')  // Убираем множественные переносы
      .replace(/\s+/g, ' ')   // Убираем множественные пробелы
      .trim();
    
    // Определяем тип документа по расширению
    const fileExtension = result.filename.split('.').pop()?.toLowerCase();
    let fileIcon = '📄';
    
    switch (fileExtension) {
      case 'pdf':
        fileIcon = '📕';
        break;
      case 'md':
        fileIcon = '📝';
        break;
      case 'txt':
        fileIcon = '📄';
        break;
      case 'doc':
      case 'docx':
        fileIcon = '📘';
        break;
      default:
        fileIcon = '📄';
    }
    
    // Форматируем номер фрагмента (без Markdown)
    const fragmentNumber = `#${index + 1}`;
    
    // Форматируем источник с иконкой (без Markdown)
    const sourceInfo = `${fileIcon} Источник: ${result.filename} (${result.source_ref})`;
    
    // Добавляем разделитель между фрагментами
    const separator = index < results.length - 1 ? "\n\n" + "─".repeat(50) + "\n\n" : "";
    
    return `${fragmentNumber}\n${cleanContent}\n\n${sourceInfo}${separator}`;
  }).join('');
}

export function formatSummaryPlain(results: SearchResult[]): string {
  if (!results || results.length === 0) {
    return "❌ Результаты не найдены";
  }
  
  const summary = results.map((result, index) => {
    const fileExtension = result.filename.split('.').pop()?.toLowerCase();
    let fileIcon = '📄';
    
    switch (fileExtension) {
      case 'pdf':
        fileIcon = '📕';
        break;
      case 'md':
        fileIcon = '📝';
        break;
      case 'txt':
        fileIcon = '📄';
        break;
      case 'doc':
      case 'docx':
        fileIcon = '📘';
        break;
    }
    
    return `${fileIcon} ${result.filename} (${result.source_ref})`;
  }).join('\n');
  
  return `📋 Найдено источников: ${results.length}\n\n${summary}`;
}

export function formatSingleResultPlain(result: SearchResult, index: number = 0): string {
  // Очищаем контент
  const cleanContent = result.content
    .replace(/\n+/g, '\n')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Определяем иконку файла
  const fileExtension = result.filename.split('.').pop()?.toLowerCase();
  let fileIcon = '📄';
  
  switch (fileExtension) {
    case 'pdf':
      fileIcon = '📕';
      break;
    case 'md':
      fileIcon = '📝';
      break;
    case 'txt':
      fileIcon = '📄';
      break;
    case 'doc':
    case 'docx':
      fileIcon = '📘';
      break;
  }
  
  return `#${index + 1}\n${cleanContent}\n\n${fileIcon} Источник: ${result.filename} (${result.source_ref})`;
} 