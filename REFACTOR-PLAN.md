# План: Рефакторинг поисковых команд Telegram Bot

## Проблемы для исправления

### P0 — Критические
1. Нет валидации результата NLP → Facade падает на пустом объекте
2. Type assertions скрывают runtime ошибки
3. `adhocContextSchemaBase` не соответствует `AdhocUserContext`

### P1 — Дублирование
1. `nlp-parser.ts` — две идентичные функции
2. `by-target.ts` + `by-adhoc.ts` — копипаста formatSearchResult
3. `text.ts` + `voice.ts` — дублирование ACTION_REQUIRED_MESSAGE
4. `ChatOpenAI` создаётся на каждый вызов

### P2 — Code smells
1. Бессмысленные прокси-функции `handleXWithText`
2. Over-engineered структура handlers
3. Разные лимиты без причины (10 vs 20)

---

## Фазы исправления

### Фаза 1: nlp-parser.ts — убрать дублирование и добавить валидацию

**Файл:** `src/telegram-bot/services/nlp-parser.ts`

1. Создать generic функцию `invokeLlmStructured<T>`:
   ```typescript
   async function invokeLlmStructured<T>(
     apiKey: string,
     schema: z.ZodType<T>,
     prompt: string,
   ): Promise<T>
   ```

2. Добавить валидацию непустого результата:
   ```typescript
   const cleaned = removeNullFields(result);
   if (Object.keys(cleaned).length === 0) {
     throw new NlpParseError("LLM returned empty result");
   }
   ```

3. Использовать Zod `.parse()` вместо `as` cast:
   ```typescript
   return targetContextSchema.parse(cleaned);
   ```

4. Убрать eslint-disable комментарии

### Фаза 2: shared/schemas.ts — исправить adhocContextSchemaBase

**Файл:** `src/shared/schemas.ts`

Удалить `adhocContextSchemaBase` — использовать `userContextSchemaBase.partial()` напрямую в nlp-parser (с нужными полями).

Альтернатива: создать отдельный тип `AdhocNlpContext` который точно соответствует тому что парсим.

### Фаза 3: handlers — убрать дублирование

**Новый файл:** `src/telegram-bot/utils/search-utils.ts`

1. Вынести общую логику:
   ```typescript
   export async function formatAndReplySearch(
     ctx: BotContext,
     result: McpToolResult,
   ): Promise<void>
   ```

2. Вынести константы:
   ```typescript
   export const SEARCH_LIMITS = {
     byTarget: 20,
     byCurrent: 20,
     byAdhoc: 20,
   } as const;
   ```

**Файлы для упрощения:**
- `src/telegram-bot/handlers/by-target.ts`
- `src/telegram-bot/handlers/by-adhoc.ts`
- `src/telegram-bot/handlers/by-current.ts`

Изменения:
1. Убрать `handleByTargetWithText` — экспортировать `processTargetQuery`
2. Использовать `formatAndReplySearch` вместо копипасты
3. Унифицировать лимиты через константу

### Фаза 4: text.ts / voice.ts — убрать дублирование

**Новый файл:** `src/telegram-bot/constants.ts`

```typescript
export const ACTION_REQUIRED_MESSAGE = "⚠️ Сначала выберите действие:\n\n" +
  "/story — Рассказать карьерную историю\n" +
  "/by_target — Поиск по целевой позиции\n" +
  "/by_adhoc — Поиск по произвольному профилю";
```

**Файлы для изменения:**
- `src/telegram-bot/handlers/text.ts` — импорт константы
- `src/telegram-bot/handlers/voice.ts` — импорт константы

### Фаза 5: Quality gates

```bash
npm run lint
npx tsc --noEmit
```

---

## Файлы для изменения

| Файл | Действие |
|------|----------|
| `src/shared/schemas.ts` | Удалить adhocContextSchemaBase |
| `src/telegram-bot/services/nlp-parser.ts` | Рефакторинг: generic функция + валидация |
| `src/telegram-bot/utils/search-utils.ts` | **Создать**: formatAndReplySearch, SEARCH_LIMITS |
| `src/telegram-bot/constants.ts` | **Создать**: ACTION_REQUIRED_MESSAGE |
| `src/telegram-bot/handlers/by-target.ts` | Упростить, использовать utils |
| `src/telegram-bot/handlers/by-adhoc.ts` | Упростить, использовать utils |
| `src/telegram-bot/handlers/by-current.ts` | Использовать utils |
| `src/telegram-bot/handlers/text.ts` | Импорт константы |
| `src/telegram-bot/handlers/voice.ts` | Импорт константы |
| `src/telegram-bot/bot.ts` | Обновить импорты (если нужно) |
