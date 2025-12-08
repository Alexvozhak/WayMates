# Вариант B vs Вариант C: Детальное Сравнение

> **Дата**: 2025-12-08
> **Вопрос**: Зачем Вариант B (просто enum), если Вариант C (Tool Registry) дает полную type safety без дублирования?

---

## TL;DR Вывод

**Вариант C (Tool Registry) - ЛУЧШЕ** ✅

**Почему я ошибся в анализе**:
- ❌ "Дублирование схем" - **ЛОЖЬ**: Facade schemas УЖЕ в `src/facade/mcp-server/schemas.ts`, просто переиспользуем их!
- ❌ "Дублирование runtime валидации" - **ЛОЖЬ**: Bot валидирует ПЕРЕД отправкой, Facade валидирует ПОСЛЕ получения (double check OK)
- ❌ "Сложность переноса" - **ЛОЖЬ**: Schemas УЖЕ отдельно от Facade logic, просто экспортируем из нужного места

**Вариант C выигрывает по всем метрикам**:
- ✅ Полная type safety (tool names + params + response)
- ✅ Runtime валидация в Bot (early error detection)
- ✅ Single source of truth (tool registry)
- ✅ Лучше для бизнес-кода (меньше boilerplate, autocomplete)

---

## Текущее Состояние

### Facade Schemas (сейчас)

**Файл**: `src/facade/mcp-server/schemas.ts`

```typescript
// Facade schemas УЖЕ переиспользуют shared!
import {
  adhocUserContextSchema,
  targetSearchParamsBaseSchema,
  userSearchParamsRawSchema,
  // ... другие из shared
} from "../../shared/schemas.js";

export const telegramRegisterParamsSchema = z.object({
  telegramUserId: z.number().int().positive(),
  telegramUsername: z.string().optional(),
  telegramFirstName: z.string().optional(),
});

export const coldStartParamsSchema = z.object({
  message: z.string().min(1),
  sessionId: sessionIdSchema,
});

export const searchByTargetParamsSchema = targetSearchParamsBaseSchema.extend({
  sessionId: sessionIdSchema,
});

// ... 17 tool schemas
```

**Факт**: Schemas УЖЕ отделены от Facade logic! Они просто в `src/facade/mcp-server/schemas.ts`.

---

### Bot Code (сейчас)

**Файл**: `src/telegram-bot/handlers/link.ts`

```typescript
async function callLinkTool(ctx: BotContext, token: string, telegramUserId: number): Promise<LinkResponse | null> {
  const result = await callTool(ctx, "link_telegram", { // ❌ Строка (нет type safety)
    token,                      // ❌ Любые поля (нет autocomplete)
    telegramUserId,
    telegramUsername: ctx.from?.username,
    telegramFirstName: ctx.from?.first_name,
  });

  return parseJsonContent<LinkResponse>(result); // ⚠️ Manual typing
}
```

**Проблемы**:
1. ❌ `"link_telegram"` - строка (можно опечататься)
2. ❌ `{ token, ... }` - нет autocomplete для полей
3. ❌ Нет compile-time проверки params
4. ⚠️ Manual typing для response

---

## Вариант B: Enum в shared

### Реализация

**Шаг 1**: Добавить enum в shared

```typescript
// src/shared/schemas.ts

export enum McpToolName {
  AUTH = "auth",
  REGISTER_TELEGRAM = "register_telegram",
  LINK_TELEGRAM = "link_telegram",
  COLD_START = "cold_start",
  SEARCH_BY_TARGET = "search_by_target",
  // ... 17 tools
}
```

**Шаг 2**: McpClient использует enum

```typescript
// src/telegram-bot/services/mcp-client.ts

import { McpToolName } from "../../shared/schemas.js";

export class McpClient {
  async call(
    toolName: McpToolName, // ✅ Type-safe enum
    params: Record<string, unknown> // ❌ ВСЕ ЕЩЕ any
  ): Promise<McpToolResult> {
    return await this.sendWithRetry(toolName, params);
  }
}
```

### Бизнес-код

**Файл**: `src/telegram-bot/handlers/link.ts`

```typescript
import { McpToolName } from "../../shared/schemas.js";

async function callLinkTool(ctx: BotContext, token: string, telegramUserId: number): Promise<LinkResponse | null> {
  const result = await callTool(
    ctx,
    McpToolName.LINK_TELEGRAM, // ✅ Type-safe tool name
    {
      token,                    // ❌ Все еще нет autocomplete
      telegramUserId,
      telegramUsername: ctx.from?.username,
      telegramFirstName: ctx.from?.first_name,
      // ❌ Могу добавить невалидное поле - компилятор не остановит
      invalidField: "foo",      // ⚠️ Ошибка только в runtime (Facade вернет error)
    }
  );

  return parseJsonContent<LinkResponse>(result); // ⚠️ Manual typing
}
```

**Что улучшилось**:
- ✅ Type-safe tool name

**Что НЕ улучшилось**:
- ❌ Params все еще `Record<string, unknown>` (нет autocomplete, нет compile-time проверки)
- ❌ Response все еще manual typing
- ❌ Ошибки только в runtime (после отправки в Facade)

---

## Вариант C: Tool Registry

### Реализация

**Шаг 1**: Tool Registry в shared (переиспользует Facade schemas!)

```typescript
// src/shared/tool-registry.ts

import {
  telegramRegisterParamsSchema,
  coldStartParamsSchema,
  searchByTargetParamsSchema,
  // ... все Facade schemas
} from "../facade/mcp-server/schemas.js"; // ✅ Переиспользование!

import {
  sessionResponseSchema,
  coldStartResponseSchema,
  searchResultSchema,
  // ... response schemas
} from "../facade/mcp-server/result.js"; // ✅ Переиспользование!

export const TOOL_REGISTRY = {
  register_telegram: {
    params: telegramRegisterParamsSchema, // ✅ Те же схемы, что у Facade
    response: sessionResponseSchema,
  },
  cold_start: {
    params: coldStartParamsSchema,
    response: coldStartResponseSchema,
  },
  link_telegram: {
    params: telegramLinkParamsSchema,
    response: sessionResponseSchema,
  },
  search_by_target: {
    params: searchByTargetParamsSchema,
    response: searchResultSchema,
  },
  // ... все 17 tools
} as const;

export type ToolName = keyof typeof TOOL_REGISTRY;

// Derive enum (для SEARCH_CONFIG)
export const McpToolName = {
  AUTH: "auth" as const,
  REGISTER_TELEGRAM: "register_telegram" as const,
  LINK_TELEGRAM: "link_telegram" as const,
  COLD_START: "cold_start" as const,
  SEARCH_BY_TARGET: "search_by_target" as const,
  // ...
} as const satisfies Record<string, ToolName>;
```

**Нет дублирования!** Facade schemas остаются в `src/facade/mcp-server/schemas.ts`, просто импортируем их.

---

**Шаг 2**: McpClient с полной type safety

```typescript
// src/telegram-bot/services/mcp-client.ts

import { TOOL_REGISTRY, type ToolName } from "../../shared/tool-registry.js";
import type { z } from "zod";

export class McpClient {
  async callTool<T extends ToolName>(
    toolName: T, // ✅ Type-safe tool name
    params: z.infer<typeof TOOL_REGISTRY[T]["params"]> // ✅ Type-safe params!
  ): Promise<z.infer<typeof TOOL_REGISTRY[T]["response"]>> {
    const tool = TOOL_REGISTRY[toolName];

    // ✅ Runtime валидация params (early error detection)
    const validatedParams = tool.params.parse(params);

    const result = await this.call(toolName, validatedParams);

    // ✅ Runtime валидация response
    const parsedContent = parseJsonContent(result);
    return tool.response.parse(parsedContent);
  }
}
```

---

### Бизнес-код

**Файл**: `src/telegram-bot/handlers/link.ts`

```typescript
async function callLinkTool(ctx: BotContext, token: string, telegramUserId: number) {
  // ✅ Полная type safety!
  const result = await ctx.services.mcpClient.callTool(
    "link_telegram", // ✅ Autocomplete tool names
    {
      token,         // ✅ Autocomplete для полей
      telegramUserId,
      telegramUsername: ctx.from?.username,
      telegramFirstName: ctx.from?.first_name,
      // ❌ TypeScript error: invalidField не существует!
      // invalidField: "foo", // ❌ Compile-time error!
    }
    // ✅ Return type автоматически: SessionResponse
  );

  // ✅ result уже типизирован!
  ctx.session.sessionId = result.sessionId;
  ctx.session.hasStory = result.hasStory;
  ctx.session.token = result.token;
}
```

**Что улучшилось**:
- ✅ Type-safe tool name (autocomplete)
- ✅ Type-safe params (autocomplete + compile-time проверка)
- ✅ Type-safe response (автоматически)
- ✅ Ошибки в compile-time (ДО запуска кода)
- ✅ Runtime валидация params (early error detection)

---

### Пример 2: Story handler

**Было** (Вариант B):

```typescript
// src/telegram-bot/handlers/story.ts

async function sendStoryToAgent(ctx: BotContext, message: string): Promise<void> {
  const result = await callTool(ctx, McpToolName.COLD_START, {
    message, // ❌ Нет autocomplete, нет compile-time проверки
    // Могу забыть поле или добавить невалидное
  });

  // ⚠️ Manual typing
  const data = parseJsonContent<ColdStartResponse>(result);

  await ctx.reply(formatColdStartResult(data), { ... });
}
```

**Станет** (Вариант C):

```typescript
// src/telegram-bot/handlers/story.ts

async function sendStoryToAgent(ctx: BotContext, message: string): Promise<void> {
  // ✅ Полная type safety
  const result = await ctx.services.mcpClient.callTool(
    "cold_start",
    {
      message, // ✅ TypeScript знает какие поля нужны
      // ❌ Compile-time error если забыл поле или добавил невалидное
    }
    // ✅ Return type: ColdStartResponse
  );

  // ✅ result уже типизирован (не нужен parseJsonContent)
  await ctx.reply(formatColdStartResult(result), { ... });
}
```

---

### Пример 3: Search handler

**Было** (Вариант B):

```typescript
// src/telegram-bot/handlers/by-target.ts

async function executeTargetSearch(ctx: BotContext, query: string): Promise<void> {
  const result = await callTool(ctx, McpToolName.SEARCH_BY_TARGET, {
    // ❌ Нет autocomplete
    targetContext: { /* ... */ },
    limit: 20,
    // Могу забыть обязательное поле → runtime error
  });

  const data = parseJsonContent<SearchResult>(result);
  // ...
}
```

**Станет** (Вариант C):

```typescript
// src/telegram-bot/handlers/by-target.ts

async function executeTargetSearch(ctx: BotContext, query: string): Promise<void> {
  const result = await ctx.services.mcpClient.callTool(
    "search_by_target",
    {
      targetContext: { /* ✅ Autocomplete для полей */ },
      limit: 20,
      // ❌ TypeScript error если забыл обязательное поле!
    }
    // ✅ Return type: SearchResult
  );

  // ✅ result уже типизирован
  await formatSearchResult(result);
}
```

---

## Сравнение: Runtime Валидация

### Вариант B (только Facade валидирует)

```
Bot Handler
  ↓
callTool("link_telegram", { invalidField: "foo" }) // ⚠️ Компилятор OK
  ↓
HTTP request → Facade
  ↓
Facade валидирует params
  ↓
❌ Zod error: "Unknown field: invalidField"
  ↓
Bot получает error
  ↓
⚠️ Runtime error (уже отправили HTTP request)
```

**Проблема**: Ошибки только после HTTP request → больше latency, хуже UX.

---

### Вариант C (Bot + Facade валидируют)

```
Bot Handler
  ↓
callTool("link_telegram", { invalidField: "foo" })
  ↓
❌ TypeScript error: "Unknown field: invalidField" (compile-time)
  ↓
❌ Не компилируется
```

**Если TypeScript пропустил (edge case)**:

```
Bot Handler
  ↓
callTool("link_telegram", { invalidField: "foo" })
  ↓
❌ Zod validation error в Bot (tool.params.parse)
  ↓
⚠️ Runtime error (ДО отправки HTTP request)
```

**Плюсы**:
- ✅ Early error detection (в Bot, до HTTP request)
- ✅ Меньше latency (не ждем ответа от Facade)
- ✅ Лучше UX (быстрее показываем ошибку)

**Вопрос**: "Это дублирование валидации?"

**Ответ**: НЕТ, это **defense in depth**:
- Bot валидирует → early error detection
- Facade валидирует → защита от других клиентов (LibreChat, direct HTTP)

Это standard practice (REST API: client-side + server-side validation).

---

## Сравнение: Что Нужно Изменить?

### Вариант B: Enum в shared

**Изменения**:
1. ✅ Добавить `enum McpToolName` в `src/shared/schemas.ts`
2. ✅ McpClient: `toolName: string` → `toolName: McpToolName`
3. ✅ SEARCH_CONFIG: `mcpTool: "search_by_target"` → `mcpTool: McpToolName.SEARCH_BY_TARGET`

**Итого**: ~20 строк кода

---

### Вариант C: Tool Registry

**Изменения**:
1. ✅ Создать `src/shared/tool-registry.ts` (импортирует Facade schemas)
2. ✅ McpClient: добавить `callTool<T extends ToolName>` метод
3. ✅ SEARCH_CONFIG: `mcpTool: "search_by_target"` → `mcpTool: McpToolName.SEARCH_BY_TARGET`
4. ✅ Handlers: `callTool(ctx, "link_telegram", { ... })` → `mcpClient.callTool("link_telegram", { ... })`
5. ✅ Удалить `parseJsonContent` из handlers (не нужен)

**Итого**: ~100 строк кода (tool-registry.ts) + обновить handlers

---

## Разбор Моих Ошибок

### Ошибка 1: "Дублирование схем"

**Я сказал**: "Facade уже имеет Zod schemas → дублирование"

**Почему ошибся**: Facade schemas УЖЕ отдельно в `src/facade/mcp-server/schemas.ts`! Tool Registry просто импортирует их:

```typescript
// src/shared/tool-registry.ts

import { telegramRegisterParamsSchema } from "../facade/mcp-server/schemas.js";

export const TOOL_REGISTRY = {
  register_telegram: {
    params: telegramRegisterParamsSchema, // ✅ Переиспользование!
  },
};
```

**Нет дублирования!**

---

### Ошибка 2: "Дублирование runtime валидации"

**Я сказал**: "Facade валидирует params → Bot тоже будет валидировать → дублирование"

**Почему ошибся**:
1. Это НЕ дублирование, это **defense in depth** (standard practice)
2. Bot валидация → **early error detection** (до HTTP request)
3. Facade валидация → **защита от других клиентов**

**Это плюс, не минус!**

---

### Ошибка 3: "Сложность переноса"

**Я сказал**: "Нужно переносить Facade schemas в shared"

**Почему ошибся**: НЕ нужно переносить! Facade schemas остаются в `src/facade/mcp-server/schemas.ts`, просто импортируем их в tool-registry.ts.

**Никакого breaking change для Facade!**

---

## Итоговое Сравнение

| Критерий | Вариант B (Enum) | Вариант C (Registry) |
|----------|------------------|----------------------|
| **Type-safe tool names** | ✅ Да | ✅ Да |
| **Type-safe params** | ❌ Нет (`Record<string, unknown>`) | ✅ Да (полная) |
| **Type-safe response** | ⚠️ Manual (`parseJsonContent<T>`) | ✅ Да (автоматически) |
| **Autocomplete в IDE** | ⚠️ Только tool names | ✅ Tool names + params + response |
| **Compile-time проверка** | ⚠️ Только tool names | ✅ Tool names + params |
| **Runtime валидация** | ⚠️ Только Facade | ✅ Bot + Facade (defense in depth) |
| **Early error detection** | ❌ Нет | ✅ Да (в Bot, до HTTP request) |
| **Бизнес-код** | ⚠️ Много boilerplate | ✅ Минимум boilerplate |
| **Дублирование схем** | ✅ Нет | ✅ Нет (переиспользование Facade schemas) |
| **Breaking change для Facade** | ✅ Нет | ✅ Нет |
| **Сложность реализации** | ✅ Простая (~20 строк) | ⚠️ Средняя (~100 строк + обновить handlers) |

---

## Финальная Рекомендация

**✅ Вариант C (Tool Registry)** - РЕКОМЕНДУЮ

**Почему**:
1. ✅ **Полная type safety** (tool names + params + response)
2. ✅ **Лучше для бизнес-кода** (меньше boilerplate, autocomplete)
3. ✅ **Early error detection** (ошибки в compile-time + Bot runtime)
4. ✅ **Нет дублирования** (переиспользуем Facade schemas)
5. ✅ **Defense in depth** (Bot + Facade валидация)

**Почему НЕ Вариант B**:
- ⚠️ Половинчатое решение (только tool names, params все еще `Record<string, unknown>`)
- ⚠️ Ошибки только в runtime (после HTTP request в Facade)
- ⚠️ Больше boilerplate в handlers (`parseJsonContent<T>`)

**Сравнение сложности**:
- Вариант B: ~20 строк кода
- Вариант C: ~100 строк кода + обновить handlers

**Вывод**: Вариант C на 5x больше кода, но дает 10x больше пользы (полная type safety, early errors, лучше DX).

---

## План Реализации (Вариант C)

### Шаг 1: Создать Tool Registry

```typescript
// src/shared/tool-registry.ts

import {
  authParamsSchema,
  telegramRegisterParamsSchema,
  telegramLinkParamsSchema,
  coldStartParamsSchema,
  resetColdStartParamsSchema,
  getStoryParamsSchema,
  searchByTargetParamsSchema,
  searchUserCareersParamsSchema,
  facadeAdhocSearchParamsSchema,
  setGoalParamsSchema,
  getGoalParamsSchema,
  deleteGoalParamsSchema,
  updateContextParamsSchema,
  upsertContextParamsSchema,
  deleteContextParamsSchema,
  upsertTrailParamsSchema,
  deleteTrailParamsSchema,
} from "../facade/mcp-server/schemas.js";

import {
  sessionResponseSchema,
  coldStartResponseSchema,
  storyResponseSchema,
  searchResultSchema,
  goalResponseSchema,
  contextResponseSchema,
  trailResponseSchema,
} from "../facade/mcp-server/result.js";

export const TOOL_REGISTRY = {
  // Auth
  auth: {
    params: authParamsSchema,
    response: sessionResponseSchema,
  },
  register_telegram: {
    params: telegramRegisterParamsSchema,
    response: sessionResponseSchema,
  },
  link_telegram: {
    params: telegramLinkParamsSchema,
    response: sessionResponseSchema,
  },

  // Story
  cold_start: {
    params: coldStartParamsSchema,
    response: coldStartResponseSchema,
  },
  reset_cold_start: {
    params: resetColdStartParamsSchema,
    response: z.object({ success: z.boolean() }),
  },
  get_story: {
    params: getStoryParamsSchema,
    response: storyResponseSchema,
  },

  // Search
  search_by_target: {
    params: searchByTargetParamsSchema,
    response: searchResultSchema,
  },
  search_user_careers: {
    params: searchUserCareersParamsSchema,
    response: searchResultSchema,
  },
  search_careers: {
    params: facadeAdhocSearchParamsSchema,
    response: searchResultSchema,
  },

  // Goals
  set_goal: {
    params: setGoalParamsSchema,
    response: goalResponseSchema,
  },
  get_goal: {
    params: getGoalParamsSchema,
    response: goalResponseSchema,
  },
  delete_goal: {
    params: deleteGoalParamsSchema,
    response: z.object({ success: z.boolean() }),
  },

  // Contexts
  update_context: {
    params: updateContextParamsSchema,
    response: contextResponseSchema,
  },
  upsert_context: {
    params: upsertContextParamsSchema,
    response: contextResponseSchema,
  },
  delete_context: {
    params: deleteContextParamsSchema,
    response: z.object({ success: z.boolean() }),
  },

  // Trails
  upsert_trail: {
    params: upsertTrailParamsSchema,
    response: trailResponseSchema,
  },
  delete_trail: {
    params: deleteTrailParamsSchema,
    response: z.object({ success: z.boolean() }),
  },
} as const;

export type ToolName = keyof typeof TOOL_REGISTRY;

// Derive enum для SEARCH_CONFIG
export const McpToolName = {
  AUTH: "auth",
  REGISTER_TELEGRAM: "register_telegram",
  LINK_TELEGRAM: "link_telegram",
  COLD_START: "cold_start",
  RESET_COLD_START: "reset_cold_start",
  GET_STORY: "get_story",
  SEARCH_BY_TARGET: "search_by_target",
  SEARCH_USER_CAREERS: "search_user_careers",
  SEARCH_CAREERS: "search_careers",
  SET_GOAL: "set_goal",
  GET_GOAL: "get_goal",
  DELETE_GOAL: "delete_goal",
  UPDATE_CONTEXT: "update_context",
  UPSERT_CONTEXT: "upsert_context",
  DELETE_CONTEXT: "delete_context",
  UPSERT_TRAIL: "upsert_trail",
  DELETE_TRAIL: "delete_trail",
} as const satisfies Record<string, ToolName>;
```

### Шаг 2: Обновить McpClient

```typescript
// src/telegram-bot/services/mcp-client.ts

import { TOOL_REGISTRY, type ToolName } from "../../shared/tool-registry.js";
import type { z } from "zod";

export class McpClient {
  constructor(private facadeMcpUrl: string) {}

  // Type-safe method
  async callTool<T extends ToolName>(
    toolName: T,
    params: z.infer<typeof TOOL_REGISTRY[T]["params"]>
  ): Promise<z.infer<typeof TOOL_REGISTRY[T]["response"]>> {
    const tool = TOOL_REGISTRY[toolName];

    // Runtime validation params
    const validatedParams = tool.params.parse(params);

    const result = await this.sendWithRetry(toolName, validatedParams);

    // Runtime validation response
    const parsedContent = parseJsonContent(result);
    return tool.response.parse(parsedContent);
  }

  // Low-level method (для backward compatibility)
  private async sendWithRetry(
    toolName: string,
    params: Record<string, unknown>
  ): Promise<McpToolResult> {
    // ... existing implementation
  }
}
```

### Шаг 3: Обновить SEARCH_CONFIG

```typescript
// src/telegram-bot/types.ts

import { McpToolName } from "../shared/tool-registry.js";

export const SEARCH_CONFIG = {
  by_target: {
    command: "/by_target",
    action: "by_target" as const,
    i18n: { usage: "target-usage", searching: "searching-target" },
    mcpTool: McpToolName.SEARCH_BY_TARGET,
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
```

### Шаг 4: Обновить Handlers

```typescript
// src/telegram-bot/handlers/link.ts

async function callLinkTool(ctx: BotContext, token: string, telegramUserId: number) {
  const result = await ctx.services.mcpClient.callTool(
    "link_telegram",
    {
      token,
      telegramUserId,
      // ❌ НЕ отправляем username и firstName (анонимная платформа)
    }
  );

  // ✅ result уже типизирован как SessionResponse
  ctx.session.sessionId = result.sessionId;
  ctx.session.hasStory = result.hasStory;
  ctx.session.token = result.token;
}
```

### Шаг 5: Проверка

```bash
npm run lint
npx tsc --noEmit
```

---

## Ответы на Вопросы

### 1. "откуда дублирование?"

**Ответ**: Нет дублирования! Я ошибся.

Facade schemas остаются в `src/facade/mcp-server/schemas.ts`, Tool Registry просто импортирует их:

```typescript
import { telegramRegisterParamsSchema } from "../facade/mcp-server/schemas.js";

export const TOOL_REGISTRY = {
  register_telegram: {
    params: telegramRegisterParamsSchema, // ✅ Переиспользование!
  },
};
```

---

### 2. "что за дублирование runtime валидации?"

**Ответ**: Нет дублирования! Это **defense in depth** (standard practice).

**Bot валидация** (Tool Registry):
- Цель: Early error detection (до HTTP request)
- Польза: Быстрее показываем ошибку пользователю

**Facade валидация**:
- Цель: Защита от других клиентов (LibreChat, direct HTTP)
- Польза: Безопасность (не доверяем клиентам)

**Аналогия**: REST API всегда валидирует дважды (client-side + server-side).

---

### 3. "енум в shared, а что в фасаде сейчас нет такого енума?"

**Ответ**: Правильно, в Facade НЕТ enum для tool names!

**Сейчас** (Facade):
```typescript
server.addTool({
  name: "register_telegram", // ❌ Строка (нет enum)
  parameters: telegramRegisterParamsSchema,
  execute: async (args) => { ... },
});
```

**После Вариант C** (опционально для Facade):
```typescript
import { McpToolName } from "../../shared/tool-registry.js";

server.addTool({
  name: McpToolName.REGISTER_TELEGRAM, // ✅ Type-safe (опционально)
  parameters: telegramRegisterParamsSchema,
  execute: async (args) => { ... },
});
```

НО это опционально для Facade! Главная польза - для Bot.

---

## Финал

**Вариант C - ЛУЧШЕ** ✅

Мои "минусы" были ошибочными:
- ❌ "Дублирование схем" - ЛОЖЬ (переиспользование)
- ❌ "Дублирование валидации" - ЛОЖЬ (defense in depth)
- ❌ "Сложность переноса" - ЛОЖЬ (просто импортируем)

**Реальные плюсы Вариант C**:
- ✅ Полная type safety (tool + params + response)
- ✅ Early error detection
- ✅ Лучше DX (autocomplete, меньше boilerplate)
- ✅ Single source of truth

**Реализуем Вариант C?** 🚀
