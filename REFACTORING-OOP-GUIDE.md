# Руководство по ООП Рефакторингу Telegram Bot

> **Дата**: 2025-12-08
> **Формат**: Детальные ответы с примерами кода
> **Цель**: ООП подход - архитектурные решения с примерами

---

## 1. Massive Code Duplication - Единый Словарь

### Твой вопрос

> "что если завести мапу со структурой? что мы по ключу получаем либо Command Action +2 ключа из SearchI18nKey? стоит ли объединять это всё в один словарь так скажем?"

### Предложенная структура

**Единый конфиг для всех search типов**:

```typescript
// types.ts

export const SearchType = {
  BY_TARGET: "by_target",
  BY_CURRENT: "by_current",
  BY_ADHOC: "by_adhoc",
} as const;

export type SearchType = (typeof SearchType)[keyof typeof SearchType];

// Единая структура с ВСЕМИ данными для каждого типа поиска
export const SEARCH_CONFIG = {
  [SearchType.BY_TARGET]: {
    command: "/by_target",
    action: "by_target" as const,
    i18n: {
      usage: "target-usage",
      searching: "searching-target",
    },
    mcpTool: "search_by_target",
  },
  [SearchType.BY_CURRENT]: {
    command: "/by_current",
    action: "by_current" as const,
    i18n: {
      usage: "current-usage",
      searching: "searching-current",
    },
    mcpTool: "search_user_careers",
  },
  [SearchType.BY_ADHOC]: {
    command: "/by_adhoc",
    action: "by_adhoc" as const,
    i18n: {
      usage: "adhoc-usage",
      searching: "searching-adhoc",
    },
    mcpTool: "search_careers",
  },
} as const;

// Типы для конфига
export type SearchConfig = typeof SEARCH_CONFIG[SearchType];
export type SearchAction = SearchConfig["action"];
export type PendingAction = "story" | SearchAction;
```

### Использование в коде

```typescript
// handlers/by-target.ts

import { SearchType, SEARCH_CONFIG } from "../types.js";

const config = SEARCH_CONFIG[SearchType.BY_TARGET];

export async function handleByTarget(ctx: BotContext): Promise<void> {
  const query = ctx.message?.text?.replace(config.command, "").trim();

  if (!query) {
    ctx.session.pendingAction = config.action; // ✅ Из конфига
    await ctx.reply(ctx.t(config.i18n.usage));    // ✅ Из конфига
    return;
  }

  const statusMsg = await ctx.reply(ctx.t(config.i18n.searching)); // ✅ Из конфига
  await ctx.replyWithChatAction("typing");

  const searchParams = await parseTargetQuery(ctx.services.openaiApiKey, query);
  const result = await callTool(ctx, config.mcpTool, searchParams); // ✅ Из конфига

  await ctx.api.deleteMessage(statusMsg.chat.id, statusMsg.message_id);
  await formatAndReplySearch(ctx, result);
}
```

### Плюсы единого конфига

1. ✅ **Single source of truth** - всё в одном месте
2. ✅ **Type-safe** - TypeScript знает структуру
3. ✅ **Легко расширять** - добавляешь новый search → просто новый ключ в SEARCH_CONFIG
4. ✅ **Нет дублирования** - command, action, i18n, mcpTool в одной структуре
5. ✅ **Читабельно** - видно ВСЕ параметры типа поиска сразу

### Минусы

1. ⚠️ **Нельзя derive автоматически** - mcpTool != command (не прямое соответствие)
2. ⚠️ **Вложенная структура** - `config.i18n.usage` вместо `I18N_USAGE[type]`

### Рекомендация

**ДА, использовать единый словарь SEARCH_CONFIG** ✅

**Причины**:
- Соответствует ООП подходу (конфигурация = объект)
- Минимум дублирования
- Легко тестировать (mock конфиг)
- Легко расширять (новый search type = новый ключ)

---

## 2. SRP Violation - ООП Подход (Детальный Разбор)

### Общая архитектура

```
services/
├── session-manager.ts  ← SessionManager class
├── mcp-http-client.ts  ← McpHttpClient class
└── mcp-client.ts       ← Facade (callTool function)
```

---

### 2.1 Где создавать экземпляры классов?

**Твой ответ**: "В index.ts (при старте приложения)"

**Вариант A: index.ts (до createBot)**

```typescript
// index.ts

import { createBot } from "./bot.js";
import { SessionManager } from "./services/session-manager.js";
import { McpHttpClient } from "./services/mcp-http-client.js";
import { validateEnv } from "./env.js";

const env = validateEnv();

// ✅ Создаём экземпляры ЗДЕСЬ (при старте)
const sessionManager = new SessionManager(env.FACADE_MCP_URL);
const mcpClient = new McpHttpClient(env.FACADE_MCP_URL);

const bot = createBot(env.TELEGRAM_BOT_TOKEN, {
  facadeMcpUrl: env.FACADE_MCP_URL,
  openaiApiKey: env.OPENAI_API_KEY,
  groqApiKey: env.GROQ_API_KEY,
  botToken: env.TELEGRAM_BOT_TOKEN,
  formatterLlm: { model: "gpt-4o-mini", temperature: 0 },
  sessionManager,  // ✅ Передаём в services
  mcpClient,       // ✅ Передаём в services
});

await bot.start();
```

**Плюсы**:
- ✅ Явное создание (видно ЧТО создаётся)
- ✅ Зависимости явные (facadeUrl передаётся напрямую)
- ✅ Легко тестировать (можно подменить в тестах)

**Минусы**:
- ⚠️ index.ts знает о внутренних классах (SessionManager, McpHttpClient)

---

**Вариант B: bot.ts (внутри createBot)**

```typescript
// bot.ts

import { SessionManager } from "./services/session-manager.js";
import { McpHttpClient } from "./services/mcp-http-client.js";

export function createBot(token: string, services: BotServices): Bot<BotContext> {
  // ✅ Создаём экземпляры ВНУТРИ createBot
  const sessionManager = new SessionManager(services.facadeMcpUrl);
  const mcpClient = new McpHttpClient(services.facadeMcpUrl);

  const bot = new Bot<BotContext>(token);

  // ...middleware, handlers

  bot.use(async (ctx, next) => {
    ctx.services = {
      ...services,
      sessionManager, // ✅ Добавляем в ctx.services
      mcpClient,
    };
    await next();
  });

  // ...
}
```

**Плюсы**:
- ✅ Инкапсуляция (index.ts НЕ знает о классах)
- ✅ createBot полностью настраивает бота

**Минусы**:
- ⚠️ Создаются КАЖДЫЙ раз при вызове createBot (но createBot вызывается один раз)

---

**Рекомендация**: **Вариант A (index.ts)** ✅

**Почему**:
1. ✅ Explicit is better than implicit
2. ✅ Зависимости явные (видно ЧТО создаётся и с КАКИМИ параметрами)
3. ✅ Проще тестировать (можем передать mock классы в createBot)

**Но**: Если хочешь полную инкапсуляцию → используй Вариант B

---

### 2.2 Как передавать зависимости между классами?

**Твой ответ**: "хз, нужно больше контекста и рекомендации"

**Вопрос**: SessionManager зависит от McpHttpClient или каждый независим?

**Архитектурные варианты**:

#### Вариант A: SessionManager использует McpHttpClient (композиция)

```typescript
// services/session-manager.ts

export class SessionManager {
  constructor(
    private httpClient: McpHttpClient,  // ✅ Зависимость через конструктор
  ) {}

  async refresh(ctx: BotContext, userId: number): Promise<MySessionData> {
    // ✅ Используем httpClient для запроса
    const result = await this.httpClient.call("register_telegram", {
      telegramUserId: userId,
      telegramUsername: ctx.from?.username,
      telegramFirstName: ctx.from?.first_name,
    });

    // Парсим и обновляем ctx.session
    // ...
  }
}

// index.ts
const mcpClient = new McpHttpClient(env.FACADE_MCP_URL);
const sessionManager = new SessionManager(mcpClient); // ✅ Передаём зависимость
```

**Плюсы**:
- ✅ Чистая композиция (SessionManager depends on McpHttpClient)
- ✅ Легко тестировать (mock httpClient)
- ✅ SRP (SessionManager не знает как делать HTTP запросы)

**Минусы**:
- ⚠️ Больше связности (SessionManager зависит от McpHttpClient)

---

#### Вариант B: Оба независимы (только facadeUrl)

```typescript
// services/session-manager.ts

export class SessionManager {
  constructor(private facadeUrl: string) {} // ✅ Только URL

  async refresh(ctx: BotContext, userId: number): Promise<MySessionData> {
    // ❌ Как делать HTTP запрос? Либо дублировать код, либо вызывать функцию
    const result = await sendMcpRequest(this.facadeUrl, "register_telegram", {...}); // Функция из mcp-http-client
    // ...
  }
}

// index.ts
const sessionManager = new SessionManager(env.FACADE_MCP_URL);
const mcpClient = new McpHttpClient(env.FACADE_MCP_URL);
```

**Плюсы**:
- ✅ Нет связности между классами
- ✅ Независимые модули

**Минусы**:
- ⚠️ Дублирование HTTP логики ИЛИ вызов функции из другого модуля

---

**Рекомендация**: **Вариант A (композиция)** ✅

**Почему**:
1. ✅ DRY - SessionManager использует McpHttpClient для HTTP запросов
2. ✅ Чёткая ответственность:
   - SessionManager = управление session lifecycle
   - McpHttpClient = HTTP запросы с retry
3. ✅ Легко тестировать (mock httpClient в тестах SessionManager)

**Как передавать**:
```typescript
// index.ts
const mcpClient = new McpHttpClient(env.FACADE_MCP_URL);
const sessionManager = new SessionManager(mcpClient); // ✅ Dependency Injection
```

---

### 2.3 Lifetime классов - Singleton или Per-request?

**Твой ответ**: "что может быть синглтоном, делаем им. в чем вопрос?"

**Вопрос был**: Создавать один экземпляр на весь бот (singleton) или для каждого ctx (per-request)?

**Ответ**: **Singleton (один экземпляр на бота)** ✅

**Почему**:
1. ✅ **McpHttpClient** - stateless (только хранит facadeUrl), можно переиспользовать
2. ✅ **SessionManager** - stateless (мутирует ctx.session, но не хранит state), можно переиспользовать
3. ✅ **Производительность** - создание объектов каждый request = overhead

**Per-request НЕ нужен**, потому что:
- Классы не хранят request-specific state
- ctx передаётся как параметр в методы
- Session хранится в ctx.session (Redis)

**Код**:
```typescript
// index.ts (ОДИН раз при старте)
const mcpClient = new McpHttpClient(env.FACADE_MCP_URL); // ✅ Singleton
const sessionManager = new SessionManager(mcpClient);    // ✅ Singleton

const bot = createBot(env.TELEGRAM_BOT_TOKEN, {
  ...services,
  sessionManager, // ✅ Один экземпляр для ВСЕХ requests
  mcpClient,
});
```

---

### 2.4 SessionManager мутирует ctx.session - это нормально?

**Твой ответ**: "альтернативу не понял"

**Контекст**: Класс имеет side-effect (мутация ctx.session)

**Вопрос был**: Это нормально (текущий подход) ИЛИ SessionManager должен возвращать новую session без мутации?

**Вариант A: Мутация ctx.session (текущий)**

```typescript
export class SessionManager {
  async refresh(ctx: BotContext, userId: number): Promise<void> {
    const result = await this.httpClient.call("register_telegram", {...});
    const parsed = sessionResponseSchema.parse(parseJsonContent(result));

    // ✅ Мутируем ctx.session напрямую
    ctx.session.sessionId = parsed.sessionId;
    ctx.session.hasStory = parsed.hasStory;
    ctx.session.token = parsed.token;
  }
}

// Использование
await sessionManager.refresh(ctx, userId); // ✅ ctx.session обновлён
```

**Плюсы**:
- ✅ Простота (caller не делает ничего)
- ✅ Соответствует текущему стилю проекта

**Минусы**:
- ❌ Side effect (функция мутирует аргумент)
- ❌ Неявно (caller не знает что ctx изменён)

---

**Вариант B: Возвращать новую session (immutable)**

```typescript
export class SessionManager {
  async refresh(ctx: BotContext, userId: number): Promise<MySessionData> {
    const result = await this.httpClient.call("register_telegram", {...});
    const parsed = sessionResponseSchema.parse(parseJsonContent(result));

    // ✅ Возвращаем новый объект (не мутируем)
    return {
      sessionId: parsed.sessionId,
      hasStory: parsed.hasStory,
      token: parsed.token,
    };
  }
}

// Использование
ctx.session = await sessionManager.refresh(ctx, userId); // ✅ Caller обновляет ctx.session
```

**Плюсы**:
- ✅ Immutable (нет side effects)
- ✅ Явно (caller видит что session обновляется)
- ✅ Functional style

**Минусы**:
- ⚠️ Caller должен присваивать результат
- ⚠️ Не соответствует ООП стилю (классы обычно мутируют состояние)

---

**Рекомендация**: **Вариант A (мутация)** ✅

**Почему**:
1. ✅ Соответствует ООП стилю (Manager управляет состоянием)
2. ✅ Проще для caller (не нужно присваивать)
3. ✅ ctx.session = mutable по дизайну Grammy (session plugin)

**НО** если переходишь на immutable/functional стиль → используй Вариант B

---

### 2.5 Кто owner session state?

**Твой ответ**: "вопроса не понял, нужны примеры"

**Вопрос**: Кто владеет session state - SessionManager (encapsulation) или ctx.session (текущий подход)?

**Вариант A: ctx.session owner (текущий)**

```typescript
// SessionManager только обновляет ctx.session
export class SessionManager {
  async refresh(ctx: BotContext, userId: number): Promise<void> {
    // ...
    ctx.session.sessionId = parsed.sessionId; // ✅ Обновляем ЧТО-ТО внешнее
  }
}

// Handlers ТОЖЕ могут напрямую обращаться к ctx.session
export async function handleByTarget(ctx: BotContext): Promise<void> {
  const sessionId = ctx.session.sessionId; // ✅ Прямой доступ
}
```

**Плюсы**:
- ✅ Handlers могут читать session напрямую
- ✅ Гибкость (можем обновлять session в handlers)

**Минусы**:
- ❌ Нет encapsulation (SessionManager НЕ владеет session)
- ❌ Можем сломать session в handlers (забыть обновить)

---

**Вариант B: SessionManager owner (encapsulation)**

```typescript
// SessionManager инкапсулирует ВЕСЬ доступ к session
export class SessionManager {
  private session: MySessionData; // ✅ Private state

  getSessionId(): string {
    return this.session.sessionId;
  }

  async refresh(userId: number): Promise<void> {
    // ...
    this.session.sessionId = parsed.sessionId; // ✅ Обновляем СВОЙ state
  }
}

// Handlers используют SessionManager
export async function handleByTarget(ctx: BotContext): Promise<void> {
  const sessionId = ctx.services.sessionManager.getSessionId(); // ✅ Через getter
}
```

**Плюсы**:
- ✅ Encapsulation (только SessionManager трогает session)
- ✅ Type-safe (можем добавить validation в getters/setters)

**Минусы**:
- ❌ НЕ работает с Grammy session plugin (session хранится в Redis, нужен ctx)
- ❌ Дублирование state (SessionManager.session vs ctx.session)

---

**Рекомендация**: **Вариант A (ctx.session owner)** ✅

**Почему**:
1. ✅ Соответствует Grammy session plugin (session = часть ctx)
2. ✅ Redis хранит session (не можем инкапсулировать в SessionManager)
3. ✅ Handlers нуждаются в прямом доступе к session (hasStory, pendingAction)

**Вывод**: SessionManager = helper для управления session, НЕ owner

---

### 2.6 SessionManager.ensure(ctx) - принимать весь ctx?

**Твой ответ**: "нужны примеры реализации с рекомендациями"

**Вопрос**: Принимать весь BotContext ИЛИ только нужные поля?

**Вариант A: Принимать BotContext (текущий)**

```typescript
export class SessionManager {
  async ensure(ctx: BotContext): Promise<void> {
    if (ctx.session.sessionId) return;

    const userId = ctx.from?.id;
    if (!userId) throw new Error("No user ID");

    await this.refresh(ctx, userId);
  }

  async refresh(ctx: BotContext, userId: number): Promise<void> {
    const result = await this.httpClient.call("register_telegram", {
      telegramUserId: userId,
      telegramUsername: ctx.from?.username,  // ✅ Используем ctx.from
      telegramFirstName: ctx.from?.first_name,
    });

    // ...update ctx.session
  }
}

// Использование
await sessionManager.ensure(ctx); // ✅ Просто
```

**Плюсы**:
- ✅ Простота (один параметр)
- ✅ Гибкость (SessionManager может читать любые данные из ctx)

**Минусы**:
- ❌ Tight coupling (SessionManager зависит от BotContext)
- ❌ Неявные зависимости (не видно ЧТО читается из ctx)
- ❌ Сложно тестировать (нужно создавать полный BotContext в тестах)

---

**Вариант B: Принимать только нужные поля (pure)**

```typescript
export class SessionManager {
  async refresh(
    session: MySessionData,       // ✅ Explicit
    user: { id: number; username?: string; firstName?: string }, // ✅ Explicit
  ): Promise<MySessionData> {
    const result = await this.httpClient.call("register_telegram", {
      telegramUserId: user.id,
      telegramUsername: user.username,
      telegramFirstName: user.firstName,
    });

    const parsed = sessionResponseSchema.parse(parseJsonContent(result));

    // ✅ Возвращаем новую session (не мутируем)
    return {
      sessionId: parsed.sessionId,
      hasStory: parsed.hasStory,
      token: parsed.token,
    };
  }
}

// Использование (caller обновляет ctx.session)
const user = { id: ctx.from!.id, username: ctx.from?.username, firstName: ctx.from?.first_name };
ctx.session = await sessionManager.refresh(ctx.session, user);
```

**Плюсы**:
- ✅ Explicit dependencies (видно ЧТО нужно SessionManager)
- ✅ Легко тестировать (mock только user объект)
- ✅ Pure function style

**Минусы**:
- ❌ Verbose (caller должен извлекать user из ctx)
- ❌ Caller должен обновлять ctx.session
- ❌ НЕ ООП стиль (классы обычно принимают объект целиком)

---

**Рекомендация**: **Вариант A (принимать BotContext)** ✅

**Почему**:
1. ✅ ООП стиль (классы работают с объектами)
2. ✅ Проще для caller (один параметр)
3. ✅ SessionManager = domain expert для session (знает ЧТО нужно из ctx)

**Вариант B** хорош для functional style, но мы переходим к ООП → используем Вариант A

---

### 2.7 McpHttpClient.call() - generic или typed?

**Твой ответ**: "покажи примеры применения и дай сравнения рекомендации"

**Вариант A: Generic (flexible)**

```typescript
export class McpHttpClient {
  async call<T>(toolName: string, params: object): Promise<T> {
    const result = await this.sendWithRetry(toolName, params);
    // Caller ответственен за парсинг результата
    return result as T; // ⚠️ Type assertion
  }
}

// Использование
const result = await httpClient.call<{ sessionId: string; hasStory: boolean }>(
  "register_telegram",
  { telegramUserId: 123 }
);

// ✅ TypeScript знает тип result
console.log(result.sessionId); // ✅ Type-safe
```

**Плюсы**:
- ✅ Гибкость (можем вызывать с любым типом)
- ✅ Caller контролирует тип результата

**Минусы**:
- ❌ Type assertion (не проверяется runtime)
- ❌ Caller должен знать тип результата

---

**Вариант B: Typed (explicit)**

```typescript
export class McpHttpClient {
  async call(toolName: string, params: object): Promise<McpToolResult> {
    const result = await this.sendWithRetry(toolName, params);
    return result; // ✅ Возвращаем raw MCP result
  }
}

// Использование
const result = await httpClient.call("register_telegram", { telegramUserId: 123 });

// ❌ Caller должен парсить result
const content = validateToolContent(result);
const jsonData = parseToolContentAsJson(content.text);
const parsed = sessionResponseSchema.parse(jsonData); // ✅ Runtime validation
```

**Плюсы**:
- ✅ Type-safe (возвращаем известный тип)
- ✅ Caller парсит результат явно (видно ЧТО происходит)
- ✅ Runtime validation (Zod schema)

**Минусы**:
- ⚠️ Verbose (caller должен парсить каждый раз)

---

**Вариант C: Hybrid (typed + helpers)**

```typescript
export class McpHttpClient {
  // Базовый метод (typed)
  async call(toolName: string, params: object): Promise<McpToolResult> {
    return await this.sendWithRetry(toolName, params);
  }

  // Helper с generic (для удобства)
  async callTyped<T>(
    toolName: string,
    params: object,
    schema: z.ZodType<T>
  ): Promise<T> {
    const result = await this.call(toolName, params);
    const content = validateToolContent(result);
    const jsonData = parseToolContentAsJson(content.text);
    return schema.parse(jsonData); // ✅ Runtime validation
  }
}

// Использование
const result = await httpClient.callTyped(
  "register_telegram",
  { telegramUserId: 123 },
  sessionResponseSchema // ✅ Zod schema
);

// ✅ TypeScript знает тип + runtime validation
console.log(result.sessionId); // ✅ Type-safe
```

**Плюсы**:
- ✅ Гибкость (можем использовать call или callTyped)
- ✅ Type-safe + runtime validation
- ✅ DRY (парсинг в одном месте)

**Минусы**:
- ⚠️ Больше методов (два способа вызова)

---

**Рекомендация**: **Вариант C (hybrid)** ✅

**Почему**:
1. ✅ call() - для low-level доступа (когда нужен raw result)
2. ✅ callTyped() - для high-level (с валидацией)
3. ✅ Best of both worlds

**Пример применения**:

```typescript
// SessionManager использует callTyped
export class SessionManager {
  async refresh(ctx: BotContext, userId: number): Promise<void> {
    const parsed = await this.httpClient.callTyped(
      "register_telegram",
      { telegramUserId: userId, ... },
      sessionResponseSchema // ✅ Runtime validation
    );

    ctx.session.sessionId = parsed.sessionId; // ✅ Type-safe
  }
}

// Для специальных случаев - call()
const rawResult = await httpClient.call("custom_tool", {});
// Обрабатываем raw result вручную
```

---

### 2.8 SessionManager vs SessionService vs SessionRepository?

**Твой ответ**: "сервис"

**Рекомендация**: **SessionService** ✅

**Почему**:
1. ✅ **Service** pattern = бизнес-логика (управление session lifecycle)
2. ❌ **Manager** - устаревший термин (из Java EE)
3. ❌ **Repository** - data access layer (для БД, не для session)

**Итоговый нейминг**:

```typescript
// services/session-service.ts
export class SessionService {
  constructor(private httpClient: McpHttpClient) {}

  async ensure(ctx: BotContext): Promise<void> { ... }
  async refresh(ctx: BotContext, userId: number): Promise<void> { ... }
}
```

---

### 2.9 McpHttpClient vs McpClient vs HttpMcpClient?

**Твой ответ**: "mcpclient"

**Рекомендация**: **McpClient** ✅

**Почему**:
1. ✅ Короче (McpClient vs McpHttpClient)
2. ✅ HTTP = детали реализации (можем поменять на WebSocket в будущем)
3. ✅ Соответствует паттерну (ApiClient, DbClient, ...)

**НО** если важно явно указать транспорт → **McpHttpClient**

**Итоговый нейминг**:

```typescript
// services/mcp-client.ts
export class McpClient {
  constructor(private baseUrl: string) {}

  async call(toolName: string, params: object): Promise<McpToolResult> { ... }
  async callTyped<T>(...): Promise<T> { ... }
}
```

---

### Итоговая Архитектура ООП

```typescript
// services/mcp-client.ts
export class McpClient {
  constructor(private baseUrl: string) {}

  async call(toolName: string, params: object): Promise<McpToolResult> {
    return await this.sendWithRetry(toolName, params);
  }

  async callTyped<T>(toolName: string, params: object, schema: z.ZodType<T>): Promise<T> {
    const result = await this.call(toolName, params);
    const content = validateToolContent(result);
    const jsonData = parseToolContentAsJson(content.text);
    return schema.parse(jsonData);
  }

  private async sendWithRetry(toolName: string, params: object): Promise<McpToolResult> {
    // retry logic + HTTP request
  }
}

// services/session-service.ts
export class SessionService {
  constructor(private httpClient: McpClient) {}

  async ensure(ctx: BotContext): Promise<void> {
    if (ctx.session.sessionId) return;

    const userId = ctx.from?.id;
    if (!userId) throw new Error("No user ID");

    await this.refresh(ctx, userId);
  }

  async refresh(ctx: BotContext, userId: number): Promise<void> {
    const parsed = await this.httpClient.callTyped(
      "register_telegram",
      {
        telegramUserId: userId,
        telegramUsername: ctx.from?.username,
        telegramFirstName: ctx.from?.first_name,
      },
      sessionResponseSchema
    );

    ctx.session.sessionId = parsed.sessionId;
    ctx.session.hasStory = parsed.hasStory;
    ctx.session.token = parsed.token;
  }
}

// index.ts
const mcpClient = new McpClient(env.FACADE_MCP_URL);
const sessionService = new SessionService(mcpClient);

const bot = createBot(env.TELEGRAM_BOT_TOKEN, {
  ...services,
  sessionService,
  mcpClient,
});

// types.ts
export type BotServices = {
  facadeMcpUrl: string;
  openaiApiKey: string;
  groqApiKey: string;
  botToken: string;
  formatterLlm: LlmConfig;
  sessionService: SessionService; // ✅ Добавляем классы
  mcpClient: McpClient;
};
```

---

## 3. Type Safety Issue - Optional vs Non-null Assertion

### Твои вопросы

1. "3.1 от 3.3 чем отличаются?"
2. "и непонятно мы должны ли здесь бросать исключение? как обрабатывать ошибку и где?"

### Решения из REFACTORING-ANSWERS.md

**Решение 1.1**: Optional + Type Narrowing Helper (assertServices)
**Решение 1.3**: Optional + Assertion в bot.ts (guard middleware + `!`)

### Разница между 1.1 и 1.3

#### Решение 1.1 (assertServices)

```typescript
// utils/guards.ts
export function assertServices(ctx: BotContext): asserts ctx is BotContext & { services: BotServices } {
  if (!ctx.services) {
    throw new Error("Services not initialized"); // ❌ Бросаем исключение
  }
}

// handlers/by-target.ts
export async function handleByTarget(ctx: BotContext): Promise<void> {
  assertServices(ctx); // ✅ КАЖДЫЙ handler вызывает assert

  // После assert TS знает что services НЕ undefined
  const apiKey = ctx.services.openaiApiKey; // ✅ Работает БЕЗ !
}
```

**Где обрабатываем ошибку**: В bot.catch() (централизованно)

**Когда бросается**: Если handler вызван ДО services middleware (НЕ ДОЛЖНО произойти)

---

#### Решение 1.3 (guard middleware + non-null assertion)

```typescript
// bot.ts

// Guard middleware (ОДНА проверка для ВСЕХ handlers)
bot.use(async (ctx, next) => {
  if (!ctx.services) {
    // ❌ Это НЕ ДОЛЖНО произойти (services установлены выше)
    logger.error("Services not initialized in context");
    await ctx.reply("Internal error. Please try /start");
    return; // ❌ Блокируем дальнейшее выполнение
  }

  await next(); // ✅ Пропускаем дальше ТОЛЬКО если services есть
});

// handlers/by-target.ts
export async function handleByTarget(ctx: BotContext): Promise<void> {
  const apiKey = ctx.services!.openaiApiKey; // ✅ Non-null assertion (!)
}
```

**Где обрабатываем ошибку**: В guard middleware (сразу reply пользователю)

**Когда показывается**: Если services НЕ установлены (НЕ ДОЛЖНО произойти)

---

### Сравнение 1.1 vs 1.3

| Критерий | 1.1 (assertServices) | 1.3 (guard + !) |
|----------|---------------------|----------------|
| **Где проверка** | В каждом handler | В guard middleware (один раз) |
| **Обработка ошибки** | throw → bot.catch() | reply пользователю напрямую |
| **Type-safe** | ✅ ДА (type narrowing) | ❌ НЕТ (non-null assertion) |
| **Шаблонный код** | ⚠️ assertServices(ctx) в каждом handler | ✅ Только ! в handlers |

---

### Должны ли бросать исключение?

**Нет, не нужно бросать** ✅

**Почему**:
1. Это **конфигурационная ошибка** (services не установлены)
2. **НЕ штатная ситуация** (не должна произойти в production)
3. Лучше **fail-fast** → reply пользователю сразу (guard middleware)

**Рекомендация**: **Решение 1.3 (guard middleware)** ✅

```typescript
// bot.ts

bot.use(async (ctx, next) => {
  ctx.services = services; // ✅ Устанавливаем services
  await next();
});

bot.use(async (ctx, next) => {
  if (!ctx.services) {
    logger.error("Services not initialized"); // ⚠️ Логируем (это баг!)
    await ctx.reply("Internal error. Please try /start");
    return; // ❌ Блокируем
  }

  await next(); // ✅ Пропускаем только если services есть
});

// Все handlers ПОСЛЕ guard
bot.use(storyRequiredGuard);
bot.command("start", handleStart);
// ...
```

**Где обрабатываем**: Guard middleware → reply пользователю напрямую
**НЕ бросаем исключение**: fail-fast вместо exception handling

---

## 4. Nullable Approach - Кейсы и Реакции

### Твой подход

> "давай разделим все ошибки по типам наших реакций. Кейс с ошибкой и наша реакция (варианты + сравнения + рекомендация). мне непонятно как мы сейчас собираемся и где обрабатывать невалидные значения. Не хотелось бы иметь фолбеки, пропускать дальше ошибочные данные."

### Классификация ошибок

#### Критические (MUST throw)

**Когда**: Невалидные данные = баг ИЛИ невозможно продолжить

**Наша реакция**: Бросаем исключение → показываем generic error пользователю

**Примеры**:
- MCP вернул пустой content
- MCP вернул не JSON (но мы ожидаем JSON)
- MCP вернул JSON без обязательного поля

---

#### Опциональные (nullable OK)

**Когда**: Отсутствие данных = штатная ситуация

**Наша реакция**: Возвращаем null → caller обрабатывает (fallback)

**Примеры**:
- Formatter получил plain text (не JSON) → показываем raw text

---

### Кейсы с parseJsonContent

#### Кейс 1: callbacks.ts - Парсинг cold_start COMPLETED

**Контекст**: Пользователь нажал "Подтвердить" → cold_start завершён

**Что ожидаем**: `{ phase: "COMPLETED", message: "История сохранена!" }`

**Что может пойти не так**:
1. MCP вернул пустой content → extractTextContent → null
2. MCP вернул не JSON → JSON.parse fail → null
3. MCP вернул JSON без `phase` → data.phase = undefined

**Штатная ситуация?** ❌ НЕТ (критическая ошибка)

**Текущий код**:
```typescript
const data = parseJsonContent<Record<string, unknown>>(result);

if (data && data.phase === "COMPLETED" && typeof data.message === "string") {
  // Success path
} else {
  // Fallback - показываем "story-confirmed"
}
```

**Проблема**: Silent fail (если data = null, показываем generic "story-confirmed")

---

**ПРАВИЛЬНЫЙ подход** (throwing):

```typescript
// mcp-utils.ts (изменить на throwing)
export function parseJsonContent<T>(result: McpToolResult): T {
  const text = extractTextContent(result);
  if (!text) {
    throw new McpClientError("MCP result has no text content"); // ❌ Критическая ошибка
  }

  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new McpClientError("Failed to parse JSON from MCP result", error); // ❌ Критическая ошибка
  }
}

// callbacks.ts (упрощаем)
export async function handleApproveCallback(ctx: BotContext): Promise<void> {
  await ctx.answerCallbackQuery({ text: ctx.t("callback-processing") });

  // ✅ Если parseJsonContent fail → throw → bot.catch() → показываем generic error
  const result = await callTool(ctx, "cold_start", { message: "да" });
  const data = parseJsonContent<Record<string, unknown>>(result); // ❌ Может бросить

  if (data.phase === "COMPLETED" && typeof data.message === "string") {
    ctx.session.hasStory = true; // ✅ Прямая установка (sessionId гарантирован guard middleware)
    await ctx.editMessageText(ctx.t("story-approved", { message: data.message }));
  } else {
    // Другая фаза cold_start (COLLECTING, CONFIRMING)
    await ctx.editMessageText(ctx.t("story-confirmed"));
  }
}

// bot.ts (catch обрабатывает исключения)
bot.catch(async (error) => {
  const ctx = error.ctx;

  if (error.error instanceof McpClientError) {
    logger.error({ err: error.error }, "MCP client error");
    await ctx.reply(ctx.t("error-generic")); // ✅ Показываем пользователю
    return;
  }

  // ...
});
```

**Где обрабатываем**: bot.catch() → reply generic error пользователю
**Бросаем исключение**: parseJsonContent fail = критическая ошибка

---

#### Кейс 2: link.ts - Парсинг link_telegram

**Контекст**: Пользователь привязывает LibreChat аккаунт через `/link <token>`

**Что ожидаем**: `{ sessionId: "123", hasStory: false, token: "abc" }`

**Что может пойти не так**:
1. Token неверный → MCP бросает ошибку (ловится в handleLinkError)
2. MCP вернул пустой content → parseJsonContent → null

**Штатная ситуация?** ❌ НЕТ (критическая ошибка)

**Текущий код**:
```typescript
const data = parseJsonContent<LinkResponse>(result);
if (!data?.sessionId) return; // Silent fail
```

**Проблема**: Silent fail (ничего не показываем пользователю)

---

**ПРАВИЛЬНЫЙ подход** (throwing):

```typescript
// link.ts
async function callLinkTool(...): Promise<LinkResponse> {
  const result = await callTool(ctx, "link_telegram", {...});

  // ✅ parseJsonContent throws если fail
  const data = parseJsonContent<LinkResponse>(result); // ❌ Может бросить

  // Валидация обязательных полей
  if (!data.sessionId) {
    throw new McpClientError("No sessionId in link response"); // ❌ Критическая ошибка
  }

  return data;
}

// bot.catch() обработает исключение
```

**Где обрабатываем**: bot.catch() → reply generic error
**Бросаем исключение**: parseJsonContent fail ИЛИ нет sessionId = критическая ошибка

---

#### Кейс 3: formatters/story.ts - Форматирование cold_start фаз

**Контекст**: Форматирование ответа cold_start агента

**Что ожидаем**: `{ phase: "COLLECTING", message: "Расскажите подробнее..." }`

**Что может пойти не так**:
1. MCP вернул plain text (не JSON) → parseJsonContent → null
2. MCP вернул пустой content → extractTextContent → null

**Штатная ситуация?** ✅ ДА (агент может вернуть plain text)

**Текущий код**:
```typescript
export function formatColdStartResult(result: McpToolResult): string {
  const text = extractTextContent(result);
  if (!text) return "❌ Не удалось обработать ответ";

  const data = parseJsonContent<ColdStartData>(result);
  return data ? formatColdStartPhase(data, text) : text; // ✅ Fallback на raw text
}
```

**Это ПРАВИЛЬНО** ✅

**Почему**:
- Агент МОЖЕТ вернуть plain text (штатная ситуация)
- Fallback на raw text = показываем пользователю ответ агента
- Не критическая ошибка

---

**НО**: parseJsonContent должен throw в других кейсах!

**Решение**: Два варианта функции

```typescript
// mcp-utils.ts

// Throwing version (для критических случаев)
export function parseJsonContent<T>(result: McpToolResult): T {
  const text = extractTextContent(result);
  if (!text) {
    throw new McpClientError("MCP result has no text content");
  }

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
```

**Использование**:

```typescript
// callbacks.ts (критическая ошибка)
const data = parseJsonContent<Record<string, unknown>>(result); // ❌ Throw if fail

// formatters/story.ts (optional)
const data = tryParseJsonContent<ColdStartData>(result); // ✅ null if fail
return data ? formatColdStartPhase(data, text) : text; // ✅ Fallback
```

---

### Итоговая Таблица Реакций

| Кейс | Штатная ситуация? | Функция | Реакция на ошибку |
|------|-------------------|---------|-------------------|
| **callbacks.ts** (cold_start COMPLETED) | ❌ НЕТ | parseJsonContent() | Throw → bot.catch() → generic error |
| **link.ts** (link_telegram) | ❌ НЕТ | parseJsonContent() | Throw → bot.catch() → generic error |
| **formatters/story.ts** (format result) | ✅ ДА | tryParseJsonContent() | null → fallback на raw text |

---

### Рекомендация

1. ✅ **parseJsonContent** → throwing (для критических случаев)
2. ✅ **tryParseJsonContent** → nullable (для optional случаев)
3. ✅ **Обрабатываем в bot.catch()** → reply generic error пользователю
4. ❌ **НЕТ фолбеков для критических данных** (не пропускаем ошибочные данные)

---

## 5. Layer Mixing - ООП Подход для Форматтера

### Твой вопрос

> "вариант С - ок, но если мы на ооп переходим, не стоит ли здесь пересмотреть варианты подхода?"

### Вариант C (из REFACTORING-ANSWERS.md)

Переименовать formatters/ → presenters/

**НО** в ООП контексте есть лучший вариант:

---

### Вариант D: Presenter Class (ООП)

```typescript
// presenters/search-presenter.ts

export class SearchPresenter {
  constructor(
    private llm: ChatOpenAI, // ✅ LLM как зависимость
  ) {}

  async formatSearchResult(
    rawJsonResult: string,
    languageCode: string
  ): Promise<string> {
    const languageMap: Record<string, string> = {
      ru: "Russian",
      en: "English",
      de: "German",
      fr: "French",
      es: "Spanish",
    };

    const language = languageMap[languageCode] ?? "English";

    const prompt = ChatPromptTemplate.fromMessages([
      ["system", "You are a helpful assistant..."],
      ["user", "Format this search result: {data}"],
    ]);

    const chain = prompt.pipe(this.llm);
    const response = await chain.invoke({
      data: rawJsonResult,
      language,
    });

    return response.content.toString().trim();
  }
}

// index.ts (создаём LLM один раз)
const formatterLlm = new ChatOpenAI({
  modelName: env.FORMATTER_LLM_MODEL,
  temperature: env.FORMATTER_LLM_TEMPERATURE,
  openAIApiKey: env.OPENAI_API_KEY,
});

const searchPresenter = new SearchPresenter(formatterLlm); // ✅ DI

const bot = createBot(env.TELEGRAM_BOT_TOKEN, {
  ...services,
  searchPresenter, // ✅ Передаём в services
});

// types.ts
export type BotServices = {
  // ...
  searchPresenter: SearchPresenter; // ✅ Добавляем presenter
};

// handlers/by-target.ts (использование)
export async function handleByTarget(ctx: BotContext): Promise<void> {
  // ...
  const result = await callTool(ctx, "search_by_target", searchParams);

  // ✅ Используем presenter из services
  const formatted = await ctx.services.searchPresenter.formatSearchResult(
    JSON.stringify(result),
    ctx.from?.language_code ?? "en"
  );

  await ctx.reply(formatted, { parse_mode: "Markdown" });
}
```

**Плюсы**:
- ✅ LLM создаётся ОДИН РАЗ (в index.ts)
- ✅ Presenter = класс (ООП стиль)
- ✅ Dependency Injection (LLM через конструктор)
- ✅ Легко тестировать (mock LLM)
- ✅ Инкапсуляция (LLM = private field)

**Минусы**:
- ⚠️ Больше boilerplate (класс вместо функции)

---

### Сравнение с Вариантом C (rename)

| Критерий | Вариант C (rename) | Вариант D (ООП class) |
|----------|-------------------|----------------------|
| **Стиль** | Функциональный | ООП |
| **LLM создание** | Каждый раз | Один раз (DI) |
| **Тестируемость** | Mock функцию | Mock класс (проще) |
| **Boilerplate** | ✅ Минимальный | ⚠️ Средний |

---

### Рекомендация

**Вариант D (Presenter Class)** ✅

**Почему**:
1. ✅ Соответствует ООП подходу (класс вместо функции)
2. ✅ LLM создаётся один раз (производительность)
3. ✅ Dependency Injection (явные зависимости)
4. ✅ Легко расширять (добавить методы в класс)

**Используем**: `presenters/search-presenter.ts` (класс) вместо `formatters/search.ts` (функция)

---

## 7. Error Handling - Детальный Разбор Кейсов

### Кейс 1: parseJsonContent

**Твой ответ**: "да, изменить на throwing. Но вопрос что дальше с исключением делать и где"

**Ответ**: Обрабатываем в **bot.catch()** (централизованно)

```typescript
// mcp-utils.ts (throwing version)
export function parseJsonContent<T>(result: McpToolResult): T {
  const text = extractTextContent(result);
  if (!text) {
    throw new McpClientError("MCP result has no text content");
  }

  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new McpClientError("Failed to parse JSON from MCP result", error);
  }
}

// callbacks.ts (используем)
export async function handleApproveCallback(ctx: BotContext): Promise<void> {
  const result = await callTool(ctx, "cold_start", { message: "да" });
  const data = parseJsonContent<Record<string, unknown>>(result); // ❌ Может throw

  // ...остальная логика
}

// bot.ts (обрабатываем исключение)
bot.catch(async (error) => {
  const ctx = error.ctx;

  // ✅ Обрабатываем McpClientError
  if (error.error instanceof McpClientError) {
    logger.error({ err: error.error }, "MCP client error");
    await ctx.reply(ctx.t("error-generic")); // ✅ Показываем пользователю
    return;
  }

  if (error.error instanceof BotError) {
    await ctx.reply(`❌ ${error.error.message}`);
    return;
  }

  logger.error({ err: error.error }, "Unhandled error");
  await ctx.reply(ctx.t("error-generic"));
});
```

**Где обрабатываем**: bot.catch() → reply generic error
**Что делаем**: Логируем ошибку + показываем пользователю "Произошла ошибка. Попробуйте ещё раз."

---

### Кейс 2: MySessionData.sessionId

**Твой вопрос**: "непонятно почему возможен второй кейс. мне непонятен кейс пользовательский когда это происходит и непонятно реально ли такое может произойти (уточни по коду фасада или текущего редиса?)"

**Контекст**: Два случая когда sessionId пустой:
1. Первое сообщение пользователя → session создаётся с sessionId: ""
2. Session истекла в Redis → session пересоздаётся с sessionId: ""

**Разберу код**:

#### Первое сообщение

```typescript
// bot.ts

bot.use(
  session({
    initial: (): MySessionData => ({
      sessionId: "",  // ✅ Первое сообщение → sessionId пустой
      hasStory: false,
      token: "",
    }),
    storage,
  }),
);
```

**Что происходит**:
1. Пользователь отправляет первое сообщение (например, /start)
2. Grammy session plugin создаёт новую session с initial()
3. sessionId = "" (uninitialised)
4. Handler вызывает ensureSession → register_telegram → sessionId заполняется

**Это штатная ситуация** ✅

---

#### Session истекла в Redis

**Что происходит**:
1. Пользователь активен → session в Redis (с sessionId)
2. Пользователь неактивен 30 дней → Redis TTL истекает → session удаляется
3. Пользователь снова пишет → Grammy session plugin НЕ находит session в Redis
4. Grammy создаёт новую session с initial() → sessionId = ""

**Реально ли это?** ✅ ДА

**Код Redis storage**:

```typescript
// @grammyjs/storage-redis

export class RedisAdapter<T> implements StorageAdapter<T> {
  async read(key: string): Promise<T | undefined> {
    const value = await this.instance.get(key); // ❌ Может вернуть null (TTL истёк)
    return value ? JSON.parse(value) : undefined;
  }
}

// grammy session plugin
bot.use(session({
  initial: () => ({ sessionId: "" }),
  storage,
}));

// Внутри session middleware
const sessionData = await storage.read(sessionKey);

if (!sessionData) {
  // ✅ Session не найдена → создаём initial
  ctx.session = initial();
}
```

**Вывод**: Session истекла в Redis = **штатная ситуация** ✅

---

**Решение**: Discriminated Union + Guard Middleware

```typescript
// types.ts

export type MySessionData =
  | { status: "uninitialised" }
  | { status: "initialised"; sessionId: string; hasStory: boolean; token: string };

// bot.ts

bot.use(
  session({
    initial: (): MySessionData => ({
      status: "uninitialised", // ✅ Честная типизация
    }),
    storage,
  }),
);

// Guard middleware (автоматически инициализируем session)
bot.use(async (ctx, next) => {
  if (ctx.session.status === "uninitialised") {
    await ctx.services.sessionService.initialize(ctx); // ✅ register_telegram
  }

  await next(); // ✅ Пропускаем только если status = "initialised"
});

// services/session-service.ts

export class SessionService {
  async initialize(ctx: BotContext): Promise<void> {
    const userId = ctx.from?.id;
    if (!userId) throw new Error("No user ID");

    const parsed = await this.httpClient.callTyped(
      "register_telegram",
      {
        telegramUserId: userId,
        telegramUsername: ctx.from?.username,
        telegramFirstName: ctx.from?.first_name,
      },
      sessionResponseSchema
    );

    // ✅ Изменяем тип session
    ctx.session = {
      status: "initialised",
      sessionId: parsed.sessionId,
      hasStory: parsed.hasStory,
      token: parsed.token,
    };
  }
}

// handlers/by-target.ts

export async function handleByTarget(ctx: BotContext): Promise<void> {
  // ✅ TS знает что session.status = "initialised" (guard проверил)
  if (ctx.session.status === "uninitialised") {
    throw new Error("Session not initialized"); // ❌ НЕ ДОЛЖНО произойти
  }

  const sessionId = ctx.session.sessionId; // ✅ Type-safe (sessionId доступен)
}
```

**Плюсы**:
- ✅ Type-safe (TS знает когда sessionId доступен)
- ✅ Guard middleware автоматически инициализирует session
- ✅ Handlers получают initialised session

---

### Кейс 3: updateHasStory

**Твой вопрос**: "системно не могу понять о каком кейсе идет речь. Что мы делаем по воркфлоу и кодом когда она протухает? от этого не знаю что ответить на твой вопрос"

**Юзерфлоу**:

```
1. User: /story
   ↓
2. Bot: "Расскажите о вашей карьере..."
   ↓ (пользователь пишет историю)
3. User: "Я работал Senior Developer в Google..."
   ↓
4. Bot: [показывает инлайн клавиатуру] "Подтвердить / Редактировать / Отменить"
   ↓ (⏰ ВРЕМЯ ПРОХОДИТ - пользователь ушёл пить кофе 30 дней)
5. ⏰ Redis TTL истекает → session удаляется
   ↓
6. User нажимает "Подтвердить" (через 30 дней!)
   ↓
7. handleApproveCallback вызывается
   ↓
8. ctx.session = initial() (session пересоздана с sessionId: "")
   ↓
9. updateHasStory(ctx, true) → проверяет sessionId
   ↓
10. sessionId = "" → return false
    ↓
11. Bot: "Session expired. Please try /story again"
```

**Что происходит когда протухает**:
1. Redis удаляет session (TTL истёк)
2. Grammy создаёт новую session с initial()
3. sessionId = "" (uninitialised)
4. updateHasStory проверяет sessionId → false
5. Показываем пользователю "session expired"

---

**НО**: С discriminated union + guard middleware **это НЕ МОЖЕТ произойти**!

**Почему**:

```typescript
// bot.ts

// Guard middleware для callbacks
bot.callbackQuery("decision:approve", async (ctx, next) => {
  // ✅ Проверяем session ПЕРЕД handler
  if (ctx.session.status === "uninitialised") {
    await ctx.answerCallbackQuery({ text: "Session expired" });
    await ctx.editMessageText(ctx.t("session-expired"));
    return; // ❌ Блокируем
  }

  await next(); // ✅ Пропускаем только если initialised
});

// callbacks.ts

export async function handleApproveCallback(ctx: BotContext): Promise<void> {
  // ✅ session.status = "initialised" ГАРАНТИРОВАННО (guard проверил)

  const result = await callTool(ctx, "cold_start", { message: "да" });
  const data = parseJsonContent(result);

  if (data.phase === "COMPLETED") {
    ctx.session.hasStory = true; // ✅ Прямая установка (sessionId ЕСТЬ)
    await ctx.editMessageText(ctx.t("story-approved", { message: data.message }));
  }
}
```

**Вывод**: updateHasStory **НЕ НУЖНА** (inline в handler + guard middleware)

---

## 8. updateHasStory - Обратная Связь от Фасада

**Твой ответ**: "Отлично, доверяем фасаду, вопрос снимается"

**Решение**: Facade возвращает hasStory в ответе cold_start

```typescript
// Facade MCP Server - cold_start tool

export async function coldStart(params: { message: string; sessionId: string }): Promise<{
  phase: string;
  message: string;
  hasStory?: boolean; // ✅ Добавляем флаг
}> {
  // ...обработка

  if (phase === "COMPLETED") {
    // ✅ Проверяем что истории действительно сохранены в Neo4j
    const session = await getSession(params.sessionId);
    const contextsCount = await db.query(
      "MATCH (u:User {user_id: $userId})-[:HAS_CONTEXT]->(c:Context) RETURN count(c) as count",
      { userId: session.userId }
    );

    return {
      phase: "COMPLETED",
      message: "История сохранена!",
      hasStory: contextsCount.records[0].get("count") > 0, // ✅ Проверено в БД
    };
  }

  return { phase, message };
}

// Telegram bot - callbacks.ts

export async function handleApproveCallback(ctx: BotContext): Promise<void> {
  const result = await callTool(ctx, "cold_start", { message: "да" });
  const data = parseJsonContent<{
    phase: string;
    message: string;
    hasStory?: boolean;
  }>(result);

  if (data.phase === "COMPLETED") {
    ctx.session.hasStory = data.hasStory ?? false; // ✅ Берём из ответа фасада
    await ctx.editMessageText(ctx.t("story-approved", { message: data.message }));
  }
}
```

**Плюсы**:
- ✅ Guarantee (фасад проверил БД)
- ✅ Нет дополнительных запросов (один round-trip)
- ✅ Логично (фасад знает state, бот просто отображает)

---

## Итоговая Таблица Решений (ООП Подход)

| # | Вопрос | Решение ООП |
|---|--------|------------|
| 1 | Единый словарь | ✅ SEARCH_CONFIG (const as const) |
| 2.1 | Где создавать классы | ✅ index.ts (при старте) |
| 2.2 | Зависимости между классами | ✅ Композиция (SessionService uses McpClient) |
| 2.3 | Lifetime | ✅ Singleton (один экземпляр на бота) |
| 2.4 | Мутация ctx.session | ✅ Да (ООП стиль) |
| 2.5 | Owner session | ✅ ctx.session (SessionService = helper) |
| 2.6 | Принимать BotContext | ✅ Да (ООП стиль) |
| 2.7 | Generic или typed | ✅ Hybrid (call + callTyped) |
| 2.8 | Нейминг Manager | ✅ SessionService |
| 2.9 | Нейминг HttpClient | ✅ McpClient |
| 3 | Type safety | ✅ Guard middleware (не бросаем исключение) |
| 4 | parseJsonContent | ✅ Throwing + tryParseJsonContent (nullable) |
| 5 | LLM в форматтере | ✅ SearchPresenter class (ООП) |
| 7.1 | parseJsonContent ошибка | ✅ bot.catch() → generic error |
| 7.2 | sessionId пустой | ✅ Discriminated union + guard middleware |
| 7.3 | updateHasStory | ✅ Inline + guard middleware |
| 8 | Feedback от фасада | ✅ cold_start возвращает hasStory |

---

## Следующие Шаги

1. ✅ Согласовать итоговые решения
2. ✅ Создать классы (McpClient, SessionService, SearchPresenter)
3. ✅ Обновить types.ts (discriminated union для MySessionData)
4. ✅ Добавить guard middleware
5. ✅ Изменить parseJsonContent на throwing + добавить tryParseJsonContent
6. ✅ Обновить Facade MCP Server (cold_start возвращает hasStory)
7. ✅ Запустить lint + tsc + tests
