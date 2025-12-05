# План: Исправление поисковых команд Telegram Bot

## Проблема

1. **`/search` использует неправильную схему** — передаёт `{ position: string }` вместо `{ position: FieldFilter }`
2. **Отсутствуют два типа поиска** — `search_user_careers` и `search_careers` не реализованы
3. **Несуществующие поля** — `organization`, `location` нет в Facade targetContextSchema

## Решение

Заменить `/search` на три команды с правильными схемами:

| Команда | Facade Tool | Назначение | Требует story |
|---------|-------------|------------|---------------|
| `/by_target <цель>` | `search_by_target` | "Хочу стать X" | Нет |
| `/by_current` | `search_user_careers` | "Похожие на меня" | **Да** |
| `/by_adhoc <контекст>` | `search_careers` | "Похожие на контекст Y" | Нет |

---

## Фаза 1: NLP Parsers

### 1.1 Создать NLP-схемы на базе shared/schemas.ts

**Файл:** `src/telegram-bot/services/nlp-parser.ts`

Импортируем базовые схемы и создаём NLP-версии с `.nullable().optional()`:

```typescript
import {
  fieldFilterSchema,
  type TargetContext,
  type AdhocUserContext,
} from "../../shared/schemas.js";

// NLP-версия FieldFilter для OpenAI Structured Output
// Базовая схема из shared, но с nullable для LLM
const fieldFilterNlpSchema = fieldFilterSchema.nullable().optional();

// NLP-версия TargetContext (для /by_target)
// Структура идентична shared/targetContextSchema, но все поля nullable
const targetContextNlpSchema = z.object({
  position: fieldFilterNlpSchema.describe("Целевая позиция"),
  countries: fieldFilterNlpSchema.describe("Страны (ISO коды: RU, US, DE)"),
  domains: fieldFilterNlpSchema.describe("Домены (FinTech, HealthTech, etc)"),
  skills: fieldFilterNlpSchema.describe("Навыки"),
  languages: fieldFilterNlpSchema.describe("Языки (ISO коды: en, ru, de)"),
});

// NLP-версия AdhocUserContext (для /by_adhoc)
// Подмножество полей из shared/userContextSchemaBase
const adhocContextNlpSchema = z.object({
  position: z.string().nullable().optional().describe("Позиция"),
  skills: z.array(z.string()).nullable().optional().describe("Навыки"),
  domains: z.array(z.string()).nullable().optional().describe("Домены"),
  industry: z.string().nullable().optional().describe("Индустрия"),
  countryCode: z.string().nullable().optional().describe("Код страны (RU, US, DE)"),
  cityName: z.string().nullable().optional().describe("Город"),
});
```

**Принцип:** Структура схем идентична `shared/schemas.ts`, но обёрнута в `.nullable().optional()` для совместимости с OpenAI Structured Output API.

### 1.2 Функции парсинга

```typescript
import type { TargetContext, AdhocUserContext } from "../../shared/schemas.js";

// parseTargetQuery — для /by_target
// Возвращает TargetContext из shared (без null полей)
export async function parseTargetQuery(apiKey: string, query: string): Promise<TargetContext> {
  const llm = new ChatOpenAI({ modelName: "gpt-4o-mini", temperature: 0, openAIApiKey: apiKey });
  const structuredLlm = llm.withStructuredOutput(targetContextNlpSchema);

  const prompt = `Extract target job criteria from user query.
Return FieldFilter format: { mode: "desired" | "undesired", values: string[] }
Use "undesired" ONLY for explicit exclusions ("except", "not", "кроме").
Countries: use ISO codes (RU, US, DE).
Languages: use ISO codes (en, ru, de).

Query: ${query}`;

  const result = await structuredLlm.invoke(prompt);
  return removeNullFields(result) as TargetContext;  // приводим к shared type
}

// parseAdhocQuery — для /by_adhoc
// Возвращает Partial<AdhocUserContext> из shared
export async function parseAdhocQuery(apiKey: string, query: string): Promise<Partial<AdhocUserContext>> {
  const llm = new ChatOpenAI({ modelName: "gpt-4o-mini", temperature: 0, openAIApiKey: apiKey });
  const structuredLlm = llm.withStructuredOutput(adhocContextNlpSchema);

  const prompt = `Extract career context from description.
Return only fields mentioned by user.
countryCode: use ISO code (RU, US, DE).

Query: ${query}`;

  const result = await structuredLlm.invoke(prompt);
  return removeNullFields(result);
}

// Утилита для удаления null/undefined полей
function removeNullFields<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v != null)
  ) as Partial<T>;
}
```

### 1.3 Удалить старый parseSearchQuery

Удалить функцию `parseSearchQuery` и тип `SearchParams` — они больше не нужны.

---

## Фаза 2: Handlers

### 2.1 Создать `handlers/by-target.ts`

```typescript
import { formatSearchResult } from "../formatters/search.js";
import { callTool } from "../services/mcp-client.js";
import { parseTargetQuery } from "../services/nlp-parser.js";
import { setPendingAction } from "../services/pending-actions.js";
import type { BotContext } from "../types.js";

export async function handleByTarget(ctx: BotContext): Promise<void> {
  const query = ctx.message?.text?.replace("/by_target", "").trim();
  await processTargetQuery(ctx, query);
}

export async function handleByTargetWithText(ctx: BotContext, text: string): Promise<void> {
  await processTargetQuery(ctx, text);
}

async function processTargetQuery(ctx: BotContext, query: string | undefined): Promise<void> {
  if (!query) {
    await showTargetUsage(ctx);
    return;
  }
  await performTargetSearch(ctx, query);
}

async function showTargetUsage(ctx: BotContext): Promise<void> {
  setPendingAction(ctx, "by_target");
  await ctx.reply(
    "🎯 Поиск по целевой позиции\n\n" +
    "Опишите кем хотите стать:\n" +
    "/by_target Senior ML Engineer в финтехе\n" +
    "/by_target Backend Python в Германии\n\n" +
    "💬 Можно текст или голосовое."
  );
}

async function performTargetSearch(ctx: BotContext, query: string): Promise<void> {
  await ctx.reply("🔍 Ищу тех, кто уже достиг похожей цели...");
  await ctx.replyWithChatAction("typing");

  const targetContext = await parseTargetQuery(ctx.services.openaiApiKey, query);

  const result = await callTool(ctx, "search_by_target", {
    targetContext,
    limit: 10,
  });

  const formatted = await formatSearchResult({
    apiKey: ctx.services.openaiApiKey,
    llmConfig: ctx.services.formatterLlm,
    languageCode: ctx.from?.language_code ?? "ru",
    result,
  });

  await ctx.reply(formatted, { parse_mode: "Markdown" });
}
```

### 2.2 Создать `handlers/by-current.ts`

```typescript
import { formatSearchResult } from "../formatters/search.js";
import { callTool } from "../services/mcp-client.js";
import type { BotContext } from "../types.js";

export async function handleByCurrent(ctx: BotContext): Promise<void> {
  await ctx.reply("🔍 Ищу похожие карьерные пути на основе вашего профиля...");
  await ctx.replyWithChatAction("typing");

  const result = await callTool(ctx, "search_user_careers", {
    limit: 20,
  });

  const formatted = await formatSearchResult({
    apiKey: ctx.services.openaiApiKey,
    llmConfig: ctx.services.formatterLlm,
    languageCode: ctx.from?.language_code ?? "ru",
    result,
  });

  await ctx.reply(formatted, { parse_mode: "Markdown" });
}
```

### 2.3 Создать `handlers/by-adhoc.ts`

```typescript
import { formatSearchResult } from "../formatters/search.js";
import { callTool } from "../services/mcp-client.js";
import { parseAdhocQuery } from "../services/nlp-parser.js";
import { setPendingAction } from "../services/pending-actions.js";
import type { BotContext } from "../types.js";

export async function handleByAdhoc(ctx: BotContext): Promise<void> {
  const query = ctx.message?.text?.replace("/by_adhoc", "").trim();
  await processAdhocQuery(ctx, query);
}

export async function handleByAdhocWithText(ctx: BotContext, text: string): Promise<void> {
  await processAdhocQuery(ctx, text);
}

async function processAdhocQuery(ctx: BotContext, query: string | undefined): Promise<void> {
  if (!query) {
    await showAdhocUsage(ctx);
    return;
  }
  await performAdhocSearch(ctx, query);
}

async function showAdhocUsage(ctx: BotContext): Promise<void> {
  setPendingAction(ctx, "by_adhoc");
  await ctx.reply(
    "🔎 Поиск по произвольному контексту\n\n" +
    "Опишите профиль для сравнения:\n" +
    "/by_adhoc Backend Python 3 года в стартапе\n" +
    "/by_adhoc Data Scientist ML в банке Москва\n\n" +
    "💬 Можно текст или голосовое."
  );
}

async function performAdhocSearch(ctx: BotContext, query: string): Promise<void> {
  await ctx.reply("🔍 Ищу похожие карьерные пути...");
  await ctx.replyWithChatAction("typing");

  const referenceContext = await parseAdhocQuery(ctx.services.openaiApiKey, query);

  const result = await callTool(ctx, "search_careers", {
    referenceContext,
    limit: 20,
  });

  const formatted = await formatSearchResult({
    apiKey: ctx.services.openaiApiKey,
    llmConfig: ctx.services.formatterLlm,
    languageCode: ctx.from?.language_code ?? "ru",
    result,
  });

  await ctx.reply(formatted, { parse_mode: "Markdown" });
}
```

### 2.4 Удалить `handlers/search.ts`

Файл больше не нужен — заменяется тремя новыми handlers.

---

## Фаза 3: Обновить types.ts

```typescript
// Было:
export type PendingAction = "story" | "search";

// Станет:
export type PendingAction = "story" | "by_target" | "by_adhoc";
```

Примечание: `by_current` не требует pending action (не принимает текст).

---

## Фаза 4: Обновить bot.ts

### 4.1 Импорты

```typescript
// Удалить:
import { handleSearch } from "./handlers/search.js";

// Добавить:
import { handleByTarget } from "./handlers/by-target.js";
import { handleByCurrent } from "./handlers/by-current.js";
import { handleByAdhoc } from "./handlers/by-adhoc.js";
```

### 4.2 Guard для /by_current

```typescript
// Было:
const STORY_REQUIRED_COMMANDS = new Set(["/goal", "/context", "/trail"]);

// Станет:
const STORY_REQUIRED_COMMANDS = new Set(["/goal", "/context", "/trail", "/by_current"]);
```

### 4.3 Регистрация команд

```typescript
// Удалить:
bot.command("search", handleSearch);

// Добавить:
bot.command("by_target", handleByTarget);
bot.command("by_current", handleByCurrent);
bot.command("by_adhoc", handleByAdhoc);
```

---

## Фаза 5: Обновить text.ts и voice.ts

### 5.1 text.ts

```typescript
import { handleByTargetWithText } from "./by-target.js";
import { handleByAdhocWithText } from "./by-adhoc.js";

// В handleText():
if (pendingAction === "story") {
  await handleStoryWithText(ctx, text);
} else if (pendingAction === "by_target") {
  await handleByTargetWithText(ctx, text);
} else if (pendingAction === "by_adhoc") {
  await handleByAdhocWithText(ctx, text);
}
```

### 5.2 voice.ts

Аналогичные изменения.

---

## Фаза 6: Обновить help.ts

```typescript
await ctx.reply(
  "📚 Команды WayMates\n\n" +
  "🚀 Начало работы:\n" +
  "/start — Регистрация\n" +
  "/story — Рассказать карьерную историю\n\n" +
  "🔍 Поиск карьерных путей:\n" +
  "/by_target <цель> — Найти достигших цели\n" +
  "/by_current — Найти похожих на меня*\n" +
  "/by_adhoc <контекст> — Сравнить с профилем\n\n" +
  "⚙️ Управление:\n" +
  "/token — Показать токен для LibreChat\n" +
  "/link <token> — Привязать LibreChat\n" +
  "/cancel — Отменить операцию\n\n" +
  "* требует завершённый /story"
);
```

---

## Файлы для изменения

| Файл | Действие |
|------|----------|
| `src/telegram-bot/services/nlp-parser.ts` | Переписать: два новых парсера |
| `src/telegram-bot/types.ts` | Изменить: PendingAction type |
| `src/telegram-bot/handlers/search.ts` | **Удалить** |
| `src/telegram-bot/handlers/by-target.ts` | **Создать** |
| `src/telegram-bot/handlers/by-current.ts` | **Создать** |
| `src/telegram-bot/handlers/by-adhoc.ts` | **Создать** |
| `src/telegram-bot/handlers/text.ts` | Изменить: routing для pending actions |
| `src/telegram-bot/handlers/voice.ts` | Изменить: routing для pending actions |
| `src/telegram-bot/bot.ts` | Изменить: команды + guard |
| `src/telegram-bot/handlers/help.ts` | Изменить: справка |

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
