# План Рефакторинга Telegram Bot

> **Дата**: 2025-12-08
> **Статус**: Готов к реализации

---

## Production Readiness (P0)

### 1. Request Timeout

**Проблема**: Нет timeout для HTTP запросов к Facade → бот может зависнуть

**Решение**: Axios с timeout из .env

```typescript
// .env
FACADE_REQUEST_TIMEOUT_MS=30000

// env.ts
facadeRequestTimeoutMs: z.coerce.number().min(1000).max(60000).default(30000)

// services/mcp-client.ts
export class McpClient {
  constructor(baseUrl: string, timeoutMs: number) {
    this.axiosInstance = axios.create({
      baseURL: baseUrl,
      timeout: timeoutMs,
    });
  }
}
```

---

### 2. Conversation State Cleanup (Memory Leak)

**Проблема**: Grammy session без TTL → memory leak

**Решение**: Global TTL 7 дней для Telegram Redis

```typescript
// bot.ts
const storage = new RedisAdapter<MySessionData>({
  instance: redis,
  ttl: 604800,  // 7 дней
});
```

**Зачем локальный Redis?**

| Store | Что хранит | TTL |
|-------|-----------|-----|
| Telegram Redis (state) | `pendingAction` (UI state), `token` (permanent), `hasStory` (cache) | 7 дней (UX) |
| Telegram Redis (sessionId) | `sessionId` (кэш для оптимизации) | **30 мин** (синхронизировано с Facade) |
| Facade Redis | User session для MCP tools, LangGraph states | 30 мин (security) |

**Архитектура кэширования sessionId:**

```typescript
// Два разных ключа с разными TTL:
// telegram:session:{userId}:state       → TTL 7 дней (permanent state)
// telegram:session:{userId}:sessionId   → TTL 30 мин (cache синхронизирован с Facade)

// SessionService.getSessionId()
async getSessionId(ctx: BotContext): Promise<string> {
  const cacheKey = `telegram:session:${ctx.from.id}:sessionId`;
  let sessionId = await redis.get(cacheKey);

  if (!sessionId) {
    // Кэш протух или первый запрос → получаем fresh sessionId
    const result = await this.mcpClient.callTool("register_telegram", {
      telegramUserId: ctx.from.id,
    });

    sessionId = result.sessionId;
    await redis.setex(cacheKey, 1800, sessionId); // TTL 30 минут
  }

  return sessionId;
}
```

**Плюсы Варианта B:**
- Меньше вызовов `register_telegram` (кэш работает 30 минут)
- Автоматическая синхронизация с Facade TTL
- Если sessionId протух в Facade → протух и в кэше → автоматический перезапрос

---

### 3. Graceful Shutdown

**Проблема**: Redis соединение не закрывается при shutdown

**Решение**: Закрыть Redis при SIGTERM/SIGINT

```typescript
// index.ts
async function shutdown(signal: string): Promise<void> {
  await bot.stop();
  await redis.quit();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
```

---

## Production Readiness (P1)

### 4. Webhook Secret Validation

**Проблема**: Злоумышленники могут отправлять поддельные webhooks

**Решение**: Telegram secret token validation

```typescript
// .env
TELEGRAM_WEBHOOK_SECRET=randomly_generated_secret_token_123

// bot.ts
if (env.USE_WEBHOOK) {
  const handleWebhook = webhookCallback(bot, "std/http", {
    secretToken: env.TELEGRAM_WEBHOOK_SECRET,
  });
}
```

**Как работает**: Telegram добавляет `X-Telegram-Bot-Api-Secret-Token` заголовок → Grammy проверяет → отклоняет запросы без токена

---

## Архитектурные Решения

### 5. Response Schemas для Валидации

**Проблема**: Bot не валидирует ответы от Facade → silent fails при изменении API

**Решение**: Создать response schemas в `telegram-bot/schemas/mcp-responses.ts`

**ВАЖНО:** НЕ в `shared/schemas.ts` (архитектурная ошибка), а в отдельном файле telegram-bot.

```typescript
// telegram-bot/schemas/mcp-responses.ts
import { z } from "zod";
import { userIdSchema, tokenSchema, scoredMatchedCandidateSchema } from "../../shared/schemas.js";

// Session ID schema
export const sessionIdSchema = z.string().regex(/^sess_[0-9a-f]{32}$/);

// Error schemas
export const errorCodeSchema = z.enum(["session_expired", "session_invalid", "unauthorized"]);
export const errorResponseSchema = z.object({
  code: errorCodeSchema,
  message: z.string(),
});

// Response schemas
export const telegramRegisterResponseSchema = z.object({
  userId: userIdSchema,
  token: tokenSchema,
  sessionId: sessionIdSchema,
  isNewUser: z.boolean(),
  hasStory: z.boolean(),
});

export const coldStartResponseSchema = z.object({
  phase: z.enum(["COLLECTING", "CONFIRMATION", "COMPLETED"]),
  message: z.string(),
  hasStory: z.boolean().optional(),
});

export const searchResultResponseSchema = z.object({
  candidates: z.array(scoredMatchedCandidateSchema),
  totalCount: z.number(),
});
```

**Убрать username/firstName из params:**

```diff
// shared/schemas.ts
export const telegramRegisterParamsSchema = z.object({
  telegramUserId: z.number().int().positive(),
- telegramUsername: z.string().optional(),
- telegramFirstName: z.string().optional(),
});
```

---

### 6. Runtime Валидация с Zod (Упрощенный Подход)

**Проблема**: Нет runtime валидации params/response от Facade

**Решение**: Zod валидация БЕЗ Tool Registry (упрощенный вариант)

**Принято:** Отказ от полного Tool Registry (слишком сложно) → используем только Zod валидация.

```typescript
// services/mcp-client.ts
export class McpClient {
  private axiosInstance: AxiosInstance;

  constructor(baseUrl: string, timeoutMs: number) {
    this.axiosInstance = axios.create({
      baseURL: baseUrl,
      timeout: timeoutMs,
    });
  }

  async callTool<TParams, TResponse>(
    toolName: string,
    params: TParams,
    paramsSchema: z.ZodType<TParams>,
    responseSchema: z.ZodType<TResponse>
  ): Promise<TResponse> {
    // Runtime валидация params
    const validatedParams = paramsSchema.parse(params);

    // Отправка запроса с retry
    const result = await this.sendWithRetry(toolName, validatedParams);

    // Парсинг и валидация response
    const parsedContent = parseJsonContent(result);
    return responseSchema.parse(parsedContent);
  }

  private async sendWithRetry(toolName: string, params: unknown): Promise<McpToolResult> {
    // ... retry логика
  }
}

// handlers/by-target.ts
const result = await ctx.services.mcpClient.callTool(
  "search_by_target",
  { targetContext: { ... }, limit: 10 },
  searchByTargetParamsSchema,
  searchResultResponseSchema
);
```

**Плюсы:**
- ✅ Runtime валидация работает
- ✅ Проще реализовать (нет registry)
- ✅ Меньше кода

**Минусы:**
- ❌ Нет compile-time проверки tool name
- ❌ Нет autocomplete для params
- ❌ Verbose (2 схемы каждый раз)

---

### 7. Discriminated Union для MySessionData

**Проблема**: sessionId может быть пустым → runtime ошибки

**Решение**: Discriminated union с guard middleware

```typescript
// types.ts
export type MySessionData =
  | { status: "uninitialised" }
  | {
      status: "initialised";
      token: string;              // ← для LibreChat linking
      hasStory: boolean;          // ← кэш (обновляется после /story)
      pendingAction?: PendingAction; // ← UI state
      // sessionId хранится в ОТДЕЛЬНОМ Redis ключе с TTL 30 мин!
      // НЕ в Grammy session (разные TTL)
    };
```

**Guards**:

```typescript
// bot.ts

// Guard для commands (автоматическая инициализация)
bot.use(async (ctx, next) => {
  if (ctx.session.status === "uninitialised") {
    await ctx.services.sessionService.initialize(ctx);
  }
  await next();
});

// Guard для callbacks (session может протухнуть)
bot.callbackQuery(/^decision:/, async (ctx, next) => {
  if (ctx.session.status === "uninitialised") {
    await ctx.answerCallbackQuery({ text: "Session expired" });
    await ctx.editMessageText(ctx.t("session-expired"));
    return;
  }
  await next();
});
```

---

### 8. ООП Архитектура

**Проблема**: Функциональный стиль → сложная композиция зависимостей

**Решение**: Классы McpClient, SessionService, SearchPresenter

```typescript
// services/mcp-client.ts
export class McpClient {
  private axiosInstance: AxiosInstance;

  constructor(baseUrl: string, timeoutMs: number) {
    this.axiosInstance = axios.create({ baseURL: baseUrl, timeout: timeoutMs });
  }

  async callTool<T extends ToolName>(...): Promise<...> { ... }
  private async sendWithRetry(...): Promise<McpToolResult> { ... }
}

// services/session-service.ts
import type { Redis } from "ioredis";

export class SessionService {
  constructor(
    private mcpClient: McpClient,
    private redis: Redis  // ← ИСПРАВЛЕНО: добавлен Redis
  ) {}

  async initialize(ctx: BotContext): Promise<void> {
    const result = await this.mcpClient.callTool(
      "register_telegram",
      { telegramUserId: ctx.from!.id },
      telegramRegisterParamsSchema,
      telegramRegisterResponseSchema
    );

    ctx.session = {
      status: "initialised",
      token: result.token,
      hasStory: result.hasStory,
      // sessionId НЕ в Grammy session (разные TTL)!
    };

    // Кэшируем sessionId отдельно с TTL 30 мин
    const cacheKey = `telegram:session:${ctx.from.id}:sessionId`;
    await this.redis.setex(cacheKey, 1800, result.sessionId);
  }

  async getSessionId(ctx: BotContext): Promise<string> {
    const cacheKey = `telegram:session:${ctx.from.id}:sessionId`;
    let sessionId = await this.redis.get(cacheKey);

    if (!sessionId) {
      // Кэш протух → получаем fresh sessionId
      const result = await this.mcpClient.callTool(
        "register_telegram",
        { telegramUserId: ctx.from.id },
        telegramRegisterParamsSchema,
        telegramRegisterResponseSchema
      );

      sessionId = result.sessionId;
      await this.redis.setex(cacheKey, 1800, sessionId); // 30 мин
    }

    return sessionId;
  }

  async clearSessionCache(userId: number): Promise<void> {
    // Очистка кэша при /start или logout
    const cacheKey = `telegram:session:${userId}:sessionId`;
    await this.redis.del(cacheKey);
  }
}

// presenters/search-presenter.ts
import { ChatOpenAI } from "@langchain/openai";
import type { LlmConfig } from "../types.js";

export class SearchPresenter {
  private llm: ChatOpenAI;

  constructor(apiKey: string, llmConfig: LlmConfig) {
    this.llm = new ChatOpenAI({
      modelName: llmConfig.model,
      temperature: llmConfig.temperature,
      openAIApiKey: apiKey,
    });
  }

  async formatSearchResult(rawJsonResult: string, languageCode: string): Promise<string> {
    const prompt = createPrompt(rawJsonResult, languageCode);
    const response = await this.llm.invoke(prompt);
    return typeof response.content === "string" ? response.content.trim() : String(response.content).trim();
  }
}

function createPrompt(rawJson: string, languageCode: string): string {
  return `You are a friendly career consultant in a Telegram bot.

Task: Present career path search results in a warm, human tone.

Rules:
- Use emojis sparingly (📊 🎯 💼 🔧 📍)
- Format with Markdown (bold **text**, lists)
- Each path should be a separate block
- Highlight similarity percentage and key skills
- Add a short intro (1-2 sentences)
- Avoid template phrases like "Here's what I found"
- Show top 5 results maximum
- If no results, say it naturally
- IMPORTANT: Respond in ${languageCode === "en" ? "English" : "Russian"}

Data (JSON):
${rawJson}

Response (Markdown only, no explanations):`;
}

// index.ts
const redis = new Redis(env.TELEGRAM_REDIS_URL);

const mcpClient = new McpClient(env.FACADE_MCP_URL, env.FACADE_REQUEST_TIMEOUT_MS);
const sessionService = new SessionService(mcpClient, redis);
const searchPresenter = new SearchPresenter(env.OPENAI_API_KEY, {
  model: "gpt-4o-mini",
  temperature: 0.7,
});

const bot = createBot(env.TELEGRAM_BOT_TOKEN, {
  mcpClient,
  sessionService,
  searchPresenter,
});

// Graceful shutdown
async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "Shutting down gracefully");
  await bot.stop();
  await redis.quit();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
```

---

### 9. Error Handling

**Проблема**: parseJsonContent возвращает null → silent fails

**Решение**: Throwing для критических, nullable для optional

```typescript
// utils/mcp-utils.ts

// Throwing version (для критических случаев)
export function parseJsonContent<T>(result: McpToolResult): T {
  const text = extractTextContent(result);
  if (!text) throw new McpClientError("MCP result has no text content");

  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new McpClientError("Failed to parse JSON", error);
  }
}

// Nullable version (для optional случаев)
export function tryParseJsonContent<T>(result: McpToolResult): T | null {
  const text = extractTextContent(result);
  if (!text) return null;

  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

// bot.ts
bot.catch(async (error) => {
  if (error.error instanceof McpClientError) {
    logger.error({ err: error.error }, "MCP client error");
    await ctx.reply(ctx.t("error-generic"));
    return;
  }

  logger.error({ err: error.error }, "Unhandled error");
  await ctx.reply(ctx.t("error-generic"));
});
```

---

### 10. cold_start Возвращает hasStory

**Проблема**: Bot не знает когда story завершена

**Решение**: Facade возвращает hasStory при COMPLETED

```typescript
// facade/mcp-server/cold-start.tool.ts
if (phase === "COMPLETED") {
  const contextsCount = await db.query(
    "MATCH (u:User {user_id: $userId})-[:HAS_CONTEXT]->(c:Context) RETURN count(c) as count",
    { userId: session.userId }
  );

  return {
    phase: "COMPLETED",
    message: "История сохранена!",
    hasStory: contextsCount.records[0].get("count") > 0,
  };
}

// telegram-bot/callbacks.ts
const data = parseJsonContent<ColdStartResponse>(result);

if (data.phase === "COMPLETED") {
  ctx.session.hasStory = data.hasStory ?? false;
  await ctx.editMessageText(ctx.t("story-approved", { message: data.message }));
}
```

---

## Code Quality (Выполнено)

### 11. NLP Parser — Generic Function ✅

**Статус**: Выполнено в предыдущей сессии

### 12. Schema Cleanup ✅

**Статус**: Выполнено в предыдущей сессии

### 13. Search Utils — formatAndReplySearch ✅

**Статус**: УЖЕ существует в `utils/search-utils.ts`

### 14. ACTION_REQUIRED_MESSAGE — i18n ✅

**Статус**: Выполнено (через `locales/ru.ftl`)

### 15. Handlers Дублирование — Убрать Прокси

**Проблема**: Прокси-функции `handleByTargetWithText`, `handleByAdhocWithText`, `handleByCurrentWithText` дублируют код

**Решение**: Убрать прокси, экспортировать внутренние `process*Query` функции

```typescript
// by-target.ts
// Было:
export async function handleByTargetWithText(ctx: BotContext, text: string) {
  await performTargetSearch(ctx, text); // ← Ненужная обертка
}

// Станет:
export async function processTargetQuery(ctx: BotContext, query: string) {
  const statusMsg = await ctx.reply(ctx.t("searching-target"));
  await ctx.replyWithChatAction("typing");

  const searchParams = await parseTargetQuery(ctx.services.openaiApiKey, query);
  const result = await callTool(ctx, "search_by_target", searchParams);

  await ctx.api.deleteMessage(statusMsg.chat.id, statusMsg.message_id);
  await formatAndReplySearch(ctx, result);
}

// input-router.ts
const handlers = {
  by_target: processTargetQuery, // ← Прямой вызов, БЕЗ обертки
  by_adhoc: processAdhocQuery,
  by_current: processCurrentQuery,
};
```

---

## Файлы для Изменения

### Создать

| Файл | Назначение |
|------|-----------|
| `src/telegram-bot/schemas/mcp-responses.ts` | Response schemas для валидации |
| `src/telegram-bot/services/mcp-client.ts` | McpClient класс (НЕ функция!) |
| `src/telegram-bot/services/session-service.ts` | SessionService класс |
| `src/telegram-bot/presenters/search-presenter.ts` | SearchPresenter класс |
| `src/telegram-bot/services/live-messages.ts` | LLM генерация приветствий |
| `src/telegram-bot/formatters/cold-start.ts` | LLM форматирование cold_start результатов |
| `src/telegram-bot/locales/ru.ftl` | i18n локализация ✅ (уже создано) |

### Изменить

| Файл | Действие |
|------|----------|
| `src/shared/schemas.ts` | Добавить response schemas, убрать username/firstName |
| `src/telegram-bot/types.ts` | MySessionData → discriminated union |
| `src/telegram-bot/bot.ts` | Guard middleware, webhook secret |
| `src/telegram-bot/env.ts` | FACADE_REQUEST_TIMEOUT_MS, TELEGRAM_WEBHOOK_SECRET |
| `src/telegram-bot/index.ts` | Создать классы, graceful shutdown |
| `src/telegram-bot/handlers/*.ts` | Guard в handlers, убрать `handleByTargetWithText` обертки |
| `src/telegram-bot/handlers/input-router.ts` | Импортировать `process*Query` вместо `handle*WithText` |
| `src/telegram-bot/handlers/start.ts` | Использовать `generateWelcomeMessage` вместо i18n |
| `src/telegram-bot/handlers/story.ts` | Использовать `formatColdStartMessage` для ответов LangGraph |
| `src/telegram-bot/utils/mcp-utils.ts` | tryParseJsonContent |
| `src/facade/mcp-server/cold-start.tool.ts` | Возвращать hasStory |

---

## Приоритеты Реализации

### Фаза 0: Доделать REFACTOR-PLAN.md (старый план)

**Что осталось из старого плана:**
- ❌ Фаза 3.2: Убрать `handleByTargetWithText`, `handleByAdhocWithText`, `handleByCurrentWithText` обертки
- ❌ Экспортировать `processTargetQuery`, `processAdhocQuery`, `processCurrentQuery`
- ❌ Обновить `input-router.ts` (прямые вызовы вместо оберток)

**Почему в Фазе 0:** Это простой рефакторинг без зависимостей, быстро доделать перед основными фазами.

**Файлы:**
- `src/telegram-bot/handlers/by-target.ts`
- `src/telegram-bot/handlers/by-adhoc.ts`
- `src/telegram-bot/handlers/by-current.ts`
- `src/telegram-bot/handlers/input-router.ts`

---

### Фаза 1a: Production Readiness (независимая часть)
1. Request Timeout (axios + .env)
2. Conversation State Cleanup (Grammy session TTL 7 дней)
3. Graceful Shutdown (закрыть Redis при SIGTERM/SIGINT)
4. Health Check на старте (Redis + Facade ping)

**Файлы:**
- `src/telegram-bot/env.ts` — добавить FACADE_REQUEST_TIMEOUT_MS
- `src/telegram-bot/index.ts` — graceful shutdown, health check
- `src/telegram-bot/bot.ts` — Grammy session TTL 7 дней

### Фаза 2: Архитектурные Изменения
1. Response Schemas в `telegram-bot/schemas/mcp-responses.ts`
2. Discriminated Union для MySessionData
3. Убрать username/firstName из telegramRegisterParamsSchema

**Файлы:**
- `src/telegram-bot/schemas/mcp-responses.ts` — создать
- `src/telegram-bot/types.ts` — MySessionData discriminated union
- `src/shared/schemas.ts` — убрать username/firstName

### Фаза 3: ООП Рефакторинг + Migration
1. McpClient класс (упрощенный, без Tool Registry)
2. SessionService класс
3. SearchPresenter класс
4. Обновить BotServices тип
5. **Migration: Обновить ВСЕ handlers** (breaking change!)

**Migration Sub-Phase:**
- Обновить 6 handlers: by-target, by-adhoc, by-current, story, link, token
- Было: `callTool(ctx, "search_by_target", params)`
- Станет: `ctx.services.mcpClient.callTool("search_by_target", params, paramsSchema, responseSchema)`

**Файлы:**
- `src/telegram-bot/services/mcp-client.ts` — класс McpClient
- `src/telegram-bot/services/session-service.ts` — класс SessionService
- `src/telegram-bot/presenters/search-presenter.ts` — класс SearchPresenter
- `src/telegram-bot/types.ts` — обновить BotServices
- `src/telegram-bot/handlers/*.ts` — обновить все вызовы callTool (6 файлов)

### Фаза 1b: sessionId Кэширование (зависит от SessionService)
1. Реализовать `SessionService.getSessionId()` с Redis кэшем (TTL 30 мин)
2. Обновить retry логику в McpClient для `session_expired`
3. Добавить `clearSessionCache()` для cleanup

**ВАЖНО:** Делается ПОСЛЕ Фазы 3 (нужен SessionService класс с Redis).

**Файлы:**
- `src/telegram-bot/services/session-service.ts` — getSessionId() с кэшем
- `src/telegram-bot/services/mcp-client.ts` — retry логика

---

### Фаза 4: LLM Integration (Новое!)
1. `generateWelcomeMessage` (приветствие через LLM)
2. `formatColdStartMessage` (cold_start результаты через LLM, только COLLECTING/COMPLETED)
3. Создать `services/live-messages.ts`
4. Создать `formatters/cold-start.ts`
5. Обновить `handlers/start.ts` и `handlers/story.ts`

**Файлы:**
- `src/telegram-bot/services/live-messages.ts` — генерация приветствий
- `src/telegram-bot/formatters/cold-start.ts` — форматирование cold_start
- `src/telegram-bot/handlers/start.ts` — использовать generateWelcomeMessage
- `src/telegram-bot/handlers/story.ts` — использовать formatColdStartMessage

### Фаза 5: Error Handling
1. parseJsonContent → throwing
2. tryParseJsonContent → nullable
3. bot.catch()
4. cold_start.hasStory

### Фаза 6: Security (P1)
1. Webhook Secret Validation

---

## Quality Gates

После каждой фазы:

```bash
npx tsc --noEmit
npm run lint
npm run test:unit
npm run test:integration  # Если затронуты MCP tools
```

---

## Согласованные Решения (из предыдущей сессии)

### Health Check — Только на старте

**Решение:** Проверка зависимостей на старте, БЕЗ HTTP health endpoint.

```typescript
// index.ts
async function startBot() {
  try {
    await redis.ping();
    logger.info("Redis connected");

    await axios.get(`${env.FACADE_MCP_URL}/health`, { timeout: 5000 });
    logger.info("Facade MCP reachable");
  } catch (error) {
    logger.fatal({ err: error }, "Failed to connect to dependencies");
    process.exit(1); // Docker Compose перезапустит контейнер
  }

  await bot.start();
}
```

**Почему БЕЗ HTTP endpoint:**
- Для Docker Compose достаточно проверки на старте
- HTTP health endpoint нужен только для Kubernetes (liveness/readiness probes)
- Сейчас не используем K8s → не нужен

---

### Username/FirstName — НЕ отправлять

**Решение:** Убрать `telegramUsername` и `telegramFirstName` из `register_telegram`.

**Причина:** WayMates — анонимная платформа, не собираем личные данные.

---

### i18n vs Живые LLM

**Статус:** ОБСУЖДАЕТСЯ (см. вопрос ниже)

---

---

## i18n vs LLM — Финальная Стратегия

**ПРИНЯТО:**

| Тип сообщения | Метод | Обоснование |
|---------------|-------|-------------|
| **Приветствия** (`/start`) | **LLM** | Естественность, персонализация |
| **Результаты поиска** | **LLM** ✅ | Уже реализовано (`formatSearchResult`) |
| **cold_start результаты** | **LLM** | Обработка ответов от LangGraph через LLM |
| **Ошибки** | **i18n** | Четкость, предсказуемость |
| **Инструкции** (/help, usage) | **i18n** | Точность команд |
| **Callback feedback** | **i18n** | Быстро, просто |
| **Status messages** (`searching-*`) | **i18n** | Простота, быстрота |

**Новая функциональность:**

### 16. Приветствие через LLM

**Проблема:** Шаблонное приветствие неестественно

**Решение:** Генерация приветствия через LLM

```typescript
// services/live-messages.ts
export async function generateWelcomeMessage(params: {
  hasStory: boolean;
  language: string;
  userName?: string;
}): Promise<string> {
  const llm = new ChatOpenAI({ modelName: "gpt-4o-mini", temperature: 0.7 });

  const prompt = `You are a career assistant for WayMates platform.

User just started conversation. Greet them warmly and explain:
- Platform helps find career paths based on similar professionals
- Available commands: /story, /by_target, /by_current, /by_adhoc
- ${params.hasStory ? "User has story → suggest search commands" : "Suggest starting with /story"}

${params.userName ? `User name: ${params.userName}` : ""}
Language: ${params.language === "en" ? "English" : "Russian"}
Tone: friendly, concise (3-4 sentences)
Format: Plain text, use emojis sparingly`;

  const response = await llm.invoke(prompt);
  return response.content;
}

// handlers/start.ts
try {
  const welcomeMsg = await generateWelcomeMessage({
    hasStory: ctx.session.status === "initialised" ? ctx.session.hasStory : false,
    language: ctx.from?.language_code ?? "ru",
    userName: ctx.from?.first_name,
  });
  await ctx.reply(welcomeMsg);
} catch (error) {
  logger.error({ err: error }, "Failed to generate welcome message");
  await ctx.reply(ctx.t("error-generic"));
}
```

**Fallback:** При ошибке LLM → показать `error-generic` (без i18n fallback пока).

**Model:** gpt-4o-mini (достаточно для качественного форматирования).

**Кэширование:** НЕТ, генерируем каждый раз (персонализация важнее экономии).

---

### 17. cold_start Результаты через LLM

**Проблема:** Ответы от cold_start (LangGraph) приходят как JSON → нужна обработка для пользователя

**Решение:** Formatter для cold_start сообщений (только COLLECTING и COMPLETED)

**ВАЖНО:** Фаза CONFIRMATION НЕ форматируется через LLM (гарантия соответствия инлайн-кнопкам).

```typescript
// formatters/cold-start.ts
export async function formatColdStartMessage(params: {
  phase: "COLLECTING" | "COMPLETED";  // ← CONFIRMATION исключена!
  message: string;
  language: string;
}): Promise<string> {
  const llm = new ChatOpenAI({ modelName: "gpt-4o-mini", temperature: 0.7 });

  const prompt = `You are a career assistant helping user share their career story.

Phase: ${params.phase}
Raw message from system: ${params.message}

Rewrite the message in a friendly, natural tone.
Language: ${params.language === "en" ? "English" : "Russian"}
Format: Plain text, 2-3 sentences max
Use emoji sparingly

${params.phase === "COLLECTING" ? "Encourage user to share more details" : ""}
${params.phase === "COMPLETED" ? "Congratulate and suggest next steps" : ""}`;

  const response = await llm.invoke(prompt);
  return response.content;
}

// handlers/story.ts
if (data.phase === "CONFIRMATION") {
  // Сырое сообщение от Facade (гарантия соответствия кнопкам)
  await ctx.reply(data.message, { reply_markup: ... });
} else {
  // Форматируем только COLLECTING и COMPLETED
  const formattedMsg = await formatColdStartMessage({
    phase: data.phase,
    message: data.message,
    language: ctx.from?.language_code ?? "ru",
  });
  await ctx.reply(formattedMsg);
}
```

**Fallback:** При ошибке LLM → показать `error-generic` (без i18n fallback пока).

**Model:** gpt-4o-mini (достаточно для качественного форматирования).

**Кэширование:** НЕТ, генерируем каждый раз (персонализация важнее экономии).

---

## Вопросы Требующие Ответа

**Все вопросы закрыты!** ✅

**Статус**: Готов к реализации 🚀
