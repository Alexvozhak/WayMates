---
description: "Исправление поисковых команд Telegram Bot — три типа поиска с правильными схемами"
allowed-tools: ["Read", "Edit", "Write", "Task", "AskUserQuestion", "Bash", "TodoWrite", "Glob", "Grep"]
---

# 🔍 Refactor Search Commands

## Цель

Исправить поисковые команды Telegram Bot:
1. `/search` использует неправильную схему — заменить на три команды
2. Добавить недостающие типы поиска (`search_user_careers`, `search_careers`)
3. Использовать схемы из `shared/schemas.ts` (без дублирования)

**Критерий успеха**: lint + tsc проходят, все три команды работают.

---

## Обязательный контекст

**ПЕРЕД началом работы** прочитай:

1. **План**: `SEARCH-COMMANDS-PLAN.md` (ГЛАВНЫЙ документ)
2. **Shared схемы**: `src/shared/schemas.ts` (source of truth)
3. **Facade схемы**: `src/facade/mcp-server/schemas.ts`

**Текущая реализация**:

4. **Types**: `src/telegram-bot/types.ts`
5. **Bot**: `src/telegram-bot/bot.ts`
6. **NLP Parser**: `src/telegram-bot/services/nlp-parser.ts`
7. **Handlers**: `src/telegram-bot/handlers/*.ts`

---

## Три типа поиска

| Команда | Facade Tool | Назначение | Требует story |
|---------|-------------|------------|---------------|
| `/by_target <цель>` | `search_by_target` | "Хочу стать X" | Нет |
| `/by_current` | `search_user_careers` | "Похожие на меня" | **Да** |
| `/by_adhoc <контекст>` | `search_careers` | "Похожие на контекст Y" | Нет |

---

## Workflow

### Фаза 1: NLP Parsers

1. **Переписать `nlp-parser.ts`**:
   - Импортировать `fieldFilterSchema`, `TargetContext`, `AdhocUserContext` из `shared/schemas.ts`
   - Создать NLP-схемы с `.nullable().optional()` для OpenAI
   - `parseTargetQuery()` → возвращает `TargetContext`
   - `parseAdhocQuery()` → возвращает `Partial<AdhocUserContext>`
   - Удалить старый `parseSearchQuery()`

2. **Проверка**: `npm run lint && npx tsc --noEmit`

### Фаза 2: Handlers

1. **Создать `handlers/by-target.ts`** — `/by_target` команда
2. **Создать `handlers/by-current.ts`** — `/by_current` команда
3. **Создать `handlers/by-adhoc.ts`** — `/by_adhoc` команда
4. **Удалить `handlers/search.ts`** — больше не нужен

5. **Проверка**: `npm run lint && npx tsc --noEmit`

### Фаза 3: Types

1. **Обновить `types.ts`**:
   ```typescript
   // Было:
   export type PendingAction = "story" | "search";

   // Станет:
   export type PendingAction = "story" | "by_target" | "by_adhoc";
   ```

2. **Проверка**: `npm run lint && npx tsc --noEmit`

### Фаза 4: Bot.ts

1. **Обновить импорты** — удалить search, добавить by-target/by-current/by-adhoc
2. **Добавить `/by_current` в guard**:
   ```typescript
   const STORY_REQUIRED_COMMANDS = new Set(["/goal", "/context", "/trail", "/by_current"]);
   ```
3. **Зарегистрировать команды**:
   ```typescript
   bot.command("by_target", handleByTarget);
   bot.command("by_current", handleByCurrent);
   bot.command("by_adhoc", handleByAdhoc);
   ```

4. **Проверка**: `npm run lint && npx tsc --noEmit`

### Фаза 5: Text/Voice Routing

1. **Обновить `text.ts`** — routing для `by_target` и `by_adhoc`
2. **Обновить `voice.ts`** — аналогично

3. **Проверка**: `npm run lint && npx tsc --noEmit`

### Фаза 6: Help

1. **Обновить `help.ts`** — новые команды в справке

2. **Финальная проверка**: `npm run lint && npx tsc --noEmit`

---

## Ключевые паттерны

### NLP схемы на базе shared

```typescript
import { fieldFilterSchema, type TargetContext } from "../../shared/schemas.js";

// NLP-версия с nullable для OpenAI Structured Output
const fieldFilterNlpSchema = fieldFilterSchema.nullable().optional();

const targetContextNlpSchema = z.object({
  position: fieldFilterNlpSchema.describe("Целевая позиция"),
  countries: fieldFilterNlpSchema.describe("Страны (ISO: RU, US, DE)"),
  domains: fieldFilterNlpSchema.describe("Домены"),
  skills: fieldFilterNlpSchema.describe("Навыки"),
  languages: fieldFilterNlpSchema.describe("Языки (ISO: en, ru)"),
});
```

### FieldFilter формат

```typescript
// Правильный формат для Facade
{
  position: { mode: "desired", values: ["Senior ML Engineer"] },
  domains: { mode: "desired", values: ["FinTech"] },
}
```

### removeNullFields утилита

```typescript
function removeNullFields<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v != null)
  ) as Partial<T>;
}
```

---

## Файлы для изменения

| Файл | Действие |
|------|----------|
| `src/telegram-bot/services/nlp-parser.ts` | Переписать |
| `src/telegram-bot/types.ts` | Изменить PendingAction |
| `src/telegram-bot/handlers/search.ts` | **Удалить** |
| `src/telegram-bot/handlers/by-target.ts` | **Создать** |
| `src/telegram-bot/handlers/by-current.ts` | **Создать** |
| `src/telegram-bot/handlers/by-adhoc.ts` | **Создать** |
| `src/telegram-bot/handlers/text.ts` | Изменить routing |
| `src/telegram-bot/handlers/voice.ts` | Изменить routing |
| `src/telegram-bot/bot.ts` | Команды + guard |
| `src/telegram-bot/handlers/help.ts` | Справка |

---

## Не делай

- ❌ Не дублируй схемы — импортируй из `shared/schemas.ts`
- ❌ Не используй `as` для type assertions — используй Zod `.parse()`
- ❌ Не превышай complexity 8, max-depth 2, 60 строк на функцию
- ❌ Не добавляй `organization`/`location` — их нет в Facade

---

## Примеры вызовов Facade

### `/by_target Senior ML Engineer в финтехе`
```typescript
await callTool(ctx, "search_by_target", {
  targetContext: {
    position: { mode: "desired", values: ["Senior ML Engineer"] },
    domains: { mode: "desired", values: ["FinTech"] },
  },
  limit: 10,
});
```

### `/by_current`
```typescript
await callTool(ctx, "search_user_careers", {
  limit: 20,
});
```

### `/by_adhoc Backend Python в Германии`
```typescript
await callTool(ctx, "search_careers", {
  referenceContext: {
    position: "Backend Developer",
    skills: ["Python"],
    countryCode: "DE",
  },
  limit: 20,
});
```

---

## Quality Gates

После каждой фазы:
```bash
npm run lint
npx tsc --noEmit
```

После завершения — ручное тестирование всех трёх команд.
