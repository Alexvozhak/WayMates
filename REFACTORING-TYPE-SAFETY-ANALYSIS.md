# Анализ Type Safety для MCP Tool Names

> **Дата**: 2025-12-08
> **Вопрос**: Можно ли переиспользовать SEARCH_CONFIG для enum? Сравнить подходы.

---

## Текущее Состояние

### MCP Tools в Facade (17 tools)

**Auth** (3):
- `auth`
- `register_telegram`
- `link_telegram`

**Story** (3):
- `cold_start`
- `reset_cold_start`
- `get_story`

**Search** (3):
- `search_by_target` ← SEARCH_CONFIG
- `search_user_careers` ← SEARCH_CONFIG
- `search_careers` ← SEARCH_CONFIG

**Goals** (3):
- `set_goal`
- `get_goal`
- `delete_goal`

**Contexts** (3):
- `update_context`
- `upsert_context`
- `delete_context`

**Trails** (2):
- `upsert_trail`
- `delete_trail`

### SEARCH_CONFIG (согласовано, не реализовано)

**Покрывает**: Только 3 search tools (из 17)

```typescript
export const SEARCH_CONFIG = {
  by_target: {
    command: "/by_target",
    action: "by_target" as const,
    i18n: { usage: "target-usage", searching: "searching-target" },
    mcpTool: "search_by_target", // ← Tool name
  },
  by_current: {
    mcpTool: "search_user_careers",
  },
  by_adhoc: {
    mcpTool: "search_careers",
  },
} as const;
```

**Вывод**: SEARCH_CONFIG - это bot-specific конфиг для search команд, НЕ полный список MCP tools.

---

## Вопрос: Переиспользовать SEARCH_CONFIG?

**Проблема**: SEARCH_CONFIG не покрывает:
- ❌ `register_telegram` (session init)
- ❌ `cold_start` (story command)
- ❌ `link_telegram` (link command)
- ❌ `get_story` (story command)
- ❌ 11 других tools (goals, contexts, trails)

**Решение**: Нужен **полный enum** для всех MCP tools, а SEARCH_CONFIG использует его.

---

## Сравнение Подходов

### Вариант A: Enum в telegram-bot (изолированный)

```typescript
// src/telegram-bot/types.ts

export enum McpToolName {
  // Auth
  AUTH = "auth",
  REGISTER_TELEGRAM = "register_telegram",
  LINK_TELEGRAM = "link_telegram",

  // Story
  COLD_START = "cold_start",
  RESET_COLD_START = "reset_cold_start",
  GET_STORY = "get_story",

  // Search
  SEARCH_BY_TARGET = "search_by_target",
  SEARCH_USER_CAREERS = "search_user_careers",
  SEARCH_CAREERS = "search_careers",

  // Goals
  SET_GOAL = "set_goal",
  GET_GOAL = "get_goal",
  DELETE_GOAL = "delete_goal",

  // Contexts
  UPDATE_CONTEXT = "update_context",
  UPSERT_CONTEXT = "upsert_context",
  DELETE_CONTEXT = "delete_context",

  // Trails
  UPSERT_TRAIL = "upsert_trail",
  DELETE_TRAIL = "delete_trail",
}

// SEARCH_CONFIG использует enum
export const SEARCH_CONFIG = {
  by_target: {
    command: "/by_target",
    action: "by_target" as const,
    i18n: { usage: "target-usage", searching: "searching-target" },
    mcpTool: McpToolName.SEARCH_BY_TARGET, // ✅ Type-safe
  },
  // ...
} as const;

// McpClient сигнатура
export class McpClient {
  async callTyped<T>(
    toolName: McpToolName, // ✅ Enum
    params: Record<string, unknown>,
    schema: z.ZodType<T>
  ): Promise<T> { ... }
}
```

**Плюсы**:
- ✅ Простота (все в одном модуле)
- ✅ Type-safe tool names
- ✅ SEARCH_CONFIG использует enum

**Минусы**:
- ⚠️ Дублирование (bot и facade имеют tool names)
- ⚠️ Нужно sync вручную (изменения в facade → bot)

---

### Вариант B: Enum в shared (рекомендуется ✅)

```typescript
// src/shared/schemas.ts

export enum McpToolName {
  // Auth
  AUTH = "auth",
  REGISTER_TELEGRAM = "register_telegram",
  LINK_TELEGRAM = "link_telegram",

  // Story
  COLD_START = "cold_start",
  RESET_COLD_START = "reset_cold_start",
  GET_STORY = "get_story",

  // Search
  SEARCH_BY_TARGET = "search_by_target",
  SEARCH_USER_CAREERS = "search_user_careers",
  SEARCH_CAREERS = "search_careers",

  // Goals
  SET_GOAL = "set_goal",
  GET_GOAL = "get_goal",
  DELETE_GOAL = "delete_goal",

  // Contexts
  UPDATE_CONTEXT = "update_context",
  UPSERT_CONTEXT = "upsert_context",
  DELETE_CONTEXT = "delete_context",

  // Trails
  UPSERT_TRAIL = "upsert_trail",
  DELETE_TRAIL = "delete_trail",
}
```

```typescript
// src/telegram-bot/types.ts

import { McpToolName } from "../shared/schemas.js";

export const SEARCH_CONFIG = {
  by_target: {
    command: "/by_target",
    action: "by_target" as const,
    i18n: { usage: "target-usage", searching: "searching-target" },
    mcpTool: McpToolName.SEARCH_BY_TARGET, // ✅ Из shared
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

```typescript
// src/telegram-bot/services/mcp-client.ts

import { McpToolName } from "../../shared/schemas.js";

export class McpClient {
  async callTyped<T>(
    toolName: McpToolName, // ✅ Enum из shared
    params: Record<string, unknown>,
    schema: z.ZodType<T>
  ): Promise<T> {
    const result = await this.call(toolName, params);
    return schema.parse(parseJsonContent(result));
  }
}
```

```typescript
// src/facade/mcp-server/facade-mcp-server.ts (опционально)

import { McpToolName } from "../../shared/schemas.js";

function registerAuthTool(server: FastMCP, tool: AuthTool): void {
  server.addTool({
    name: McpToolName.AUTH, // ✅ Type-safe (опционально)
    description: "...",
    parameters: authParamsSchema,
    execute: async (args: unknown) => { ... },
  });
}
```

**Плюсы**:
- ✅ **Single source of truth** (один enum для bot + facade)
- ✅ **Автоматический sync** (изменения в shared → везде)
- ✅ **Facade может мигрировать** (опционально, для type safety)
- ✅ **DRY** (не дублируем tool names)

**Минусы**:
- ⚠️ Зависимость bot → shared (НО это OK для типов, shared уже используется)

---

### Вариант C: Tool Registry (Advanced)

```typescript
// src/shared/tool-registry.ts

import {
  authParamsSchema,
  coldStartParamsSchema,
  telegramRegisterParamsSchema,
  // ... все Facade schemas
} from "./facade/mcp-server/schemas.js"; // ⚠️ Проблема: facade schemas не в shared!

export const TOOL_REGISTRY = {
  register_telegram: {
    params: telegramRegisterParamsSchema,
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

// McpClient с полной type safety
export class McpClient {
  async callTool<T extends ToolName>(
    toolName: T,
    params: z.infer<typeof TOOL_REGISTRY[T]["params"]> // ✅ Type-safe params!
  ): Promise<z.infer<typeof TOOL_REGISTRY[T]["response"]>> {
    const tool = TOOL_REGISTRY[toolName];

    // ✅ Runtime валидация params
    const validatedParams = tool.params.parse(params);

    const result = await this.call(toolName, validatedParams);

    // ✅ Runtime валидация response
    return tool.response.parse(parseJsonContent(result));
  }
}

// Использование
await mcpClient.callTool(
  "register_telegram", // ✅ Autocomplete
  {
    telegramUserId: 123,
    // ✅ TypeScript знает какие поля нужны!
  }
);

// ❌ TypeScript error: params не соответствует схеме
await mcpClient.callTool(
  "register_telegram",
  { invalidParam: "foo" }
);
```

**Плюсы**:
- ✅ **Полная type safety** (tool names + params + response)
- ✅ **Single source of truth** (tool registry)
- ✅ **Runtime валидация** (Zod для params + response)
- ✅ **Autocomplete** для params в IDE

**Минусы**:
- ❌ **Дублирование схем** (Facade уже имеет Zod schemas в `src/facade/mcp-server/schemas.ts`)
- ❌ **Сложность** (нужно переносить Facade schemas в shared)
- ❌ **Зависимость** (tool registry зависит от всех Facade schemas)

**Проблема**: Facade schemas в `src/facade/mcp-server/schemas.ts` → нужно переносить в shared (breaking change)

---

## Рекомендация (ОБНОВЛЕНО)

**⚠️ Первоначальный анализ был НЕВЕРНЫМ!**

После детального разбора с примерами бизнес-кода:

### ✅ Вариант C (Tool Registry) - ФИНАЛЬНОЕ РЕШЕНИЕ

**Почему Вариант B был ошибкой**:
- ❌ Половинчатое решение (только tool names, params все еще `Record<string, unknown>`)
- ❌ Ошибки только в runtime (после HTTP request)
- ❌ Больше boilerplate в handlers

**Почему Вариант C лучше**:
1. ✅ **Полная type safety** (tool names + params + response)
2. ✅ **Early error detection** (compile-time + Bot runtime, ДО HTTP request)
3. ✅ **НЕТ дублирования** (переиспользуем Facade schemas из `src/facade/mcp-server/schemas.ts`)
4. ✅ **Defense in depth** (Bot + Facade валидация - standard practice, НЕ дублирование)
5. ✅ **Лучше DX** (autocomplete для params, меньше boilerplate)
6. ✅ **Single source of truth** (tool registry)

**Мои ошибки в первоначальном анализе**:
1. ❌ "Дублирование схем" - ЛОЖЬ (Facade schemas остаются в `src/facade/mcp-server/schemas.ts`, просто импортируем)
2. ❌ "Дублирование валидации" - ЛОЖЬ (Bot валидация = early errors, Facade валидация = security)
3. ❌ "Сложность переноса" - ЛОЖЬ (НЕ нужно переносить, просто импортируем)

**См. детальное сравнение**: `VARIANT-B-VS-C-COMPARISON.md`

---

## Итоговое Решение

**Вариант C (Tool Registry)** - ФИНАЛЬНОЕ РЕШЕНИЕ ✅

**План реализации**:

**Шаг 1**: Добавить enum в shared/schemas.ts:
```typescript
// src/shared/schemas.ts

export enum McpToolName {
  // Auth
  AUTH = "auth",
  REGISTER_TELEGRAM = "register_telegram",
  LINK_TELEGRAM = "link_telegram",

  // Story
  COLD_START = "cold_start",
  RESET_COLD_START = "reset_cold_start",
  GET_STORY = "get_story",

  // Search
  SEARCH_BY_TARGET = "search_by_target",
  SEARCH_USER_CAREERS = "search_user_careers",
  SEARCH_CAREERS = "search_careers",

  // Goals
  SET_GOAL = "set_goal",
  GET_GOAL = "get_goal",
  DELETE_GOAL = "delete_goal",

  // Contexts
  UPDATE_CONTEXT = "update_context",
  UPSERT_CONTEXT = "upsert_context",
  DELETE_CONTEXT = "delete_context",

  // Trails
  UPSERT_TRAIL = "upsert_trail",
  DELETE_TRAIL = "delete_trail",
}
```

**Шаг 2**: SEARCH_CONFIG использует enum:
```typescript
// src/telegram-bot/types.ts

import { McpToolName } from "../shared/schemas.js";

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

**Шаг 3**: McpClient использует enum:
```typescript
// src/telegram-bot/services/mcp-client.ts

import { McpToolName } from "../../shared/schemas.js";

export class McpClient {
  async call(
    toolName: McpToolName, // ✅ Строгий enum
    params: Record<string, unknown>
  ): Promise<McpToolResult> {
    // ...
  }

  async callTyped<T>(
    toolName: McpToolName, // ✅ Строгий enum
    params: Record<string, unknown>,
    schema: z.ZodType<T>
  ): Promise<T> {
    // ...
  }
}
```

**Проверка**:
```bash
npm run lint
npx tsc --noEmit
```

---

## Ответ на Вопрос

> "мы же уже вроде согласовали енум конфиг, его нельзя тут переиспользовать? или расширить?"

**Ответ**: SEARCH_CONFIG - это bot-specific конфиг для 3 search команд (из 17 MCP tools).

**Решение**:
1. ✅ Создать **полный enum McpToolName** в shared/schemas.ts (все 17 tools)
2. ✅ SEARCH_CONFIG **переиспользует** enum: `mcpTool: McpToolName.SEARCH_BY_TARGET`
3. ✅ McpClient принимает `toolName: McpToolName`

**Не нужно расширять SEARCH_CONFIG** (он bot-specific), нужен отдельный enum для всех MCP tools.

> "Если хочешь полную type safety для params → Вариант 3 (Tool Registry)"

**Мнение**: Tool Registry (Вариант C) - **сложнее и не нужен сейчас**, потому что:
- ⚠️ Facade уже валидирует params через Zod → дублирование
- ⚠️ Нужно переносить Facade schemas в shared (breaking change)
- ⚠️ Сложность реализации vs польза

**Рекомендую**: Начать с **Вариант B (enum в shared)**, если понадобится полная type safety → мигрировать на Tool Registry позже.

---

## Финальное Решение

**✅ Вариант B (Enum в shared)** - Single source of truth, DRY, type-safe tool names.

После согласования → можем начинать реализацию!
