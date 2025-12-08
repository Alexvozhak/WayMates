# Архитектурный Review: Конфликты и Новые Вопросы

> **Дата**: 2025-12-08
> **Метод**: Sequential thinking systematic review
> **Scope**: Все 7 согласованных архитектурных решений

---

## TL;DR

Найдено **9 новых вопросов**, требующих решения:
- **2 критических** (блокируют начало реализации)
- **5 средних** (implementation details)
- **2 малых** (optimization opportunities)

**Главный вывод**: Tool Registry - правильное решение, НО требует создания Response Schemas в Facade (~200 строк кода).

---

## ❌ КРИТИЧЕСКИЕ Вопросы (Блокируют Реализацию)

### 1. Response Schemas НЕ СУЩЕСТВУЮТ в Facade

**Проблема**:

Tool Registry план импортирует:
```typescript
import {
  sessionResponseSchema,  // ❌ НЕ СУЩЕСТВУЕТ
  coldStartResponseSchema, // ❌ НЕ СУЩЕСТВУЕТ
  searchResultSchema,      // ❌ НЕ СУЩЕСТВУЕТ
} from "../facade/mcp-server/result.js";
```

**Факт**: `src/facade/mcp-server/result.ts` содержит только:
- `sessionIdSchema`
- `errorCodeSchema`
- `errorResponseSchema`
- `Result<T, E>` type

**НЕТ** response schemas для MCP tools!

**Существует**: TypeScript types в auth.service.ts:
```typescript
export type TelegramRegisterResult = {
  userId: string;
  token: Token;
  sessionId: SessionId;
  isNewUser: boolean;
  hasStory: boolean;
};
```

Но это TS type, НЕ Zod schema!

**Что нужно создать** (9+ schemas):

1. `telegramRegisterResponseSchema` (auth, register_telegram, link_telegram)
2. `coldStartResponseSchema` (cold_start)
3. `resetColdStartResponseSchema` (reset_cold_start)
4. `storyResponseSchema` (get_story)
5. `searchResultSchema` (search_by_target, search_user_careers, search_careers)
6. `goalResponseSchema` (set_goal, get_goal)
7. `contextResponseSchema` (update_context, upsert_context)
8. `trailResponseSchema` (upsert_trail)
9. `deleteResponseSchema` (delete_goal, delete_context, delete_trail) - общий `{ success: boolean }`

**Объем работы**: ~200 строк кода (создание Zod schemas на основе существующих TS types)

**Решения**:

**Вариант A**: Создать response schemas в Facade (рекомендую ✅)
```typescript
// src/facade/mcp-server/result.ts

export const telegramRegisterResponseSchema = z.object({
  userId: z.string(),
  token: tokenSchema,
  sessionId: sessionIdSchema,
  isNewUser: z.boolean(),
  hasStory: z.boolean(),
});

export type TelegramRegisterResponse = z.infer<typeof telegramRegisterResponseSchema>;
```

**Почему**:
- ✅ Facade должен иметь response schemas (для type safety)
- ✅ Tool Registry переиспользует их
- ✅ Single source of truth

**Вариант B**: Отказаться от runtime validation response
```typescript
export const TOOL_REGISTRY = {
  register_telegram: {
    params: telegramRegisterParamsSchema, // ✅ Runtime validation
    responseType: {} as TelegramRegisterResult, // ⚠️ Только compile-time
  },
};
```

**Почему НЕТ**:
- ❌ Теряем половину пользы Tool Registry
- ❌ Нет runtime validation Facade responses
- ❌ Нет защиты от API breaking changes

**Рекомендация**: Вариант A - создать response schemas в Facade.

---

### 2. SessionService.initialize() + Discriminated Union Type Narrowing

**Проблема**:

TypeScript НЕ УМЕЕТ track мутации для type narrowing!

```typescript
export class SessionService {
  async initialize(ctx: BotContext): Promise<void> {
    const result = await this.mcpClient.callTool("register_telegram", { telegramUserId });

    // Мутируем ctx.session
    ctx.session = {
      status: "initialised",
      sessionId: result.sessionId,
      hasStory: result.hasStory,
      token: result.token,
    };

    // ❌ TypeScript НЕ ЗНАЕТ что ctx.session теперь "initialised"!
    // ctx.session все еще имеет type: MySessionData (union)
  }
}
```

После вызова в guard middleware:
```typescript
bot.use(async (ctx, next) => {
  if (ctx.session.status === "uninitialised") {
    await ctx.services.sessionService.initialize(ctx);
  }
  // ❌ TypeScript НЕ ЗНАЕТ что ctx.session.status === "initialised"
  await next();
});
```

**Согласованное решение**: "Мутировать ctx.session (ООП стиль)"

**Конфликт**: Мутация НЕ РАБОТАЕТ с discriminated union type narrowing!

**Решения**:

**Вариант A**: Return new session (immutable) - РЕКОМЕНДУЮ ✅
```typescript
export class SessionService {
  async initialize(ctx: BotContext): Promise<InitialisedSession> {
    const result = await this.mcpClient.callTool("register_telegram", { telegramUserId });

    // ✅ Возвращаем новый session объект
    return {
      status: "initialised",
      sessionId: result.sessionId,
      hasStory: result.hasStory,
      token: result.token,
    };
  }
}

// Guard middleware
bot.use(async (ctx, next) => {
  if (ctx.session.status === "uninitialised") {
    ctx.session = await ctx.services.sessionService.initialize(ctx);
    // ✅ TypeScript понимает что ctx.session теперь initialised (присвоение)
  }
  await next();
});
```

**Тип**:
```typescript
export type InitialisedSession = Extract<MySessionData, { status: "initialised" }>;
```

**Почему ДА**:
- ✅ Type narrowing работает (присвоение, не мутация)
- ✅ Immutable pattern (лучше для тестирования)
- ✅ TypeScript happy

**Почему меняет решение**:
- ⚠️ Согласованное решение было "мутировать ctx.session"
- ⚠️ Теперь "возвращать новый session" (immutable)

**Вариант B**: Type assertion после initialize
```typescript
if (ctx.session.status === "uninitialised") {
  await ctx.services.sessionService.initialize(ctx);
  // Type assertion
  const session = ctx.session as Extract<MySessionData, { status: "initialised" }>;
}
```

**Почему НЕТ**:
- ❌ Type assertions - опасно (можем соврать компилятору)
- ❌ Не решает проблему в handlers

**Вариант C**: Non-null assertion в handlers
```typescript
// Guard гарантирует что session initialised
bot.use(guardMiddleware);

// В handlers
const sessionId = ctx.session.sessionId!; // ⚠️ Non-null assertion
```

**Почему НЕТ**:
- ❌ Теряем type safety (зачем discriminated union?)
- ❌ Можем забыть ! и получить runtime error

**Рекомендация**: Вариант A - SessionService.initialize() возвращает InitialisedSession.

**Изменение решения**: "Мутация ctx.session" → "Возврат нового session объекта".

---

## ⚠️ СРЕДНИЕ Вопросы (Implementation Details)

### 3. BotServices Type Split (config vs services)

**Проблема**:

Текущий тип:
```typescript
export type BotServices = {
  facadeMcpUrl: string;
  openaiApiKey: string;
  groqApiKey: string;
  botToken: string;
  formatterLlm: LlmConfig;
};
```

После OOP нужно добавить классы:
```typescript
export type BotServices = {
  // Config fields
  facadeMcpUrl: string;
  openaiApiKey: string;
  groqApiKey: string;
  botToken: string;
  formatterLlm: LlmConfig;

  // Class instances
  mcpClient: McpClient;
  sessionService: SessionService;
  searchPresenter: SearchPresenter;
};
```

НО BotServices передается В createBot, а классы создаются ВНУТРИ createBot!

**Решение**: Разделить на config и services

```typescript
export type BotConfig = {
  facadeMcpUrl: string;
  openaiApiKey: string;
  groqApiKey: string;
  botToken: string;
  formatterLlm: LlmConfig; // ❓ Или ChatOpenAI instance?
};

export type BotServices = {
  mcpClient: McpClient;
  sessionService: SessionService;
  searchPresenter: SearchPresenter;
};

// createBot signature
export function createBot(config: BotConfig): Bot<BotContext> {
  const mcpClient = new McpClient(config.facadeMcpUrl);
  const sessionService = new SessionService(mcpClient);
  const searchPresenter = new SearchPresenter(formatterLlm);

  const services: BotServices = { mcpClient, sessionService, searchPresenter };

  bot.use(async (ctx, next) => {
    ctx.services = services;
    await next();
  });
}
```

**BotContext**:
```typescript
export type BotContext = Context &
  I18nFlavor &
  HydrateFlavor<Context> &
  SessionFlavor<MySessionData> & {
    services: BotServices; // ✅ Только class instances
  };
```

**Рекомендация**: Разделить BotConfig и BotServices.

---

### 4. Guard Middleware Order (services → session)

**Проблема**:

Guard middleware для session использует sessionService:
```typescript
bot.use(async (ctx, next) => {
  if (ctx.session.status === "uninitialised") {
    await ctx.services.sessionService.initialize(ctx); // ❗ Нужен ctx.services
  }
  await next();
});
```

sessionService добавляется в ctx.services в middleware:
```typescript
bot.use(async (ctx, next) => {
  ctx.services = { mcpClient, sessionService, searchPresenter };
  await next();
});
```

**Вопрос**: Какой порядок middleware?

**Решение**:
```typescript
// 1. Добавить services
bot.use(async (ctx, next) => {
  ctx.services = { mcpClient, sessionService, searchPresenter };
  await next();
});

// 2. Guard для services (опционально)
bot.use(async (ctx, next) => {
  if (!ctx.services) {
    logger.error("Services not initialized");
    await ctx.reply("Internal error");
    return;
  }
  await next();
});

// 3. Guard для session
bot.use(async (ctx, next) => {
  if (ctx.session.status === "uninitialised") {
    ctx.session = await ctx.services.sessionService.initialize(ctx);
  }
  await next();
});
```

**Порядок**: services → services guard (optional) → session guard

**Рекомендация**: Уточнить порядок middleware в REFACTORING-PLAN.md.

---

### 5. Error Handling в McpClient.callTool

**Проблема**:

McpToolResult имеет `isError?: boolean`:
```typescript
export type McpToolResult = {
  content: { type: string; text?: string }[];
  isError?: boolean;
};
```

McpClient.callTool должен проверять isError ПЕРЕД parseJsonContent:
```typescript
async callTool<T extends ToolName>(toolName: T, params: ...) {
  const result = await this.sendWithRetry(toolName, params);

  // ❓ Проверка isError?
  if (result.isError) {
    // ❓ Что делать?
    throw new McpClientError("MCP tool returned error");
  }

  const parsedContent = parseJsonContent(result);
  return tool.response.parse(parsedContent);
}
```

**Вопросы**:
1. Что делать если Facade вернул error (isError = true)?
2. Как парсить error response (ErrorResponse schema)?
3. Бросать исключение или возвращать Result<T, E>?

**Решения**:

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

**Вариант B**: Result<T, E> pattern
```typescript
async callTool<T extends ToolName>(toolName: T, params: ...): Promise<Result<..., ErrorResponse>> {
  const result = await this.sendWithRetry(toolName, params);

  if (result.isError) {
    const error = parseJsonContent<ErrorResponse>(result);
    return err(error);
  }

  const parsedContent = parseJsonContent(result);
  const validated = tool.response.parse(parsedContent);
  return ok(validated);
}
```

**Рекомендация**: Вариант A (throwing) - проще, совместимо с bot.catch() error handling.

---

### 6. formatterLlm Ownership (index.ts vs createBot)

**Проблема**:

План (REFACTORING-PLAN.md):
```typescript
// index.ts
const formatterLlm = new ChatOpenAI(...); // ✅ Создается в index.ts

// createBot
const searchPresenter = new SearchPresenter(formatterLlm); // ✅ Принимает instance
```

Вопрос: BotConfig содержит instance или config?

**Вариант A**: Instance в BotConfig
```typescript
export type BotConfig = {
  facadeMcpUrl: string;
  formatterLlm: ChatOpenAI; // ✅ Instance
};

// index.ts
const formatterLlm = new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0.3 });
createBot({ facadeMcpUrl, formatterLlm });

// createBot
const searchPresenter = new SearchPresenter(config.formatterLlm);
```

**Вариант B**: Config в BotConfig
```typescript
export type BotConfig = {
  facadeMcpUrl: string;
  formatterLlm: LlmConfig; // ✅ Config object
};

// index.ts
createBot({ facadeMcpUrl, formatterLlm: { model: "gpt-4o-mini", temperature: 0.3 } });

// createBot
const llm = new ChatOpenAI(config.formatterLlm);
const searchPresenter = new SearchPresenter(llm);
```

**Рекомендация**: Вариант B (config) - createBot инкапсулирует создание LLM instance.

---

### 7. Discriminated Union Guards в Handlers (не только middleware)

**Проблема**:

После guard middleware TypeScript НЕ ЗНАЕТ что session initialised в handlers!

```typescript
// callbacks.ts
export async function handleApproveCallback(ctx: BotContext): Promise<void> {
  // ❌ TypeScript НЕ ЗНАЕТ что ctx.session.status === "initialised"
  ctx.session.hasStory = true; // ❌ Error: Property 'hasStory' does not exist
}
```

Guard middleware гарантирует что session initialised, но TypeScript не может это track через async boundaries.

**Решение**: Добавить type guard в начале каждого handler

```typescript
export async function handleApproveCallback(ctx: BotContext): Promise<void> {
  if (ctx.session.status !== "initialised") {
    await ctx.answerCallbackQuery({ text: "Session expired" });
    return;
  }

  // ✅ TypeScript знает что ctx.session.status === "initialised"
  const result = await callColdStart(ctx, "да");
  if (result.phase === "COMPLETED") {
    ctx.session.hasStory = true; // ✅ Type-safe
  }
}
```

**Плюсы**:
- ✅ Type safety (TypeScript проверяет)
- ✅ Explicit guards (понятно что проверяется)
- ✅ Fail-fast (если guard middleware не сработал)

**Минусы**:
- ⚠️ Boilerplate (проверка в каждом handler)
- ⚠️ Дублирование (guard middleware + handler guards)

**Альтернатива**: Non-null assertion (ctx.session.hasStory! = true)
- ❌ Теряем type safety
- ❌ Можем забыть ! и получить runtime error

**Рекомендация**: Добавить type guards в handlers. Boilerplate acceptable за type safety.

---

## ✅ МАЛЫЕ Вопросы (Optimization Opportunities)

### 8. Redis TTL для uninitialised vs initialised sessions

**Проблема**:

Redis session TTL = 30 дней для ВСЕХ sessions (uninitialised + initialised).

uninitialised session - это пользователь который:
- Открыл бота
- НЕ выполнил /story или /link

Зачем хранить uninitialised session 30 дней?

**Решение**: Разные TTL

```typescript
bot.use(
  session({
    initial: (): MySessionData => ({ status: "uninitialised" }),
    storage: new RedisAdapter({
      instance: redis,
      ttl: (session) => {
        // ✅ Короткий TTL для uninitialised
        if (session.status === "uninitialised") {
          return 60 * 60; // 1 час
        }
        // ✅ Длинный TTL для initialised
        return 30 * 24 * 60 * 60; // 30 дней
      },
    }),
  })
);
```

**Плюсы**:
- ✅ Меньше нагрузка на Redis (uninitialised sessions короткий TTL)
- ✅ Логично (незарегистрированные пользователи забываются быстро)

**Минусы**:
- ⚠️ Сложность (conditional TTL)

**Рекомендация**: Можно реализовать, но не критично. Optimization opportunity.

---

### 9. Search Handlers Params (разные params для разных search types)

**Проблема**:

SEARCH_CONFIG покрывает 3 search types с РАЗНЫМИ params:
- search_by_target: `{ targetContext, limit, ... }`
- search_user_careers: `{ limit, excludedFields, ... }`
- search_careers: `{ referenceContext, limit, ... }`

Можно ли унифицировать handlers?

**Решения**:

**Вариант A**: Generic handler (сложный)
```typescript
async function executeSearch(ctx: BotContext, searchType: SearchType, params: unknown) {
  const config = SEARCH_CONFIG[searchType];

  // ❌ params - unknown, нужна type safety
  const result = await ctx.services.mcpClient.callTool(config.mcpTool, params as any);

  await formatSearchResult(result);
}
```

**Вариант B**: Три отдельных handlers (простой) ✅
```typescript
// by-target.ts
async function executeTargetSearch(ctx: BotContext, query: string) {
  const result = await ctx.services.mcpClient.callTool("search_by_target", {
    targetContext: parseTargetQuery(query),
    limit: 20,
  });
  // ...
}

// by-current.ts
async function executeCurrentSearch(ctx: BotContext) {
  const result = await ctx.services.mcpClient.callTool("search_user_careers", {
    limit: 20,
  });
  // ...
}

// by-adhoc.ts
async function executeAdhocSearch(ctx: BotContext, query: string) {
  const result = await ctx.services.mcpClient.callTool("search_careers", {
    referenceContext: parseAdhocQuery(query),
    limit: 20,
  });
  // ...
}
```

**Рекомендация**: Вариант B - три отдельных handlers. Type safety важнее DRY.

---

## 📊 Итоговая Таблица

| # | Вопрос | Приоритет | Блокирует? | Рекомендация |
|---|--------|-----------|-----------|--------------|
| 1 | Response Schemas НЕ СУЩЕСТВУЮТ | 🔴 P0 | ДА | Создать в Facade result.ts (~200 строк) |
| 2 | SessionService.initialize() + Type Narrowing | 🔴 P0 | ДА | Возвращать InitialisedSession (immutable) |
| 3 | BotServices Type Split | 🟡 P1 | НЕТ | Разделить BotConfig и BotServices |
| 4 | Guard Middleware Order | 🟡 P1 | НЕТ | Уточнить: services → session guard |
| 5 | Error Handling в McpClient | 🟡 P1 | НЕТ | Throwing errors (McpClientError) |
| 6 | formatterLlm Ownership | 🟡 P1 | НЕТ | Config в BotConfig (createBot создает LLM) |
| 7 | Discriminated Union Guards в Handlers | 🟡 P1 | НЕТ | Добавить guards в handlers |
| 8 | Redis TTL Optimization | 🟢 P2 | НЕТ | Опционально (conditional TTL) |
| 9 | Search Handlers Params | 🟢 P2 | НЕТ | Три отдельных handlers (type safety) |

---

## 🎯 Action Items

**Перед началом реализации**:

1. ✅ **Создать Response Schemas в Facade** (P0)
   - Файл: `src/facade/mcp-server/result.ts`
   - 9+ Zod schemas на основе существующих TS types
   - ~200 строк кода

2. ✅ **Изменить решение: SessionService.initialize()** (P0)
   - Было: "Мутировать ctx.session"
   - Станет: "Возвращать InitialisedSession (immutable)"
   - Обновить REFACTORING-PLAN.md

3. ✅ **Уточнить Implementation Details** (P1)
   - BotConfig vs BotServices split
   - Guard middleware order
   - Error handling strategy в McpClient
   - formatterLlm ownership
   - Discriminated union guards в handlers

**После согласования**:
4. ✅ Обновить REFACTORING-PLAN.md с уточненными решениями
5. ✅ Начать реализацию

---

## 📝 Вывод

**Tool Registry - ПРАВИЛЬНОЕ решение**, НО:
- ⚠️ Требует создания Response Schemas в Facade (~200 строк)
- ⚠️ SessionService.initialize() должен возвращать новый session (immutable)
- ⚠️ Нужно уточнить 5 implementation details

**Все конфликты РЕШАЕМЫ**. Не требуется отмена согласованных решений, только уточнения.

**Оценка трудозатрат**:
- Response Schemas: +200 строк (~2 часа)
- Implementation Details: обсуждение + уточнение (~1 час)

**Итого**: +3 часа к первоначальной оценке (~1 час).

**Готово к согласованию решений для P0 вопросов** ✅
