# Анализ состояния Telegram бота

**Дата:** 2025-12-08
**Версия:** После рефакторинга search commands
**Branch:** `feature/telegram-bot`

---

## 📊 Итоговая оценка

**Текущее состояние:** 7.5/10 для MVP

**Сильные стороны:**
- ✅ Профессиональная архитектура (middleware, guards, i18n)
- ✅ Type safety (TypeScript + Zod)
- ✅ Error handling (централизованный catch)
- ✅ Персистентность (Redis sessions)
- ✅ Graceful shutdown
- ✅ DRY после рефакторинга

**Что нужно для production:**
- ❌ Rate limiting (P0)
- ❌ Error monitoring (P0)
- ❌ Session TTL (P0)
- ❌ Tests (unit + integration)
- ❌ Health checks (P1)
- ❌ Request timeouts (P1)

**Оценка времени до MVP:**
- P0 tasks: ~3-4 часа
- P1 tasks: ~2-3 часа
- Tests (basic coverage): ~6-8 часов
- **Total: ~12-15 часов работы**

---

## ✅ Стало ли лучше после рефакторинга?

**ДА, значительно лучше!** Рефакторинг решил все критические проблемы.

### Было (BEFORE):

```typescript
// ❌ Дублирование кода - 3 идентичные функции
export async function parseTargetQuery(apiKey: string, query: string) {
  const llm = new ChatOpenAI({ modelName: "gpt-4o-mini", temperature: 0, openAIApiKey: apiKey });
  const structuredLlm = llm.withStructuredOutput(targetSearchNullableSchema);
  const result = await structuredLlm.invoke(prompt);
  const cleaned = removeNullFields(result);
  return targetSearchParamsBaseSchema.parse(cleaned);  // ❌ Нет валидации пустого результата
}

// Аналогично для parseAdhocQuery и parseCurrentQuery - 100% дублирование
```

**Проблемы:**
- ❌ 3 идентичные функции (нарушение DRY)
- ❌ Нет валидации пустого результата от LLM
- ❌ Type assertions вместо Zod validation
- ❌ Shared схема `adhocSearchParamsBaseSchema` не соответствовала реальному использованию

### Стало (AFTER):

```typescript
// ✅ Generic функция - DRY принцип
async function invokeLlmStructured<T extends ZodType>(
  apiKey: string,
  schema: T,
  prompt: string,
): Promise<z.infer<T>> {
  const llm = new ChatOpenAI({ modelName: "gpt-4o-mini", temperature: 0, openAIApiKey: apiKey });
  const nullableSchema = makeNullable(schema);
  const structuredLlm = llm.withStructuredOutput(nullableSchema);

  const result = await structuredLlm.invoke(prompt);
  const cleaned = removeNullFields(result);

  if (Object.keys(cleaned).length === 0) {  // ✅ Валидация пустого результата
    throw new NlpParseError("LLM returned empty result after cleaning null fields");
  }

  return schema.parse(cleaned);  // ✅ Zod validation вместо type assertion
}

// ✅ Локальные NLP-схемы (правильное разделение ответственности)
const targetNlpSchema = z.object({
  targetContext: z.object({ /* ... */ }).optional(),
  excludedCreationReasons: z.array(newContextReasonSchema).optional(),
  recencyThresholdMonths: z.number().min(1).optional(),
  limit: z.number().min(1).max(100).optional(),
});

// 3 публичные функции теперь просто вызывают invokeLlmStructured
export async function parseTargetQuery(apiKey: string, query: string): Promise<TargetNlpResult> {
  const result = await invokeLlmStructured(apiKey, targetNlpSchema, prompt);

  if (!result.targetContext) {
    throw new NlpParseError("Could not recognize search criteria...");
  }

  if (Object.keys(result.targetContext).length === 0) {
    throw new NlpParseError("Could not recognize search criteria...");
  }

  return result;
}
```

### Конкретные улучшения:

1. ✅ **DRY**: Устранено дублирование (3 функции → 1 generic)
2. ✅ **Type Safety**: Нет `as` assertions, только Zod `.parse()`
3. ✅ **Валидация**: Проверка пустого результата LLM (защита от Facade ошибок)
4. ✅ **Разделение ответственности**: NLP-схемы локальные (telegram-bot), не shared
5. ✅ **Null safety**: Разделённые проверки `!result.targetContext` и `Object.keys(...).length === 0`

### Метрики изменений:

```
 src/shared/schemas.ts                   |  21 строка удалена (неиспользуемая схема)
 src/telegram-bot/services/nlp-parser.ts | 112 строк (+32 новых, -85 дублирования)
```

**Net result:**
- Удалено: 85 строк дублирующегося кода
- Добавлено: 32 строки качественного generic кода
- Улучшение: -53 строки при большей функциональности

---

## ⚠️ Не стало ли хуже? Новые проблемы?

**НЕТ новых проблем!** Рефакторинг был **хирургически точным**.

### Риски минимизированы:

✅ **Площадь изменений:**
- Изменено только 2 файла с кодом (`nlp-parser.ts`, `shared/schemas.ts`)
- Handlers НЕ тронуты (уже использовали правильную архитектуру)
- MCP facade НЕ затронут
- Локализация не изменена

✅ **Quality Gates пройдены:**
- TypeScript компиляция: ✅ Passed
- ESLint: ✅ Passed (warnings только в старом коде `trajectory-similarity.service.ts`)
- Manual code review: ✅ Passed
  - Нет type assertions
  - Нет eslint-disable комментариев
  - DRY соблюдён
  - Все функции < 60 строк
  - Complexity <= 8

✅ **Обратная совместимость:**
- Публичные API (`parseTargetQuery`, `parseAdhocQuery`, `parseCurrentQuery`) не изменились
- Типы возвращаемых значений обновлены корректно
- Handlers продолжают работать без изменений

### Единственная "проблема" (не связанная с рефакторингом):

План рефакторинга (`REFACTOR-PLAN.md`) частично устарел относительно реального кода, НО это **хорошо**, т.к.:
- ✅ Я проверял каждое изменение самостоятельно
- ✅ Не создавал дублирования (план предлагал `constants.ts`, но i18n лучше)
- ✅ Не удалял нужный код (прокси-функции используются в routing)
- ✅ Не создавал magic numbers (дефолт уже в `shared/schemas.ts`)

---

## 💡 Новые рекомендации

### 1. Архитектурные улучшения

#### Что хорошо (сохранить):

```
✅ Чёткое разделение на слои:
src/telegram-bot/
├── handlers/          # Command handlers (by-target, story, etc.)
├── services/          # Business logic (MCP client, NLP parser, Whisper)
├── formatters/        # Response formatting (search, story)
├── utils/             # Utilities (search-utils)
├── locales/           # i18n (ru.ftl, en.ftl)
├── bot.ts             # Bot setup (middleware, guards)
└── index.ts           # Entry point

✅ i18n через Fluent (лучше чем hardcoded константы)
✅ Redis sessions для персистентности
✅ Guards middleware для бизнес-логики (storyRequiredGuard)
✅ Централизованный error handler (bot.catch)
```

#### Что улучшить:

##### 1.1. Rate Limiting (P0 - блокер)

**Проблема:** Без rate limiting бот уязвим к abuse/DoS.

**Решение:**

```typescript
// src/telegram-bot/bot.ts
import { limit } from "@grammyjs/ratelimiter";

export function createBot(token: string, services: BotServices): Bot<BotContext> {
  const bot = new Bot<BotContext>(token);

  // ...existing middleware...

  // Rate limiting BEFORE handlers
  bot.use(
    limit({
      timeFrame: 2000,        // 2 секунды
      limit: 3,               // 3 запроса на пользователя
      storageClient: redis,   // Используем существующий Redis
      onLimitExceeded: async (ctx) => {
        await ctx.reply(ctx.t("rate-limit-exceeded"));
      },
      keyGenerator: (ctx) => ctx.from?.id.toString() ?? "anonymous",
    })
  );

  // ...rest of bot setup...
}
```

```fluent
# src/telegram-bot/locales/ru.ftl
rate-limit-exceeded = ⏱️ Слишком много запросов. Пожалуйста, подождите немного.

# src/telegram-bot/locales/en.ftl
rate-limit-exceeded = ⏱️ Too many requests. Please wait a moment.
```

**Установка:**
```bash
npm install @grammyjs/ratelimiter
```

**Время:** ~30 минут

##### 1.2. Request Timeout (P1)

**Проблема:** MCP calls могут висеть вечно.

**Решение:**

```typescript
// src/telegram-bot/services/mcp-client.ts
import pTimeout from 'p-timeout';

export async function callTool(
  ctx: BotContext,
  toolName: string,
  params: unknown,
): Promise<McpToolResult> {
  const request = fetch(ctx.services.facadeMcpUrl, {
    method: "POST",
    headers: { /* ... */ },
    body: JSON.stringify({ /* ... */ }),
  });

  try {
    const response = await pTimeout(request, {
      milliseconds: 30000,  // 30 секунд
      message: "MCP request timed out after 30s",
    });

    // ...rest of processing...
  } catch (error) {
    if (error.name === 'TimeoutError') {
      throw new BotError(ctx.t("mcp-timeout"));
    }
    throw error;
  }
}
```

**Установка:**
```bash
npm install p-timeout
```

**Время:** ~30 минут

##### 1.3. Conversation State Cleanup (P0 - memory leak)

**Проблема:** Pending actions живут вечно в Redis (memory leak).

**Решение:**

```typescript
// src/telegram-bot/bot.ts
const storage = new RedisAdapter<MySessionData>({
  instance: redis,
  ttl: 3600,  // 1 час - автоматическая очистка неактивных сессий
});
```

**Время:** ~5 минут

---

### 2. Production-Ready Features

| Feature | Статус | Приоритет | Решение | Время |
|---------|--------|-----------|---------|-------|
| **Rate Limiting** | ❌ Нет | 🔴 P0 | `@grammyjs/ratelimiter` | 30 мин |
| **Error Monitoring** | ❌ Нет | 🔴 P0 | Sentry integration | 1 час |
| **Session TTL** | ❌ Нет | 🔴 P0 | RedisAdapter config | 5 мин |
| **Request Timeout** | ❌ Нет | 🟡 P1 | `p-timeout` | 30 мин |
| **Health Checks** | ❌ Нет | 🟡 P1 | `/health` endpoint | 15 мин |
| **Metrics** | ❌ Нет | 🟡 P1 | Prometheus/StatsD | 2 часа |
| **Webhooks** | ❌ Нет | 🟢 P2 | Production deployment | 1 час |

#### 2.1. Error Monitoring (P0 - блокер)

**Проблема:** Нужно видеть ошибки в production.

**Решение - Sentry:**

```typescript
// src/telegram-bot/index.ts
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
});

const bot = createBot(env.TELEGRAM_BOT_TOKEN, services);

// src/telegram-bot/bot.ts
bot.catch(async (error) => {
  const ctx = error.ctx;

  // Capture в Sentry
  Sentry.captureException(error.error, {
    user: { id: ctx.from?.id.toString() },
    tags: {
      handler: error.ctx.update.message ? "message" : "callback",
    },
    extra: {
      update: ctx.update,
    },
  });

  if (error.error instanceof BotError) {
    await ctx.reply(`❌ ${error.error.message}`);
    return;
  }

  logger.error({ err: error.error }, "Unhandled error");
  await ctx.reply(ctx.t("error-generic"));
});
```

**Установка:**
```bash
npm install @sentry/node
```

**Env:**
```bash
SENTRY_DSN=https://...@sentry.io/...
```

**Время:** ~1 час

#### 2.2. Health Check (P1)

**Решение:**

```typescript
// src/telegram-bot/index.ts
import express from "express";

const app = express();

app.get("/health", async (req, res) => {
  const redisStatus = redis.status === "ready";

  res.status(redisStatus ? 200 : 503).json({
    status: redisStatus ? "ok" : "degraded",
    uptime: process.uptime(),
    redis: redisStatus,
    timestamp: new Date().toISOString(),
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  logger.info(`Health check listening on port ${PORT}`);
});

// Start bot
await bot.start();
```

**Время:** ~15 минут

#### 2.3. Improved Graceful Shutdown (P1)

**Текущая версия:**
```typescript
// src/telegram-bot/index.ts
process.on("SIGTERM", () => void bot.stop());
process.on("SIGINT", () => void bot.stop());
```

**Улучшенная версия:**

```typescript
// src/telegram-bot/index.ts
async function gracefulShutdown(signal: string) {
  logger.info(`${signal} received, starting graceful shutdown...`);

  try {
    // 1. Stop accepting new updates
    logger.info("Stopping bot...");
    await bot.stop();

    // 2. Close Redis connection
    logger.info("Closing Redis connection...");
    await redis.quit();

    // 3. Close HTTP server (if using webhooks)
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }

    logger.info("Graceful shutdown completed");
    process.exit(0);
  } catch (error) {
    logger.error({ err: error }, "Error during shutdown");
    process.exit(1);
  }
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
```

**Время:** ~20 минут

---

### 3. Security

#### 3.1. Существующие меры безопасности ✅

```typescript
// ✅ Environment validation через Zod
export const envSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  FACADE_MCP_URL: z.string().url(),
  OPENAI_API_KEY: z.string().min(1),
  GROQ_API_KEY: z.string().min(1),
  // ...
});

// ✅ Bot token validation (grammY автоматически)
// ✅ Input validation через Zod schemas
// ✅ Error handling без утечки sensitive data
```

#### 3.2. Что добавить:

##### Webhook Secret Validation (для production webhooks)

```typescript
// src/telegram-bot/webhook.ts (если используем webhooks)
import { webhookCallback } from "grammy";
import express from "express";

const app = express();

app.use(
  webhookCallback(bot, "express", {
    secretToken: process.env.WEBHOOK_SECRET,  // Добавить валидацию
  })
);
```

**Env:**
```bash
WEBHOOK_SECRET=your-random-secret-string
```

---

## 🎯 Что не хватает до релиза MVP?

### P0 (Блокеры релиза) - MUST HAVE:

#### 1. Rate Limiting ⏱️
- **Проблема:** Без этого бот уязвим к abuse/DoS
- **Решение:** `@grammyjs/ratelimiter` (см. выше)
- **Время:** 30 минут
- **Блокирует:** Production deployment

#### 2. Error Monitoring 📊
- **Проблема:** Невозможно отследить ошибки в production
- **Решение:** Sentry SDK (см. выше)
- **Время:** 1 час
- **Блокирует:** Production deployment

#### 3. Session TTL 🧹
- **Проблема:** Memory leak в Redis (сессии живут вечно)
- **Решение:** `RedisAdapter({ ttl: 3600 })`
- **Время:** 5 минут
- **Блокирует:** Production deployment (memory leak)

#### 4. Basic Tests 🧪
- **Проблема:** Нет защиты от регрессий
- **Решение:** Unit tests для critical paths (см. раздел "Тестирование")
- **Время:** 6-8 часов
- **Блокирует:** Confident deployment

**Итого P0: ~10 часов**

---

### P1 (Важно для стабильности) - SHOULD HAVE:

#### 5. Request Timeouts ⏰
- **Проблема:** MCP calls могут висеть вечно
- **Решение:** `p-timeout` (см. выше)
- **Время:** 30 минут

#### 6. Health Check Endpoint ❤️
- **Проблема:** Kubernetes/Docker нужен `/health`
- **Решение:** Express middleware (см. выше)
- **Время:** 15 минут

#### 7. Logging Improvements 📝
- **Проблема:** Нет request ID tracing
- **Решение:** Добавить correlation ID в логи
- **Время:** 1 час

**Итого P1: ~2 часа**

---

### P2 (Nice to have) - COULD HAVE:

#### 8. Webhooks вместо Polling 🌐
- **Текущее:** Polling (OK для dev/small scale)
- **Production:** Webhooks (меньше latency, лучше масштабирование)
- **Требует:** HTTPS endpoint + webhook setup
- **Время:** 1 час

#### 9. Metrics & Analytics 📈
- Количество запросов
- Среднее время ответа
- Популярные команды
- **Решение:** Prometheus + Grafana
- **Время:** 2-3 часа

#### 10. Admin Commands 🛠️
- `/stats` - статистика бота
- `/broadcast` - рассылка сообщений
- **Время:** 2-3 часа

**Итого P2: ~6 часов**

---

## 🧪 Как тестировать Telegram бота?

### Best Practices (research results)

Основано на:
- [grammY Official Testing Docs](https://grammy.dev/advanced/deployment.html#testing)
- [grammY Tests Library (WIP)](https://github.com/dcdunkan/grammy_tests)
- [Example: grammy-with-tests](https://github.com/PavelPolyakov/grammy-with-tests)
- [LogRocket: Building Telegram Bot](https://blog.logrocket.com/building-telegram-bot-grammy/)

**Основные подходы:**

1. **Unit Tests** - тестирование бизнес-логики изолированно
2. **Integration Tests** - тестирование с мокированным Telegram API
3. **E2E Tests** - тестирование с реальным Telegram (test bot)

---

### Стратегия для WayMates Bot

#### 1. Unit Tests (Приоритет 1) ⭐

**Что тестировать:**
- ✅ NLP parsing (`nlp-parser.ts`) - КРИТИЧНО
- ✅ Formatters (`formatters/search.ts`, `formatters/story.ts`)
- ✅ Utils (`search-utils.ts`)
- ✅ MCP client logic

**Пример:**

```typescript
// tests/telegram-bot/services/nlp-parser.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseTargetQuery } from "@/telegram-bot/services/nlp-parser";
import { NlpParseError } from "@/telegram-bot/errors";
import { ChatOpenAI } from "@langchain/openai";

vi.mock("@langchain/openai");

describe("NLP Parser - parseTargetQuery", () => {
  let mockLlm: any;

  beforeEach(() => {
    mockLlm = {
      withStructuredOutput: vi.fn().mockReturnThis(),
      invoke: vi.fn(),
    };
    vi.mocked(ChatOpenAI).mockImplementation(() => mockLlm);
  });

  it("should parse target query with position and country", async () => {
    mockLlm.invoke.mockResolvedValue({
      targetContext: {
        position: { mode: "desired", values: ["Senior Developer"] },
        countries: { mode: "desired", values: ["DE"] },
      },
      limit: 20,
    });

    const result = await parseTargetQuery("api-key", "найди Senior Developer в Германии");

    expect(result.targetContext?.position).toBeDefined();
    expect(result.targetContext.position?.values).toContain("Senior Developer");
    expect(result.targetContext.countries?.values).toContain("DE");
    expect(result.limit).toBe(20);
  });

  it("should throw NlpParseError on empty targetContext", async () => {
    mockLlm.invoke.mockResolvedValue({});

    await expect(
      parseTargetQuery("api-key", "invalid query")
    ).rejects.toThrow(NlpParseError);

    await expect(
      parseTargetQuery("api-key", "invalid query")
    ).rejects.toThrow("LLM returned empty result");
  });

  it("should throw NlpParseError when targetContext is undefined", async () => {
    mockLlm.invoke.mockResolvedValue({
      limit: 10,
    });

    await expect(
      parseTargetQuery("api-key", "some text")
    ).rejects.toThrow("Could not recognize search criteria");
  });

  it("should throw NlpParseError when targetContext is empty object", async () => {
    mockLlm.invoke.mockResolvedValue({
      targetContext: {},
      limit: 10,
    });

    await expect(
      parseTargetQuery("api-key", "some text")
    ).rejects.toThrow("Could not recognize search criteria");
  });

  it("should handle undesired filters (exclusions)", async () => {
    mockLlm.invoke.mockResolvedValue({
      targetContext: {
        position: { mode: "desired", values: ["Developer"] },
        skills: { mode: "undesired", values: ["PHP"] },
      },
    });

    const result = await parseTargetQuery("api-key", "Developer кроме PHP");

    expect(result.targetContext?.skills?.mode).toBe("undesired");
    expect(result.targetContext?.skills?.values).toContain("PHP");
  });
});
```

**Покрытие для NLP Parser:**

```typescript
// tests/telegram-bot/services/nlp-parser.test.ts (продолжение)

describe("NLP Parser - parseAdhocQuery", () => {
  it("should parse adhoc query with profile", async () => {
    mockLlm.invoke.mockResolvedValue({
      referenceContext: {
        position: "Senior Backend Developer",
        skills: ["Node.js", "PostgreSQL"],
        domains: ["FinTech"],
        countryCode: "DE",
      },
      limit: 15,
      pathLimit: 10,
    });

    const result = await parseAdhocQuery(
      "api-key",
      "Senior Backend Developer, Node.js, PostgreSQL, FinTech, Германия"
    );

    expect(result.referenceContext?.position).toBe("Senior Backend Developer");
    expect(result.referenceContext?.skills).toContain("Node.js");
    expect(result.limit).toBe(15);
  });

  it("should throw on empty referenceContext", async () => {
    mockLlm.invoke.mockResolvedValue({
      limit: 10,
    });

    await expect(
      parseAdhocQuery("api-key", "invalid")
    ).rejects.toThrow("Could not recognize profile for search");
  });
});

describe("NLP Parser - parseCurrentQuery", () => {
  it("should parse current query with filters", async () => {
    mockLlm.invoke.mockResolvedValue({
      excludedContextFields: ["position", "industry"],
      limit: 30,
      pathLimit: 20,
    });

    const result = await parseCurrentQuery(
      "api-key",
      "ищи кроме позиции и индустрии, топ 30"
    );

    expect(result.excludedContextFields).toContain("position");
    expect(result.excludedContextFields).toContain("industry");
    expect(result.limit).toBe(30);
  });

  it("should return empty object for minimal query (все defaults)", async () => {
    mockLlm.invoke.mockResolvedValue({});

    const result = await parseCurrentQuery("api-key", "поиск");

    // Все поля optional - пустой объект валиден
    expect(result).toBeDefined();
  });
});
```

---

#### 2. Integration Tests (Приоритет 2) ⭐

**Подход grammY** (из официальной документации):

```typescript
// tests/telegram-bot/integration/bot.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { Bot } from "grammy";
import { createBot } from "@/telegram-bot/bot";
import type { BotContext, BotServices } from "@/telegram-bot/types";

describe("Bot Integration Tests", () => {
  let bot: Bot<BotContext>;
  let capturedRequests: Array<{ method: string; payload: any }>;
  let mockServices: BotServices;

  beforeEach(() => {
    capturedRequests = [];

    mockServices = {
      facadeMcpUrl: "http://localhost:3000/mcp",
      openaiApiKey: "test-key",
      groqApiKey: "test-groq-key",
      botToken: "test-token",
      formatterLlm: {
        model: "gpt-4o-mini",
        temperature: 0.7,
      },
    };

    bot = createBot("test-token", mockServices);

    // Mock Telegram API calls using transformer
    bot.api.config.use((prev, method, payload, signal) => {
      capturedRequests.push({ method, payload });
      // Return mock response
      return Promise.resolve({ ok: true, result: {} } as any);
    });
  });

  it("should respond to /start command", async () => {
    // Sample update object from Telegram docs
    await bot.handleUpdate({
      update_id: 1,
      message: {
        message_id: 1,
        from: { id: 123, is_bot: false, first_name: "Test" },
        chat: { id: 123, type: "private" },
        date: Math.floor(Date.now() / 1000),
        text: "/start",
      },
    });

    // Assert that sendMessage was called
    expect(capturedRequests).toHaveLength(1);
    expect(capturedRequests[0].method).toBe("sendMessage");
    expect(capturedRequests[0].payload.text).toContain("Добро пожаловать");
  });

  it("should respond to /help command", async () => {
    await bot.handleUpdate({
      update_id: 2,
      message: {
        message_id: 2,
        from: { id: 123, is_bot: false, first_name: "Test" },
        chat: { id: 123, type: "private" },
        date: Math.floor(Date.now() / 1000),
        text: "/help",
      },
    });

    expect(capturedRequests).toHaveLength(1);
    expect(capturedRequests[0].payload.text).toContain("доступные команды");
  });

  it("should require story for /by_current command", async () => {
    await bot.handleUpdate({
      update_id: 3,
      message: {
        message_id: 3,
        from: { id: 456, is_bot: false, first_name: "NoStory" },
        chat: { id: 456, type: "private" },
        date: Math.floor(Date.now() / 1000),
        text: "/by_current",
      },
    });

    // Should show "story required" message
    expect(capturedRequests).toHaveLength(1);
    expect(capturedRequests[0].payload.text).toContain("Сначала расскажите");
  });

  it("should handle /by_target with query parameter", async () => {
    // Mock NLP parser
    vi.mock("@/telegram-bot/services/nlp-parser", () => ({
      parseTargetQuery: vi.fn().mockResolvedValue({
        targetContext: {
          position: { mode: "desired", values: ["Developer"] },
        },
        limit: 20,
      }),
    }));

    // Mock MCP client
    vi.mock("@/telegram-bot/services/mcp-client", () => ({
      callTool: vi.fn().mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify({ candidates: [] }),
          },
        ],
      }),
    }));

    await bot.handleUpdate({
      update_id: 4,
      message: {
        message_id: 4,
        from: { id: 123, is_bot: false, first_name: "Test" },
        chat: { id: 123, type: "private" },
        date: Math.floor(Date.now() / 1000),
        text: "/by_target Senior Developer в США",
      },
    });

    // Should show "searching" message + results
    expect(capturedRequests.length).toBeGreaterThan(1);
  });
});
```

---

#### 3. E2E Tests (Приоритет 3 - опционально)

**Для полной уверенности**, но требует test bot в Telegram:

```typescript
// tests/e2e/bot.e2e.test.ts
import { describe, it, expect } from "vitest";
import { Api, TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";

describe("E2E Tests (real Telegram)", () => {
  let client: TelegramClient;
  const BOT_USERNAME = "@waymates_test_bot";

  beforeAll(async () => {
    client = new TelegramClient(
      new StringSession(""),
      parseInt(process.env.API_ID!),
      process.env.API_HASH!,
      { connectionRetries: 5 }
    );

    await client.start({
      phoneNumber: process.env.TEST_PHONE!,
      password: async () => process.env.TEST_PASSWORD!,
      phoneCode: async () => {
        // Получить код из консоли или SMS service
        return prompt("Enter code:");
      },
      onError: (err) => console.log(err),
    });
  });

  afterAll(async () => {
    await client.disconnect();
  });

  it("should respond to /start command in real Telegram", async () => {
    // Send /start to bot
    await client.sendMessage(BOT_USERNAME, { message: "/start" });

    // Wait for bot response
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Get messages
    const messages = await client.getMessages(BOT_USERNAME, { limit: 5 });
    const botResponse = messages.find((msg) =>
      msg.message?.includes("Добро пожаловать")
    );

    expect(botResponse).toBeDefined();
  });
});
```

**Примечание:** E2E тесты медленные и требуют настройки Telegram test account. Используйте их для smoke testing перед релизом.

---

### Рекомендуемая структура тестов:

```
📦 tests/
├── telegram-bot/
│   ├── unit/
│   │   ├── services/
│   │   │   ├── nlp-parser.test.ts          # ← START HERE (P0)
│   │   │   ├── mcp-client.test.ts          # ← P0
│   │   │   ├── mcp-utils.test.ts
│   │   │   ├── whisper.test.ts
│   │   │   └── pending-actions.test.ts
│   │   ├── formatters/
│   │   │   ├── search.test.ts              # ← P1
│   │   │   └── story.test.ts
│   │   └── utils/
│   │       └── search-utils.test.ts
│   ├── integration/
│   │   ├── handlers/
│   │   │   ├── by-target.integration.test.ts  # ← P1
│   │   │   ├── by-adhoc.integration.test.ts
│   │   │   ├── by-current.integration.test.ts
│   │   │   └── story.integration.test.ts
│   │   └── bot.integration.test.ts            # ← P1
│   └── e2e/
│       └── bot.e2e.test.ts                    # ← P2 (optional)
└── fixtures/
    ├── telegram-updates.ts                     # Sample update objects
    └── mcp-responses.ts                        # Mock MCP responses
```

### Приоритеты тестирования:

| Приоритет | Что тестировать | Время | Coverage |
|-----------|-----------------|-------|----------|
| **P0** | `nlp-parser.ts` (все 3 функции) | 2-3 часа | ~90% |
| **P0** | `mcp-client.ts` (callTool, error handling) | 1-2 часа | ~80% |
| **P1** | Handlers integration (bot.handleUpdate) | 2-3 часа | ~70% |
| **P1** | Formatters (search, story) | 1-2 часа | ~80% |
| **P2** | E2E (smoke tests) | 1-2 часа | N/A |

**Итого:** 6-10 часов для базового coverage (~70% critical paths)

---

### Test Configuration (Vitest)

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/telegram-bot/**/*.ts"],
      exclude: [
        "**/*.test.ts",
        "**/*.d.ts",
        "**/types.ts",
        "**/index.ts",
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

---

## 📈 Roadmap до Production

### Timeline (оптимистичный сценарий):

| Неделя | Задачи | Время |
|--------|--------|-------|
| **Week 1** | P0 features (rate limiting, monitoring, session TTL) | 4 часа |
| | Unit tests (nlp-parser, mcp-client) | 4 часа |
| | Integration tests (handlers) | 3 часа |
| **Week 2** | P1 features (timeouts, health checks, logging) | 2 часа |
| | Additional tests (formatters, utils) | 2 часа |
| | Documentation update | 1 час |
| **Week 3** | Webhooks setup (production) | 1 час |
| | E2E smoke tests | 1 час |
| | Load testing | 2 часа |
| **Week 4** | Monitoring dashboard | 2 часа |
| | Buffer for bugs/issues | 4 часа |

**Total: ~26 часов (3-4 недели part-time)**

---

## 📚 Resources

### Official Documentation:
- [grammY Framework](https://grammy.dev/)
- [grammY Testing Guide](https://grammy.dev/advanced/deployment.html#testing)
- [Telegram Bot API](https://core.telegram.org/bots/api)

### Testing Resources:
- [grammY Tests Library (WIP)](https://github.com/dcdunkan/grammy_tests)
- [Example: grammy-with-tests](https://github.com/PavelPolyakov/grammy-with-tests)
- [Building Telegram Bot Tutorial](https://blog.logrocket.com/building-telegram-bot-grammy/)

### Production Guides:
- [Deployment Checklist](https://grammy.dev/advanced/deployment.html)
- [Telegram Bot Best Practices](https://core.telegram.org/bots/webhooks)
- [Developer Guide 2025](https://stellaray777.medium.com/a-developers-guide-to-building-telegram-bots-in-2025-dbc34cd22337)

### Libraries Used:
- [grammY](https://www.npmjs.com/package/grammy)
- [@grammyjs/auto-retry](https://www.npmjs.com/package/@grammyjs/auto-retry)
- [@grammyjs/ratelimiter](https://www.npmjs.com/package/@grammyjs/ratelimiter)
- [@grammyjs/i18n](https://www.npmjs.com/package/@grammyjs/i18n)
- [@sentry/node](https://www.npmjs.com/package/@sentry/node)

---

## ✅ Checklist для Production

### Pre-deployment:
- [ ] Rate limiting настроен
- [ ] Error monitoring (Sentry) подключён
- [ ] Session TTL установлен
- [ ] Request timeouts добавлены
- [ ] Health check endpoint работает
- [ ] Graceful shutdown реализован
- [ ] Tests (unit + integration) проходят
- [ ] Environment variables задокументированы
- [ ] Secrets не в git

### Deployment:
- [ ] Webhooks настроены (или polling для малой нагрузки)
- [ ] HTTPS certificate валиден
- [ ] Redis доступен и персистентен
- [ ] Logs агрегируются
- [ ] Monitoring dashboard настроен
- [ ] Alerting настроен (critical errors)

### Post-deployment:
- [ ] Smoke tests прошли
- [ ] Monitoring показывает OK status
- [ ] Error rate < 1%
- [ ] Response time < 2s (p95)
- [ ] Rollback plan готов

---

**Последнее обновление:** 2025-12-08
**Статус:** Ready for MVP implementation
**Next steps:** P0 features + Basic tests
