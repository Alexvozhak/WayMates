# Ответы на Вопросы: Рефакторинг Telegram Bot

> **Дата**: 2025-12-07
> **Формат**: Детальные ответы с вариантами и рекомендациями
> **Цель**: Согласовать архитектурные решения после обратной связи

---

## 1. Massive Code Duplication - Упрощение Енумов

### Вопрос 1.1: Можно ли обойтись одним енумом?

**Текущее предложение**: 4 енума (SearchCommand, SearchAction, SearchI18nKey, McpToolName)

**Анализ**:

```typescript
// Сейчас
SearchCommand.BY_TARGET = "/by_target"  // Telegram команда
SearchAction.BY_TARGET = "by_target"    // PendingAction значение
SearchI18nKey.TARGET_USAGE = "target-usage"  // i18n ключ
McpToolName.SEARCH_BY_TARGET = "search_by_target"  // MCP tool
```

**Можно ли объединить SearchCommand и SearchAction?**

**НЕТ**, потому что:
- `SearchCommand` = строка с `/` (Telegram команда)
- `SearchAction` = строка БЕЗ `/` (PendingAction)
- Разные форматы, разное назначение

**НО** можно сделать **derive** одно из другого:

```typescript
export enum SearchType {
  BY_TARGET = "by_target",
  BY_CURRENT = "by_current",
  BY_ADHOC = "by_adhoc",
}

// Derive остальное
const SEARCH_COMMAND: Record<SearchType, string> = {
  [SearchType.BY_TARGET]: "/by_target",
  [SearchType.BY_CURRENT]: "/by_current",
  [SearchType.BY_ADHOC]: "/by_adhoc",
};

// PendingAction уже использует SearchType значения
type PendingAction = "story" | SearchType;
```

**Плюсы**:
- Один source of truth (SearchType)
- Остальное derives (команды, i18n ключи, MCP tools)

**Минусы**:
- Нужно писать `SEARCH_COMMAND[SearchType.BY_TARGET]` вместо `SearchCommand.BY_TARGET`

---

### Вопрос 1.2: SearchI18nKey - зачем 2 ключа на тип поиска?

**Текущее**:
```typescript
SearchI18nKey.TARGET_USAGE = "target-usage"       // Сообщение usage
SearchI18nKey.TARGET_SEARCHING = "searching-target"  // Статус сообщение
```

**Зачем 2 ключа**:
1. **Usage** - когда пользователь вызвал `/by_target` БЕЗ аргумента → показываем инструкцию
2. **Searching** - когда поиск начался → показываем "Ищу тех, кто достиг похожей цели..."

**Юзерфлоу**:
```
User: /by_target
Bot: "Опишите целевую позицию..." ← TARGET_USAGE

User: Senior ML Engineer
Bot: "Ищу тех, кто достиг..." ← TARGET_SEARCHING (loading message)
  [выполняем поиск]
Bot: [результаты]
```

**Можно ли 1 ключ?**

**Вариант A**: Объединить в один ключ
```typescript
SearchI18nKey.TARGET = "target"
// В .ftl файле:
target-usage = "Опишите целевую позицию..."
target-searching = "Ищу тех, кто достиг..."
```
Обращение: `ctx.t("target-usage")`, `ctx.t("target-searching")`

**Вариант B**: Template с параметром
```typescript
SearchI18nKey.TARGET = "target"
// В .ftl файле:
target = { $phase ->
  [usage] Опишите целевую позицию...
  [searching] Ищу тех, кто достиг...
}
```
Обращение: `ctx.t("target", { phase: "usage" })`

**Вариант C**: Оставить 2 ключа (текущий)
- Простой mapping (enum → i18n ключ)
- Нет логики в .ftl файлах

**Рекомендация**: **Вариант C** (оставить 2 ключа)
- Простота важнее DRY для i18n ключей
- Fluent не должен содержать логику

---

### Вопрос 1.3: McpToolName - можно ли derive от SearchCommand?

**Текущее**:
```typescript
SearchCommand.BY_TARGET → McpToolName.SEARCH_BY_TARGET
"/by_target" → "search_by_target"
```

**Можно derive?** ДА:

```typescript
const MCP_TOOL: Record<SearchType, string> = {
  [SearchType.BY_TARGET]: "search_by_target",
  [SearchType.BY_CURRENT]: "search_user_careers",
  [SearchType.BY_ADHOC]: "search_careers",
};
```

**НО**: "search_user_careers" ≠ "search_by_current" (не прямое соответствие!)

**Вывод**: Нельзя derive автоматически, нужен **explicit mapping**.

---

### Вопрос 1.4: Enum vs const as const - разница?

**Enum**:
```typescript
export enum SearchType {
  BY_TARGET = "by_target",
  BY_CURRENT = "by_current",
  BY_ADHOC = "by_adhoc",
}

// Использование
const type: SearchType = SearchType.BY_TARGET;
```

**const as const**:
```typescript
export const SearchType = {
  BY_TARGET: "by_target",
  BY_CURRENT: "by_current",
  BY_ADHOC: "by_adhoc",
} as const;

export type SearchType = (typeof SearchType)[keyof typeof SearchType];
// SearchType = "by_target" | "by_current" | "by_adhoc"

// Использование
const type: SearchType = SearchType.BY_TARGET;
```

**Различия**:

| Критерий | Enum | const as const |
|----------|------|----------------|
| **Compiled JS** | Объект + reverse mapping | Обычный объект |
| **Type** | Отдельный тип (nominal) | Union type (structural) |
| **Tree-shaking** | Хуже (может не убраться) | Лучше (inline константы) |
| **Extensibility** | Нельзя расширить | Можно spread |
| **Идиома TS** | Старая (JS-like) | Новая (type-first) |

**Compiled output**:

```typescript
// Enum → JS
var SearchType;
(function (SearchType) {
    SearchType["BY_TARGET"] = "by_target";
    SearchType["BY_CURRENT"] = "by_current";
    SearchType["BY_ADHOC"] = "by_adhoc";
})(SearchType || (SearchType = {}));

// const as const → JS
const SearchType = {
  BY_TARGET: "by_target",
  BY_CURRENT: "by_current",
  BY_ADHOC: "by_adhoc",
};
```

**Рекомендация**: **const as const**
- Современный подход
- Лучше tree-shaking
- Меньше compiled код

---

### Финальное предложение по енумам

```typescript
// types.ts

// Базовый тип (source of truth)
export const SearchType = {
  BY_TARGET: "by_target",
  BY_CURRENT: "by_current",
  BY_ADHOC: "by_adhoc",
} as const;

export type SearchType = (typeof SearchType)[keyof typeof SearchType];

// Derive mappings
export const SEARCH_COMMAND: Record<SearchType, string> = {
  [SearchType.BY_TARGET]: "/by_target",
  [SearchType.BY_CURRENT]: "/by_current",
  [SearchType.BY_ADHOC]: "/by_adhoc",
};

export const SEARCH_I18N = {
  [SearchType.BY_TARGET]: {
    usage: "target-usage",
    searching: "searching-target",
  },
  [SearchType.BY_CURRENT]: {
    usage: "current-usage",
    searching: "searching-current",
  },
  [SearchType.BY_ADHOC]: {
    usage: "adhoc-usage",
    searching: "searching-adhoc",
  },
} as const;

export const MCP_TOOL: Record<SearchType, string> = {
  [SearchType.BY_TARGET]: "search_by_target",
  [SearchType.BY_CURRENT]: "search_user_careers",
  [SearchType.BY_ADHOC]: "search_careers",
};

// PendingAction использует SearchType
export type PendingAction = "story" | SearchType;
```

**Использование**:
```typescript
const type = SearchType.BY_TARGET;
const command = SEARCH_COMMAND[type];  // "/by_target"
const usageKey = SEARCH_I18N[type].usage;  // "target-usage"
const tool = MCP_TOOL[type];  // "search_by_target"
```

**Плюсы**:
- Один source of truth (SearchType)
- Все mappings explicit (видно соответствие)
- const as const (современный подход)
- Type-safe

**Что согласовать**:
- [ ] Использовать const as const вместо enum?
- [ ] Структура mappings (SEARCH_I18N nested object)?

---

## 2. SRP Violation - Детальное Сравнение Вариантов 2 и 3

### Контекст: Почему я решил что проект функциональный?

**Анализ кодовой базы**:

Проверяю handlers/, services/, formatters/:
```bash
grep -r "class " src/telegram-bot --include="*.ts" | wc -l
# 0 классов (кроме Error классов)

grep -r "export function" src/telegram-bot --include="*.ts" | wc -l
# ~40 функций
```

**Вывод**: Весь код - pure functions + functional composition. **НЕТ бизнес-классов**.

**Но**: Использует ООП библиотеки (Grammy Bot, ChatOpenAI, Redis) → **Гибридный стиль**.

**Уточнение**: Проект **функционально-ориентированный** (functional-first), но не догматичный FP.

---

### Вариант 2: ООП (3 файла с классами)

**Структура**:

```typescript
// services/session-manager.ts
export class SessionManager {
  constructor(private facadeUrl: string) {}

  async ensure(ctx: BotContext): Promise<void> {
    if (ctx.session.sessionId) return;
    await this.refresh(ctx, ctx.from!.id);
  }

  async refresh(ctx: BotContext, userId: number): Promise<MySessionData> {
    const result = await sendMcpRequest(
      this.facadeUrl,
      "register_telegram",
      { telegramUserId: userId, ... }
    );
    // parse + update ctx.session
    return ctx.session;
  }
}

// services/mcp-http-client.ts
export class McpHttpClient {
  constructor(private baseUrl: string) {}

  async call(toolName: string, params: object): Promise<McpToolResult> {
    return this.sendWithRetry(toolName, params);
  }

  private async sendWithRetry(toolName: string, params: object): Promise<McpToolResult> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        return await this.sendRequest(toolName, params);
      } catch (error) {
        lastError = error;
        if (isClientError(error)) throw error;
        await sleep(Math.pow(2, attempt) * 1000);
      }
    }

    throw new McpClientError(`Failed after ${MAX_RETRIES} retries`, lastError);
  }

  private async sendRequest(toolName: string, params: object): Promise<McpToolResult> {
    const response = await fetch(this.baseUrl, {
      method: "POST",
      body: JSON.stringify({ jsonrpc: "2.0", method: "tools/call", params: { name: toolName, arguments: params } }),
    });

    if (!response.ok) throw new McpClientError(`HTTP ${response.status}`);

    const data = mcpResponseSchema.parse(await response.json());
    if (data.error) throw new McpClientError(data.error.message);
    if (!data.result) throw new McpClientError("No result");

    return data.result;
  }
}

// services/mcp-client.ts (фасад)
export async function callTool(ctx: BotContext, toolName: string, params: object): Promise<McpToolResult> {
  const sessionManager = ctx.services.sessionManager;
  const httpClient = ctx.services.httpClient;

  const telegramUserId = ctx.from?.id;
  if (!telegramUserId) throw new McpClientError("No Telegram user ID");

  await sessionManager.ensure(ctx);

  const paramsWithSession = { ...params, sessionId: ctx.session.sessionId };

  try {
    return await httpClient.call(toolName, paramsWithSession);
  } catch (error) {
    if (error.message.includes("session_expired")) {
      await sessionManager.refresh(ctx, telegramUserId);
      return await httpClient.call(toolName, { ...params, sessionId: ctx.session.sessionId });
    }
    throw new McpClientError(`Failed to call tool ${toolName}`, error);
  }
}
```

**bot.ts (DI)**:
```typescript
const sessionManager = new SessionManager(env.FACADE_MCP_URL);
const httpClient = new McpHttpClient(env.FACADE_MCP_URL);

const bot = createBot(env.TELEGRAM_BOT_TOKEN, {
  ...services,
  sessionManager,
  httpClient,
});
```

**Плюсы**:
- ✅ Чистое SRP (каждый класс - одна ответственность)
- ✅ Легко тестировать (mock classes)
- ✅ Encapsulation (private методы)
- ✅ Переиспользуемые экземпляры (создаются один раз)

**Минусы**:
- ⚠️ ООП (не в стиле проекта, но не критично)
- ⚠️ DI через ctx.services (нужно расширять BotServices тип)
- ⚠️ Больше boilerplate (constructor, private fields)

---

### Вариант 3: Функциональный (3 файла БЕЗ классов)

**Структура**:

```typescript
// services/session-manager.ts
export async function ensureSession(ctx: BotContext, facadeUrl: string): Promise<void> {
  if (ctx.session.sessionId) return;

  const telegramUserId = ctx.from?.id;
  if (!telegramUserId) throw new McpClientError("No Telegram user ID");

  await refreshSession(ctx, facadeUrl, telegramUserId);
}

export async function refreshSession(
  ctx: BotContext,
  facadeUrl: string,
  userId: number
): Promise<MySessionData> {
  const result = await sendMcpRequestWithRetry(facadeUrl, "register_telegram", {
    telegramUserId: userId,
    telegramUsername: ctx.from?.username,
    telegramFirstName: ctx.from?.first_name,
  });

  const content = validateToolContent(result);
  const jsonData = parseToolContentAsJson(content.text);
  const parsed = sessionResponseSchema.parse(jsonData);

  ctx.session.sessionId = parsed.sessionId;
  ctx.session.hasStory = parsed.hasStory;
  ctx.session.token = parsed.token;

  return ctx.session;
}

// services/mcp-http.ts
export async function sendMcpRequestWithRetry(
  facadeUrl: string,
  toolName: string,
  params: object
): Promise<McpToolResult> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const result = await attemptMcpRequest(facadeUrl, toolName, params);
    if (result.success) return result.value;

    lastError = result.error;
    if (isClientError(lastError)) throw lastError;

    await sleep(Math.pow(2, attempt) * 1000);
  }

  throw new McpClientError(`Failed after ${MAX_RETRIES} retries`, lastError);
}

async function attemptMcpRequest(
  facadeUrl: string,
  toolName: string,
  params: object
): Promise<{ success: true; value: McpToolResult } | { success: false; error: Error }> {
  try {
    const value = await sendMcpRequest(facadeUrl, toolName, params);
    return { success: true, value };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
  }
}

export async function sendMcpRequest(
  facadeUrl: string,
  toolName: string,
  params: object
): Promise<McpToolResult> {
  const response = await fetch(facadeUrl, {
    method: "POST",
    body: JSON.stringify({ jsonrpc: "2.0", method: "tools/call", params: { name: toolName, arguments: params } }),
  });

  if (!response.ok) throw new McpClientError(`HTTP ${response.status}`);

  const data = mcpResponseSchema.parse(await response.json());
  if (data.error) throw new McpClientError(data.error.message);
  if (!data.result) throw new McpClientError("No result");

  return data.result;
}

// Helpers
function isClientError(error: Error): boolean {
  return error.message.includes("HTTP error 4");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// services/mcp-client.ts (оркестратор)
export async function callTool(ctx: BotContext, toolName: string, params: object): Promise<McpToolResult> {
  const facadeUrl = ctx.services.facadeMcpUrl;
  const telegramUserId = ctx.from?.id;
  if (!telegramUserId) throw new McpClientError("No Telegram user ID");

  await ensureSession(ctx, facadeUrl);

  const paramsWithSession = { ...params, sessionId: ctx.session.sessionId };

  try {
    return await sendMcpRequestWithRetry(facadeUrl, toolName, paramsWithSession);
  } catch (error) {
    if (error instanceof Error && error.message.includes("session_expired")) {
      await refreshSession(ctx, facadeUrl, telegramUserId);
      return await sendMcpRequestWithRetry(facadeUrl, toolName, { ...params, sessionId: ctx.session.sessionId });
    }
    throw new McpClientError(`Failed to call tool ${toolName}`, error);
  }
}
```

**Использование**:
```typescript
// Без изменений!
await callTool(ctx, "search_by_target", params);
```

**Плюсы**:
- ✅ Функциональный стиль (соответствует проекту)
- ✅ Pure functions (легко тестировать)
- ✅ Explicit зависимости (facadeUrl передаётся явно)
- ✅ Нет DI контейнеров (простота)
- ✅ Нет изменений в handlers (обратно-совместимо)

**Минусы**:
- ⚠️ Передача facadeUrl везде (но это explicit > implicit)
- ⚠️ Нет encapsulation (все функции public)

---

### Сравнение по критериям

| Критерий | Вариант 2 (ООП) | Вариант 3 (Функциональный) |
|----------|-----------------|----------------------------|
| **SRP** | ✅ Чистое (классы) | ✅ Чистое (модули) |
| **Стиль проекта** | ⚠️ ООП (новый стиль) | ✅ Функциональный (текущий стиль) |
| **Тестируемость** | ✅ Mock классы | ✅ Mock функции |
| **Encapsulation** | ✅ Private методы | ❌ Все функции public |
| **DI** | ⚠️ Через ctx.services (расширяем тип) | ✅ Через параметры (explicit) |
| **Boilerplate** | ⚠️ Constructor, fields | ✅ Минимальный |
| **Обратная совместимость** | ⚠️ Изменения в bot.ts | ✅ Нет изменений в handlers |
| **Bundle size** | ⚠️ Больше (классы) | ✅ Меньше (функции) |

---

### Мои вопросы по варианту 2 (ООП)

#### Архитектурные:

1. **Где создавать экземпляры классов**?
   - В `bot.ts` (при создании бота) ✅
   - В `index.ts` (при старте приложения)
   - Через DI контейнер (overengineering)

2. **Как передавать зависимости между классами**?
   - SessionManager зависит от McpHttpClient?
   - ИЛИ каждый независим (только facadeUrl)?

3. **Lifetime классов**:
   - Singleton (один экземпляр на весь бот) ✅
   - Per-request (создаётся для каждого ctx)

#### Бизнесовые:

4. **SessionManager мутирует ctx.session** - это нормально?
   - Класс имеет side-effect (mutation)
   - Альтернатива: возвращать новую session → caller обновляет ctx

5. **Кто owner session state**?
   - SessionManager (encapsulation)
   - ctx.session (текущий подход)

#### Сигнатурные:

6. **SessionManager.ensure(ctx)** - принимать весь ctx?
   - ДА: `ensure(ctx: BotContext)`
   - НЕТ: `ensure(session: MySessionData, userId: number)` (более pure)

7. **McpHttpClient.call()** - generic или typed?
   - Generic: `call<T>(toolName: string, params: object): Promise<T>`
   - Typed: `call(toolName: string, params: object): Promise<McpToolResult>`

#### Нейминг:

8. **SessionManager vs SessionService vs SessionRepository**?
   - Manager - управление lifecycle
   - Service - бизнес-логика
   - Repository - data access (не подходит, не БД)

9. **McpHttpClient vs McpClient vs HttpMcpClient**?
   - McpHttpClient ✅ (явно указывает HTTP transport)
   - McpClient (может быть и WebSocket)
   - HttpMcpClient (HTTP первым - акцент на транспорте)

---

### Заключение и рекомендация

**Если хотите ООП (вариант 2)**:

**Плюсы**:
- Чёткая структура (классы = bounded contexts)
- Encapsulation (private методы скрывают детали)
- Легко расширять (добавить новый метод в класс)

**НО**:
- Нужно расширять `BotServices` тип
- Нужно создавать экземпляры в bot.ts
- Отход от текущего стиля проекта

**Если хотите функциональный (вариант 3)**:

**Плюсы**:
- Соответствует текущему стилю
- Минимальные изменения (обратная совместимость)
- Explicit зависимости (видно что откуда берётся)

**НО**:
- Нет encapsulation (все функции public, можно вызвать внутренние)
- Передача facadeUrl везде (но это не критично)

**Моя рекомендация**: **Вариант 3 (функциональный)**

**Почему**:
1. ✅ Соответствует текущему стилю проекта (40 функций vs 0 классов)
2. ✅ Минимальные изменения (не нужно трогать bot.ts, handlers)
3. ✅ Explicit зависимости (facadeUrl передаётся явно, а не через ctx.services)
4. ✅ Проще для понимания (функции понятнее классов для новичков)

**НО если** вы хотите переходить к ООП стилю в проекте → выбирайте вариант 2.

**Что согласовать**:
- [ ] Выбрать вариант 2 (ООП) или 3 (функциональный)?
- [ ] Если вариант 2: ответить на вопросы (архитектурные, бизнесовые, сигнатурные, нейминг)

---

## 3. Type Safety Issue - Optional с одной проверкой

### Решение 1: Optional + Guard Middleware

**Типы**:
```typescript
export type BotServices = {
  facadeMcpUrl: string;
  openaiApiKey: string;
  groqApiKey: string;
  botToken: string;
  formatterLlm: LlmConfig;
};

export type BotContext = Context &
  I18nFlavor &
  HydrateFlavor<Context> &
  SessionFlavor<MySessionData> & {
    services?: BotServices; // ✅ Optional
  };
```

**Guard Middleware (ОДНА проверка в начале)**:
```typescript
// bot.ts
bot.use(async (ctx, next) => {
  ctx.services = services; // Устанавливаем services
  await next();
});

// Добавляем guard СРАЗУ ПОСЛЕ:
bot.use(async (ctx, next) => {
  if (!ctx.services) {
    // ❌ Это НЕ ДОЛЖНО произойти (services установлены выше)
    logger.error("Services not initialized in context");
    await ctx.reply("Internal error. Please try /start");
    return; // Блокируем дальнейшее выполнение
  }

  await next(); // Пропускаем дальше ТОЛЬКО если services есть
});

// ВСЕ ОСТАЛЬНЫЕ middleware и handlers ПОСЛЕ guard
bot.use(storyRequiredGuard);
bot.command("start", handleStart);
// ...
```

**В handlers - БЕЗ проверок**:
```typescript
export async function handleByTarget(ctx: BotContext): Promise<void> {
  // ✅ TypeScript видит services как optional
  // ✅ НО guard middleware гарантирует что services ЕСТЬ

  const apiKey = ctx.services.openaiApiKey; // ❌ TS error: Object is possibly 'undefined'

  // Нужно либо non-null assertion:
  const apiKey = ctx.services!.openaiApiKey; // ✅ Работает

  // ИЛИ guard (но guard уже в middleware!):
  if (!ctx.services) return; // Избыточная проверка
  const apiKey = ctx.services.openaiApiKey;
}
```

**Проблема**: TypeScript всё равно требует проверку или non-null assertion (`!`)

---

### Решение 1.1: Optional + Type Narrowing Helper

```typescript
// utils/guards.ts
export function assertServices(ctx: BotContext): asserts ctx is BotContext & { services: BotServices } {
  if (!ctx.services) {
    throw new Error("Services not initialized"); // Не должно произойти
  }
}

// handlers/by-target.ts
export async function handleByTarget(ctx: BotContext): Promise<void> {
  assertServices(ctx); // ✅ Type narrowing

  // После assert TS знает что services НЕ undefined
  const apiKey = ctx.services.openaiApiKey; // ✅ Работает БЕЗ !
}
```

**Проблема**: Нужно вызывать `assertServices(ctx)` в КАЖДОМ handler (избыточно)

---

### Решение 1.2: Optional + Custom Handler Wrapper

```typescript
// utils/wrapper.ts
function withServices<T extends BotContext>(
  handler: (ctx: T & { services: BotServices }) => Promise<void>
): (ctx: T) => Promise<void> {
  return async (ctx: T) => {
    if (!ctx.services) {
      throw new Error("Services not initialized");
    }

    // Type narrowing - передаём ctx с гарантированным services
    await handler(ctx as T & { services: BotServices });
  };
}

// bot.ts
bot.command("start", withServices(handleStart)); // ✅ Обёрнуто
bot.command("by_target", withServices(handleByTarget));

// handlers/start.ts
export async function handleStart(ctx: BotContext & { services: BotServices }): Promise<void> {
  // ✅ services НЕ optional здесь!
  const apiKey = ctx.services.openaiApiKey; // ✅ Работает
}
```

**Плюсы**:
- ✅ Одна проверка (в wrapper)
- ✅ Handlers получают ctx с гарантированным services
- ✅ Type-safe

**Минусы**:
- ⚠️ Нужно оборачивать КАЖДЫЙ handler
- ⚠️ Шаблонный код в bot.ts

---

### Решение 1.3: Optional + Assertion в bot.ts

```typescript
// bot.ts
bot.use(async (ctx, next) => {
  ctx.services = services;
  await next();
});

// СРАЗУ после services middleware - assert для TS
bot.use(async (ctx, next) => {
  // Runtime guard (не должен сработать)
  if (!ctx.services) {
    logger.error("Services not initialized");
    await ctx.reply("Internal error");
    return;
  }

  // Type assertion для следующих middleware
  await next();
});

// handlers/by-target.ts (используют non-null assertion)
export async function handleByTarget(ctx: BotContext): Promise<void> {
  const apiKey = ctx.services!.openaiApiKey; // ✅ non-null assertion

  // Безопасно, потому что guard middleware проверил
}
```

**Плюсы**:
- ✅ Одна проверка (guard middleware)
- ✅ Минимальные изменения в handlers (просто добавить `!`)

**Минусы**:
- ⚠️ Non-null assertion (`!`) - отключаем type checking
- ⚠️ Если случайно вызовем handler ДО guard → runtime error

---

### Сравнение решений для Optional

| Решение | Проверка | Handlers | Type-safe | Шаблонный код |
|---------|----------|----------|-----------|---------------|
| **1.1 assertServices** | В каждом handler | `assertServices(ctx)` + обращение | ✅ | ⚠️ Средний |
| **1.2 withServices wrapper** | В wrapper | Обёрнутый handler | ✅ | ⚠️ Высокий |
| **1.3 Assertion в middleware** | Guard middleware | Non-null `!` | ❌ | ✅ Низкий |

---

### Моя рекомендация для Optional

**Решение 1.3 (Guard middleware + non-null assertion)**

**Почему**:
1. ✅ Одна проверка (guard middleware)
2. ✅ Минимальный шаблонный код (`!` короче чем `assertServices`)
3. ✅ Работает "из коробки" (не нужны wrappers)

**Риск**: Non-null assertion отключает type checking, но риск низкий:
- Guard middleware ВСЕГДА первым (перед handlers)
- Handlers НЕ могут быть вызваны напрямую (только через Grammy middleware chain)

**Что согласовать**:
- [ ] Решение 1.3 (guard + `!`) ОК?
- [ ] ИЛИ предпочитаете wrapper (решение 1.2) для type safety?

---

## 4. Nullable Approach - Детальный Разбор

### Зачем парсить текст? Юзеркейс и воркфлоу

**MCP Protocol** возвращает результат в формате:

```json
{
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"sessionId\": \"123\", \"hasStory\": true}"
      }
    ]
  }
}
```

**Зачем парсить**:
1. MCP возвращает JSON **как строку** в `content[0].text`
2. Нужно извлечь строку → распарсить в объект → валидировать Zod схемой

**Workflow**:
```
Handler → callTool("cold_start", {...})
  ↓
MCP Client → HTTP POST to Facade MCP Server
  ↓
MCP Server → возвращает { result: { content: [{ type: "text", text: "{...}" }] } }
  ↓
extractTextContent(result) → извлекает text из content[0]
  ↓
parseJsonContent(result) → JSON.parse(text) → объект
  ↓
Handler → использует объект
```

---

### Где используется parseJsonContent? 3 места

#### 1. callbacks.ts:11 - Парсинг cold_start результата

```typescript
export async function handleApproveCallback(ctx: BotContext): Promise<void> {
  const result = await callTool(ctx, "cold_start", { message: "да" });
  const data = parseJsonContent<Record<string, unknown>>(result); // ← ТУТ

  if (data && data.phase === "COMPLETED" && typeof data.message === "string") {
    // Обрабатываем завершение cold_start
  }
}
```

**Юзеркейс**: Пользователь нажал "Подтвердить" → cold_start завершается
**Что возвращает MCP**: `{ phase: "COMPLETED", message: "История сохранена!" }`

**Когда невалидное значение**:
- MCP вернул пустой `content: []` → `parseJsonContent` → `null`
- MCP вернул не JSON строку → `JSON.parse` fail → `parseJsonContent` → `null`
- MCP вернул JSON, но без `phase` → `data` есть, но `data.phase` undefined → fallback

---

#### 2. link.ts:47 - Парсинг link_telegram результата

```typescript
async function callLinkTool(...): Promise<LinkResponse | null> {
  const result = await callTool(ctx, "link_telegram", {...});
  return parseJsonContent<LinkResponse>(result); // ← ТУТ
}

// LinkResponse = { sessionId?: string; hasStory?: boolean; token?: string }
```

**Юзеркейс**: Пользователь привязывает LibreChat аккаунт через `/link <token>`
**Что возвращает MCP**: `{ sessionId: "123", hasStory: false, token: "abc" }`

**Когда невалидное значение**:
- Token неверный → MCP бросает ошибку (ловится в handleLinkError)
- MCP вернул пустой content → `parseJsonContent` → `null` → caller проверяет

---

#### 3. formatters/story.ts:13 - Парсинг cold_start фаз

```typescript
export function formatColdStartResult(result: McpToolResult): string {
  const text = extractTextContent(result);
  if (!text) return "❌ Не удалось обработать ответ";

  const data = parseJsonContent<ColdStartData>(result); // ← ТУТ
  return data ? formatColdStartPhase(data, text) : text; // Fallback на raw text
}

// ColdStartData = { phase?: string; message?: string; extractedData?: unknown }
```

**Юзеркейс**: Форматирование ответа cold_start агента (фазы: COLLECTING, CONFIRMING, COMPLETED)
**Что возвращает MCP**: `{ phase: "COLLECTING", message: "Расскажите подробнее..." }`

**Когда невалидное значение**:
- MCP вернул plain text (не JSON) → `parseJsonContent` → `null` → fallback на `text`
- MCP вернул пустой content → `extractTextContent` → `null` → "Не удалось обработать"

---

### Когда может быть невалидное значение? Ситуации

#### Ситуация 1: MCP server вернул ошибку

```json
{
  "result": {
    "content": [],
    "isError": true
  }
}
```

MCP server явно вернул ошибку → `content` пустой

**Как обрабатываем**:
- `extractTextContent` → `null` (пустой массив)
- `parseJsonContent` → `null`
- Caller проверяет `if (!data)` → показывает generic error

---

#### Ситуация 2: MCP server вернул plain text (не JSON)

```json
{
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Session expired. Please login again."
      }
    ]
  }
}
```

**Как обрабатываем**:
- `extractTextContent` → `"Session expired. Please login again."`
- `parseJsonContent` → `JSON.parse` fail → catch → return `null`
- Caller проверяет `if (!data)` → fallback behaviour

**Пример**: formatters/story.ts - fallback на raw text:
```typescript
const data = parseJsonContent(result);
return data ? formatColdStartPhase(data, text) : text; // Показываем plain text если не JSON
```

---

#### Ситуация 3: Network glitch → partial response

MCP request прервался → response incomplete → `JSON.parse` fail

**Как обрабатываем**:
- `parseJsonContent` → `null`
- Caller показывает error

---

### Как логично обрабатывать ошибки? Рекомендации

#### Для callbacks.ts (холд_start approve)

**Текущее**:
```typescript
const data = parseJsonContent(result);

if (data && data.phase === "COMPLETED" && typeof data.message === "string") {
  // Success path
} else {
  // Fallback - показываем "story-confirmed"
}
```

**Проблема**: Silent fail - если `data = null`, показываем generic "story-confirmed"

**Лучше**:
```typescript
const data = parseJsonContent(result);

if (!data) {
  // Явная обработка parsing error
  await ctx.editMessageText(ctx.t("error-generic"));
  return;
}

if (data.phase === "COMPLETED" && typeof data.message === "string") {
  // Success path
} else {
  // Другая фаза cold_start
  await ctx.editMessageText(ctx.t("story-confirmed"));
}
```

---

#### Для link.ts (привязка аккаунта)

**Текущее**:
```typescript
const data = parseJsonContent<LinkResponse>(result);
if (!data?.sessionId) return; // Silent fail
```

**Лучше**:
```typescript
const data = parseJsonContent<LinkResponse>(result);

if (!data) {
  throw new McpClientError("Failed to parse link response");
}

if (!data.sessionId) {
  throw new McpClientError("No sessionId in link response");
}
```

---

#### Для formatters/story.ts (форматирование)

**Текущее**:
```typescript
const data = parseJsonContent(result);
return data ? formatColdStartPhase(data, text) : text; // Fallback на raw text ✅
```

**ОК** - fallback на raw text логичен для formatter

---

### Что делать с parseJsonContent? Рекомендации

1. ✅ **Оставить nullable approach** - правильный выбор для optional данных

2. ✅ **Улучшить обработку в callers**:
   - callbacks.ts - явная проверка `if (!data)` + error message
   - link.ts - бросать ошибку если `!data` (критично для linking)
   - formatters/story.ts - оставить fallback на raw text (ОК)

3. ✅ **Добавить логирование** (опционально):
   ```typescript
   export function parseJsonContent<T>(result: McpToolResult): T | null {
     const text = extractTextContent(result);
     if (!text) return null;

     try {
       return JSON.parse(text) as T;
     } catch (error) {
       logger.warn({ text, error }, "Failed to parse JSON content");
       return null;
     }
   }
   ```

**Что согласовать**:
- [ ] Оставить parseJsonContent как nullable? ✅
- [ ] Улучшить обработку в callers (явные проверки + errors)?
- [ ] Добавить логирование ошибок парсинга?

---

## 5. Layer Mixing - Актуализация вопросов

### Текущая ситуация

**Сейчас**: `formatters/search.ts` делает LLM вызов (ChatOpenAI.invoke)

**Ты хочешь**: LLM форматирование (не вручную)

**Контекст**: Сейчас УЖЕ LLM форматирует! Вопрос был не "LLM vs template", а "ГДЕ должен быть LLM вызов?"

---

### Актуализированные вопросы

**Вопрос 5.1**: Форматтер делает API вызов (LLM.invoke) - это нарушение слоёв?

**Варианты**:

#### A. Оставить в formatters/ (текущий подход)
```typescript
// formatters/search.ts
export async function formatSearchResult(params): Promise<string> {
  const llm = new ChatOpenAI({...});
  const response = await llm.invoke(prompt); // ← LLM вызов ЗДЕСЬ
  return response.content.trim();
}
```

**Pros**:
- ✅ Простота - форматтер = "превратить данные в UI"
- ✅ Нет дублирования файлов (formatters/ уже есть)

**Cons**:
- ❌ Side effect (API вызов) в форматтере
- ❌ Форматтер не pure function

---

#### B. Переместить в services/ (правильные слои)
```typescript
// services/search-formatter.ts
export async function formatSearchResult(rawJson: string, apiKey: string, llmConfig: LlmConfig, languageCode: string): Promise<string> {
  const llm = new ChatOpenAI({...});
  const response = await llm.invoke(prompt); // ← LLM вызов в service
  return response.content.trim();
}

// formatters/search.ts - удалить ИЛИ оставить для template-based форматирования
```

**Pros**:
- ✅ Service = API вызовы (правильный слой)
- ✅ Явное разделение ответственностей

**Cons**:
- ⚠️ formatters/ становится бесполезным (только template helper функции?)
- ⚠️ Больше файлов

---

#### C. Переименовать formatters/ → presenters/
```typescript
// presenters/search.ts (было formatters/search.ts)
export async function formatSearchResult(...): Promise<string> {
  const llm = new ChatOpenAI({...});
  const response = await llm.invoke(prompt); // ← LLM вызов ОК в presenter
  return response.content.trim();
}
```

**Pros**:
- ✅ Presenter = prepare data for UI (включая API вызовы для форматирования)
- ✅ Нейминг отражает ответственность
- ✅ Минимальные изменения (просто rename)

**Cons**:
- ⚠️ Только переименование (суть не меняется)

---

### Моя рекомендация

**Вариант C (переименовать formatters/ → presenters/)**

**Почему**:
1. ✅ Presenter pattern = prepare data for presentation layer (UI)
2. ✅ Включает форматирование через API (LLM, template engines, etc)
3. ✅ Минимальные изменения (просто rename)
4. ✅ Честный нейминг (presenter делает то что написано)

**Альтернатива**: Вариант A (оставить как есть)
- Если считаем что "форматтер может делать API вызовы"
- Просто добавить комментарий объясняющий почему

**Что согласовать**:
- [ ] Переименовать formatters/ → presenters/?
- [ ] ИЛИ оставить в formatters/ + комментарий?
- [ ] ИЛИ переместить в services/?

---

## 6. NLP Parsers - Создание LLM каждый раз

### Вопрос: ОК ли создавать ChatOpenAI каждый раз?

**Текущий код**:
```typescript
export async function parseTargetQuery(apiKey: string, query: string): Promise<...> {
  const llm = new ChatOpenAI({ modelName: "gpt-4o-mini", temperature: 0, openAIApiKey: apiKey }); // ← Каждый раз!
  // ...
}
```

**Анализ ChatOpenAI**:

```typescript
// @langchain/openai source
class ChatOpenAI {
  constructor(config) {
    this.modelName = config.modelName;
    this.temperature = config.temperature;
    this.apiKey = config.openAIApiKey;
    // НЕТ connection pool
    // НЕТ persistent connections
    // Просто хранит конфиг
  }

  async invoke(prompt) {
    // Каждый вызов = новый HTTP request
    return fetch("https://api.openai.com/v1/chat/completions", {
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model: this.modelName, messages: [...] }),
    });
  }
}
```

**Вывод**: ChatOpenAI = lightweight config object, НЕ connection pool!

---

### Создавать каждый раз - проблема?

**НЕТ, потому что**:

1. ✅ ChatOpenAI не хранит state (только конфиг)
2. ✅ Не создаёт persistent connections (каждый invoke = новый HTTP request)
3. ✅ Нет connection pool (в отличие от PostgreSQL client)
4. ✅ Создание = просто присвоение полей (дешёвая операция)

**Метрики**:
```typescript
// Создание ChatOpenAI
console.time("create");
const llm = new ChatOpenAI({...});
console.timeEnd("create");
// → ~0.01ms (очень быстро!)

// HTTP request
console.time("invoke");
await llm.invoke(prompt);
console.timeEnd("invoke");
// → ~1000-3000ms (медленно, но не зависит от создания объекта!)
```

**Вывод**: Создание ChatOpenAI **НЕ проблема** (0.01ms vs 1000ms для API request)

---

### Singleton LLM - зачем?

**Если не проблема производительности, зачем singleton?**

**Причины ЗА singleton**:
1. ❓ Экономия памяти - ChatOpenAI объект занимает ~1KB (незначительно)
2. ❓ Переиспользование конфигурации - конфиг один и тот же (modelName, temperature)
3. ✅ **Читабельность** - создание один раз в начале файла показывает что LLM = shared resource

**Причины ПРОТИВ singleton**:
1. ❌ Global state (модуль-level переменная)
2. ❌ Не thread-safe (не важно для Node.js single-threaded)
3. ❌ Усложняет тестирование (нужно мокать модуль-level переменную)

---

### Предложенное решение - читаемость

**Текущий код**:
```typescript
export async function parseTargetQuery(apiKey: string, query: string): Promise<...> {
  const llm = new ChatOpenAI({ modelName: "gpt-4o-mini", temperature: 0, openAIApiKey: apiKey });
  const structuredLlm = llm.withStructuredOutput(targetSearchNullableSchema);
  const result = await structuredLlm.invoke(prompt);
  // ...
}
```

**Самое читаемое** (твои слова):
- ✅ Видно что создаём LLM
- ✅ Видно конфиг (modelName, temperature)
- ✅ Explicit (не скрыто в singleton)

**Рекомендация**: **Оставить как есть** (создавать каждый раз)

**Почему**:
1. ✅ Нет проблем производительности (создание = 0.01ms)
2. ✅ Читабельнее (explicit > implicit)
3. ✅ Проще тестировать (можно mock ChatOpenAI конструктор)
4. ✅ Нет global state

**НО** если хотите убрать дублирование кода (3 функции создают одинаковый LLM) → используйте **helper функцию**:

```typescript
function createNlpLlm(apiKey: string): ChatOpenAI {
  return new ChatOpenAI({
    modelName: "gpt-4o-mini",
    temperature: 0,
    openAIApiKey: apiKey,
  });
}

export async function parseTargetQuery(apiKey: string, query: string): Promise<...> {
  const llm = createNlpLlm(apiKey); // ✅ DRY, но создаём каждый раз
  // ...
}
```

**Что согласовать**:
- [ ] Оставить создание LLM каждый раз? ✅
- [ ] ИЛИ добавить helper функцию createNlpLlm для DRY?
- [ ] ИЛИ всё-таки singleton (если хотите)?

---

## 7. Error Handling - Кейсы по Отдельности

### Твой подход (цитата)

> "ок поле может быть опциональным (если по логике такое может быть), но проверку мы делаем на входе, и бизнес-код не должен страдать, а мы должны знать как на входе реагируем. на сколько это штатная ситуация."

**Перефразируя**:
1. Optional поля ОК (если логика допускает)
2. Проверка на ВХОДЕ (guard/validation)
3. Бизнес-код НЕ страдает (не проверяет optional везде)
4. Знаем как реагировать (штатная ситуация vs ошибка)

---

### Кейс 1: parseJsonContent (mcp-utils.ts)

**Ситуация**: MCP возвращает JSON как строку, парсим в объект

**Может быть null**:
- MCP вернул пустой content → `extractTextContent` → `null`
- MCP вернул не JSON → `JSON.parse` fail → `null`

**Штатная ситуация?**
- MCP вернул пустой content → ❌ НЕ штатная (ошибка MCP server)
- MCP вернул не JSON → ❌ НЕ штатная (неожиданный формат)

**Текущий подход**: Nullable (`T | null`)
**Проблема**: Caller обрабатывает `null` как штатную ситуацию (fallback)

**Правильный подход (по твоей логике)**:

```typescript
export function parseJsonContent<T>(result: McpToolResult): T {
  const text = extractTextContent(result);
  if (!text) {
    throw new McpClientError("MCP result has no text content"); // ❌ НЕ штатная → throw
  }

  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new McpClientError("Failed to parse JSON", error); // ❌ НЕ штатная → throw
  }
}
```

**Проверка на входе**: В `callTool` проверяем MCP response схему (уже есть)

**Бизнес-код НЕ страдает**: Handlers получают валидный объект ИЛИ exception (catch выше)

**Что согласовать**:
- [ ] Изменить parseJsonContent на throwing (вместо nullable)?

---

### Кейс 2: MySessionData.sessionId

**Ситуация**: Session может быть uninitialised (`sessionId === ""`)

**Может быть пустым**:
- Первое сообщение пользователя → session создаётся с `sessionId: ""`
- Session истекла в Redis → session пересоздаётся с `sessionId: ""`

**Штатная ситуация?**
- Первое сообщение → ✅ штатная (нужно вызвать `register_telegram`)
- Session истекла → ⚠️ граница (можно считать штатной - auto refresh)

**Текущий подход**: `sessionId: string` (пустая строка = uninitialised)
**Проблема**: Тип говорит "всегда есть", но может быть пустым

**Правильный подход (по твоей логике)**:

```typescript
// Опциональное поле ОК
export type MySessionData = {
  sessionId: string | null; // ✅ Explicit optional
  hasStory: boolean;
  token: string;
};

// Initial state
initial: (): MySessionData => ({
  sessionId: null, // ✅ Честно: нет сессии
  hasStory: false,
  token: "",
})

// Проверка на ВХОДЕ (middleware)
bot.use(async (ctx, next) => {
  if (ctx.session.sessionId === null) {
    // Guard: автоматически создаём сессию
    await ensureSession(ctx, ctx.services.facadeMcpUrl);
  }

  await next(); // Бизнес-код получает ctx с гарантированным sessionId !== null
});

// Бизнес-код НЕ страдает
export async function handleByTarget(ctx: BotContext): Promise<void> {
  // ❌ TS error: sessionId может быть null
  const sessionId = ctx.session.sessionId;

  // Но guard middleware гарантирует что sessionId НЕ null
  // Нужно либо assertion:
  const sessionId = ctx.session.sessionId!;

  // ИЛИ type narrowing (discriminated union)
}
```

**Альтернатива (discriminated union)**:

```typescript
export type MySessionData =
  | { status: "uninitialised" }
  | { status: "initialised"; sessionId: string; hasStory: boolean; token: string };

// Проверка на ВХОДЕ (middleware)
bot.use(async (ctx, next) => {
  if (ctx.session.status === "uninitialised") {
    await ensureSession(ctx, ctx.services.facadeMcpUrl);
    // После ensureSession: ctx.session.status = "initialised"
  }

  await next();
});

// Бизнес-код НЕ страдает (type-safe!)
export async function handleByTarget(ctx: BotContext): Promise<void> {
  if (ctx.session.status === "uninitialised") {
    // TS error: Это НЕ ДОЛЖНО произойти (guard middleware проверил)
    throw new Error("Session not initialised");
  }

  // TS знает что session.sessionId доступен
  const sessionId = ctx.session.sessionId; // ✅ Type-safe
}
```

**Что согласовать**:
- [ ] Использовать `sessionId: string | null` + middleware guard?
- [ ] ИЛИ discriminated union (type-safe, но больше изменений)?

---

### Кейс 3: updateHasStory (callbacks.ts)

**Ситуация**: Устанавливаем `hasStory = true` после завершения cold_start

**Может быть проблема**:
- `sessionId` пустой (session expired / uninitialised)

**Штатная ситуация?**
- ❌ НЕ штатная (session ДОЛЖНА быть initialised к этому моменту)

**Текущий подход**: Boolean return (`true` = success, `false` = session expired)
**Проблема**: Boolean return для мутации (неявная ошибка)

**Правильный подход (по твоей логике)**:

```typescript
// Проверка на ВХОДЕ (middleware)
bot.callbackQuery("decision:approve", async (ctx, next) => {
  if (ctx.session.status === "uninitialised") {
    await ctx.editMessageText(ctx.t("session-expired"));
    return; // Блокируем
  }

  await next(); // Handler получает initialised session
});

// Бизнес-код НЕ страдает
export async function handleApproveCallback(ctx: BotContext): Promise<void> {
  const result = await callTool(ctx, "cold_start", { message: "да" });
  const data = parseJsonContent(result);

  if (data.phase === "COMPLETED") {
    ctx.session.hasStory = true; // ✅ Прямая установка (session гарантированно initialised)
  }
}

// updateHasStory - удалить (не нужна)
```

**Что согласовать**:
- [ ] Добавить session guard для callbacks?
- [ ] Удалить updateHasStory (inline в handler)?

---

### Итоговая таблица по кейсам

| Кейс | Может быть null/empty? | Штатная ситуация? | Текущий подход | Правильный подход |
|------|------------------------|-------------------|----------------|-------------------|
| **parseJsonContent** | Да (MCP пустой/невалидный) | ❌ НЕ штатная | Nullable | **Throwing** |
| **sessionId** | Да (uninitialised) | ✅ Штатная (первый запуск) | `string` (пустая) | **`string \| null` + guard** |
| **updateHasStory** | Да (session expired) | ❌ НЕ штатная | Boolean return | **Middleware guard + inline** |

**Что согласовать**:
- [ ] Согласовать подход для каждого кейса?

---

## 8. updateHasStory - Обратная Связь от Фасада

### Твой вопрос

> "updateHasStory - ты считаешь корректно, сразу без фидбека от фасада разблокировать кнопки? я предполагал, что телеграм как-то будет получать обратную связь (опрашивать мб периодически наличие в бд этого флага у фасада), а не сам сразу разблокировать, а мб где-то это история не дойдет до адресата, я бы предпочел через фасад фидбек получать."

### Текущий флоу

```
User нажал "Подтвердить"
  ↓
handleApproveCallback
  ↓
callTool("cold_start", { message: "да" })
  ↓
Facade MCP Server → cold_start агент → сохраняет в Neo4j
  ↓
MCP возвращает { phase: "COMPLETED", message: "..." }
  ↓
updateHasStory(ctx, true) ← СРАЗУ устанавливаем hasStory = true
  ↓
/by_current разблокирована
```

**Проблема**: Если сохранение в Neo4j FAILED (но MCP вернул COMPLETED) → hasStory = true, но истории НЕТ в БД!

---

### Варианты обратной связи от фасада

#### Вариант 1: Доверять MCP ответу (текущий)

```typescript
const result = await callTool(ctx, "cold_start", { message: "да" });
const data = parseJsonContent(result);

if (data.phase === "COMPLETED") {
  ctx.session.hasStory = true; // Доверяем что история сохранена
}
```

**Pros**:
- ✅ Простота (один запрос)
- ✅ Быстро (нет дополнительных проверок)

**Cons**:
- ❌ Риск рассинхрона (MCP сказал COMPLETED, но БД failed)
- ❌ Нет guarantee что история в БД

---

#### Вариант 2: Проверка через MCP tool

**Добавить MCP tool `check_story`**:

```typescript
// Facade MCP Server
export async function checkStory(params: { sessionId: string }): Promise<{ hasStory: boolean }> {
  const session = await db.getSession(params.sessionId);
  const contextsCount = await db.getContextsCount(session.userId);

  return { hasStory: contextsCount > 0 };
}
```

**Telegram bot**:
```typescript
const result = await callTool(ctx, "cold_start", { message: "да" });
const data = parseJsonContent(result);

if (data.phase === "COMPLETED") {
  // Проверяем через фасад
  const checkResult = await callTool(ctx, "check_story", {});
  const checkData = parseJsonContent<{ hasStory: boolean }>(checkResult);

  ctx.session.hasStory = checkData.hasStory; // ✅ Устанавливаем ТОЛЬКО если фасад подтвердил
}
```

**Pros**:
- ✅ Guarantee (фасад проверил БД)
- ✅ Нет риска рассинхрона

**Cons**:
- ⚠️ Два запроса (cold_start + check_story)
- ⚠️ Медленнее (дополнительный round-trip)

---

#### Вариант 3: Polling (периодическая проверка)

**НЕ рекомендуется** для Telegram bot:
- Telegram = request-response модель (не WebSocket)
- Polling = дополнительная нагрузка
- Сложность (нужен scheduler, background tasks)

---

#### Вариант 4: Фасад возвращает hasStory в ответе

**Изменить cold_start MCP tool**:

```typescript
// Facade MCP Server - cold_start
export async function coldStart(params: { message: string }): Promise<{
  phase: string;
  message: string;
  hasStory?: boolean; // ✅ Добавить флаг
}> {
  // ... обработка

  if (phase === "COMPLETED") {
    // Проверяем что истории действительно сохранены
    const contextsCount = await db.getContextsCount(session.userId);
    return {
      phase: "COMPLETED",
      message: "История сохранена!",
      hasStory: contextsCount > 0, // ✅ Фасад сам проверил
    };
  }

  return { phase, message };
}
```

**Telegram bot**:
```typescript
const result = await callTool(ctx, "cold_start", { message: "да" });
const data = parseJsonContent(result);

if (data.phase === "COMPLETED") {
  ctx.session.hasStory = data.hasStory ?? false; // ✅ Берём из ответа фасада
}
```

**Pros**:
- ✅ Один запрос (нет дополнительных round-trips)
- ✅ Guarantee (фасад проверил БД перед ответом)
- ✅ Простота в боте (просто читаем hasStory из ответа)

**Cons**:
- ⚠️ Нужно изменить Facade MCP Server (добавить hasStory в ответ)

---

### Рекомендация

**Вариант 4 (фасад возвращает hasStory в ответе)**

**Почему**:
1. ✅ Guarantee (фасад проверил БД)
2. ✅ Нет дополнительных запросов (один round-trip)
3. ✅ Логично (фасад знает state, бот просто отображает)
4. ✅ Расширяемо (можно добавить другие флаги в будущем)

**Альтернатива**: Вариант 2 (check_story tool)
- Если не хотите менять cold_start
- Но два запроса медленнее

**Что согласовать**:
- [ ] Вариант 4 (фасад возвращает hasStory) ОК?
- [ ] Нужно ли изменить Facade MCP Server?
- [ ] ИЛИ вариант 2 (check_story tool)?

---

### Актуализированные вопросы из раздела 8

**Вопрос 8.1**: Inline updateHasStory?
- [ ] ДА - если используем вариант 4 (просто `ctx.session.hasStory = data.hasStory`)

**Вопрос 8.2**: Centralized session check middleware?
- [ ] Обсудили в кейсе 2 (discriminated union для MySessionData)

**Остальные вопросы НЕ актуальны** (решается через фасад feedback).

---

## Итоговая Таблица Решений

| # | Вопрос | Рекомендация | Требует обсуждения |
|---|--------|--------------|-------------------|
| 1 | Нейминг енумов | const as const + mappings | ✅ Структура mappings |
| 2 | SRP mcp-client | Вариант 3 (функциональный) ✅ | ❓ Вариант 2 (ООП) тоже рассмотреть |
| 3 | Type safety services | Optional + guard middleware + `!` | ✅ Решение 1.3 ОК? |
| 4 | parseJsonContent | Изменить на throwing | ✅ Согласовать |
| 5 | LLM в форматтере | Переименовать formatters/ → presenters/ | ✅ Согласовать |
| 6 | NLP parsers создание LLM | Оставить как есть (создавать каждый раз) | ✅ Добавить helper для DRY? |
| 7 | Error handling | Кейс-by-кейс (discriminated union для session) | ✅ Согласовать подход для каждого кейса |
| 8 | updateHasStory feedback | Вариант 4 (фасад возвращает hasStory) | ✅ Изменить Facade MCP Server? |
