# План Рефакторинга Telegram Bot

> **Дата**: 2025-12-07
> **Формат**: Краткие инструкции + требования
> **Цель**: Чек-лист для выполнения согласованных изменений

---

## P0 - Критические

### 1. Hardcoded "Russian" Fallback → "English"

**Файл**: `formatters/search.ts:58`
**Проблема**: Для неизвестных языков fallback на "Russian"
**Решение**: Изменить дефолт на "English"
**Требования**:
- Маппинг остаётся (ru, en, de, fr, es)
- Fallback для остальных языков → "English"
- Не ломать существующую логику для известных языков

**Проверка**:
```bash
# Тест с китайским language_code должен давать English ответ
```

---

### 2. Удалить createChildLogger

**Файл**: `logger.ts:15`
**Проблема**: Dead code (не используется)
**Решение**: Удалить функцию и экспорт
**Требования**:
- logger остаётся
- Убрать export createChildLogger
- Убрать саму функцию

**Проверка**:
```bash
grep -r "createChildLogger" src/telegram-bot --include="*.ts"
# Должно вернуть 0 результатов
```

---

### 3. Explicit Array Bounds Check

**Файл**: `mcp-utils.ts:5` (extractTextContent)
**Проблема**: Нет явной проверки `result.content.length` перед доступом к `[0]`
**Решение**: Добавить explicit check в начале функции
**Требования**:
- Проверка ПЕРЕД `const content = result.content[0]`
- Если length === 0 → return null
- Остальная логика без изменений

**Хлебные крошки**:
- Функция уже возвращает null при ошибке (nullable approach)
- Просто добавить проверку длины массива в начало
- Это defensive programming, а не изменение логики

---

## P1 - Средние

### 4. REDIS_URL в env validation

**Файлы**: `env.ts`, `bot.ts`, `index.ts`, `.env.example`
**Проблема**: Redis URL не валидируется через Zod
**Решение**: Добавить в envSchema + передавать через параметр
**Требования**:
- `envSchema`: добавить `REDIS_URL: z.string().url().default("redis://localhost:6379")`
- `createBot`: принимать `redisUrl: string` как 3-й параметр
- `index.ts`: передавать `env.REDIS_URL` в createBot
- `.env.example`: добавить `REDIS_URL=redis://localhost:6379`
- Убрать hardcoded `process.env.REDIS_URL` из bot.ts

**Хлебные крошки**:
- Все env переменные валидируются через validateEnv()
- Redis URL не должен быть исключением
- createBot уже принимает параметры (token, services)

---

### 5. Graceful Shutdown для Redis

**Файл**: `bot.ts`
**Проблема**: Redis connection не закрывается при shutdown
**Решение**: Добавить cleanup handler
**Требования**:
- В createBot: после создания bot и redis
- Добавить `bot.on("stop", async () => { await redis.quit(); })`
- Перед return bot

**Хлебные крошки**:
- Grammy поддерживает lifecycle events
- Redis instance создаётся в createBot → там же должен закрываться
- Не добавлять в index.ts - инкапсуляция в createBot

---

### 6. Inline pending-actions.ts

**Файл**: `services/pending-actions.ts` (удалить)
**Затронутые**: 7 файлов (input-router, story, by-target, by-current, by-adhoc, callbacks, bot.ts если есть)
**Проблема**: Trivial wrappers (3 однострочные функции)
**Решение**: Заменить на прямой доступ к ctx.session.pendingAction
**Требования**:
- `setPendingAction(ctx, "story")` → `ctx.session.pendingAction = "story"`
- `clearPendingAction(ctx)` → `delete ctx.session.pendingAction`
- `getPendingAction(ctx)` → `ctx.session.pendingAction`
- Удалить файл pending-actions.ts
- Убрать импорты

**Хлебные крошки**:
- Функции не добавляют логику, только вызывают session
- Это классический случай overengineering
- Прямой доступ читабельнее и явнее

**Проверка**:
```bash
npm run lint && npx tsc --noEmit
```

---

### 7. Inline help.ts

**Файл**: `handlers/help.ts` (удалить)
**Затронутые**: `bot.ts`
**Проблема**: Trivial wrapper (1 строка)
**Решение**: Inline в bot.ts
**Требования**:
- `bot.command("help", handleHelp)` → `bot.command("help", (ctx) => ctx.reply(ctx.t("help")))`
- Удалить файл help.ts
- Убрать import

**Хлебные крошки**:
- handleHelp просто вызывает ctx.reply(ctx.t("help"))
- Нет бизнес-логики, нет if/else
- Inline короче и понятнее

---

## P2 - Малые

### 8. Удалить рудименты команд из STORY_REQUIRED_COMMANDS

**Файл**: `bot.ts:28`
**Проблема**: Set содержит незарегистрированные команды (/goal, /context, /trail)
**Решение**: Оставить только /by_current
**Требования**:
- `new Set(["/by_current"])` - только зарегистрированная команда
- Если /by_current единственная - можно упростить guard (но не обязательно)

**Хлебные крошки**:
- guard проверяет команды из Set
- bot.command зарегистрированы только: start, help, story, by_target, by_current, by_adhoc, link, cancel, token
- /goal, /context, /trail нет в регистрации → мёртвый код в Set

---

### 9. Удалить getTextOrError

**Файл**: `mcp-utils.ts:31`
**Проблема**: Dead code (не используется)
**Решение**: Удалить функцию
**Требования**:
- Оставить extractTextContent (используется)
- Оставить parseJsonContent (используется)
- Удалить getTextOrError

**Проверка**:
```bash
grep -r "getTextOrError" src/telegram-bot --include="*.ts"
# Должно вернуть 0 результатов
```

---

## Порядок Выполнения

1. **Quick wins** (15 мин):
   - #1 Russian → English
   - #2 Удалить createChildLogger
   - #3 Array bounds check
   - #8 Рудименты команд
   - #9 Удалить getTextOrError

2. **Environment** (10 мин):
   - #4 REDIS_URL в env
   - #5 Graceful shutdown

3. **Inline overengineering** (30 мин):
   - #6 Inline pending-actions.ts
   - #7 Inline help.ts

**Итого**: ~55 минут

---

## Финальная Проверка

```bash
# Lint
npm run lint

# TypeScript
npx tsc --noEmit

# Тесты (если есть)
npm run test

# Dead code
grep -r "createChildLogger\|getTextOrError\|pending-actions" src/telegram-bot --include="*.ts"
# Должно вернуть 0 результатов

# Строк кода (должно уменьшиться)
wc -l src/telegram-bot/**/*.ts
```

---

## Ожидаемый Результат

- -2 файла (pending-actions.ts, help.ts)
- -2 dead code функции (createChildLogger, getTextOrError)
- -3 рудимента команды (/goal, /context, /trail)
- +1 explicit check (array bounds)
- +1 env validation (REDIS_URL)
- +1 graceful shutdown (Redis)
- ~18 строк удалено

**Время**: ~1 час
**Риск**: Низкий (простые изменения)

---

## Согласованные Архитектурные Решения (ООП)

> **Дата**: 2025-12-08
> **Статус**: Зафиксировано, готово к реализации

### ООП Архитектура

#### 1. Где создавать классы
**✅ Решение**: В `bot.ts` (внутри createBot)

```typescript
// bot.ts
export function createBot(token: string, services: BotServices): Bot<BotContext> {
  const mcpClient = new McpClient(services.facadeMcpUrl);
  const sessionService = new SessionService(mcpClient);
  const searchPresenter = new SearchPresenter(formatterLlm);

  bot.use(async (ctx, next) => {
    ctx.services = { ...services, mcpClient, sessionService, searchPresenter };
    await next();
  });
}
```

**Инкапсуляция**: index.ts НЕ знает о классах

---

#### 2. Зависимости между классами
**✅ Решение**: Композиция (SessionService использует McpClient)

```typescript
export class SessionService {
  constructor(private mcpClient: McpClient) {} // DI через конструктор
}
```

---

#### 3. Lifetime классов
**✅ Решение**: Singleton (один экземпляр на бота)

Классы stateless → можно переиспользовать для всех requests

---

#### 4. Мутация ctx.session
**✅ Решение**: Мутировать (ООП стиль)

```typescript
async initialize(ctx: BotContext): Promise<void> {
  ctx.session = { status: "initialised", ... }; // Мутация
}
```

---

#### 5. Owner session state
**✅ Решение**: ctx.session owner

SessionService = domain expert для session lifecycle, НЕ owner

---

#### 6. Нейминг
**✅ Решение**:
- SessionService (не Manager)
- McpClient (не McpHttpClient)

---

### Type Safety

#### Guard Middleware
**✅ Решение**: Guard middleware (не бросаем исключение)

```typescript
bot.use(async (ctx, next) => {
  if (!ctx.services) {
    logger.error("Services not initialized");
    await ctx.reply("Internal error");
    return; // Блокируем
  }
  await next();
});
```

В handlers: используем `ctx.services!` (non-null assertion)

---

### Presenter Pattern

#### LLM Formatter
**✅ Решение**: SearchPresenter class (ООП)

```typescript
export class SearchPresenter {
  constructor(private llm: ChatOpenAI) {} // LLM один раз

  async formatSearchResult(rawJson: string, languageCode: string): Promise<string> {
    // LLM форматирование
  }
}
```

**LLM создаётся ОДИН РАЗ** в index.ts → передаётся в конструктор

---

### Error Handling

#### parseJsonContent
**✅ Решение**: Два варианта функции

```typescript
// Throwing (для критических данных)
export function parseJsonContent<T>(result: McpToolResult): T {
  // throw если fail
}

// Nullable (для optional данных)
export function tryParseJsonContent<T>(result: McpToolResult): T | null {
  // null если fail
}
```

**Использование**:
- callbacks.ts, link.ts → parseJsonContent (throw)
- formatters/story.ts → tryParseJsonContent (null)

**Обработка**: bot.catch() → reply generic error

---

#### formatColdStartResult
**✅ Решение**: Throwing (не поддерживать plain text fallback)

Агент cold_start ВСЕГДА возвращает JSON → plain text = баг → throw

---

### Tool Registry для Полной Type Safety

**✅ Решение**: Tool Registry в shared (переиспользует Facade schemas)

**Шаг 1**: Tool Registry

```typescript
// src/shared/tool-registry.ts

import {
  telegramRegisterParamsSchema,
  coldStartParamsSchema,
  searchByTargetParamsSchema,
  // ... все Facade schemas (17 tools)
} from "../facade/mcp-server/schemas.js";

import {
  sessionResponseSchema,
  coldStartResponseSchema,
  searchResultSchema,
  // ... response schemas
} from "../facade/mcp-server/result.js";

export const TOOL_REGISTRY = {
  register_telegram: {
    params: telegramRegisterParamsSchema, // ✅ Переиспользование Facade schemas
    response: sessionResponseSchema,
  },
  cold_start: {
    params: coldStartParamsSchema,
    response: coldStartResponseSchema,
  },
  search_by_target: {
    params: searchByTargetParamsSchema,
    response: searchResultSchema,
  },
  // ... все 17 tools
} as const;

export type ToolName = keyof typeof TOOL_REGISTRY;

// Derive enum для SEARCH_CONFIG
export const McpToolName = {
  REGISTER_TELEGRAM: "register_telegram",
  COLD_START: "cold_start",
  SEARCH_BY_TARGET: "search_by_target",
  SEARCH_USER_CAREERS: "search_user_careers",
  SEARCH_CAREERS: "search_careers",
  // ...
} as const satisfies Record<string, ToolName>;
```

**Шаг 2**: McpClient с полной type safety

```typescript
// src/telegram-bot/services/mcp-client.ts

import { TOOL_REGISTRY, type ToolName } from "../../shared/tool-registry.js";

export class McpClient {
  async callTool<T extends ToolName>(
    toolName: T,
    params: z.infer<typeof TOOL_REGISTRY[T]["params"]> // ✅ Type-safe params!
  ): Promise<z.infer<typeof TOOL_REGISTRY[T]["response"]>> {
    const tool = TOOL_REGISTRY[toolName];

    // ✅ Runtime валидация params (early error detection)
    const validatedParams = tool.params.parse(params);

    const result = await this.sendWithRetry(toolName, validatedParams);

    // ✅ Runtime валидация response
    const parsedContent = parseJsonContent(result);
    return tool.response.parse(parsedContent);
  }
}
```

**Шаг 3**: SEARCH_CONFIG использует enum

```typescript
// src/telegram-bot/types.ts

import { McpToolName } from "../shared/tool-registry.js";

export const SEARCH_CONFIG = {
  by_target: {
    command: "/by_target",
    action: "by_target" as const,
    i18n: { usage: "target-usage", searching: "searching-target" },
    mcpTool: McpToolName.SEARCH_BY_TARGET, // ✅ Type-safe
  },
  by_current: {
    command: "/by_current",
    action: "by_current" as const,
    i18n: { usage: "current-usage", searching: "searching-current" },
    mcpTool: McpToolName.SEARCH_USER_CAREERS,
  },
  by_adhoc: {
    command: "/by_adhoc",
    action: "by_adhoc" as const,
    i18n: { usage: "adhoc-usage", searching: "searching-adhoc" },
    mcpTool: McpToolName.SEARCH_CAREERS,
  },
} as const;

// Derive SearchType
export type SearchType = keyof typeof SEARCH_CONFIG;
```

**Шаг 4**: Бизнес-код (handlers)

```typescript
// src/telegram-bot/handlers/link.ts

async function callLinkTool(ctx: BotContext, token: string, telegramUserId: number) {
  // ✅ Полная type safety: tool name + params + response
  const result = await ctx.services.mcpClient.callTool(
    "link_telegram", // ✅ Autocomplete
    {
      token,         // ✅ Autocomplete для полей
      telegramUserId,
      // ❌ TypeScript error если добавить невалидное поле
    }
    // ✅ Return type автоматически: SessionResponse
  );

  // ✅ result уже типизирован
  ctx.session.sessionId = result.sessionId;
  ctx.session.hasStory = result.hasStory;
}
```

**Почему Tool Registry**:
- ✅ **Полная type safety** (tool names + params + response)
- ✅ **Early error detection** (compile-time + Bot runtime, ДО HTTP request)
- ✅ **Нет дублирования** (переиспользуем Facade schemas)
- ✅ **Defense in depth** (Bot + Facade валидация - standard practice)
- ✅ **Лучше DX** (autocomplete, меньше boilerplate в handlers)
- ✅ **Single source of truth** (tool registry)

**См. детальное сравнение**: `VARIANT-B-VS-C-COMPARISON.md`

---

### Session Architecture

#### Зачем Telegram Redis?
**✅ Решение**: Cache pattern (текущий подход)

**Два session store**:
- **Telegram Redis**: Bot UI state (sessionId, hasStory, pendingAction) - TTL 30 дней
- **Facade Session**: MCP tool context - TTL 30 мин

**Почему**:
- ✅ Performance (данные из Redis)
- ✅ Resilience (auto refresh при session_expired)
- ✅ Scaling (несколько инстансов бота)

---

### Анонимность Платформы

#### username/firstName в Facade
**✅ Решение**: НЕ отправлять (анонимная платформа)

```typescript
export class SessionService {
  async initialize(ctx: BotContext): Promise<void> {
    const userId = ctx.from?.id;
    if (!userId) throw new Error("No user ID");

    const result = await this.mcpClient.callTyped(
      McpToolName.REGISTER_TELEGRAM,
      {
        telegramUserId: userId,
        // ❌ НЕ отправляем username и firstName (анонимная платформа)
      },
      sessionResponseSchema
    );

    ctx.session = { status: "initialised", ... };
  }
}
```

**План фикса в Facade**:
- Обновить Facade схему: `telegramUsername`, `telegramFirstName` → `optional()` (уже optional ✅)
- Проверить Postgres schema: nullable columns (уже nullable ✅)

---

### Discriminated Union для Session

#### MySessionData Type-Safe States
**✅ Решение**: Использовать Discriminated Union

**Было** (проблемный):
```typescript
export type MySessionData = {
  sessionId: string; // ❌ Может быть ""
  hasStory: boolean;
  token: string;
  pendingAction?: PendingAction;
};

// Initial state
initial: () => ({
  sessionId: "", // ❌ Пустая строка = "нет sessionId"
  hasStory: false,
  token: "",
})
```

**Станет** (type-safe):
```typescript
export type MySessionData =
  | { status: "uninitialised" } // ✅ Нет sessionId
  | {
      status: "initialised"; // ✅ Есть sessionId
      sessionId: string;
      hasStory: boolean;
      token: string;
      pendingAction?: PendingAction;
    };

// Initial state
initial: () => ({
  status: "uninitialised", // ✅ Явно: нет sessionId
})
```

**Guard Middleware** (один раз для всех handlers):
```typescript
bot.use(async (ctx, next) => {
  if (ctx.session.status === "uninitialised") {
    await sessionService.initialize(ctx);
  }
  await next(); // ✅ Пропускаем только initialised session
});
```

**Плюсы**:
- ✅ Type-safe доступ к sessionId (TypeScript проверяет)
- ✅ Explicit states (uninitialised vs initialised)
- ✅ Guard middleware (одна проверка вместо многих)
- ✅ Можем удалить updateHasStory (inline в handler)

**Что меняется**:
1. Проверка sessionId ПЕРЕМЕЩАЕТСЯ в guard middleware (было в tool call)
2. Type-safe доступ к sessionId
3. Удаляем updateHasStory (inline)

**Что НЕ меняется**:
1. Session flow (register_telegram при uninitialised)
2. Session refresh (при session_expired)
3. Redis storage (тот же Redis)

---

## Финальные Решения

**См. также**:
- **REFACTORING-TYPE-SAFETY-ANALYSIS.md** - детальный анализ подходов к enum для tool names
- **REFACTORING-FINAL-QUESTIONS.md** - обсуждение всех 4 вопросов

**Все вопросы решены** ✅:

1. **username/firstName в Facade** - НЕ отправлять (анонимная платформа) ✅
2. **Строгие типы toolName** - Tool Registry в shared (полная type safety для tool + params + response) ✅
3. **Telegram Redis Session** - Cache pattern (текущий подход) ✅
4. **Discriminated Union** - Использовать для MySessionData ✅

**Статус**: Готово к реализации! 🚀
