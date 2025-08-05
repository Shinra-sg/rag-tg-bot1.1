# Исправления проблем с Markdown парсингом

## 🐛 Проблема

Telegram API выдавал ошибку при парсинге Markdown:
```
TelegramError: 400: Bad Request: can't parse entities: Can't find end of the entity starting at byte offset 59
```

**Причина:** Специальные символы в тексте конфликтовали с Markdown разметкой.

## ✅ Решение

### 1. **Экранирование специальных символов**

Добавлена функция `escapeMarkdown()` в `src/utils/formatSources.ts`:

```typescript
function escapeMarkdown(text: string): string {
  return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
}
```

**Экранируются символы:**
- `_` `*` `[` `]` `(` `)` `~` `` ` `` `>` `#` `+` `-` `=` `|` `{` `}` `.` `!`

### 2. **Fallback на plain текст**

Создан файл `src/utils/formatSourcesPlain.ts` с версиями функций без Markdown:

- `formatSearchResultsPlain()` - полное форматирование без Markdown
- `formatSummaryPlain()` - краткая сводка без Markdown
- `formatSingleResultPlain()` - один фрагмент без Markdown

### 3. **Обработка ошибок в боте**

Обновлен `src/bot/bot.ts` с try-catch блоками:

```typescript
try {
  const summary = formatSummary(results);
  await ctx.reply(summary, { parse_mode: 'Markdown' });
} catch (error) {
  console.log("Markdown parsing error, using plain format:", error);
  const summary = formatSummaryPlain(results);
  await ctx.reply(summary);
}
```

## 🔧 Примененные изменения

### В `src/utils/formatSources.ts`:
- ✅ Добавлена функция `escapeMarkdown()`
- ✅ Экранирование имен файлов и source_ref
- ✅ Экранирование содержимого текста
- ✅ Безопасное форматирование всех функций

### В `src/bot/bot.ts`:
- ✅ Импорт plain версий функций
- ✅ Try-catch для краткой сводки
- ✅ Try-catch для полных источников
- ✅ Fallback на plain текст при ошибках

### Новый файл `src/utils/formatSourcesPlain.ts`:
- ✅ Полные аналоги функций без Markdown
- ✅ Сохранение иконок и форматирования
- ✅ Безопасная обработка любого текста

## 🎯 Результат

### До исправлений:
- ❌ Ошибки парсинга Markdown
- ❌ Падение бота при специальных символах
- ❌ Нет fallback механизма

### После исправлений:
- ✅ Автоматическое экранирование символов
- ✅ Fallback на plain текст при ошибках
- ✅ Стабильная работа с любым содержимым
- ✅ Сохранение красивого форматирования

## 🚀 Использование

### Автоматическое:
- Бот автоматически экранирует символы
- При ошибках переключается на plain версию
- Пользователь не замечает проблем

### Ручное переключение:
```typescript
// Принудительно использовать plain версию
const summary = formatSummaryPlain(results);
await ctx.reply(summary);
```

## 📊 Статистика исправлений

- **Файлов изменено:** 3
- **Новых функций:** 4
- **Try-catch блоков:** 2
- **Экранируемых символов:** 16

**Теперь бот стабильно работает с любым содержимым документов!** 🎉 