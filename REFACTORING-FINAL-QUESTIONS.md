# Финальные Вопросы для Рефакторинга

> **Дата**: 2025-12-08
> **Статус**: Требуют согласования перед началом реализации

---

## 2.6 Принимать BotContext или Pure Fields?

### Актуализация вопроса

**Оригинальный вопрос**: Принимать весь BotContext или только нужные поля (userId, username, firstName)?

**Твоё замечание**: "не должны имя и логин принимать (анонимная платформа)"

### Проверка Facade API

**Схема register_telegram**:

```typescript
// src/facade/mcp-server/schemas.ts:153

export const telegramRegisterParamsSchema = z.object({
  telegramUserId: z.number().int().positive(),
  telegramUsername: z.string().optional(),   // ✅ Optional
  telegramFirstName: z.string().optional(),  // ✅ Optional
});
```

**Что отправляем сейчас**:

```typescript
// src/telegram-bot/services/mcp-client.ts:90

await sendMcpRequestWithRetry(ctx.services.facadeMcpUrl, "register_telegram", {
  telegramUserId,
  telegramUsername: ctx.from?.username,      // ✅ Отправляем
  telegramFirstName: ctx.from?.first_name,   // ✅ Отправляем
});
```

**Что хранит Facade**:

```typescript
// src/facade/infrastructure/postgres.service.ts:226

await this.query(
  `INSERT INTO facade.users (user_id, token, telegram_user_id, telegram_username, telegram_first_name, created_via)
   VALUES ($1, $2, $3, $4, $5, 'telegram')`,
  [userId, token, telegramUserId, telegramUsername ?? null, telegramFirstName ?? null]
);
```

### Вопрос

**Должны ли мы отправлять username и firstName в Facade?**

**Вариант A**: Продолжать отправлять (текущий подход)

```typescript
await this.mcpClient.callTyped(
  "register_telegram",
  {
    telegramUserId: ctx.from!.id,
    telegramUsername: ctx.from?.username,     // ✅ Отправляем
    telegramFirstName: ctx.from?.first_name,  // ✅ Отправляем
  },
  sessionResponseSchema
);
```

**Плюсы**:
- ✅ Facade знает кто пользователь (для аналитики, поддержки)
- ✅ Можем обращаться по имени в UI (если надо)

**Минусы**:
- ❌ Нарушает анонимность?

---

**Вариант B**: НЕ отправлять (анонимная платформа)

```typescript
await this.mcpClient.callTyped(
  "register_telegram",
  {
    telegramUserId: ctx.from!.id,
    // ❌ НЕ отправляем username и firstName
  },
  sessionResponseSchema
);
```

**Плюсы**:
- ✅ Полная анонимность

**Минусы**:
- ⚠️ Нужно обновить Facade схему (сделать NOT NULL → NULL)

---

### Актуализированный вопрос

**Вопрос НЕ в том "принимать BotContext или fields"**, а в том:

**Отправлять ли username и firstName в Facade?**

Если НЕ отправляем → сигнатура становится проще:

```typescript
export class SessionService {
  async initialize(ctx: BotContext): Promise<void> {
    const userId = ctx.from?.id;
    if (!userId) throw new Error("No user ID");

    const result = await this.mcpClient.callTyped(
      "register_telegram",
      {
        telegramUserId: userId,
        // ✅ ТОЛЬКО userId (анонимная платформа)
      },
      sessionResponseSchema
    );

    ctx.session = { status: "initialised", ... };
  }
}
```

**Что согласовать**:
- [ ] Отправлять username и firstName в Facade?
- [ ] Если НЕТ → обновить Facade схему (сделать поля nullable)

---

## 2.7 Строгие Типы в Сигнатуре

### Твоё требование

> "в сигнатуре согласовать более строгие типы, не строки желательно"

### Текущая сигнатура (строки)

```typescript
export class McpClient {
  async call(
    toolName: string,              // ❌ Любая строка
    params: object                 // ❌ Любой объект
  ): Promise<McpToolResult> {
    // ...
  }

  async callTyped<T>(
    toolName: string,              // ❌ Любая строка
    params: object,                // ❌ Любой объект
    schema: z.ZodType<T>
  ): Promise<T> {
    // ...
  }
}
```

**Проблема**:
- `toolName` = любая строка (можно передать "invalid_tool")
- `params` = любой объект (можно передать неправильные параметры)

---

### Строгие типы (типизация через MCP schema)

**Вариант 1**: Enum для toolName

```typescript
export enum McpToolName {
  REGISTER_TELEGRAM = "register_telegram",
  COLD_START = "cold_start",
  RESET_COLD_START = "reset_cold_start",
  SEARCH_BY_TARGET = "search_by_target",
  SEARCH_USER_CAREERS = "search_user_careers",
  SEARCH_CAREERS = "search_careers",
  LINK_TELEGRAM = "link_telegram",
}

export class McpClient {
  async call(
    toolName: McpToolName,         // ✅ Только валидные tools
    params: object
  ): Promise<McpToolResult> {
    return await this.sendWithRetry(toolName, params);
  }

  async callTyped<T>(
    toolName: McpToolName,         // ✅ Только валидные tools
    params: object,
    schema: z.ZodType<T>
  ): Promise<T> {
    // ...
  }
}

// Использование
await mcpClient.callTyped(
  McpToolName.REGISTER_TELEGRAM,  // ✅ Type-safe
  { telegramUserId: 123 },
  sessionResponseSchema
);
```

**Плюсы**:
- ✅ Type-safe tool names
- ✅ Autocomplete в IDE

**Минусы**:
- ⚠️ Нужно поддерживать enum в sync с Facade

---

**Вариант 2**: Typed params через overloads

```typescript
export class McpClient {
  // Overload для register_telegram
  async callTyped(
    toolName: "register_telegram",
    params: { telegramUserId: number; telegramUsername?: string; telegramFirstName?: string },
    schema: z.ZodType<SessionResponse>
  ): Promise<SessionResponse>;

  // Overload для cold_start
  async callTyped(
    toolName: "cold_start",
    params: { message: string; sessionId: string },
    schema: z.ZodType<ColdStartResponse>
  ): Promise<ColdStartResponse>;

  // Generic overload (fallback)
  async callTyped<T>(
    toolName: string,
    params: object,
    schema: z.ZodType<T>
  ): Promise<T>;

  // Implementation
  async callTyped<T>(
    toolName: string,
    params: object,
    schema: z.ZodType<T>
  ): Promise<T> {
    // ...
  }
}

// Использование
await mcpClient.callTyped(
  "register_telegram",
  { telegramUserId: 123 },  // ✅ Type-safe params!
  sessionResponseSchema
);

// ❌ TypeScript error: params не соответствует типу
await mcpClient.callTyped(
  "register_telegram",
  { invalidParam: "foo" },
  sessionResponseSchema
);
```

**Плюсы**:
- ✅ Type-safe tool names
- ✅ Type-safe params (проверяется TypeScript)
- ✅ Autocomplete для params

**Минусы**:
- ⚠️ Много overloads (по одному на каждый tool)
- ⚠️ Нужно поддерживать в sync с Facade

---

**Вариант 3**: Tool Registry (Advanced)

```typescript
// tool-registry.ts

export const TOOL_REGISTRY = {
  register_telegram: {
    params: z.object({
      telegramUserId: z.number(),
      telegramUsername: z.string().optional(),
      telegramFirstName: z.string().optional(),
    }),
    response: sessionResponseSchema,
  },
  cold_start: {
    params: z.object({
      message: z.string(),
      sessionId: z.string(),
    }),
    response: coldStartResponseSchema,
  },
  // ...
} as const;

export type ToolName = keyof typeof TOOL_REGISTRY;

export class McpClient {
  async callTool<T extends ToolName>(
    toolName: T,
    params: z.infer<typeof TOOL_REGISTRY[T]["params"]>
  ): Promise<z.infer<typeof TOOL_REGISTRY[T]["response"]>> {
    const tool = TOOL_REGISTRY[toolName];

    // ✅ Валидация params через Zod schema
    const validatedParams = tool.params.parse(params);

    const result = await this.call(toolName, validatedParams);

    // ✅ Валидация response через Zod schema
    return tool.response.parse(parseJsonContent(result));
  }
}

// Использование
await mcpClient.callTool(
  "register_telegram",  // ✅ Autocomplete
  {
    telegramUserId: 123,
    // ✅ TypeScript знает какие поля нужны
  }
);

// ❌ TypeScript error: params не соответствует схеме
await mcpClient.callTool(
  "register_telegram",
  { invalidParam: "foo" }
);
```

**Плюсы**:
- ✅ Полная type safety (tool names + params + response)
- ✅ Single source of truth (tool registry)
- ✅ Runtime валидация params и response

**Минусы**:
- ⚠️ Сложность (tool registry нужно поддерживать)
- ⚠️ Дублирование схем (Facade уже имеет схемы)

---

### Рекомендация

**Вариант 1 (Enum для toolName)** + **callTyped с object params**

```typescript
export enum McpToolName {
  REGISTER_TELEGRAM = "register_telegram",
  COLD_START = "cold_start",
  SEARCH_BY_TARGET = "search_by_target",
  SEARCH_USER_CAREERS = "search_user_careers",
  SEARCH_CAREERS = "search_careers",
  // ...
}

export class McpClient {
  async callTyped<T>(
    toolName: McpToolName,         // ✅ Строгий enum
    params: Record<string, unknown>, // ⚠️ Пока object (валидируется Zod schema)
    schema: z.ZodType<T>
  ): Promise<T> {
    // Валидация params через schema (в Facade)
    // Валидация response через schema (здесь)
  }
}
```

**Почему**:
1. ✅ Type-safe tool names (enum)
2. ✅ Простота (не нужно overloads или registry)
3. ✅ params валидируются Facade (не дублируем схемы)

**Если хочешь полную type safety для params** → Вариант 3 (Tool Registry)

**Что согласовать**:
- [ ] Вариант 1 (enum) OK?
- [ ] ИЛИ Вариант 3 (tool registry с полной валидацией)?

---

## 7. Зачем Telegram Redis Хранит Session?

### Твой вопрос

> "не очень понимаю почему в телеграме редис хранит сессию. зачем это и ещё со своим ттл в 30 дней, когда у фасада свой ттл на сессию. какой смысл? какие альтернативы? сравни и дай рекомендации."

### Текущая Архитектура (Два Session Store)

```
┌─────────────────────────┐
│  Telegram Bot (Redis)   │
│  TTL: 30 дней (?)       │
│                         │
│  Хранит:                │
│  - sessionId (от Facade)│
│  - hasStory             │
│  - token                │
│  - pendingAction        │
└─────────────────────────┘
            ↓ sessionId
┌─────────────────────────┐
│  Facade Session Store   │
│  TTL: 30 мин (?)        │
│                         │
│  Хранит:                │
│  - userId               │
│  - активные tools       │
│  - холодный старт state │
└─────────────────────────┘
```

### Зачем Telegram Redis?

#### Причина 1: Grammy Session Plugin

**Grammy требует session storage** для хранения user state:

```typescript
// bot.ts

bot.use(
  session({
    initial: (): MySessionData => ({ ... }),
    storage: new RedisAdapter({ instance: redis }), // ✅ Обязательно
  })
);
```

**Без session storage**:
- ❌ Нет `ctx.session` (нет доступа к sessionId, hasStory, pendingAction)
- ❌ Каждое сообщение = новый context (stateless)

**Grammy session = Bot UI state** (что видит пользователь, что делает бот)

---

#### Причина 2: Разные Lifecycle

**Telegram Bot state** (долгий):
- `hasStory` - нужно помнить всегда (пока пользователь существует)
- `pendingAction` - нужно помнить между сообщениями
- `token` - нужно помнить для linking

**Facade session** (короткий):
- Нужен только для активных MCP tool calls
- Может истекать быстро (30 мин) → меньше нагрузка на Facade

---

### Альтернативы

#### Альтернатива 1: Без Telegram Redis (In-Memory)

```typescript
// bot.ts

bot.use(
  session({
    initial: (): MySessionData => ({ ... }),
    // ❌ НЕТ storage → in-memory
  })
);
```

**Плюсы**:
- ✅ Проще (нет Redis dependency)

**Минусы**:
- ❌ Session теряется при перезапуске бота
- ❌ НЕ работает с несколькими инстансами бота (scaling)
- ❌ Пользователь теряет state при restart бота

**Вывод**: НЕ подходит для production ❌

---

#### Альтернатива 2: Хранить всё в Facade

```typescript
// НЕТ Telegram Redis

// Каждый запрос → Facade
await facade.getUserState(telegramUserId); // { hasStory, pendingAction, ... }
await facade.setUserState(telegramUserId, { ... });
```

**Плюсы**:
- ✅ Single source of truth (Facade)

**Минусы**:
- ❌ Лишние запросы к Facade (каждое сообщение → HTTP request)
- ❌ Facade хранит Bot UI state (не его ответственность)
- ❌ НЕ работает с Grammy session plugin (требует local storage)

**Вывод**: НЕ подходит ❌

---

#### Альтернатива 3: Хранить только sessionId в Redis (минимум)

```typescript
// Telegram Redis - ТОЛЬКО sessionId
export type MySessionData = {
  sessionId: string;
  // ❌ НЕТ hasStory, token, pendingAction
};

// Остальное → из Facade при каждом запросе
const userState = await facade.getUserState(sessionId);
if (userState.hasStory) {
  // ...
}
```

**Плюсы**:
- ✅ Telegram Redis минимален
- ✅ Facade = source of truth для hasStory

**Минусы**:
- ❌ Каждое сообщение → HTTP request к Facade
- ❌ Больше latency для пользователя

**Вывод**: НЕ оптимально ⚠️

---

#### Альтернатива 4: Текущий подход (Cache pattern)

```typescript
// Telegram Redis = CACHE для Facade data
export type MySessionData = {
  sessionId: string,
  hasStory: boolean,      // ✅ Cache из Facade
  token: string,          // ✅ Cache из Facade
  pendingAction?: string, // ✅ Bot-only state
};

// Периодически синхронизируем с Facade (при register_telegram)
const result = await facade.registerTelegram(...);
ctx.session.hasStory = result.hasStory; // ✅ Обновляем cache
```

**Плюсы**:
- ✅ Минимум запросов к Facade (только при session refresh)
- ✅ Быстро для пользователя (данные из Redis)
- ✅ Поддерживает Bot UI state (pendingAction)

**Минусы**:
- ⚠️ Возможна рассинхронизация (Redis vs Facade)
- ⚠️ Два TTL (Redis и Facade)

**Решение проблем**:
- Рассинхронизация: автоматический refresh при session_expired
- Два TTL: Redis TTL >> Facade TTL (30 дней vs 30 мин)

**Вывод**: Оптимально ✅

---

### Рекомендация

**Текущий подход (Alternative 4) - ПРАВИЛЬНЫЙ** ✅

**Почему**:
1. ✅ **Performance**: данные из Redis (быстро)
2. ✅ **Resilience**: автоматический refresh при Facade session_expired
3. ✅ **Scaling**: поддерживает несколько инстансов бота
4. ✅ **Grammy compatibility**: работает с session plugin

**TTL стратегия**:
- **Telegram Redis TTL**: Длинный (30 дней) → пользователь не теряет hasStory при редких визитах
- **Facade Session TTL**: Короткий (30 мин) → меньше нагрузка на Facade

**Когда синхронизировать**:
1. Первое сообщение → register_telegram → заполняем Redis cache
2. Facade session_expired → register_telegram → обновляем Redis cache
3. Redis TTL истёк → register_telegram → восстанавливаем cache

**Что согласовать**:
- [ ] Текущий подход (cache pattern) OK? ✅

---

## 7. Discriminated Union - Как Меняет Логику?

### Твой вопрос

> "изначальный вопрос с 'Discriminated Union НЕ меняет логику' нужно ещё раз обсудить, не понимаю о чем ты"

### Что такое Discriminated Union?

**Текущий тип** (проблемный):

```typescript
export type MySessionData = {
  sessionId: string;  // ❌ Тип говорит "всегда есть"
  hasStory: boolean;
  token: string;
};

// НО initial state:
initial: () => ({
  sessionId: "",      // ❌ Пустая строка = "нет sessionId"
  hasStory: false,
  token: "",
})
```

**Проблема**: Тип говорит `sessionId: string` (всегда есть), но на самом деле может быть пустая строка (uninitialised)

---

**Discriminated Union** (правильный):

```typescript
export type MySessionData =
  | { status: "uninitialised" }                                         // ✅ Нет sessionId
  | { status: "initialised"; sessionId: string; hasStory: boolean; token: string }; // ✅ Есть sessionId

// Initial state
initial: () => ({
  status: "uninitialised", // ✅ Явно: нет sessionId
})
```

**Плюсы**:
- ✅ Тип честно отражает реальность
- ✅ TypeScript проверяет доступ к sessionId

---

### Как Меняет Логику?

**Было** (текущий код):

```typescript
// mcp-client.ts:53

if (!ctx.session.sessionId) {
  // ✅ Проверяем пустую строку
  await refreshSession(ctx, telegramUserId);
}

const paramsWithSession = { ...params, sessionId: ctx.session.sessionId };
```

**Станет** (с discriminated union):

```typescript
// Guard middleware (ОДИН РАЗ для всех handlers)

bot.use(async (ctx, next) => {
  if (ctx.session.status === "uninitialised") {
    // ✅ Проверяем статус (type-safe)
    await sessionService.initialize(ctx);
  }

  await next(); // Пропускаем только initialised session
});

// mcp-client.ts (проще!)

// ❌ Больше НЕ нужна проверка sessionId (guard middleware гарантирует)
const paramsWithSession = { ...params, sessionId: ctx.session.sessionId };
```

---

### Что Меняется в Логике?

#### 1. Проверка sessionId → Guard Middleware

**Было**: Каждый tool call проверяет `if (!ctx.session.sessionId)`

**Станет**: Guard middleware проверяет ОДИН РАЗ

**Плюсы**:
- ✅ DRY (одна проверка вместо многих)
- ✅ Fail-fast (блокируем до handlers)

---

#### 2. Type-Safe Доступ к sessionId

**Было**:

```typescript
const sessionId = ctx.session.sessionId; // ✅ TypeScript OK (но может быть "")

if (!sessionId) {
  // Runtime проверка
}
```

**Станет**:

```typescript
// В handlers ПОСЛЕ guard middleware

if (ctx.session.status === "uninitialised") {
  // ❌ TypeScript error: Это НЕ ДОЛЖНО произойти (guard проверил)
  throw new Error("Session not initialized");
}

const sessionId = ctx.session.sessionId; // ✅ TypeScript ЗНАЕТ что sessionId есть
```

**Плюсы**:
- ✅ Type-safe (TypeScript проверяет доступ)
- ✅ Явные состояния (uninitialised vs initialised)

---

#### 3. Session Expired Handling

**Было**:

```typescript
// callbacks.ts:14

function updateHasStory(ctx: BotContext, hasStory: boolean): boolean {
  if (!ctx.session.sessionId) return false; // ❌ Session expired

  ctx.session.hasStory = hasStory;
  return true;
}

// Caller
if (!updateHasStory(ctx, true)) {
  await ctx.editMessageText(ctx.t("session-expired"));
}
```

**Станет**:

```typescript
// Guard middleware для callbacks

bot.callbackQuery("decision:approve", async (ctx, next) => {
  if (ctx.session.status === "uninitialised") {
    await ctx.answerCallbackQuery({ text: "Session expired" });
    await ctx.editMessageText(ctx.t("session-expired"));
    return; // ❌ Блокируем
  }

  await next(); // ✅ Пропускаем только initialised
});

// callbacks.ts (проще!)

export async function handleApproveCallback(ctx: BotContext): Promise<void> {
  // ✅ session.status = "initialised" ГАРАНТИРОВАННО

  const result = await callTool(ctx, "cold_start", { message: "да" });
  const data = parseJsonContent(result);

  if (data.phase === "COMPLETED") {
    ctx.session.hasStory = true; // ✅ Прямая установка (sessionId ЕСТЬ)
  }
}
```

**Плюсы**:
- ✅ Centralized guard (одна проверка для всех callbacks)
- ✅ Handlers не проверяют session (guard гарантирует)
- ✅ Можем удалить updateHasStory (inline)

---

### Итоговое Сравнение

| Аспект | Текущий код | С Discriminated Union |
|--------|-------------|---------------------|
| **Проверка sessionId** | В каждом tool call | Guard middleware (один раз) |
| **Type safety** | ❌ `sessionId: string` (может быть "") | ✅ Type-safe доступ |
| **updateHasStory** | Функция с boolean return | ❌ Удаляем (inline) |
| **Callback guards** | Проверка в handler | Guard middleware |
| **Логика** | Defensive checks везде | ✅ Fail-fast guards |

---

### Меняет ли Discriminated Union Логику?

**ДА, но минимально** ✅

**Что меняется**:
1. ✅ Проверка sessionId ПЕРЕМЕЩАЕТСЯ в guard middleware (было в tool call)
2. ✅ Type-safe доступ к sessionId (TypeScript проверяет)
3. ✅ Удаляем updateHasStory (inline в handler)

**Что НЕ меняется**:
1. ✅ Session flow (register_telegram при uninitialised)
2. ✅ Session refresh (при session_expired)
3. ✅ Redis storage (тот же Redis)

**Вывод**: Discriminated Union делает код **type-safe** и **проще** (меньше defensive checks)

**Что согласовать**:
- [ ] Использовать Discriminated Union? ✅
- [ ] Понятно как меняет логику? ✅

---

## Итоговая Таблица

| # | Вопрос | Статус | Решение |
|---|--------|--------|---------|
| 1 | SearchType в конфиг | ✅ Согласовано | Derive из ключей + helper const |
| 2.5 | Смысл SessionService | ✅ Согласовано | Domain expert для session lifecycle |
| 2.6 | username/firstName в Facade | ❓ Требует решения | Отправлять или НЕТ (анонимность)? |
| 2.7 | Строгие типы toolName | ❓ Требует решения | Enum vs Tool Registry? |
| 4 | Formatter plain text | ✅ Согласовано | Throwing (не fallback) |
| 7.1 | Зачем Telegram Redis | ✅ Согласовано | Cache pattern (текущий подход) |
| 7.2 | Discriminated Union | ❓ Требует решения | Использовать? |

**Осталось согласовать**:
1. Отправлять username/firstName в Facade?
2. Enum vs Tool Registry для toolName?
3. Использовать Discriminated Union?
