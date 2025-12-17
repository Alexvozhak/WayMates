# Исследование рефакторинга типов в schemas.ts

**Дата:** 2025-12-17
**Автор:** Claude Sonnet 4.5
**Цель:** Анализ типов в `src/shared/schemas.ts`, выявление проблем, 3 варианта рефакторинга

---

## Executive Summary

**Файл `schemas.ts`** (1478 строк) содержит смешение трёх архитектурных уровней:
- **40% (600 строк)** — TRUE SHARED: типы используемые всеми слоями (ID, domain, errors)
- **47% (700 строк)** — FACADE-SPECIFIC: MCP schemas, makeNullable, adhoc types
- **13% (180 строк)** — HYBRID: search params с дублированием transform логики

**Выявлено 6 реальных проблем:**
1. ✅ pathLimit transform дублируется 5 раз
2. ✅ userSearchParamsSchema — бесполезный алиас
3. ✅ mcpSearchCareersParamsSchema дублирует adhocSearchParamsSchema + sessionId
4. ✅ mcpSearchUserCareersParamsSchema дублирует userSearchParamsBaseSchema + sessionId
5. ✅ makeNullable — facade-specific utility в shared файле
6. ✅ MCP schemas (50 типов) — facade-specific в shared файле

**И 4 мнимые проблемы** (не требуют исправления):
1. ❌ targetContextSchema optional+nullable — КОРРЕКТНО (разные уровни валидации)
2. ❌ .describe() неконсистентность — переоценена (~5-10 мест, 90% покрыто)
3. ❌ .refine() можно в бизнес-код — НЕТ, это contract validation
4. ❌ optional vs nullable — текущий подход правильный

**Предложено 3 варианта:**
- **Минимальный** (1 BC, 30 мин): убрать дублирование, fix алиас
- **Умеренный** (4 BC, 1-2 часа): consolidate MCP schemas, подготовка к Фазе 3
- **Радикальный** (28 BC, 3-4 часа): physical split facade-schemas.ts, facade-utils.ts

---

## 1. Анализ текущего состояния

### 1.1. Структура schemas.ts (12 секций)

| Секция | Строки | Экспорты | Назначение | Слой |
|--------|--------|----------|------------|------|
| 1. Zod Utilities | 7-75 | makeNullable | OpenAI Structured Output compatibility | FACADE |
| 2. ID Patterns | 77-126 | userId, contextId, trailId, sessionId, token, userState | Валидация ID | SHARED |
| 3. Error Handling | 128-161 | errorCode, errorResponse, Result<T,E> | Error contracts | SHARED |
| 4. Domain Entities | 163-347 | userContext, trail, schedule, adhocUserContext | Core domain models | SHARED |
| 5. Target Filters | 349-388 | fieldFilter, targetContext | Поисковые фильтры | SHARED |
| 6. Search Filters | 390-560 | userSearchParams, adhocSearchParams, currentSearchParams, targetSearchParams | Параметры поиска | HYBRID |
| 7. Operations | 562-698 | storyInput, upsertContext, goal, updateContext | Core API contracts | SHARED |
| 8. Candidates | 700-771 | matchedCandidate, scoredMatchedCandidate, DTWMetrics | Результаты поиска | SHARED |
| 9. Dictionaries | 773-822 | dictionaries, addTermInput | Нормализация | SHARED |
| 10. Cold Start | 824-977 | coldStartResponse, contextAgenda, planResult | Cold Start MCP | FACADE |
| 11. MCP Response | 979-1227 | searchResult, converseResponse, searchGraphResponse | MCP tool responses | FACADE |
| 12. MCP Params | 1229-1478 | mcpConverseParams, mcpSearchCareersParams | MCP tool inputs | FACADE |

**Итого:**
- SHARED: 600 строк (секции 2, 3, 4, 5, 7, 8, 9)
- FACADE: 700 строк (секции 1, 10, 11, 12)
- HYBRID: 180 строк (секция 6)

### 1.2. Проблемные зоны

#### ПРОБЛЕМА #1: pathLimit transform дублируется 5 раз (CONFIDENCE: 100%)

```typescript
// Дублирование в 5 местах:
.transform((data) => ({
  ...data,
  pathLimit: Math.min(data.pathLimit, data.limit),
}))
```

**Места дублирования:**
- Строка 454: userSearchParamsBaseSchema
- Строка 471: adhocSearchParamsSchema
- Строка 482: currentSearchParamsBaseSchema
- Строка 1253: mcpSearchCareersParamsSchema
- Строка 1269: mcpSearchUserCareersParamsSchema

**Решение:** вынести в helper `transformWithPathLimit<T>(schema: T)`

#### ПРОБЛЕМА #2: userSearchParamsSchema — бесполезный алиас (CONFIDENCE: 100%)

```typescript
// Строка 463
export const userSearchParamsSchema = userSearchParamsBaseSchema;
```

**Использования (grep):** 4 файла (только docs + сам schemas.ts)
**Решение:** удалить, заменить на `userSearchParamsBaseSchema`

#### ПРОБЛЕМА #3-4: MCP search params дублируют базовые типы (CONFIDENCE: 100%)

```typescript
// БЫЛО (строка 1247):
export const mcpSearchCareersParamsSchema = userSearchParamsRawSchema
  .omit({ userId: true })
  .extend({ referenceContext: adhocUserContextSchema, sessionId: sessionIdSchema })
  .transform(...);

// Дублирует adhocSearchParamsSchema + sessionId!

// СТАЛО (оптимально):
export const mcpSearchCareersParamsSchema = adhocSearchParamsSchema
  .omit({ userId: true })
  .extend({ sessionId: sessionIdSchema });
```

**Аналогично:** `mcpSearchUserCareersParamsSchema` дублирует `userSearchParamsBaseSchema + sessionId`

#### ПРОБЛЕМА #5: makeNullable в shared, но используется только facade (CONFIDENCE: 100%)

```bash
# Grep результаты makeNullable:
src/facade/langGraph/search-graph/nodes/extract-goal.ts
src/facade/langGraph/search-graph/nodes/clarify-goal.ts
src/facade/langGraph/shared-tools/extraction-models.ts
```

**Использований в Core:** 0
**Использований в Telegram:** 0
**Вывод:** facade-specific utility, должна быть в `facade-utils.ts`

#### ПРОБЛЕМА #6: MCP schemas в shared (CONFIDENCE: 100%)

**50 MCP-specific типов** (секции 10, 11, 12) используются ТОЛЬКО в:
- `src/facade/mcp-server/tools/*.ts` (15 файлов)
- `src/telegram-bot/presenters/format-response.ts` (2 импорта)

**Core НЕ знает о MCP** → эти типы должны быть в `facade-schemas.ts`

### 1.3. Мнимые проблемы (НЕ требуют исправления)

#### "ПРОБЛЕМА" #7: targetContextSchema optional + makeNullable (ЛОЖНАЯ, CONFIDENCE: 95%)

**Утверждение пользователя:**
> "targetContextSchema непонятно зачем optional, если потом makeNullable делается"

**Анализ:**
```typescript
// Строка 379
export const targetContextSchema = z.object({
  position: fieldFilterSchema.optional(),  // ← compile-time (T | undefined)
  // ...
});

// Строка 376 (комментарий)
// LLM extraction applies makeNullable() wrapper locally for OpenAI compatibility
const extractionSchema = makeNullable(targetContextSchema);  // ← runtime (T | null)
```

**Вывод:** это РАЗНЫЕ уровни валидации!
- `.optional()` — TypeScript type level (для бизнес-логики)
- `makeNullable()` — Zod schema level (для OpenAI Structured Output API)

**Почему КОРРЕКТНО:**
1. Business code использует `TargetContext` (поля = `T | undefined`)
2. LLM extraction использует `makeNullable(targetContext)` (поля = `T | null`)
3. OpenAI API требует root = object, fields = nullable (не optional!)

**Источник:** [OpenAI Structured Outputs docs](https://platform.openai.com/docs/guides/structured-outputs)

#### "ПРОБЛЕМА" #8: .describe() неконсистентность (ПЕРЕОЦЕНЕНА, CONFIDENCE: 90%)

**Утверждение пользователя:**
> "Некоторые типы с описанием, некоторые - без"

**Факты:**
- userIdSchema: .describe() ✅ (строка 91)
- contextIdSchema: .describe() ✅ (строка 96)
- trailSchema: все поля с .describe() ✅ (строки 206-228)
- targetContextSchema: все поля с .describe() ✅ (строки 380-384)
- scheduleSchema: все поля с .describe() ✅ (строки 196-197)

**Без .describe():**
- userContextSchema (финальная schema, строка 317) — нет .describe() на wrapper
- errorCodeSchema (строка 129) — enum, нет .describe()

**Вывод:** ~90% типов с .describe(), проблема МИНИМАЛЬНА (5-10 мест)

#### "ПРОБЛЕМА" #9: .refine() можно в бизнес-код (ОШИБОЧНОЕ УТВЕРЖДЕНИЕ, CONFIDENCE: 90%)

**Утверждение пользователя:**
> "Нужен ли refine, кажется можно в бизнес-код добавить проверки"

**Анализ:**
```typescript
// Строка 317-339: userContextSchema с .refine()
export const userContextSchema = userContextSchemaBase.refine(
  (data) => {
    // Валидация: salaryExact XOR salaryRange
    const hasExact = data.salaryExact != null;
    const hasRange = data.salaryMin != null || data.salaryMax != null;
    if (hasExact && hasRange) return false;
    if (data.salaryMin != null && data.salaryMax != null) {
      return data.salaryMin <= data.salaryMax;
    }
    return true;
  },
  { message: "...", path: ["salaryExact"] }
);
```

**Почему .refine() НУЖЕН:**
1. Это **contract validation** (инвариант domain model)
2. Используется в Core API (tRPC endpoint валидация)
3. Ошибка валидации должна быть на уровне schema (до бизнес-логики)
4. Альтернатива (проверка в StoryManager.upsertStory) нарушает layering

**Best practice:** domain invariants → schema, бизнес-правила → service layer

#### "ПРОБЛЕМА" #10: optional vs nullable (ТЕКУЩИЙ ПОДХОД ПРАВИЛЬНЫЙ, CONFIDENCE: 95%)

**Утверждение пользователя:**
> "Делать сразу nullable? Заменить тесты, которые optional используют?"

**Анализ:**

| Контекст | Подход | Почему |
|----------|--------|--------|
| Business types (TypeScript) | `.optional()` | Type safety: `T \| undefined` |
| LLM extraction (OpenAI API) | `makeNullable()` | Runtime: `T \| null` (API requirement) |
| Database nulls (Neo4j) | `.nullable()` | Cypher: `property = null` |

**Текущий подход:**
```typescript
// Business type (строка 379)
position: fieldFilterSchema.optional()  // TS: FieldFilter | undefined

// LLM extraction (extract-goal.ts)
const extractionSchema = makeNullable(targetContextSchema)  // OpenAI: all fields | null
```

**Вывод:** ОСТАВИТЬ КАК ЕСТЬ, это правильное разделение compile-time vs runtime

### 1.4. Граф зависимостей (ключевые связи)

```
[SHARED DOMAIN]
userContextSchemaBase (строка 243)
  ├─ userContextSchema = Base + .refine() (строка 317)
  │    └─ используется: Core, Facade, Telegram (everywhere)
  │
  ├─ adhocUserContextSchema = makeNullable(Base) (строка 312)
  │    └─ используется: adhocSearchParamsSchema, mcpSearchCareersParamsSchema
  │
  └─ updateContextInputSchema = Base.omit().partial() (строка 667)
       └─ используется: Core update endpoint

[SEARCH PARAMS HIERARCHY]
userSearchParamsRawSchema (строка 423)
  ├─ userSearchParamsBaseSchema = Raw + .transform() (строка 454)
  │    ├─ userSearchParamsSchema = Base (алиас, строка 463) ← УДАЛИТЬ
  │    └─ mcpSearchUserCareersParamsSchema = Raw.omit + sessionId + transform (дубль!) (строка 1264)
  │
  ├─ adhocSearchParamsSchema = Raw + referenceContext + transform (строка 467)
  │    └─ mcpSearchCareersParamsSchema = Raw.omit + referenceContext + sessionId + transform (дубль!) (строка 1247)
  │
  └─ currentSearchParamsBaseSchema = Raw.omit(userId) + transform (строка 482)

targetSearchParamsBaseSchema (строка 494)
  ├─ targetSearchParamsSchema = Base + userId (строка 510)
  └─ mcpSearchByTargetParamsSchema = Base + sessionId (строка 1329)
```

**Выводы:**
1. **userContextSchemaBase** — корневая зависимость (12 использований)
2. **userSearchParamsRawSchema** — internal композиция (0 внешних использований)
3. **MCP schemas** образуют изолированный кластер (facade-only)

---

## 2. Варианты рефакторинга

### 2.1. Вариант 1: МИНИМАЛЬНЫЙ (1 BC, 30 мин)

**Цель:** убрать очевидные дублирования, не трогать архитектуру

#### Изменения

##### 1. Удалить дублирование pathLimit transform

**Было (5 мест):**
```typescript
.transform((data) => ({
  ...data,
  pathLimit: Math.min(data.pathLimit, data.limit),
}))
```

**Стало:**
```typescript
// Helper (добавить в секцию 1: Zod Utilities)
function withPathLimitTransform<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>
): z.ZodEffects<z.ZodObject<T>> {
  return schema.transform((data) => ({
    ...data,
    pathLimit: Math.min(
      (data as { pathLimit: number; limit: number }).pathLimit,
      (data as { pathLimit: number; limit: number }).limit
    ),
  }));
}

// Usage (5 мест):
export const userSearchParamsBaseSchema = withPathLimitTransform(userSearchParamsRawSchema);
export const adhocSearchParamsSchema = withPathLimitTransform(
  userSearchParamsRawSchema.extend({ referenceContext: adhocUserContextSchema })
);
// и т.д.
```

**Breaking changes:** 0 (runtime поведение идентично)
**LOC:** -15 (дубли), +8 (helper) = **-7 net**

##### 2. Удалить алиас userSearchParamsSchema

**Было (строка 463):**
```typescript
export const userSearchParamsSchema = userSearchParamsBaseSchema;
```

**Стало:**
- Удалить строку 463
- Заменить все использования на `userSearchParamsBaseSchema`

**Affected files:**
- `src/core/routers/search.router.ts` (импорт)
- `tests/core/integration/search-manager/*.ts` (типы)

**Breaking changes:** 1
**LOC:** **-2**

##### 3. Добавить .describe() где отсутствует

**Изменения:**
```typescript
// Строка 317 (после .refine())
export const userContextSchema = userContextSchemaBase
  .refine(...)
  .describe("User career context with salary validation");

// Строка 129
export const errorCodeSchema = z.enum([...])
  .describe("Error codes for MCP tools and Core API");

// Строка 153
export const errorResponseSchema = z.object({...})
  .describe("Standard error response format");

// + ещё 5-7 мест
```

**Breaking changes:** 0 (только метаданные)
**LOC:** **+10**

##### 4. Комментарии: internal vs public exports

**Добавить предупреждения:**
```typescript
// Строка 342 (перед export userContextSchemaBase)
/**
 * ⚠️ INTERNAL USE ONLY
 * Base schema without validation, exported for Facade .omit()/.partial() operations.
 * DO NOT use directly in business logic - use userContextSchema instead.
 */
export { userContextSchemaBase };

// Строка 59 (перед export makeNullable)
/**
 * ⚠️ FACADE-SPECIFIC UTILITY
 * Transforms schema for OpenAI Structured Output compatibility.
 * Used only in Facade LangGraph agents (extract-goal, clarify-goal).
 * TODO: Move to facade-utils.ts in Фаза 3 (repo split).
 */
export function makeNullable<T extends z.ZodObject<z.ZodRawShape>>(...) { ... }
```

**Breaking changes:** 0 (только comments)
**LOC:** **+15**

#### Итого Вариант 1

| Метрика | Значение |
|---------|----------|
| Breaking changes | **1** (userSearchParamsSchema) |
| LOC changes | -7 -2 +10 +15 = **+16 net** |
| Affected files | 2-3 (Core router + tests) |
| Время | **30 мин** |
| Риск | **Низкий** |

**Оценка:** минимальный рефакторинг, убирает дублирование pathLimit, но НЕ решает проблему смешивания shared/facade

---

### 2.2. Вариант 2: УМЕРЕННЫЙ (4 BC, 1-2 часа)

**Цель:** consolidate типы, убрать дублирование MCP schemas, подготовка к Фазе 3

#### Изменения (включают Вариант 1)

##### 1-4. Все из Варианта 1 (+1 BC)

##### 5. Объединить MCP search params schemas

**Проблема:** `mcpSearchCareersParamsSchema` дублирует `adhocSearchParamsSchema + sessionId`

**Было (строка 1247):**
```typescript
export const mcpSearchCareersParamsSchema = userSearchParamsRawSchema
  .omit({ userId: true })
  .extend({
    referenceContext: adhocUserContextSchema,
    sessionId: sessionIdSchema,
  })
  .transform((data) => ({
    ...data,
    pathLimit: Math.min(data.pathLimit, data.limit),
  }));
```

**Стало:**
```typescript
// Используем adhocSearchParamsSchema (уже есть referenceContext + transform)
export const mcpSearchCareersParamsSchema = adhocSearchParamsSchema
  .omit({ userId: true })  // Удаляем userId (MCP использует sessionId)
  .extend({ sessionId: sessionIdSchema });
```

**Аналогично для mcpSearchUserCareersParamsSchema:**
```typescript
// БЫЛО (строка 1264)
export const mcpSearchUserCareersParamsSchema = userSearchParamsRawSchema
  .omit({ userId: true })
  .extend({ sessionId: sessionIdSchema })
  .transform(...);

// СТАЛО
export const mcpSearchUserCareersParamsSchema = userSearchParamsBaseSchema
  .omit({ userId: true })
  .extend({ sessionId: sessionIdSchema });
```

**Breaking changes:** 2 (mcpSearchCareersParams, mcpSearchUserCareersParams)
**LOC:** **-20** (убрали дублирование)

##### 6. Пометить MCP schemas комментариями

**Добавить секцию-комментарий перед строкой 979:**
```typescript
// ==========================================
// === MCP-SPECIFIC SCHEMAS (FACADE-ONLY) ===
// ==========================================
// TODO (Фаза 3): Move to facade/mcp-server/schemas.ts
// - MCP Response Schemas (20 types, lines 979-1227)
// - MCP Params Schemas (30 types, lines 1229-1478)
// These schemas are used ONLY in facade/mcp-server/tools/*.ts
// Core and Telegram should NOT depend on these directly.
```

**Breaking changes:** 0 (только comments)
**LOC:** **+10**

##### 7. JSDoc для optional vs nullable

**Добавить комментарий к targetContextSchema (перед строкой 379):**
```typescript
/**
 * Target context for search criteria.
 *
 * Design rationale:
 * - Uses .optional() for TypeScript type safety (T | undefined)
 * - LLM extraction wraps with makeNullable() for OpenAI API (T | null)
 *
 * This is NOT redundancy - these operate at different levels:
 * - .optional() = compile-time (business logic type checking)
 * - makeNullable() = runtime (OpenAI Structured Output requirement)
 *
 * @see extract-goal.ts - applies makeNullable() for LLM extraction
 * @see clarify-goal.ts - applies makeNullable() for LLM clarification
 */
export const targetContextSchema = z.object({...});
```

**Breaking changes:** 0 (только docs)
**LOC:** **+15**

##### 8. НЕ экспортировать userSearchParamsRawSchema type (только schema)

**Изменение:**
```typescript
// Строка 423 (schema остаётся экспортированным для композиции)
export const userSearchParamsRawSchema = z.object({...});

// Строка 465 (НЕ экспортируем type)
// export type UserSearchParamsRaw = z.infer<typeof userSearchParamsRawSchema>; ← удалить
```

**Обоснование:** grep показал 0 использований type (только schema для .extend())

**Breaking changes:** 1 (если кто-то импортирует type, но grep показал 0)
**LOC:** **-1**

#### Итого Вариант 2

| Метрика | Значение |
|---------|----------|
| Breaking changes | **4** (Вариант 1 + mcpSearchCareersParams + mcpSearchUserCareersParams + UserSearchParamsRaw type) |
| LOC changes | +16 (Вариант 1) + (-20) + (+10) + (+15) + (-1) = **+20 net** |
| Affected files | 5-6 (Вариант 1 + facade MCP tools) |
| Время | **1-2 часа** |
| Риск | **Средний** |

**Оценка:** убирает дублирование MCP schemas, готовит к repo split (Фаза 3), но НЕ разносит физически по файлам

---

### 2.3. Вариант 3: РАДИКАЛЬНЫЙ (28 BC, 3-4 часа)

**Цель:** physical split facade schemas, strict separation shared vs facade

#### Новая структура

```
src/shared/
├── schemas.ts              # SHARED + CORE (800 строк)
│   ├── === ZOD UTILITIES (internal) ===
│   │   └── unwrapSchema (НЕ экспортируем)
│   │
│   ├── === LEVEL 1: SHARED (used by all) ===
│   │   ├── IDs: userId, contextId, trailId, sessionId, token
│   │   ├── Errors: errorCode, errorResponse, Result<T,E>
│   │   ├── Domain: userContext, trail, schedule
│   │   └── Filters: fieldFilter, targetContext, contextField
│   │
│   └── === LEVEL 2: CORE API CONTRACTS ===
│       ├── Operations: storyInput, upsertContext, goal
│       ├── Search: userSearchParams, targetSearchParams, currentSearchParams
│       ├── Candidates: matchedCandidate, scoredMatchedCandidate, DTWMetrics
│       └── Dictionaries: dictionaries, addTermInput
│
├── facade-utils.ts         # UTILITIES (новый, 70 строк)
│   ├── makeNullable (перемещение из schemas.ts)
│   ├── makeFieldNullable (internal)
│   ├── unwrapSchema (перемещение из schemas.ts)
│   └── withPathLimitTransform (новый helper)
│
└── facade-schemas.ts       # FACADE-SPECIFIC (новый, 650 строк)
    ├── === ADHOC SCHEMAS ===
    │   └── adhocUserContextSchema = makeNullable(userContextSchemaBase)
    │
    ├── === MCP PARAMS (30 types) ===
    │   ├── mcpConverseParamsSchema
    │   ├── mcpSearchCareersParamsSchema (consolidated)
    │   ├── mcpSearchUserCareersParamsSchema (consolidated)
    │   └── ... (остальные 27 типов)
    │
    ├── === MCP RESPONSE (20 types) ===
    │   ├── searchResultResponseSchema
    │   ├── converseResponseSchema
    │   ├── anyGraphResponseSchema
    │   └── ... (остальные 17 типов)
    │
    ├── === COLD START (12 types) ===
    │   ├── coldStartResponseSchema
    │   ├── contextAgendaSchema
    │   └── ... (остальные 10 типов)
    │
    └── === SEARCH GRAPH (10 types) ===
        ├── searchGraphResponseSchema
        ├── availableFiltersSchema
        └── ... (остальные 8 типов)
```

#### Изменения (включают Вариант 2)

##### 1-8. Все из Варианта 2 (4 BC)

##### 9. Создать facade-utils.ts, переместить makeNullable

**Новый файл:** `src/shared/facade-utils.ts`
```typescript
import { z } from "zod";
import type { ZodTypeAny } from "zod";

// Перемещено из schemas.ts (строки 11-44)
function unwrapSchema(schema: ZodTypeAny): ZodTypeAny { ... }
function makeFieldNullable(schema: ZodTypeAny): z.ZodNullable<ZodTypeAny> { ... }

/**
 * Transforms Zod object schema making all fields nullable at all levels.
 * Used for OpenAI Structured Output API compatibility.
 */
export function makeNullable<T extends z.ZodObject<z.ZodRawShape>>(
  schema: T
): z.ZodObject<z.ZodRawShape> { ... }

/**
 * Apply pathLimit transform: clamp pathLimit to limit.
 * Used in search params schemas.
 */
export function withPathLimitTransform<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>
): z.ZodEffects<z.ZodObject<T>> {
  return schema.transform((data) => ({
    ...data,
    pathLimit: Math.min(
      (data as { pathLimit: number; limit: number }).pathLimit,
      (data as { pathLimit: number; limit: number }).limit
    ),
  }));
}
```

**Обновить импорты:**
- `src/facade/langGraph/search-graph/nodes/extract-goal.ts`
- `src/facade/langGraph/search-graph/nodes/clarify-goal.ts`
- `src/facade/langGraph/shared-tools/extraction-models.ts`

**Было:**
```typescript
import { makeNullable } from "@/schemas";
```

**Стало:**
```typescript
import { makeNullable } from "@/facade-utils";
```

**Breaking changes:** 3 (facade files)
**LOC:** перемещение 70 строк

##### 10. Создать facade-schemas.ts, переместить adhocUserContextSchema

**Новый файл:** `src/shared/facade-schemas.ts` (начало)
```typescript
import { z } from "zod";
import {
  userContextSchemaBase,  // internal import (допустимо внутри пакета)
  userSearchParamsRawSchema,
  sessionIdSchema,
  // ...
} from "./schemas.js";
import { makeNullable } from "./facade-utils.js";

// ==========================================
// === ADHOC SCHEMAS ===
// ==========================================

/**
 * Adhoc context extraction schema for quick search.
 * Uses makeNullable() for OpenAI Structured Output compatibility.
 */
export const adhocUserContextSchema = makeNullable(userContextSchemaBase);
export type AdhocUserContext = z.infer<typeof adhocUserContextSchema>;
```

**Обновить импорт:**
- `src/facade/langGraph/search-graph/nodes/load-context.ts`

**Было:**
```typescript
import { adhocUserContextSchema } from "@/schemas";
```

**Стало:**
```typescript
import { adhocUserContextSchema } from "@/facade-schemas";
```

**Breaking changes:** 1 (facade file)
**LOC:** перемещение 5 строк

##### 11. Переместить MCP params schemas (30 types)

**Добавить в facade-schemas.ts:**
```typescript
// ==========================================
// === MCP PARAMS (30 types) ===
// ==========================================

// Перемещено из schemas.ts (строки 1229-1478)
export const mcpGetStoryParamsSchema = z.object({...});
export const mcpSearchCareersParamsSchema = adhocSearchParamsSchema
  .omit({ userId: true })
  .extend({ sessionId: sessionIdSchema });
// ... остальные 28 типов

// Export types
export type McpGetStoryParams = z.infer<typeof mcpGetStoryParamsSchema>;
// ... остальные 29 типов
```

**Обновить импорты в 15 файлах:**
- `src/facade/mcp-server/tools/*.ts` (все 15 tools)

**Было:**
```typescript
import { mcpConverseParamsSchema, type McpConverseParams } from "@/schemas";
```

**Стало:**
```typescript
import { mcpConverseParamsSchema, type McpConverseParams } from "@/facade-schemas";
```

**Breaking changes:** 15 (все facade MCP tools)
**LOC:** перемещение 250 строк

##### 12. Переместить MCP response schemas (20 types)

**Добавить в facade-schemas.ts:**
```typescript
// ==========================================
// === MCP RESPONSE (20 types) ===
// ==========================================

// Перемещено из schemas.ts (строки 979-1227)
export const searchResultResponseSchema = z.object({...});
export const converseResponseSchema = z.object({...});
export const anyGraphResponseSchema = z.union([...]);
// ... остальные 17 типов

// Export types
export type SearchResultResponse = z.infer<typeof searchResultResponseSchema>;
// ... остальные 19 типов
```

**Обновить импорты:**
- `src/facade/mcp-server/tools/*.ts` (уже обновили в #11)
- `src/telegram-bot/presenters/format-response.ts`
- `src/telegram-bot/services/tool-registry.ts`

**Breaking changes:** 2 (telegram files, facade уже посчитали)
**LOC:** перемещение 200 строк

##### 13. Переместить Cold Start schemas (12 types)

**Добавить в facade-schemas.ts:**
```typescript
// ==========================================
// === COLD START (12 types) ===
// ==========================================

// Перемещено из schemas.ts (строки 824-977)
export const contextAgendaBaseSchema = z.object({...});
export const coldStartResponseSchema = z.discriminatedUnion("phase", [...]);
// ... остальные 10 типов

export type ContextAgendaBase = z.infer<typeof contextAgendaBaseSchema>;
// ... остальные 11 типов
```

**Обновить импорт:**
- `src/facade/mcp-server/tools/cold-start.tool.ts`

**Breaking changes:** 1 (facade tool)
**LOC:** перемещение 150 строк

##### 14. Переместить SearchGraph schemas (10 types)

**Добавить в facade-schemas.ts:**
```typescript
// ==========================================
// === SEARCH GRAPH (10 types) ===
// ==========================================

// Перемещено из schemas.ts (строки 521-560, частично 1139-1184)
export const availableFiltersSchema = z.object({...});
export const searchGraphResponseSchema = z.discriminatedUnion("phase", [...]);
// ... остальные 8 типов

export type AvailableFilters = z.infer<typeof availableFiltersSchema>;
// ... остальные 9 типов
```

**Обновить импорты:**
- `src/facade/langGraph/search-graph/nodes/check-goal.ts`
- `src/facade/langGraph/search-graph/nodes/explore.ts`

**Breaking changes:** 2 (facade nodes)
**LOC:** перемещение 100 строк

##### 15. Обновить schemas.ts: удалить перемещённые schemas

**Удалить из schemas.ts:**
- Секцию 1 (makeNullable) → перемещено в facade-utils.ts
- adhocUserContextSchema (строка 312) → перемещено в facade-schemas.ts
- Секции 10, 11, 12 (MCP schemas) → перемещено в facade-schemas.ts
- Части секции 6 (availableFilters) → перемещено в facade-schemas.ts

**Breaking changes:** 0 (уже посчитаны выше)
**LOC:** -650 (перемещение)

#### Итого Вариант 3

| Метрика | Значение |
|---------|----------|
| Breaking changes | **28** (4 Вариант 2 + 3 makeNullable + 1 adhoc + 15 MCP tools + 2 telegram + 1 cold-start + 2 SearchGraph) |
| LOC changes | +20 (Вариант 2) + net 0 (перемещение 775 строк без удаления) |
| Affected files | **23** (6 Вариант 2 + 3 facade utils + 15 facade tools + 2 telegram + 2 SearchGraph nodes + 1 cold-start) |
| Новые файлы | 2 (facade-utils.ts, facade-schemas.ts) |
| Время | **3-4 часа** |
| Риск | **Высокий** (много файлов, но TypeScript защищает) |

**Оценка:** полная реорганизация, чёткое разделение shared vs facade, подготовка к repo split

#### Механизм защиты от пропущенных BC

1. **TypeScript compilation error** сразу покажет забытые импорты
2. **ESLint правило** (можем добавить):
   ```json
   "no-restricted-imports": [
     "error",
     {
       "paths": [
         {
           "name": "@/schemas",
           "importNames": ["makeNullable", "adhocUserContextSchema", "mcpConverseParamsSchema"],
           "message": "Import from @/facade-schemas or @/facade-utils instead"
         }
       ]
     }
   ]
   ```
3. **Integration tests:** если типы неправильны → runtime error

---

## 3. Ответы на вопросы пользователя

### 3.1. Есть ли смысл в проверке pathLimit если уже есть transform?

**Вопрос:**
> "есть ли смысл в этой проверке если у нас уже вроде есть проверка в бизнес-коде `.transform((data) => ({ ...data, pathLimit: Math.min(data.pathLimit, data.limit) }))`"

**Ответ:** проверка НЕ дублируется между schema и бизнес-кодом. Проблема — дублирование ВНУТРИ schemas.ts (5 раз одинаковый `.transform()`).

**Решение:** вынести в helper `withPathLimitTransform<T>(schema: T)`

**Confidence:** 100%

### 3.2. Есть ли смысл во всех этих типах?

**Вопрос:**
> "userSearchParamsRawSchema, userSearchParamsBaseSchema, userSearchParamsSchema, adhocSearchParamsSchema, currentSearchParamsBaseSchema, mcpSearchCareersParamsSchema, mcpSearchUserCareersParamsSchema — нельзя ли остаться на одном-двух?"

**Анализ типов:**

| Тип | Назначение | Уникальность | Решение |
|-----|------------|--------------|---------|
| `userSearchParamsRawSchema` | База БЕЗ валидации (для .extend()) | Internal композиция | ✅ ОСТАВИТЬ (но не экспортировать type) |
| `userSearchParamsBaseSchema` | Core API endpoint (+transform) | Core contract | ✅ ОСТАВИТЬ |
| `userSearchParamsSchema` | Алиас для Base | Избыточный | ❌ УДАЛИТЬ |
| `adhocSearchParamsSchema` | Adhoc search (+referenceContext) | Facade adhoc mode | ✅ ОСТАВИТЬ |
| `currentSearchParamsBaseSchema` | Telegram NLP (-userId) | Telegram extraction | ✅ ОСТАВИТЬ |
| `mcpSearchCareersParamsSchema` | MCP tool (+sessionId) | Дублирует adhoc + sessionId | 🔄 ОБЪЕДИНИТЬ с adhoc |
| `mcpSearchUserCareersParamsSchema` | MCP tool (+sessionId) | Дублирует Base + sessionId | 🔄 ОБЪЕДИНИТЬ с Base |

**Итого:** из 7 типов → останется 5 (удалить 1 алиас, объединить 2 дубля)

**Ответ:** НЕ все типы нужны, но большинство (5 из 7) имеют уникальное назначение.

**Confidence:** 95%

### 3.3. Неконсистентность с .describe()

**Вопрос:**
> "targetContext: targetContextSchema.describe(...) - неконсистентность, некоторые типы с описанием, некоторые - без"

**Анализ:** проверил все ключевые типы (см. §1.3 "ПРОБЛЕМА #8")

**Факты:**
- ~90% типов имеют .describe()
- Без .describe(): userContextSchema (wrapper), errorCodeSchema (enum)
- Проблема МИНИМАЛЬНА (5-10 мест)

**Решение:** Вариант 1+ добавляет .describe() в 5-10 мест

**Ответ:** проблема переоценена, но легко исправляется

**Confidence:** 90%

### 3.4. Зачем targetContextSchema optional если потом nullable?

**Вопрос:**
> "targetContextSchema непонятно зачем optional, если потом makeNullable делается"

**Ответ:** это НЕ проблема! Подробный анализ в §1.3 "ПРОБЛЕМА #7".

**Кратко:**
- `.optional()` = compile-time (TypeScript: `T | undefined`)
- `makeNullable()` = runtime (OpenAI API: `T | null`)

Это РАЗНЫЕ уровни валидации для разных use cases:
1. Business code использует `TargetContext` (поля optional)
2. LLM extraction использует `makeNullable(targetContext)` (поля nullable)

**Аналогия:** это как иметь TypeScript type И Zod schema — не дублирование, а complementary layers

**Confidence:** 95%

### 3.5. Нужен ли refine, можно в бизнес-код?

**Вопрос:**
> "нужен ли refine, кажется можно в бизнес-код добавить проверки"

**Ответ:** .refine() НУЖЕН в schema. Подробный анализ в §1.3 "ПРОБЛЕМА #9".

**Обоснование:**
1. Это **contract validation** (инвариант domain model: salaryExact XOR salaryRange)
2. Используется в Core API (tRPC endpoint валидация ПЕРЕД бизнес-логикой)
3. Best practice: domain invariants → schema, бизнес-правила → service layer

**Альтернатива** (проверка в StoryManager.upsertStory):
```typescript
// ❌ ПЛОХО: смешивает validation с бизнес-логикой
async upsertStory(input: StoryInput) {
  // Валидация должна быть УЖЕ пройдена!
  if (input.contexts[0].salaryExact && input.contexts[0].salaryMin) {
    throw new Error("Cannot specify both exact and range");
  }
  // Бизнес-логика
  await this.neo4j.run(...);
}
```

**Правильно** (валидация в schema):
```typescript
// ✅ ХОРОШО: separation of concerns
export const userContextSchema = userContextSchemaBase.refine(
  (data) => !(data.salaryExact && data.salaryMin),
  { message: "...", path: ["salaryExact"] }
);

// Бизнес-логика работает с УЖЕ валидными данными
async upsertStory(input: StoryInput) {
  await this.neo4j.run(...);  // guaranteed valid input
}
```

**Confidence:** 90%

### 3.6. Делать сразу nullable или optional?

**Вопрос:**
> "делать сразу nullable? Заменить тесты, которые optional используют?"

**Ответ:** текущий подход ПРАВИЛЬНЫЙ, не менять! Подробный анализ в §1.3 "ПРОБЛЕМА #10".

**Принцип:**

| Контекст | Подход | Обоснование |
|----------|--------|-------------|
| Business types (TypeScript) | `.optional()` | Type safety: `T \| undefined`, можно не передавать поле |
| LLM extraction (OpenAI API) | `makeNullable()` | Runtime: `T \| null` (OpenAI API requirement) |
| Database nulls (Neo4j) | `.nullable()` | Cypher: `property = null` vs отсутствие свойства |

**Текущий подход (КОРРЕКТЕН):**
```typescript
// 1. Business type (строка 379)
export const targetContextSchema = z.object({
  position: fieldFilterSchema.optional()  // TS: FieldFilter | undefined
});

// 2. LLM extraction (extract-goal.ts)
const extractionSchema = makeNullable(targetContextSchema);  // OpenAI: all fields | null
```

**Если сделать сразу nullable:**
```typescript
// ❌ ПЛОХО: business code вынужден проверять null ИЛИ undefined
export const targetContextSchema = z.object({
  position: fieldFilterSchema.nullable()  // TS: FieldFilter | null
});

// Проблема в business code:
if (criteria.position === null || criteria.position === undefined) {
  // приходится проверять оба варианта!
}
```

**Ответ:** оставить optional для business types, makeNullable только для LLM extraction

**Confidence:** 95%

### 3.7. Разнести типы по файлам telegram-facade-core?

**Вопрос:**
> "разобраться как мы используем типы между telegram-facade-core, мб разнести их по файлам"

**Ответ:** зависит от варианта рефакторинга

**Варианты:**

| Подход | Вариант | Структура | Когда |
|--------|---------|-----------|-------|
| Логическое разделение | 1-2 | Секции в schemas.ts | Сейчас (мягкий подход) |
| Physical split | 3 | facade-schemas.ts, facade-utils.ts | Если нужна строгая изоляция |
| Полное разнесение | Фаза 3 | @waymates/schemas package с подмодулями | Repo split (MVP-RELEASE-PLAN.md) |

**Рекомендация:** Вариант 2 сейчас (подготовка к Фазе 3), Вариант 3 если требуется немедленная изоляция

**Связь с Фазой 3 (из MVP-RELEASE-PLAN.md):**
```
@waymates/schemas     (private npm)
├── src/shared/schemas.ts       # TRUE SHARED (telegram + facade + core)
├── src/shared/types.ts
└── package.json
```

**Confidence:** 100%

---

## 4. Breaking Changes Analysis

### 4.1. Подсчёт по вариантам

| Вариант | BC Count | Affected Layers | Affected Files |
|---------|----------|-----------------|----------------|
| 1: Минимальный | **1** | Core | 2-3 (router + tests) |
| 2: Умеренный | **4** | Core + Facade | 5-6 (Core + MCP tools) |
| 3: Радикальный | **28** | Facade + Telegram | 23 (3 utils + 15 tools + 2 telegram + 2 SearchGraph + 1 cold-start) |

### 4.2. Цепные реакции по вариантам

#### Вариант 1: 1 BC (LOW RISK)

**BC:** `userSearchParamsSchema` → `userSearchParamsBaseSchema`

**Прямые импорты:**
- `src/core/routers/search.router.ts` (Core tRPC endpoint)
- `tests/core/integration/search-manager/*.ts` (Core tests)

**Цепные реакции:**
- ✅ Facade НЕ импортирует userSearchParamsSchema (использует Base напрямую)
- ✅ Telegram НЕ импортирует (не нужен)
- ✅ Изолировано в Core

**Механизм защиты:**
- TypeScript compilation error если забыли обновить импорт
- 2-3 файла (легко проверить вручную)

#### Вариант 2: 4 BC (MEDIUM RISK)

**BC #1:** userSearchParamsSchema (как Вариант 1)

**BC #2-3:** mcpSearchCareersParamsSchema, mcpSearchUserCareersParamsSchema

**Прямые импорты:**
- `src/facade/mcp-server/tools/search-careers.tool.ts`
- `src/facade/mcp-server/tools/search-user-careers.tool.ts`
- `src/facade/mcp-server/mcp-server.ts` (регистрация tools)

**Цепные реакции:**
- ✅ Telegram НЕ импортирует params (только response schemas)
- ✅ Изолировано в Facade MCP layer
- ⚠️ Нужно обновить 3 файла (risk: забыть mcp-server.ts registration)

**BC #4:** userSearchParamsRawSchema type (не экспортируем)

**Прямые импорты:** 0 (grep показал нет внешних использований)

**Цепные реакции:** NONE

**ИТОГО:** все BC изолированы в Facade, Core затронут минимально (1 BC), Telegram не затронут

#### Вариант 3: 28 BC (HIGH RISK, но TypeScript защищает)

**Группы BC:**

| Группа | Count | Affected Files |
|--------|-------|----------------|
| makeNullable → facade-utils.ts | 3 | facade extract-goal, clarify-goal, extraction-models |
| adhocUserContextSchema → facade-schemas.ts | 1 | facade load-context |
| MCP params → facade-schemas.ts | 15 | все facade/mcp-server/tools/*.ts |
| MCP responses → facade-schemas.ts | 2 | telegram format-response, tool-registry |
| Cold Start → facade-schemas.ts | 1 | facade cold-start.tool |
| SearchGraph → facade-schemas.ts | 2 | facade check-goal, explore |
| Вариант 2 BC | 4 | (уже посчитаны) |

**Цепные реакции:**

1. **Telegram импортирует MCP response schemas:**
   - format-response.ts: anyGraphResponseSchema, systemMessageSchema
   - tool-registry.ts: converseResponseSchema

   Cascade: если меняем путь → обновляем 2 файла telegram

   **Риск:** LOW (TypeScript покажет ошибку, 2 файла легко проверить)

2. **Facade tools импортируют MCP schemas:**
   - 15 tools → обновляем import paths

   Cascade: если забыли 1 tool → compilation error (TypeScript защита)

   **Риск:** LOW (компилятор проверит все imports)

3. **SearchGraph nodes импортируют SearchGraph schemas:**
   - check-goal.ts, extract-goal.ts (уже посчитан в makeNullable), clarify-goal.ts (уже посчитан), explore.ts

   Cascade: обновляем 4 файла (2 новых + 2 уже в makeNullable группе)

   **Риск:** LOW

**ИТОГО:** 28 BC, но:
- ✅ TypeScript защищает от забытых импортов (compilation error)
- ✅ Все BC изолированы в facade/telegram (Core не затронут)
- ✅ ESLint правило (optional) может запретить импорты старых путей
- ⚠️ Риск: MEDIUM (много файлов, но компилятор проверит)

### 4.3. Механизмы защиты от пропущенных BC

#### 1. TypeScript Compilation Error

**Автоматически ловит:**
- Забытые обновления import paths
- Неправильные типы после перемещения
- Отсутствующие exports

**Пример:**
```bash
$ npx tsc --noEmit

src/facade/mcp-server/tools/cold-start.tool.ts:5:10 - error TS2305:
Module '"@/schemas"' has no exported member 'coldStartResponseSchema'.

5 import { coldStartResponseSchema } from "@/schemas";
           ~~~~~~~~~~~~~~~~~~~~~~~~
```

#### 2. ESLint No-Restricted-Imports (опционально)

**Конфигурация для Варианта 3:**
```json
// eslint.config.mjs
{
  "rules": {
    "no-restricted-imports": [
      "error",
      {
        "paths": [
          {
            "name": "@/schemas",
            "importNames": [
              "makeNullable",
              "adhocUserContextSchema",
              "mcpConverseParamsSchema",
              "coldStartResponseSchema",
              "searchGraphResponseSchema"
            ],
            "message": "Import from @/facade-schemas or @/facade-utils instead (see SCHEMAS-REFACTORING-RESEARCH.md)"
          }
        ]
      }
    ]
  }
}
```

**Эффект:** ESLint ошибка если кто-то попытается импортировать старый путь

#### 3. Integration Tests

**Автоматически ловят:**
- Runtime errors из-за неправильных типов
- MCP tool registration errors
- Zod validation errors

**Пример:**
```typescript
// tests/facade/mcp-tools/integration/cold-start.integration.ts
test("TC-CS1: cold_start returns valid response", async () => {
  const response = await mcpServer.callTool("cold_start", {
    message: "...",
    sessionId: "sess_123"
  });

  // Если coldStartResponseSchema неправильный → Zod validation error
  expect(response).toMatchObject({ phase: "story_gathering" });
});
```

#### 4. Рекомендуемая процедура миграции (Вариант 3)

**Пошаговый план:**

1. **Создать новые файлы** (не удалять старые!)
   ```bash
   touch src/shared/facade-utils.ts
   touch src/shared/facade-schemas.ts
   ```

2. **Скопировать (не переместить) типы**
   - Копируем makeNullable в facade-utils.ts
   - Копируем MCP schemas в facade-schemas.ts
   - Оставляем старые типы в schemas.ts (временно)

3. **Обновить imports в affected files**
   - Используем IDE Find & Replace по списку affected files (23 файла)
   - Проверяем каждый файл вручную

4. **Проверить TypeScript compilation**
   ```bash
   npx tsc --noEmit
   ```
   Если ошибки → исправляем забытые imports

5. **Проверить ESLint**
   ```bash
   npm run lint
   ```

6. **Запустить integration tests**
   ```bash
   npm run test:integration
   ```
   Если падают → проверяем типы

7. **Удалить старые типы из schemas.ts**
   - Только ПОСЛЕ успешного tsc + tests
   - Удаляем makeNullable, MCP schemas из schemas.ts

8. **Финальная проверка**
   ```bash
   npx tsc --noEmit && npm run lint && npm run test:integration
   ```

**Откат (если что-то пошло не так):**
```bash
git checkout src/shared/schemas.ts  # восстановить старый файл
rm src/shared/facade-utils.ts src/shared/facade-schemas.ts
```

---

## 5. Рекомендации

### 5.1. Выбор варианта

**Матрица решений:**

| Критерий | Вариант 1 | Вариант 2 | Вариант 3 |
|----------|-----------|-----------|-----------|
| Риск | ✅ Низкий | ⚠️ Средний | ⚠️ Высокий |
| Время | ✅ 30 мин | ⚠️ 1-2 часа | ❌ 3-4 часа |
| BC | ✅ 1 | ⚠️ 4 | ❌ 28 |
| Убирает дублирование | ✅ Да (pathLimit) | ✅ Да (все) | ✅ Да (все) |
| Разделяет shared/facade | ❌ Нет | ⚠️ Частично (комментарии) | ✅ Да (физически) |
| Готовит к Фазе 3 | ❌ Нет | ✅ Да | ✅ Да (полностью) |

**Рекомендация по контексту:**

| Контекст | Рекомендуемый вариант | Обоснование |
|----------|----------------------|-------------|
| **Сейчас** (до Фазы 3) | **Вариант 2** | Убирает дублирование, готовит к repo split, low risk (4 BC изолированы в Facade) |
| **Срочно нужна изоляция** | Вариант 3 | Полное разделение, но 28 BC (TypeScript защищает) |
| **Нет времени** | Вариант 1 | Минимальные изменения, 1 BC |
| **Фаза 3** (repo split) | Вариант 3 | Физический split файлов в @waymates/schemas package |

**Моя рекомендация: Вариант 2**

**Причины:**
1. ✅ Убирает все дублирования (pathLimit, MCP params)
2. ✅ Подготавливает к Фазе 3 (комментарии, структура)
3. ✅ Low risk (4 BC, изолированы в Facade)
4. ✅ Разумное время (1-2 часа vs 3-4 для Варианта 3)
5. ✅ Физический split можно сделать в Фазе 3 (меньше спешки)

### 5.2. План миграции (Вариант 2)

**Шаг 1: Подготовка (5 мин)**
```bash
# Создать feature branch
git checkout -b refactor/schemas-consolidation

# Прочитать этот документ (вы уже это сделали!)
```

**Шаг 2: Код-изменения (30-45 мин)**

1. **pathLimit helper** (10 мин)
   ```typescript
   // schemas.ts: добавить helper в секцию 1
   function withPathLimitTransform<T extends z.ZodRawShape>(...) { ... }

   // Заменить 5 мест на helper
   ```

2. **Удалить userSearchParamsSchema** (5 мин)
   - Удалить строку 463
   - Обновить Core router (1 файл)
   - Обновить Core tests (1-2 файла)

3. **Консолидировать MCP params** (10 мин)
   ```typescript
   // mcpSearchCareersParamsSchema
   adhocSearchParamsSchema.omit({ userId: true }).extend({ sessionId })

   // mcpSearchUserCareersParamsSchema
   userSearchParamsBaseSchema.omit({ userId: true }).extend({ sessionId })
   ```

4. **Добавить комментарии** (10 мин)
   - MCP schemas section comment
   - makeNullable JSDoc
   - userContextSchemaBase warning
   - targetContextSchema JSDoc (optional vs nullable)

5. **Добавить .describe()** (5 мин)
   - userContextSchema
   - errorCodeSchema
   - 3-5 других мест

**Шаг 3: Проверки (15-30 мин)**
```bash
# TypeScript
npx tsc --noEmit

# Lint
npm run lint:fix

# Tests
npm run test:unit
npm run test:integration
```

**Шаг 4: Commit & Review (10 мин)**
```bash
git add src/shared/schemas.ts src/core/routers/search.router.ts tests/
git commit -m "refactor(schemas): consolidate types, remove duplication (Variant 2)

- Remove pathLimit transform duplication (5 places → 1 helper)
- Delete userSearchParamsSchema alias (use Base directly)
- Consolidate mcpSearchCareersParams (use adhocSearchParams + sessionId)
- Consolidate mcpSearchUserCareersParams (use Base + sessionId)
- Add JSDoc for optional vs nullable distinction
- Mark MCP schemas section (TODO: move to facade in Phase 3)
- Add .describe() to 5-10 types

Breaking changes:
- userSearchParamsSchema → userSearchParamsBaseSchema (1 BC, Core only)
- mcpSearchCareersParamsSchema signature (consolidated, Facade only)
- mcpSearchUserCareersParamsSchema signature (consolidated, Facade only)
- UserSearchParamsRaw type removed from exports (0 usages)

See: SCHEMAS-REFACTORING-RESEARCH.md"

# Push
git push origin refactor/schemas-consolidation
```

**Итого:** ~1-1.5 часа

### 5.3. Связь с Фазой 3 (repo split)

**Из MVP-RELEASE-PLAN.md:**

```
## Фаза 3: Repo Split

### Структура

waymates-core/        (private)
├── src/core/
├── src/cypher/
└── package.json

waymates-facade/      (public)
├── src/facade/
└── package.json

waymates-telegram/    (public)
├── src/telegram-bot/
└── package.json

@waymates/schemas     (private npm)
├── src/shared/schemas.ts       # TRUE SHARED
├── src/shared/types.ts
└── package.json
```

**Как Вариант 2 готовит к Фазе 3:**

1. ✅ **Логическое разделение** (комментарии в schemas.ts)
   - MCP schemas помечены как "TODO: move to facade"
   - makeNullable помечена как facade-specific

2. ✅ **Убрано дублирование** (DRY)
   - pathLimit helper → легко перенести в @waymates/schemas
   - MCP schemas consolidated → меньше типов для переноса

3. ✅ **Идентифицированы facade-specific типы**
   - adhocUserContextSchema (используется только facade)
   - makeNullable (используется только facade)
   - 50 MCP schemas (используются facade + telegram)

**План для Фазы 3 (после Варианта 2):**

1. Создать @waymates/schemas package
   ```
   @waymates/schemas/
   ├── src/
   │   ├── shared/
   │   │   └── schemas.ts       # TRUE SHARED (IDs, domain, operations)
   │   ├── core/
   │   │   └── index.ts         # re-export shared (Core не добавляет своих типов)
   │   ├── facade/
   │   │   ├── utils.ts         # makeNullable (из Варианта 3)
   │   │   └── schemas.ts       # MCP schemas (из Варианта 3)
   │   └── telegram/
   │       └── index.ts         # re-export facade (Telegram не добавляет типов)
   ```

2. Выполнить Вариант 3 (physical split)
   - Уже подготовлено Вариантом 2!
   - Просто переместить типы в новую структуру

3. Обновить импорты в waymates-core, waymates-facade, waymates-telegram
   ```typescript
   // БЫЛО
   import { userIdSchema } from "@/schemas";

   // СТАЛО
   import { userIdSchema } from "@waymates/schemas/shared";
   ```

**Итого:** Вариант 2 → минимум усилий для Фазы 3

---

## 6. Выводы

### 6.1. Что выявлено

**Реальные проблемы (требуют исправления):**
1. ✅ pathLimit transform дублируется 5 раз → helper
2. ✅ userSearchParamsSchema — бесполезный алиас → удалить
3. ✅ mcpSearchCareersParamsSchema дублирует adhocSearchParamsSchema → объединить
4. ✅ mcpSearchUserCareersParamsSchema дублирует userSearchParamsBaseSchema → объединить
5. ✅ makeNullable — facade-specific в shared файле → пометить комментарием (Вариант 2) или переместить (Вариант 3)
6. ✅ MCP schemas (50 типов) — facade-specific в shared файле → пометить комментарием (Вариант 2) или переместить (Вариант 3)

**Мнимые проблемы (НЕ требуют исправления):**
1. ❌ targetContextSchema optional+nullable — КОРРЕКТНО (разные уровни валидации)
2. ❌ .describe() неконсистентность — переоценена (~5-10 мест, 90% покрыто)
3. ❌ .refine() можно в бизнес-код — НЕТ, это contract validation
4. ❌ optional vs nullable — текущий подход правильный

### 6.2. Метрики

| Метрика | Значение |
|---------|----------|
| Общий размер schemas.ts | 1478 строк |
| SHARED schemas | ~600 строк (40%) |
| FACADE schemas | ~700 строк (47%) |
| HYBRID schemas | ~180 строк (13%) |
| Импортирующих файлов | 146 |
| makeNullable использований | 10 файлов (3 src) |
| Дублирований pathLimit | 5 мест |
| Избыточных типов | 2 (userSearchParamsSchema, UserSearchParamsRaw type) |
| MCP-specific типов | 50 (params + response + cold-start + search-graph) |

### 6.3. Confidence Levels

| Вывод | Confidence |
|-------|------------|
| pathLimit дублируется | 100% |
| userSearchParamsSchema — алиас | 100% |
| makeNullable — facade-specific | 100% |
| MCP schemas — facade-specific | 100% |
| targetContextSchema optional+nullable КОРРЕКТЕН | 95% |
| .refine() нужен в schema | 90% |
| optional vs nullable текущий подход правильный | 95% |
| .describe() проблема переоценена | 90% |

### 6.4. Итоговая рекомендация

**Выбрать Вариант 2: УМЕРЕННЫЙ (4 BC, 1-2 часа)**

**Обоснование:**
1. ✅ Убирает все дублирования (pathLimit, MCP params)
2. ✅ Готовит к Фазе 3 (repo split) через комментарии и структуру
3. ✅ Low risk (4 BC, изолированы в Facade, Core затронут минимально)
4. ✅ Разумное время (1-2 часа vs 3-4 для Варианта 3)
5. ✅ TypeScript защищает от ошибок
6. ✅ Физический split можно отложить до Фазы 3 (меньше спешки)

**После завершения Варианта 2:**
- Обновить `.claude/context/project.md` (упомянуть схемы разделения)
- Обновить `docs/mvp_final/MVP-RELEASE-PLAN.md` (link на этот документ)
- Запустить `/sync-memory` для сохранения решений

---

## Changelog

**2025-12-17:** Initial research
- Глубокий анализ 1478 строк schemas.ts
- Выявлено 6 реальных + 4 мнимых проблемы
- Предложено 3 варианта рефакторинга (1 BC, 4 BC, 28 BC)
- Рекомендован Вариант 2 (умеренный, 4 BC, 1-2 часа)
- Confidence level 90-100% на все выводы
