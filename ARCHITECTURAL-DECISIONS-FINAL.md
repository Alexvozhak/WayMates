# Финальные Архитектурные Решения

> **Дата**: 2025-12-08
> **Статус**: Ответы на 9 вопросов из ARCHITECTURAL-CONFLICTS-REVIEW.md

---

## 1. Response Schemas - Где Хранить?

### Вопрос
"сделать в shared? чтобы и facade и telegram общались по одному api?"

### Текущая Ситуация

**MCP СЕЙЧАС работает БЕЗ Zod response schemas!**

Facade:
```typescript
execute: async (args) => {
  const params = telegramRegisterParamsSchema.parse(args); // ✅ Валидирует params
  const result = await tool.execute(params);
  return JSON.stringify(result.value, null, 2); // ⚠️ БЕЗ Zod validation!
}
```

Telegram:
```typescript
const result = await callTool(ctx, "link_telegram", { ... });
return parseJsonContent<LinkResponse>(result); // ⚠️ Type assertion, БЕЗ validation!
```

**parseJsonContent**:
```typescript
export function parseJsonContent<T>(result: McpToolResult): T {
  return JSON.parse(content.text) as T; // ⚠️ Type assertion
}
```

**Итог**: Runtime валидации responses НЕТ! Только TypeScript compile-time types.

---

### ✅ ФИНАЛЬНОЕ РЕШЕНИЕ: Schemas + Types ОБА в shared/schemas.ts

**Причина**: Подготовка к разделению на пакеты

**Архитектура пакетов**:
```
@waymates/shared        ← BASE (domain types + MCP contract)
   ↑
   ├── @waymates/facade         (бизнес-логика)
   └── @waymates/telegram-bot   (бизнес-логика)
```

**Почему ОБА в shared**:
- ✅ Shared = НЕЗАВИСИМЫЙ BASE пакет
- ✅ MCP contract (params + responses) в одном месте
- ✅ Facade НЕ владеет MCP schemas - это транспортный слой
- ✅ Telegram импортирует напрямую из shared (через Tool Registry)
- ✅ НЕТ циклических зависимостей (shared → facade ❌)

**Что НЕ в shared**: Бизнес-логика Facade (services, tools implementation)

---

### Миграция (3 шага)

#### Шаг 1: Переместить из facade в shared

**Из `facade/result.ts` → `shared/schemas.ts`**:
```typescript
// Primitives
export const sessionIdSchema = z
  .string()
  .regex(/^sess_[0-9a-f]{32}$/, "Session ID must be in format sess_<32-char-hex>");
export type SessionId = z.infer<typeof sessionIdSchema>;

export const errorCodeSchema = z.enum([
  "session_expired",
  "session_invalid",
  "invalid_token",
  "normalization_failed",
  "core_api_error",
  "validation_error",
  "internal_error",
  "postgres_connection_failed",
  "postgres_query_failed",
]);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const errorResponseSchema = z.object({
  code: errorCodeSchema,
  message: z.string(),
  details: z.record(z.unknown()).optional(),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
```

**Из `facade/schemas.ts` → `shared/schemas.ts`**:
```typescript
// MCP Params (ВСЕ schemas с sessionId)
export const tokenSchema = z.string().uuid().describe("User token (UUID v7)");
export type Token = z.infer<typeof tokenSchema>;

export const telegramRegisterParamsSchema = z.object({
  telegramUserId: z.number().int().positive(),
  telegramUsername: z.string().optional(),
  telegramFirstName: z.string().optional(),
});
export type TelegramRegisterParams = z.infer<typeof telegramRegisterParamsSchema>;

export const coldStartParamsSchema = z.object({
  message: z.string().min(1),
  sessionId: sessionIdSchema,
});
export type ColdStartParams = z.infer<typeof coldStartParamsSchema>;

// ... ВСЕ params schemas (~17 tools)
```

#### Шаг 2: Создать Response Schemas в shared (~200 строк)

```typescript
// shared/schemas.ts

// ========== MCP Response Schemas ==========

export const telegramRegisterResponseSchema = z.object({
  userId: userIdSchema,
  token: tokenSchema,
  sessionId: sessionIdSchema,
  isNewUser: z.boolean(),
  hasStory: z.boolean(),
});
export type TelegramRegisterResponse = z.infer<typeof telegramRegisterResponseSchema>;

export const coldStartResponseSchema = z.object({
  phase: z.enum(["COLLECTING", "CONFIRMATION", "COMPLETED"]),
  message: z.string(),
  collectedContexts: z.array(userContextSchema).optional(),
  needsConfirmation: z.boolean().optional(),
});
export type ColdStartResponse = z.infer<typeof coldStartResponseSchema>;

export const searchResultResponseSchema = z.object({
  candidates: z.array(scoredMatchedCandidateSchema),
  totalCount: z.number(),
});
export type SearchResultResponse = z.infer<typeof searchResultResponseSchema>;

export const goalResponseSchema = z.object({
  goalId: goalIdSchema,
  targetContext: targetContextSchema,
  createdAt: z.string(),
});
export type GoalResponse = z.infer<typeof goalResponseSchema>;

export const contextResponseSchema = z.object({
  contextId: contextIdSchema,
  context: userContextSchema,
});
export type ContextResponse = z.infer<typeof contextResponseSchema>;

export const trailResponseSchema = z.object({
  trailId: trailIdSchema,
  trail: trailSchema,
});
export type TrailResponse = z.infer<typeof trailResponseSchema>;

export const deleteResponseSchema = z.object({
  success: z.boolean(),
  deletedId: z.string(),
});
export type DeleteResponse = z.infer<typeof deleteResponseSchema>;

export const storyResponseSchema = z.object({
  contexts: z.array(userContextSchema),
  trails: z.array(trailSchema),
});
export type StoryResponse = z.infer<typeof storyResponseSchema>;

export const linkTelegramResponseSchema = z.object({
  userId: userIdSchema,
  sessionId: sessionIdSchema,
  hasStory: z.boolean(),
});
export type LinkTelegramResponse = z.infer<typeof linkTelegramResponseSchema>;

// ... остальные response schemas
```

#### Шаг 3: Создать facade/utils/result.ts

**Проблема**: Result<T, E> type используется ВСЕМИ facade tools, но это internal utility, НЕ часть MCP contract.

**Решение**: Вынести в отдельный файл `facade/utils/result.ts`

```typescript
// facade/utils/result.ts (НОВЫЙ ФАЙЛ)

/**
 * Result type for facade tools.
 * Discriminated union pattern for success/error handling.
 *
 * NOT part of MCP contract - internal facade utility.
 */
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
```

**Обновить импорты** во ВСЕХ facade tools:
```typescript
// facade/mcp-server/tools/*.ts
- import type { Result } from "../result.js";
+ import type { Result } from "../utils/result.js";
```

**Файлы для изменения** (~15 files):
- `tools/auth.tool.ts`
- `tools/cold-start.tool.ts`
- `tools/reset-cold-start.tool.ts`
- `tools/get-story.tool.ts`
- `tools/search-*.tool.ts` (3 files)
- `tools/*-goal.tool.ts` (3 files)
- `tools/*-context.tool.ts` (3 files)
- `tools/*-trail.tool.ts` (2 files)

---

#### Шаг 4: Удалить дублирование auth types

**Проблема**: auth.service.ts имеет TypeScript types, которые дублируют Zod schemas из shared.

**Решение**: Удалить старые types, использовать schemas из shared.

**В auth.service.ts**:

```diff
import { userIdSchema } from "../../shared/schemas.js";
+ import type {
+   SessionId,
+   Token,
+   RegisterResponse,
+   AuthenticateResponse,
+   TelegramRegisterResponse,
+   TelegramLinkResponse,
+ } from "../../shared/schemas.js";
import { InvalidTokenError } from "../errors.js";
import { postgresService } from "../infrastructure/postgres.service.js";

- import type { SessionId } from "./result.js";
- import type { Token } from "./schemas.js";
import type { SessionMiddleware } from "./session-middleware.js";
import type { UserId } from "../../shared/schemas.js";

- export type RegisterResult = {
-   token: Token;
-   sessionId: SessionId;
-   warning: string;
- };
-
- export type AuthenticateResult = {
-   sessionId: SessionId;
- };
-
- export type TelegramRegisterResult = {
-   userId: string;
-   token: Token;
-   sessionId: SessionId;
-   isNewUser: boolean;
-   hasStory: boolean;
- };
-
- export type TelegramLinkResult = {
-   userId: string;
-   sessionId: SessionId;
- };

export class AuthService {
  private static readonly registerWarning = "Save this token securely. It cannot be recovered if lost.";

  constructor(private sessionMiddleware: SessionMiddleware) {}

- async register(): Promise<RegisterResult> {
+ async register(): Promise<RegisterResponse> {
    // ... implementation unchanged
  }

- async authenticate(token: Token): Promise<AuthenticateResult> {
+ async authenticate(token: Token): Promise<AuthenticateResponse> {
    // ... implementation unchanged
  }

- async registerViaTelegram(userInfo: TelegramUserInfo): Promise<TelegramRegisterResult> {
+ async registerViaTelegram(userInfo: TelegramUserInfo): Promise<TelegramRegisterResponse> {
    // ... implementation unchanged
  }

- async linkTelegram(token: Token, userInfo: TelegramUserInfo): Promise<TelegramLinkResult> {
+ async linkTelegram(token: Token, userInfo: TelegramUserInfo): Promise<TelegramLinkResponse> {
    // ... implementation unchanged
  }
}
```

**Проверка**:
```bash
npx tsc --noEmit
npm run lint
# Должны пройти без ошибок
```

---

#### Шаг 5: Обновить импорты в facade (schemas + primitives)

**Критически важно**: Обновить импорты ПЕРЕД удалением facade/schemas.ts и facade/result.ts

**5.1. facade-mcp-server.ts** (строки 6-24):
```diff
import { throwToolError } from "../errors.js";
+ import {
+   authParamsSchema,
+   coldStartParamsSchema,
+   deleteContextParamsSchema,
+   deleteGoalParamsSchema,
+   deleteTrailParamsSchema,
+   facadeAdhocSearchParamsSchema,
+   getGoalParamsSchema,
+   getStoryParamsSchema,
+   resetColdStartParamsSchema,
+   searchByTargetParamsSchema,
+   searchUserCareersParamsSchema,
+   setGoalParamsSchema,
+   telegramLinkParamsSchema,
+   telegramRegisterParamsSchema,
+   updateContextParamsSchema,
+   upsertContextParamsSchema,
+   upsertTrailParamsSchema,
+ } from "../../shared/schemas.js";
import { AuthService } from "./auth.service.js";
- import {
-   authParamsSchema,
-   coldStartParamsSchema,
-   // ... остальные
- } from "./schemas.js";
```

**5.2. session-middleware.ts**:
```diff
- import { sessionIdSchema } from "./result.js";
+ import { sessionIdSchema } from "../../shared/schemas.js";
```

**5.3. errors.ts** (строка 1):
```diff
- import type { ErrorResponse } from "./mcp-server/result.js";
+ import type { ErrorResponse } from "../shared/schemas.js";
```

**Проверка**:
```bash
npx tsc --noEmit
# Должно пройти БЕЗ ОШИБОК
```

---

#### Шаг 6: Удалить facade/schemas.ts и facade/result.ts

После обновления всех импортов эти файлы больше НЕ нужны.

```bash
rm src/facade/mcp-server/schemas.ts
rm src/facade/mcp-server/result.ts
```

**Проверка**:
```bash
npx tsc --noEmit
npm run lint
# Должны пройти БЕЗ ОШИБОК

# Убедиться, что нет импортов из удалённых файлов
grep -r "from.*facade/mcp-server/schemas" src/
grep -r "from.*facade/mcp-server/result" src/
# Должны вернуть 0 результатов
```

---

#### Шаг 7: Финальная проверка

```bash
# 1. TypeScript compilation
npx tsc --noEmit

# 2. Linter
npm run lint

# 3. Unit tests
npm run test:unit

# 4. Integration tests (если затронуты MCP tools)
npm run test:integration
```

---

### Структура после миграции

```
src/
├── shared/
│   └── schemas.ts              ← ВСЁ здесь (domain + MCP contract)
│       ├── Domain entities (userContext, trail, goal, etc.)
│       ├── Search params (target, adhoc, current)
│       ├── MCP Primitives (sessionId, token, errorCode)
│       ├── MCP Params (17 tools params schemas + types)
│       └── MCP Responses (5 response schemas: auth + delete) ← НОВОЕ
│
├── facade/
│   ├── utils/
│   │   └── result.ts           ← Result<T, E> type (internal utility) ← НОВОЕ
│   └── mcp-server/
│       ├── facade-mcp-server.ts   ← Импортирует из shared
│       ├── auth.service.ts        ← Использует response types из shared
│       ├── story.service.ts
│       └── tools/*.ts             ← Импортируют Result из utils/
│
└── telegram-bot/
    ├── handlers/                  ← Импортирует типы из shared
    └── services/
        └── mcp-client.ts          ← Импортирует schemas через Tool Registry
```

**Ключевые изменения**:
- ✅ MCP contract (schemas) в shared
- ✅ Result<T, E> в facade/utils (internal utility)
- ✅ НЕТ дублирования auth types
- ✅ facade/schemas.ts и facade/result.ts удалены

---

### Facade импортирует из shared:
```typescript
// facade/mcp-server/facade-mcp-server.ts

import {
  telegramRegisterParamsSchema,
  telegramRegisterResponseSchema,
  coldStartParamsSchema,
  coldStartResponseSchema,
  errorResponseSchema,
} from "../../shared/schemas.js";
```

---

### Структура после миграции

```
src/
├── shared/
│   └── schemas.ts              ← ВСЁ здесь (domain + MCP contract)
│       ├── Domain entities (userContext, trail, goal, etc.)
│       ├── Search params (target, adhoc, current)
│       ├── MCP Primitives (sessionId, token, errorCode)
│       ├── MCP Params (17 tools params schemas + types)
│       └── MCP Responses (17 tools response schemas + types) ← НОВОЕ
│
├── facade/
│   └── mcp-server/
│       ├── facade-mcp-server.ts   ← Импортирует из shared
│       ├── auth.service.ts        ← Бизнес-логика
│       ├── story.service.ts
│       └── ...
│
└── telegram-bot/
    ├── handlers/                  ← Импортирует типы из shared
    └── services/
        └── mcp-client.ts          ← Импортирует schemas через Tool Registry
```

---

### Tool Registry (НЕ меняется)

```typescript
// shared/tool-registry.ts

import {
  telegramRegisterParamsSchema,
  telegramRegisterResponseSchema,
  coldStartParamsSchema,
  coldStartResponseSchema,
  // ... все импорты из shared/schemas.ts
} from "./schemas.js";

export const TOOL_REGISTRY = {
  register_telegram: {
    params: telegramRegisterParamsSchema,
    response: telegramRegisterResponseSchema,
  },
  cold_start: {
    params: coldStartParamsSchema,
    response: coldStartResponseSchema,
  },
  // ... 17 tools
} as const;
```

---

## 2. SessionService.initialize() Immutable

### Решение: ОК ✅

**Вариант A**: Return new session (immutable)

```typescript
export class SessionService {
  async initialize(ctx: BotContext): Promise<InitialisedSession> {
    const result = await this.mcpClient.callTool("register_telegram", {
      telegramUserId: ctx.from!.id,
    });

    return {
      status: "initialised",
      sessionId: result.sessionId,
      hasStory: result.hasStory,
      token: result.token,
    };
  }
}

// Guard middleware
if (ctx.session.status === "uninitialised") {
  ctx.session = await ctx.services.sessionService.initialize(ctx);
}
```

**Тип**:
```typescript
export type InitialisedSession = Extract<MySessionData, { status: "initialised" }>;
```

---

## 3. BotServices Type Split

### Решение: ОК ✅

**Разделить BotConfig и BotServices**:

```typescript
// Config (передается В createBot)
export type BotConfig = {
  facadeMcpUrl: string;
  openaiApiKey: string;
  groqApiKey: string;
  botToken: string;
  formatterLlm: LlmConfig; // Config object
};

// Services (создаются ВНУТРИ createBot)
export type BotServices = {
  mcpClient: McpClient;
  sessionService: SessionService;
  searchPresenter: SearchPresenter;
};

// Signature
export function createBot(config: BotConfig): Bot<BotContext> {
  const llm = new ChatOpenAI(config.formatterLlm);
  const mcpClient = new McpClient(config.facadeMcpUrl);
  const sessionService = new SessionService(mcpClient);
  const searchPresenter = new SearchPresenter(llm);

  const services: BotServices = { mcpClient, sessionService, searchPresenter };

  bot.use(async (ctx, next) => {
    ctx.services = services;
    await next();
  });
}
```

---

## 4. Guard Middleware Order

### Вопрос
"создание всех сервисов в начале разве норм? не возникнет ли новых проблем?"

### Ответ: Нет Проблем ✅

**Уточнение**: Сервисы создаются **ОДИН РАЗ** при старте бота (singleton), НЕ при каждом сообщении!

```typescript
export function createBot(config: BotConfig): Bot<BotContext> {
  // ✅ ОДИН РАЗ при старте бота (не при каждом сообщении!)
  const mcpClient = new McpClient(config.facadeMcpUrl);
  const sessionService = new SessionService(mcpClient);
  const searchPresenter = new SearchPresenter(llm);

  const services = { mcpClient, sessionService, searchPresenter };

  // Middleware ТОЛЬКО добавляет ссылку на УЖЕ созданные сервисы
  bot.use(async (ctx, next) => {
    ctx.services = services; // ✅ Shallow copy reference (не создание!)
    await next();
  });

  return bot;
}
```

**Что происходит при каждом сообщении**:
1. Grammy создает новый `ctx` объект
2. Middleware #1: добавляет `ctx.services = services` (ссылка на singleton instances)
3. Middleware #2: проверяет `ctx.session.status`, вызывает `sessionService.initialize()` если нужно
4. Handler: использует `ctx.services.mcpClient.callTool(...)`

**Сервисы НЕ СОЗДАЮТСЯ заново, только ссылка копируется!**

**Почему нет проблем**:
- ✅ Сервисы stateless (нет mutable state)
- ✅ Singleton pattern (переиспользуем instances)
- ✅ Thread-safe (Node.js single-threaded, async operations OK)
- ✅ Эффективно (не создаем LLM/HTTP clients при каждом сообщении)

**Порядок middleware**:
```typescript
// 1. Добавить services (ССЫЛКА на singleton instances)
bot.use(async (ctx, next) => {
  ctx.services = { mcpClient, sessionService, searchPresenter };
  await next();
});

// 2. Guard для session (использует ctx.services.sessionService)
bot.use(async (ctx, next) => {
  if (ctx.session.status === "uninitialised") {
    ctx.session = await ctx.services.sessionService.initialize(ctx);
  }
  await next();
});
```

**Итог**: Нет проблем ✅

---

## 5. Error Handling в McpClient

### Решение: ОК ✅

**Вариант A**: Throwing (простой)

```typescript
async callTool<T extends ToolName>(toolName: T, params: ...) {
  const result = await this.sendWithRetry(toolName, params);

  if (result.isError) {
    const error = parseJsonContent<ErrorResponse>(result);
    throw new McpClientError(error.message, error.code);
  }

  const parsedContent = parseJsonContent(result);
  return tool.response.parse(parsedContent);
}
```

**Обработка**: `bot.catch()` → reply generic error

---

## 6. formatterLlm Ownership

### Решение: ОК ✅

**Вариант B**: Config в BotConfig

```typescript
export type BotConfig = {
  facadeMcpUrl: string;
  formatterLlm: LlmConfig; // ✅ Config object
};

// index.ts
createBot({
  facadeMcpUrl,
  formatterLlm: { model: "gpt-4o-mini", temperature: 0.3 },
});

// createBot
const llm = new ChatOpenAI(config.formatterLlm);
const searchPresenter = new SearchPresenter(llm);
```

**Почему**: createBot инкапсулирует создание LLM instance.

---

## 7. Discriminated Union Guards в Handlers

### Вопрос
"актуален ли после вопрос №4?"

### Ответ: ДА, Актуален! ✅

**Проблема**: TypeScript type narrowing НЕ РАБОТАЕТ через async boundaries (`await next()`)

```typescript
// Guard middleware
bot.use(async (ctx, next) => {
  if (ctx.session.status === "uninitialised") {
    ctx.session = await sessionService.initialize(ctx);
  }
  // ✅ TypeScript ЗДЕСЬ знает что ctx.session.status === "initialised"
  await next(); // ❌ Async boundary! TypeScript теряет narrowing
});

// Handler (ПОСЛЕ next())
bot.command("story", async (ctx) => {
  // ❌ TypeScript НЕ ЗНАЕТ что ctx.session.status === "initialised"
  // ctx.session все еще union type!
  ctx.session.hasStory = true; // ❌ Property 'hasStory' does not exist
});
```

**Почему TypeScript теряет narrowing**:
- `next()` возвращает `Promise`
- TypeScript не может track type narrowing через async operations
- `ctx.session` может измениться между middleware и handler (теоретически)

**Решение**: Guards в handlers НЕОБХОДИМЫ!

```typescript
bot.command("story", async (ctx) => {
  if (ctx.session.status !== "initialised") {
    await ctx.reply("Session expired");
    return;
  }
  // ✅ TypeScript ЗНАЕТ что ctx.session.status === "initialised"
  ctx.session.hasStory = true;
});
```

**Альтернатива**: Non-null assertion
```typescript
ctx.session.hasStory! = true; // ❌ Теряем type safety
```

**Рекомендация**: Добавить guards в handlers. Boilerplate acceptable за type safety.

**Паттерн для всех handlers**:
```typescript
export async function handleApproveCallback(ctx: BotContext): Promise<void> {
  // Guard в начале handler
  if (ctx.session.status !== "initialised") {
    await ctx.answerCallbackQuery({ text: "Session expired" });
    return;
  }

  // ✅ Дальше TypeScript знает что session initialised
  const result = await ctx.services.mcpClient.callTool("cold_start", { message: "да" });
  if (result.phase === "COMPLETED") {
    ctx.session.hasStory = true; // ✅ Type-safe
  }
}
```

---

## 8. Redis TTL Optimization

### Решение: Не Оптимизируем ✅

**Итог**: Оставляем единый TTL (30 дней). Optimization opportunity, но не критично.

---

## 9. Search Handlers - NLP Parser

### Вопрос
"мне не нравится в примерах что ты только targetcontext с ллмки берешь, а лимит сам гвоздями прибиваешь, в действительности должно быть всё с ллмки. согласен с таким подходом?"

### Ответ: ДА, Согласен! ✅

**Проверка NLP Parser** (`src/telegram-bot/services/nlp-parser.ts`):

**parseTargetQuery** извлекает:
```typescript
// Prompt
- targetContext: object with position/countries/domains/skills/languages
- excludedCreationReasons: array or null
- recencyThresholdMonths: number or null
- limit: number or null  // ✅ Извлекается!

// Return type
Promise<TargetSearchParamsBase> // ✅ Полный объект!
```

**parseAdhocQuery** извлекает:
```typescript
- referenceContext: object
- excludedContextFields: array
- excludedCreationReasons: array
- recencyThresholdMonths: number
- limit: number           // ✅ Извлекается!
- pathLimit: number       // ✅ Извлекается!
```

**parseCurrentQuery** извлекает:
```typescript
- excludedContextFields: array
- excludedCreationReasons: array
- recencyThresholdMonths: number
- limit: number           // ✅ Извлекается!
- pathLimit: number       // ✅ Извлекается!
```

**NLP Parser УЖЕ извлекает ВСЕ параметры!**

---

### Правильный Подход

**НЕ хардкодить limit**, использовать NLP parser result напрямую:

```typescript
// by-target.ts
async function executeTargetSearch(ctx: BotContext, query: string): Promise<void> {
  // ✅ NLP извлекает ВСЕ параметры (targetContext + limit + ...)
  const params = await parseTargetQuery(ctx.services.openaiApiKey, query);

  // ✅ Используем весь объект (не добавляем хардкод limit)
  const result = await ctx.services.mcpClient.callTool("search_by_target", params);

  await formatSearchResult(result, ctx);
}
```

**Если пользователь не указал limit**:
- NLP parser возвращает `null`
- Zod schema имеет `.default(20)` (из `shared/schemas.ts`)
- MCP tool получает default значение

**Схема** (`shared/schemas.ts`):
```typescript
export const targetSearchParamsBaseSchema = z.object({
  targetContext: targetContextSchema,
  excludedCreationReasons: z.array(newContextReasonSchema).default([]),
  recencyThresholdMonths: z.number().min(1).optional(),
  limit: z.number().min(1).max(100).default(20), // ✅ Default!
});
```

**Итог**: НЕ хардкодим limit, используем NLP parser + schema defaults ✅

---

## 📊 Итоговая Таблица Решений

| # | Вопрос | Решение | Статус |
|---|--------|---------|--------|
| 1 | Response Schemas | **shared/schemas.ts** (schemas + types ОБА) | ✅ Согласовано |
| 2 | SessionService.initialize() | Return InitialisedSession (immutable) | ✅ Согласовано |
| 3 | BotServices Type Split | Разделить BotConfig и BotServices | ✅ Согласовано |
| 4 | Guard Middleware Order | services → session guard (сервисы - singleton) | ✅ Согласовано |
| 5 | Error Handling | Throwing (McpClientError) | ✅ Согласовано |
| 6 | formatterLlm Ownership | Config в BotConfig (createBot создает LLM) | ✅ Согласовано |
| 7 | Discriminated Union Guards | Добавить guards в handlers (необходимо!) | ✅ Согласовано |
| 8 | Redis TTL Optimization | Не оптимизируем | ✅ Согласовано |
| 9 | Search Handlers Params | Использовать NLP parser полностью (не хардкод) | ✅ Согласовано |

---

## 🎯 Action Items

**P0 - Критические**:
1. ✅ Переместить schemas из facade в shared (~50 строк)
2. ✅ Создать Response Schemas в shared (~200 строк)
3. ✅ Удалить facade/schemas.ts и facade/result.ts
4. ✅ Обновить импорты в facade (из shared)
5. ✅ SessionService.initialize() → return InitialisedSession
6. ✅ BotConfig vs BotServices split
7. ✅ Guards в handlers (type narrowing через async)

**Обновить REFACTORING-PLAN.md**:
- Response schemas location (**shared/schemas.ts**, НЕ facade)
- Migration plan (facade → shared)
- SessionService.initialize() signature (immutable)
- BotConfig vs BotServices
- Guard pattern в handlers
- NLP parser usage (не хардкодить params)

**Статус**: Готово к обновлению REFACTORING-PLAN.md и началу реализации! 🚀
