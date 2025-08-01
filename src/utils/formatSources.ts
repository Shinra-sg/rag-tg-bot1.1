interface SearchResult {
  content: string;
  filename: string;
  source_ref: string;
}

export function formatSearchResults(results: SearchResult[]): string {
  if (!results || results.length === 0) {
    return "❌ Информация не найдена";
  }

  return results.map((result, index) => {
    // Очищаем контент от лишних пробелов и переносов
    let cleanContent = result.content
      .replace(/\n+/g, '\n')  // Убираем множественные переносы
      .replace(/\s+/g, ' ')   // Убираем множественные пробелы
      .trim();
    
    // Экранируем специальные символы в контенте
    cleanContent = escapeMarkdown(cleanContent);
    
    // Определяем тип документа по расширению
    const fileExtension = result.filename.split('.').pop()?.toLowerCase();
    let fileIcon = '📄';
    let fileType = 'Документ';
    
    switch (fileExtension) {
      case 'pdf':
        fileIcon = '📕';
        fileType = 'PDF';
        break;
      case 'md':
        fileIcon = '📝';
        fileType = 'Markdown';
        break;
      case 'txt':
        fileIcon = '📄';
        fileType = 'Текст';
        break;
      case 'doc':
      case 'docx':
        fileIcon = '📘';
        fileType = 'Word';
        break;
      default:
        fileIcon = '📄';
        fileType = 'Файл';
    }
    
    // Форматируем номер фрагмента
    const fragmentNumber = `**#${index + 1}**`;
    
    // Экранируем имя файла и source_ref
    const safeFilename = escapeMarkdown(result.filename);
    const safeSourceRef = escapeMarkdown(result.source_ref);
    
    // Форматируем источник с иконкой и типом файла
    const sourceInfo = `${fileIcon} **Источник:** ${safeFilename} (${safeSourceRef})`;
    
    // Добавляем разделитель между фрагментами
    const separator = index < results.length - 1 ? "\n\n" + "─".repeat(50) + "\n\n" : "";
    
    return `${fragmentNumber}\n${cleanContent}\n\n${sourceInfo}${separator}`;
  }).join('');
}

export function formatSingleResult(result: SearchResult, index: number = 0): string {
  // Очищаем контент
  let cleanContent = result.content
    .replace(/\n+/g, '\n')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Экранируем специальные символы в контенте
  cleanContent = escapeMarkdown(cleanContent);
  
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
  
  // Экранируем имя файла и source_ref
  const safeFilename = escapeMarkdown(result.filename);
  const safeSourceRef = escapeMarkdown(result.source_ref);
  
  return `**#${index + 1}**\n${cleanContent}\n\n${fileIcon} **Источник:** ${safeFilename} (${safeSourceRef})`;
}

// Функция для экранирования Markdown символов
function escapeMarkdown(text: string): string {
  return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

export function formatSummary(results: SearchResult[]): string {
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
    
    // Экранируем имя файла и source_ref
    const safeFilename = escapeMarkdown(result.filename);
    const safeSourceRef = escapeMarkdown(result.source_ref);
    
    return `${fileIcon} **${safeFilename}** (${safeSourceRef})`;
  }).join('\n');
  
  return `📋 **Найдено источников:** ${results.length}\n\n${summary}`;
} 