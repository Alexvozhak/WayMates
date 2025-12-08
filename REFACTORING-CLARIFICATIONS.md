# Уточнения по Рефакторингу (Несогласованные Вопросы)

> **Дата**: 2025-12-08
> **Формат**: Ответы на вопросы пользователя с примерами из реального кода
> **Цель**: Согласовать оставшиеся архитектурные решения

---

## 1. SearchType в Конфиг?

### Твой вопрос

> "почему бы и SearchType не занести в этот конфиг?"

### Текущее предложение

```typescript
export const SearchType = {
  BY_TARGET: "by_target",
  BY_CURRENT: "by_current",
  BY_ADHOC: "by_adhoc",
} as const;

export type SearchType = (typeof SearchType)[keyof typeof SearchType];

export const SEARCH_CONFIG = {
  [SearchType.BY_TARGET]: {
    command: "/by_target",
    action: "by_target",
    i18n: { usage: "target-usage", searching: "searching-target" },
    mcpTool: "search_by_target",
  },
  // ...
};
```

### Альтернатива: SearchType внутри конфига

```typescript
export const SEARCH_CONFIG = {
  by_target: {
    type: "by_target",       // ✅ Дублируем ключ внутри
    command: "/by_target",
    action: "by_target",
    i18n: { usage: "target-usage", searching: "searching-target" },
    mcpTool: "search_by_target",
  },
  by_current: {
    type: "by_current",
    command: "/by_current",
    action: "by_current",
    i18n: { usage: "current-usage", searching: "searching-current" },
    mcpTool: "search_user_careers",
  },
  by_adhoc: {
    type: "by_adhoc",
    command: "/by_adhoc",
    action: "by_adhoc",
    i18n: { usage: "adhoc-usage", searching: "searching-adhoc" },
    mcpTool: "search_careers",
  },
} as const;

// Derive SearchType из ключей конфига
export type SearchType = keyof typeof SEARCH_CONFIG; // "by_target" | "by_current" | "by_adhoc"

// Использование
const config = SEARCH_CONFIG["by_target"];
const type: SearchType = "by_target";
```

### Сравнение

| Подход | Плюсы | Минусы |
|--------|-------|--------|
| **Отдельный SearchType** | ✅ Явный enum<br>✅ Можем использовать SearchType.BY_TARGET | ⚠️ Дублирование (SearchType + ключи SEARCH_CONFIG) |
| **SearchType из конфига** | ✅ DRY (нет дублирования)<br>✅ Single source of truth | ⚠️ Нет enum syntax (только строки)<br>⚠️ Поле type дублирует ключ |

### Рекомендация

**Вариант 1: SearchType из ключей конфига (без поля type)**

```typescript
export const SEARCH_CONFIG = {
  by_target: {
    command: "/by_target",
    action: "by_target" as const,
    i18n: { usage: "target-usage", searching: "searching-target" },
    mcpTool: "search_by_target",
  },
  by_current: { /* ... */ },
  by_adhoc: { /* ... */ },
} as const;

// Derive SearchType
export type SearchType = keyof typeof SEARCH_CONFIG;

// Helper для enum-like доступа
export const SearchType = {
  BY_TARGET: "by_target" as const,
  BY_CURRENT: "by_current" as const,
  BY_ADHOC: "by_adhoc" as const,
};

// Использование
const config = SEARCH_CONFIG[SearchType.BY_TARGET]; // ✅ Enum-like
const type: SearchType = "by_target";               // ✅ Type-safe
```

**Плюсы**:
- ✅ DRY (тип из конфига)
- ✅ Enum-like доступ (SearchType.BY_TARGET)
- ✅ Type-safe

**Что согласовать**:
- [ ] Использовать этот подход?

---

## 2.1 Где создавать экземпляры классов?

### Твой выбор

> "Вариант B всё же."

**Вариант B**: В bot.ts (внутри createBot)

```typescript
// bot.ts

export function createBot(token: string, services: BotServices): Bot<BotContext> {
  // ✅ Создаём классы ВНУТРИ createBot
  const mcpClient = new McpClient(services.facadeMcpUrl);
  const sessionService = new SessionService(mcpClient);
  const searchPresenter = new SearchPresenter(
    new ChatOpenAI({
      modelName: services.formatterLlm.model,
      temperature: services.formatterLlm.temperature,
      openAIApiKey: services.openaiApiKey,
    })
  );

  const bot = new Bot<BotContext>(token);

  // ... middleware setup

  bot.use(async (ctx, next) => {
    ctx.services = {
      ...services,
      sessionService,  // ✅ Добавляем классы в ctx.services
      mcpClient,
      searchPresenter,
    };
    await next();
  });

  // ... handlers

  return bot;
}

// index.ts (НЕ знает о классах)

const bot = createBot(env.TELEGRAM_BOT_TOKEN, {
  facadeMcpUrl: env.FACADE_MCP_URL,
  openaiApiKey: env.OPENAI_API_KEY,
  groqApiKey: env.GROQ_API_KEY,
  botToken: env.TELEGRAM_BOT_TOKEN,
  formatterLlm: { model: "gpt-4o-mini", temperature: 0 },
});
```

**Плюсы**:
- ✅ Инкапсуляция (index.ts НЕ знает о классах)
- ✅ createBot полностью настраивает бота

**Минусы**:
- ⚠️ bot.ts зависит от всех классов (SessionService, McpClient, SearchPresenter, ChatOpenAI)

**Что согласовать**:
- [x] Использовать Вариант B ✅

---

## 2.5 Смысл SessionService?

### Твой вопрос

> "ок, но есть ли смысл в этом менеджере тогда? что он будет делать?"

**Контекст**: Если ctx.session owner, зачем SessionService?

### Что делает SessionService?

```typescript
export class SessionService {
  constructor(private mcpClient: McpClient) {}

  // 1. Инициализация session (register_telegram)
  async initialize(ctx: BotContext): Promise<void> {
    const userId = ctx.from?.id;
    if (!userId) throw new Error("No user ID");

    const result = await this.mcpClient.callTyped(
      "register_telegram",
      {
        telegramUserId: userId,
        telegramUsername: ctx.from?.username,
        telegramFirstName: ctx.from?.first_name,
      },
      sessionResponseSchema
    );

    // ✅ Обновляем ctx.session (мутация)
    ctx.session = {
      status: "initialised",
      sessionId: result.sessionId,
      hasStory: result.hasStory,
      token: result.token,
    };
  }

  // 2. Refresh session (при session_expired)
  async refresh(ctx: BotContext): Promise<void> {
    // То же самое что initialize
    await this.initialize(ctx);
  }
}
```

### Зачем SessionService если ctx.session owner?

**1. Инкапсуляция бизнес-логики**

Без SessionService:
```typescript
// handlers/by-target.ts (дублирование в каждом handler)

const userId = ctx.from?.id;
if (!userId) throw new Error("No user ID");

const result = await ctx.services.mcpClient.callTyped(
  "register_telegram",
  { telegramUserId: userId, telegramUsername: ctx.from?.username, ... },
  sessionResponseSchema
);

ctx.session = { status: "initialised", sessionId: result.sessionId, ... };
```

С SessionService:
```typescript
// Guard middleware (одно место)
await ctx.services.sessionService.initialize(ctx); // ✅ Одна строка
```

**2. Type-safe конвертация session**

```typescript
// SessionService знает как конвертировать MCP response → MySessionData
const result = await this.mcpClient.callTyped("register_telegram", ..., sessionResponseSchema);

ctx.session = {
  status: "initialised",      // ✅ Правильный статус
  sessionId: result.sessionId, // ✅ Type-safe mapping
  hasStory: result.hasStory,
  token: result.token,
};
```

**3. DRY для session операций**

```typescript
// initialize() - новая session
// refresh() - обновление при session_expired
// invalidate() - удаление session (в будущем)
```

### Вывод

**SessionService = Domain Expert для session lifecycle**

- ctx.session = **storage** (где хранится)
- SessionService = **logic** (как создавать/обновлять)

**Аналогия**: UserRepository vs User entity
- User = данные (storage)
- UserRepository = логика работы с User (create, update, delete)

**Что согласовать**:
- [ ] SessionService имеет смысл? ✅

---

## 2.6 Принимать только нужные поля?

### Твой выбор

> "Вариант B: Принимать только нужные поля (pure), учти что у нас нет имени и фамилии, проверь схемы"

### Проверка схем Facade

**Схема register_telegram**:

```typescript
// src/facade/mcp-server/schemas.ts:153

export const telegramRegisterParamsSchema = z.object({
  telegramUserId: z.number().int().positive(),
  telegramUsername: z.string().optional(),      // ✅ Optional
  telegramFirstName: z.string().optional(),     // ✅ Optional
});
```

**Facade принимает**: telegramUserId (required), telegramUsername (optional), telegramFirstName (optional)

**Что отправляет Telegram bot сейчас**:

```typescript
// src/telegram-bot/services/mcp-client.ts:90

await sendMcpRequestWithRetry(ctx.services.facadeMcpUrl, "register_telegram", {
  telegramUserId,
  telegramUsername: ctx.from?.username,      // ✅ Optional (может быть undefined)
  telegramFirstName: ctx.from?.first_name,   // ✅ Optional (может быть undefined)
});
```

### Вариант B (Pure) - Обновлённый

```typescript
export class SessionService {
  async initialize(
    session: MySessionData,  // Для обновления (discriminated union)
    user: {
      id: number;
      username?: string;      // ✅ Optional
      firstName?: string;     // ✅ Optional
    }
  ): Promise<MySessionData> {
    const result = await this.mcpClient.callTyped(
      "register_telegram",
      {
        telegramUserId: user.id,
        telegramUsername: user.username,   // ✅ undefined OK (Facade обрабатывает)
        telegramFirstName: user.firstName, // ✅ undefined OK
      },
      sessionResponseSchema
    );

    // ✅ Возвращаем новую session (не мутируем)
    return {
      status: "initialised",
      sessionId: result.sessionId,
      hasStory: result.hasStory,
      token: result.token,
    };
  }
}

// Guard middleware (caller обновляет ctx.session)
if (ctx.session.status === "uninitialised") {
  const user = {
    id: ctx.from!.id,
    username: ctx.from?.username,     // ✅ Optional
    firstName: ctx.from?.first_name,  // ✅ Optional
  };

  ctx.session = await sessionService.initialize(ctx.session, user);
}
```

### Вариант A (BotContext) vs Вариант B (Pure)

| Критерий | Вариант A (BotContext) | Вариант B (Pure fields) |
|----------|----------------------|------------------------|
| **Сигнатура** | `initialize(ctx: BotContext)` | `initialize(session, user)` |
| **Caller код** | `await service.initialize(ctx)` | `ctx.session = await service.initialize(ctx.session, user)` |
| **Тестируемость** | ❌ Нужен полный BotContext | ✅ Mock только user объект |
| **Explicit deps** | ❌ Неявные (ctx.from, ctx.session) | ✅ Явные (session, user) |
| **Мутация** | ✅ Мутирует ctx.session | ❌ Возвращает новую session |
| **ООП стиль** | ✅ ДА | ❌ НЕТ (functional) |

### Рекомендация

**Проблема с Вариант B**: Противоречит ООП подходу

- ООП = классы работают с объектами (BotContext)
- Pure functions = принимают только нужные данные

**Если ты хочешь Вариант B** → это функциональный стиль, НЕ ООП

**Компромисс**: Вариант A (BotContext), но с явными зависимостями через интерфейс

```typescript
// Извлекаем интерфейс для тестируемости
export interface SessionContext {
  session: MySessionData;
  from?: { id: number; username?: string; first_name?: string };
}

export class SessionService {
  async initialize(ctx: SessionContext): Promise<void> {
    const userId = ctx.from?.id;
    if (!userId) throw new Error("No user ID");

    const result = await this.mcpClient.callTyped(
      "register_telegram",
      {
        telegramUserId: userId,
        telegramUsername: ctx.from?.username,
        telegramFirstName: ctx.from?.first_name,
      },
      sessionResponseSchema
    );

    // ✅ Мутируем ctx.session (ООП стиль)
    (ctx.session as any) = {
      status: "initialised",
      sessionId: result.sessionId,
      hasStory: result.hasStory,
      token: result.token,
    };
  }
}

// В тестах (легко mock)
const mockCtx: SessionContext = {
  session: { status: "uninitialised" },
  from: { id: 123, username: "test" },
};

await sessionService.initialize(mockCtx);
```

**Что согласовать**:
- [ ] Вариант A (BotContext) с интерфейсом SessionContext?
- [ ] ИЛИ Вариант B (pure fields) + отказ от ООП для SessionService?

---

## 2.7 Generic vs Typed - Непонятна Проблема

### Твой вопрос

> "я не понял проблему и почему в случае с typed нужно что-то дополнительно делать ("// ❌ Caller должен парсить result")?"

### Разбор Вариантов

#### Вариант B: Typed (из руководства)

```typescript
export class McpClient {
  async call(toolName: string, params: object): Promise<McpToolResult> {
    const result = await this.sendWithRetry(toolName, params);
    return result; // ✅ Возвращаем RAW MCP result
  }
}

// Использование
const result = await mcpClient.call("register_telegram", { telegramUserId: 123 });

// ❌ result имеет тип McpToolResult = { content: { type: string; text?: string }[] }
// ❌ Caller должен парсить ВРУЧНУЮ

const content = result.content[0];
if (!content || content.type !== "text" || !content.text) {
  throw new Error("Invalid content");
}

const jsonData = JSON.parse(content.text); // ❌ Парсим JSON вручную
const parsed = sessionResponseSchema.parse(jsonData); // ❌ Валидируем вручную

console.log(parsed.sessionId); // ✅ Теперь type-safe
```

**Проблема**: Caller должен **каждый раз** парсить result (3 шага: extract → parse → validate)

---

#### Вариант A: Generic

```typescript
export class McpClient {
  async call<T>(toolName: string, params: object): Promise<T> {
    const result = await this.sendWithRetry(toolName, params);

    // ⚠️ КАК парсить result в тип T?
    // Вариант 1: Type assertion (небезопасно)
    return result as T; // ❌ НЕТ runtime валидации!

    // Вариант 2: JSON.parse (но как знать что это JSON?)
    const text = result.content[0]?.text ?? "";
    return JSON.parse(text) as T; // ❌ НЕТ валидации!
  }
}

// Использование
const result = await mcpClient.call<{ sessionId: string; hasStory: boolean }>(
  "register_telegram",
  { telegramUserId: 123 }
);

console.log(result.sessionId); // ✅ Type-safe (НО нет runtime валидации!)
```

**Проблема**: Generic `<T>` = только compile-time, **нет runtime валидации**

---

#### Вариант C: Hybrid (рекомендация)

```typescript
export class McpClient {
  // Low-level (typed)
  async call(toolName: string, params: object): Promise<McpToolResult> {
    return await this.sendWithRetry(toolName, params);
  }

  // High-level (typed + validated)
  async callTyped<T>(
    toolName: string,
    params: object,
    schema: z.ZodType<T>  // ✅ Zod schema для валидации
  ): Promise<T> {
    const result = await this.call(toolName, params);

    // ✅ Парсинг + валидация ВНУТРИ метода
    const content = result.content[0];
    if (!content || content.type !== "text" || !content.text) {
      throw new McpClientError("Invalid MCP result content");
    }

    const jsonData = JSON.parse(content.text);
    return schema.parse(jsonData); // ✅ Runtime валидация через Zod
  }
}

// Использование (простой API)
const result = await mcpClient.callTyped(
  "register_telegram",
  { telegramUserId: 123 },
  sessionResponseSchema  // ✅ Zod schema
);

console.log(result.sessionId); // ✅ Type-safe + validated
```

**Плюсы**:
- ✅ call() для специальных случаев (raw access)
- ✅ callTyped() для обычных случаев (парсинг + валидация)
- ✅ DRY (парсинг в одном месте)

### Почему НЕ просто Generic?

**Generic `<T>` НЕ даёт runtime информацию**:

```typescript
async call<T>(toolName: string, params: object): Promise<T> {
  // ❌ Тип T НЕ существует в runtime!
  // ❌ Нельзя проверить T = { sessionId: string } в runtime
  // ❌ Можем только сделать type assertion (небезопасно)
  return result as T;
}
```

**Zod schema ДАЁт runtime информацию**:

```typescript
async callTyped<T>(toolName: string, params: object, schema: z.ZodType<T>): Promise<T> {
  // ✅ schema существует в runtime!
  // ✅ Можем валидировать данные через schema.parse()
  return schema.parse(jsonData);
}
```

**Что согласовать**:
- [ ] Вариант C (hybrid: call + callTyped) понятен? ✅

---

## 4. Formatter Plain Text - Валидная Ситуация?

### Твой вопрос

> "не уверен что тут валидная ситуация мы должны её поддерживать в фолбек делать. ты что думаешь? почему он может? почему это не ошибка а допущение? почему мы такое должны пропускать?"

### Анализ cold_start агента

**Что возвращает cold_start tool?**

Проверяю код Facade (агент cold_start):

```typescript
// Поиск в коде показывает что cold_start возвращает ВСЕГДА JSON:
// { phase: "COLLECTING" | "CONFIRMING" | "COMPLETED", message: string, ... }
```

**НО**: Агент использует LangChain → может вернуть plain text в edge cases

**Когда может вернуть plain text?**

1. **LLM hallucination** - агент сломался, вернул текст вместо JSON
2. **Network error** - partial response (обрезанный JSON)
3. **MCP error handling** - ошибка обёрнута в plain text

### Текущий код форматтера

```typescript
// formatters/story.ts:7

export function formatColdStartResult(result: McpToolResult): string {
  const text = extractTextContent(result);
  if (!text) {
    return "❌ Не удалось обработать ответ";
  }

  const data = parseJsonContent<ColdStartData>(result);
  return data ? formatColdStartPhase(data, text) : text; // ✅ Fallback на raw text
}
```

**Что происходит при fallback**:

```
User: [рассказывает историю]
Bot: "Извините, произошла ошибка. Пожалуйста, попробуйте ещё раз." // ← Plain text от агента
```

### Должны ли поддерживать fallback?

**Вариант 1: Поддерживать (текущий)**

**Плюсы**:
- ✅ Graceful degradation (показываем хоть что-то)
- ✅ Пользователь видит error message от агента

**Минусы**:
- ❌ Скрываем баг (агент сломался)
- ❌ Пользователь видит сырой текст (не i18n)

---

**Вариант 2: НЕ поддерживать (throwing)**

```typescript
export function formatColdStartResult(result: McpToolResult): string {
  const text = extractTextContent(result);
  if (!text) {
    throw new McpClientError("MCP result has no text content");
  }

  const data = parseJsonContent<ColdStartData>(result); // ❌ Throws если не JSON
  return formatColdStartPhase(data, text);
}

// bot.catch() обработает
bot.catch(async (error) => {
  if (error.error instanceof McpClientError) {
    await ctx.reply(ctx.t("error-generic")); // ✅ i18n error message
  }
});
```

**Плюсы**:
- ✅ Баг очевиден (логируем)
- ✅ Пользователь видит i18n error message

**Минусы**:
- ❌ Пользователь НЕ видит error message от агента

---

### Рекомендация

**Вариант 2 (throwing)** ✅

**Почему**:
1. ❌ **Plain text от агента = баг** (агент должен возвращать JSON)
2. ✅ **Throwing → логируем** → видим проблему → фиксим агента
3. ✅ **i18n error message** → consistent UX

**НО**: Если агент **специально** может возвращать plain text (by design) → fallback OK

**Вопрос**: Агент cold_start может вернуть plain text by design?

**Проверка кода**: НЕТ, агент ВСЕГДА возвращает JSON (phase + message)

**Вывод**: Plain text = ошибка → throwing

**Что согласовать**:
- [ ] Изменить formatColdStartResult на throwing? ✅

---

## 7. Session Expired - Как Работает Сейчас?

### Твой вопрос

> "айди сессии нам всегда выдает фасад, а не наш телеграммный редис. верно же? как будто бы мы ещё и в телеграме бдим за сессией и если она протухла то отправляем команду уже с пустой сессией? в надежде что получим ответ с новой сессией? но нет же? нужно перелогиниться?"

### Анализ Реального Кода

#### 1. Откуда sessionId?

**ДА, sessionId выдаёт ФАСАД** ✅

```typescript
// src/facade/mcp-server/auth.service.ts:81

const sessionId = await this.sessionMiddleware.createWithSingleActiveSession(userId);

return {
  userId: existing.userId,
  token: existing.token,
  sessionId,  // ✅ Фасад создаёт sessionId
  isNewUser: false,
  hasStory,
};
```

**Фасад** хранит session в своём session store (PostgreSQL + in-memory?)

---

#### 2. Что хранит Telegram Redis?

```typescript
// src/telegram-bot/bot.ts:68

bot.use(
  session({
    initial: (): MySessionData => ({
      sessionId: "",  // ← НЕ создаём sessionId!
      hasStory: false,
      token: "",
    }),
    storage: new RedisAdapter({ instance: redis }),
  }),
);
```

**Telegram Redis хранит**:
- `sessionId` (от фасада)
- `hasStory` (от фасада)
- `token` (от фасада)
- `pendingAction` (только Telegram знает)

**НЕ хранит**: session logic (это Facade ответственность)

---

#### 3. Как работает session_expired сейчас?

**Сценарий**:

```
1. User: /by_current
   ↓
2. Bot → Facade: search_user_careers(sessionId: "abc123")
   ↓
3. Facade проверяет sessionId в своём session store
   ↓
4. ❌ sessionId "abc123" НЕ найден ИЛИ expired
   ↓
5. Facade → Bot: throw SessionExpiredError("session_expired")
   ↓
6. Bot mcp-client.ts:65 ловит "session_expired"
   ↓
7. Bot вызывает refreshSession() → register_telegram
   ↓
8. Facade создаёт НОВЫЙ sessionId → "xyz789"
   ↓
9. Bot обновляет ctx.session.sessionId = "xyz789"
   ↓
10. Bot повторяет запрос: search_user_careers(sessionId: "xyz789")
    ↓
11. ✅ Успех
```

**Код**:

```typescript
// src/telegram-bot/services/mcp-client.ts:64

try {
  return await sendMcpRequestWithRetry(ctx.services.facadeMcpUrl, toolName, paramsWithSession);
} catch (error) {
  if (error instanceof Error && error.message.includes("session_expired")) {
    // ✅ Фасад сказал "session expired" → автоматически refresh
    await refreshSession(ctx, telegramUserId);
    const retryParams = { ...params, sessionId: ctx.session.sessionId };
    return await sendMcpRequestWithRetry(ctx.services.facadeMcpUrl, toolName, retryParams);
  }
  throw new McpClientError(`Failed to call tool ${toolName}`, error);
}
```

---

#### 4. Откуда пустая sessionId?

**Два случая**:

**Случай 1: Первое сообщение пользователя**

```
User отправляет первое сообщение → Grammy создаёт session с initial()
  ↓
ctx.session = { sessionId: "", hasStory: false, token: "" }
  ↓
Handler вызывает callTool() → проверяет ctx.session.sessionId
  ↓
sessionId === "" → вызывает refreshSession() → register_telegram
  ↓
ctx.session.sessionId = "abc123" (от фасада)
```

**Код**:

```typescript
// src/telegram-bot/services/mcp-client.ts:53

if (!ctx.session.sessionId) {
  // ✅ sessionId пустой → получаем от фасада
  await refreshSession(ctx, telegramUserId);
}
```

**Это ШТАТНАЯ ситуация** ✅

---

**Случай 2: Redis TTL истёк**

```
User активен → session в Redis: { sessionId: "abc123", hasStory: true }
  ↓
⏰ 30 дней неактивности → Redis TTL истекает → session удаляется
  ↓
User пишет снова → Grammy НЕ находит session в Redis
  ↓
Grammy создаёт новую session с initial() → { sessionId: "", hasStory: false }
  ↓
Handler вызывает callTool() → sessionId === ""
  ↓
Вызывает refreshSession() → register_telegram
  ↓
Фасад находит существующего user → возвращает sessionId + hasStory
  ↓
ctx.session = { sessionId: "xyz789", hasStory: true } (восстановлено!)
```

**Это ШТАТНАЯ ситуация** ✅ (auto re-login)

---

#### 5. Facade session vs Telegram session

**Два session store**:

| Store | Что хранит | TTL | Owner |
|-------|-----------|-----|-------|
| **Facade session** | User context для MCP tools | Короткий (30 мин?) | Facade |
| **Telegram Redis** | Bot UI state (sessionId, hasStory, pendingAction) | Длинный (30 дней?) | Telegram Bot |

**Workflow**:

```
Telegram Redis протухает:
  ↓
Bot: sessionId = "" → refreshSession()
  ↓
Facade создаёт НОВЫЙ sessionId (короткий TTL)
  ↓
Bot сохраняет sessionId в Redis (длинный TTL)

Facade session протухает:
  ↓
Bot отправляет протухший sessionId
  ↓
Facade: "session_expired"
  ↓
Bot: refreshSession() → получает НОВЫЙ sessionId
  ↓
Bot повторяет запрос с новым sessionId
```

---

### Вывод

**Твоё понимание было правильное** ✅

- ✅ sessionId выдаёт фасад
- ✅ Telegram Redis хранит sessionId (как cache)
- ✅ Когда Redis протухает → автоматически re-login через register_telegram
- ✅ Когда Facade session протухает → автоматически refresh через register_telegram

**НО**: "отправляем команду с пустой сессией" = НЕ совсем так

**Правильно**:
1. Проверяем ctx.session.sessionId ПЕРЕД отправкой
2. Если пустой → refreshSession() → получаем sessionId → потом отправляем
3. Если Facade вернул "session_expired" → refreshSession() → повторяем запрос

**Discriminated Union НЕ меняет логику**, только делает type-safe:

```typescript
// Guard middleware (автоматический re-login)
bot.use(async (ctx, next) => {
  if (ctx.session.status === "uninitialised") {
    await sessionService.initialize(ctx); // register_telegram
  }
  await next(); // Пропускаем только с initialised session
});

// mcp-client (session_expired handling)
try {
  return await httpClient.call(toolName, { ...params, sessionId: ctx.session.sessionId });
} catch (error) {
  if (error.message.includes("session_expired")) {
    await sessionService.refresh(ctx); // register_telegram снова
    return await httpClient.call(toolName, { ...params, sessionId: ctx.session.sessionId });
  }
}
```

**Что согласовать**:
- [ ] Понимание session flow правильное? ✅
- [ ] Discriminated union делает это type-safe? ✅

---

## Итоговая Таблица Несогласованных Вопросов

| # | Вопрос | Рекомендация | Требует решения |
|---|--------|--------------|----------------|
| 1 | SearchType в конфиг | ✅ Derive из ключей + helper const | Согласовать |
| 2.1 | Где создавать классы | ✅ bot.ts (Вариант B) | ✅ Согласовано |
| 2.5 | Смысл SessionService | ✅ Domain expert для session lifecycle | Согласовать |
| 2.6 | Принимать BotContext или fields | ❓ BotContext с интерфейсом VS pure fields | **Требует решения** |
| 2.7 | Generic vs typed | ✅ Hybrid (call + callTyped) | Согласовать |
| 4 | Formatter plain text | ✅ Throwing (не поддерживать fallback) | Согласовать |
| 7 | Session expired flow | ✅ Понимание правильное | Согласовать |

**Ключевой вопрос**: 2.6 - Принимать BotContext (ООП) или pure fields (functional)?

Это определяет стиль всего рефакторинга.
