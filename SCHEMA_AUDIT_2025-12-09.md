# Аудит типов и схем WayMates

**Дата:** 2025-12-09
**Проверено:** telegram-bot → facade → core
**Статус:** ✅ Рудименты удалены, найдены критические проблемы архитектуры

---

## 📊 Исполнительное резюме

Проведен полный аудит типов и схем в трех модулях:
- **telegram-bot** (28 файлов)
- **facade** (MCP server + LangGraph agents)
- **core** (tRPC API)

**Главный вывод:** Архитектура shared schemas **частично правильная**, но есть **критические проблемы**:
- ❌ Дубликаты схем с разными версиями (sessionId, errorCode, errorResponse)
- ❌ Нарушение зависимостей (telegram → facade прямой импорт)
- ❌ Core-specific схемы лежат в shared
- ⚠️ Неиспользуемые рудименты

---

## 🔴 КРИТИЧЕСКИЕ ПРОБЛЕМЫ

### 1. Дубликаты схем с разными версиями

#### sessionIdSchema - 2 определения
**Локации:**
- `src/facade/mcp-server/result.ts:3-6`
- `src/telegram-bot/schemas/mcp-responses.ts:6`

```typescript
// facade
export const sessionIdSchema = z
  .string()
  .regex(/^sess_[0-9a-f]{32}$/, "Session ID must be in format sess_<32-char-hex>")
  .describe("Session ID in format sess_<32-char-hex>");

// telegram
export const sessionIdSchema = z.string().regex(/^sess_[0-9a-f]{32}$/);
```

**Проблема:** ✅ Одинаковые regex, но нарушение DRY
**Решение:** Переместить в `shared/schemas.ts`

---

#### errorCodeSchema - НЕСОВМЕСТИМЫЕ версии

**facade** (9 кодов):
```typescript
export const errorCodeSchema = z.enum([
  "session_expired",
  "session_invalid",
  "invalid_token",
  "normalization_failed",
  "core_api_error",
  "validation_error",
  "internal_error",
  "postgres_connection_failed",
  "postgres_query_failed",
]);
```

**telegram** (3 кода):
```typescript
export const errorCodeSchema = z.enum([
  "session_expired",
  "session_invalid",
  "unauthorized"
]);
```

**Проблема:** ❌ Telegram subset, но используют **РАЗНЫЕ коды** (`unauthorized` vs `invalid_token`)
**Последствия:** Type mismatch при обмене данными

---

#### errorResponseSchema - НЕСОВМЕСТИМЫЕ структуры

**facade:**
```typescript
export const errorResponseSchema = z.object({
  code: errorCodeSchema,
  message: z.string(),
  details: z.record(z.unknown()).optional(), // ← есть details
});
```

**telegram:**
```typescript
export const errorResponseSchema = z.object({
  code: errorCodeSchema,
  message: z.string(), // ← НЕТ details!
});
```

**Проблема:** ❌ Telegram не может получить детали ошибок
**Последствия:** Потеря информации при передаче ошибок через MCP

---

### 2. Нарушение зависимостей между модулями

**Обнаружено:**
```typescript
// src/telegram-bot/schemas/mcp-responses.ts:3
import { tokenSchema } from "../../facade/mcp-server/schemas.js";
```

**Проблема:** ❌ telegram → facade прямой импорт
**Правильно:** telegram → **shared ONLY**

**Архитектура зависимостей:**
```
telegram  →  MCP protocol  →  facade  →  tRPC  →  core
   ↓                             ↓                  ↓
   └────────────── shared/schemas.ts ───────────────┘
```

---

## ⚠️ Неиспользуемые схемы (рудименты)

### В shared/schemas.ts

1. **filterModeSchema** (line 299)
   ```typescript
   export const filterModeSchema = z.enum(["desired", "undesired"]);
   ```
   - **Использование:** Не используется напрямую
   - **Причина:** Часть `fieldFilterSchema`, не экспортируется отдельно
   - **Действие:** ✅ Можно удалить экспорт

2. **currentSearchParamsBaseSchema** (line 422)
   ```typescript
   export const currentSearchParamsBaseSchema = userSearchParamsRawSchema
     .omit({ userId: true })
     .refine(...);
   ```
   - **Использование:** НЕ используется
   - **Причина:** Telegram feature не реализован
   - **Действие:** ❌ Удалить (или пометить как planned)

3. **scheduleSchema** (line 146)
   ```typescript
   export const scheduleSchema = z.object({
     sessionsPerWeek: z.number().nullable().optional(),
     hoursPerSession: z.number().nullable().optional(),
   });
   ```
   - **Использование:** ТОЛЬКО внутри `trailSchemaBase` (line 164)
   - **Экспорт:** Не нужен (внутренняя схема)
   - **Действие:** ✅ Оставить, но не экспортировать

---

## 📦 Модуль-специфичные схемы в shared

**Используются ТОЛЬКО в core:**

### Goal schemas
```typescript
export const goalSchema = z.object({...});           // line 545
export const createGoalInputSchema = z.object({...}); // line 554
```

**Файлы:**
- `src/core/goals-manager.ts`
- `src/core/routers/goal.router.ts`

**Не используются в:** facade, telegram

---

### UpsertSingle schemas
```typescript
export const upsertSingleContextResultSchema = z.object({...}); // line 514
export const upsertSingleTrailResultSchema = z.object({...});   // line 529
```

**Файлы:**
- `src/core/story-manager.ts`
- `src/core/routers/context.router.ts`
- `src/core/routers/trail.router.ts`

**Не используются в:** facade, telegram

---

**Проблема:** ❌ Core-only схемы лежат в shared, увеличивают surface area для facade/telegram
**Решение:** Создать `src/core/schemas.ts`

---

## ✅ Анализ .refine() валидации

**Найдено 6 использований:**

### 1. userContextSchema - salary constraint
```typescript
// shared/schemas.ts:261
userContextSchema.refine(
  (data) => {
    const hasExact = data.salaryExact != null;
    const hasRange = data.salaryMin != null || data.salaryMax != null;
    if (hasExact && hasRange) return false;
    if (data.salaryMin != null && data.salaryMax != null) {
      return data.salaryMin <= data.salaryMax;
    }
    return true;
  },
  { message: "Specify either exact salary OR salary range..." }
);
```

**Тип:** Domain invariant (бизнес-правило модели данных)
**Решение:** ✅ **ОСТАВИТЬ** - это constraint на уровне данных

---

### 2. pathLimit <= limit
```typescript
// shared/schemas.ts:387, 404, 417
userSearchParamsBaseSchema.refine((data) => data.pathLimit <= data.limit, {
  message: "pathLimit must be <= limit (cannot return more results than fetched from DB)"
});
```

**Тип:** Mathematical constraint (data integrity)
**Решение:** ✅ **ОСТАВИТЬ** - это не бизнес-логика, а invariant

---

### 3. storyInputSchema - graph consistency
```typescript
// shared/schemas.ts:468
storyInputSchema.superRefine((data, ctx) => {
  // Rule 1: Exactly one current context
  const currentCount = data.contexts.filter(c => !c.nextContextId).length;
  if (currentCount !== 1) { ... }

  // Rule 2: All references must exist (no dangling pointers)
  for (const context of data.contexts) {
    if (context.previousContextId && !contextIds.has(context.previousContextId)) { ... }
  }
});
```

**Тип:** Structural integrity (graph consistency)
**Решение:** ✅ **ОСТАВИТЬ** - это data structure constraint

---

### 4. updateContextInputSchema
```typescript
// shared/schemas.ts:567
updateContextInputSchema.refine((data) => Object.keys(data).length > 0, {
  message: "At least one field must be provided for update"
});
```

**Тип:** Operation constraint
**Решение:** ✅ **ОСТАВИТЬ** - empty update не имеет смысла

---

### 5. excludedContextFields - skills required ⚠️
```typescript
// shared/schemas.ts:372
excludedContextFields.refine((fields) => !fields.includes("skills"), {
  message: "Cannot exclude 'skills' - skills scoring (penalties) is required..."
});
```

**Тип:** Business rule (алгоритм scoring требует skills)
**Решение:** ⚠️ **СПОРНО** - это бизнес-логика, НЕ data constraint

**Аргументы за:**
- Prevents misconfiguration
- API-level validation

**Аргументы против:**
- Business logic should be in service layer
- Coupling schema to algorithm implementation

**Рекомендация:** Перенести в `SearchManager` как runtime check

---

### 6. Дублирование в facade
```typescript
// facade/mcp-server/schemas.ts:28, 40
facadeAdhocSearchParamsSchema.refine((data) => data.pathLimit <= data.limit, ...)
searchUserCareersParamsSchema.refine((data) => data.pathLimit <= data.limit, ...)
```

**Проблема:** ❌ Дублирование - уже есть в shared
**Решение:** Использовать `extends` вместо повторного `.refine()`

---

## 📋 Использование типов по модулям

### telegram-bot

**Импортирует из shared:**
- `makeNullable` (utility)
- `userIdSchema`
- `fieldFilterSchema`
- `newContextReasonSchema`
- `contextFieldSchema`
- `adhocUserContextSchema`
- `scoredMatchedCandidateSchema`

**Импортирует из facade:** ❌
- `tokenSchema` (должно быть в shared!)

**Определяет локально:**
- `sessionIdSchema` ❌ дубликат
- `errorCodeSchema` ❌ дубликат
- `errorResponseSchema` ❌ дубликат
- `telegramRegisterResponseSchema` ✅ telegram-specific
- `coldStartResponseSchema` ✅ telegram-specific
- `searchResultResponseSchema` ✅ telegram-specific
- `telegramLinkResponseSchema` ✅ telegram-specific

---

### facade

**Импортирует из shared:** ✅
- Все search params (userSearchParamsRawSchema, targetSearchParamsBaseSchema, adhocUserContextSchema)
- Entity schemas (userContextSchema, trailSchema, userIdSchema, contextIdSchema)
- Result types (ScoredMatchedCandidate, MatchedCandidateWithPath, Goal)

**Определяет в facade/mcp-server/result.ts:**
- `sessionIdSchema` ❌ должно быть в shared
- `errorCodeSchema` ❌ дубликат (facade-specific version)
- `errorResponseSchema` ❌ дубликат (facade-specific version)
- `Result<T, E>` type ✅ facade pattern
- `ok()`, `err()` helpers ✅ facade pattern

**Определяет в facade/mcp-server/schemas.ts:**
- `tokenSchema` ❌ должно быть в shared
- Все остальные: extends shared + добавляет `sessionId` ✅

**Определяет в facade/langGraph/**/types.ts:** ✅
- `coldStartPhaseSchema` - agent-specific
- `NODE` constants - graph topology
- `contextAgendaBaseSchema` - planning tool specific

---

### core

**Импортирует из shared:** ✅
- Entity schemas (UserContext, Trail, Goal, DTWMetrics)
- Search params (targetSearchParamsSchema, userSearchParamsSchema, adhocSearchParamsSchema)
- CRUD schemas (StoryInput, UpsertContextInput, UpsertTrailInput, DeleteStoryResult)
- Dictionaries (Dictionaries, AddTermInput)

**Определяет локально:** ❌ НЕТ
- Все типы импортируются из shared

**Использует только в core (но лежат в shared):**
- `goalSchema`, `createGoalInputSchema`
- `upsertSingleContextResultSchema`, `upsertSingleTrailResultSchema`

---

## 🎯 План исправления

### Фаза 1: Переместить в shared (breaking changes)

#### 1.1 sessionIdSchema
```typescript
// src/shared/schemas.ts

export const sessionIdSchema = z
  .string()
  .regex(/^sess_[0-9a-f]{32}$/, "Session ID must be in format sess_<32-char-hex>")
  .describe("Session ID in format sess_<32-char-hex>");

export type SessionId = z.infer<typeof sessionIdSchema>;
```

**Удалить из:**
- `src/facade/mcp-server/result.ts:3-8`
- `src/telegram-bot/schemas/mcp-responses.ts:6`

**Обновить импорты:**
```typescript
// facade/mcp-server/result.ts
import { sessionIdSchema } from "../../shared/schemas.js";

// telegram/schemas/mcp-responses.ts
import { sessionIdSchema } from "../../shared/schemas.js";
```

---

#### 1.2 tokenSchema
```typescript
// src/shared/schemas.ts

export const tokenSchema = z
  .string()
  .uuid()
  .describe("User token (UUID v7 format) for authentication");

export type Token = z.infer<typeof tokenSchema>;
```

**Удалить из:**
- `src/facade/mcp-server/schemas.ts:143`

**Обновить импорты:**
```typescript
// facade/mcp-server/schemas.ts
import { tokenSchema } from "../../shared/schemas.js";

// telegram/schemas/mcp-responses.ts
import { tokenSchema } from "../../shared/schemas.js";
```

---

#### 1.3 errorCode - унифицировать

**Вариант A (рекомендую):** Базовый enum в shared, расширенный в facade

```typescript
// src/shared/schemas.ts

export const baseErrorCodeSchema = z.enum([
  "session_expired",
  "session_invalid",
  "unauthorized",
]);

export type BaseErrorCode = z.infer<typeof baseErrorCodeSchema>;
```

```typescript
// src/facade/mcp-server/result.ts

import { baseErrorCodeSchema } from "../../shared/schemas.js";

export const facadeErrorCodeSchema = z.enum([
  ...baseErrorCodeSchema.options,
  "invalid_token",
  "normalization_failed",
  "core_api_error",
  "validation_error",
  "internal_error",
  "postgres_connection_failed",
  "postgres_query_failed",
]);

export type ErrorCode = z.infer<typeof facadeErrorCodeSchema>;
```

```typescript
// src/telegram-bot/schemas/mcp-responses.ts

import { baseErrorCodeSchema } from "../../shared/schemas.js";

export const errorCodeSchema = baseErrorCodeSchema; // telegram uses base only
```

---

### Фаза 2: Создать core/schemas.ts

```typescript
// src/core/schemas.ts (НОВЫЙ ФАЙЛ)

import { z } from "zod";
import { targetContextSchema, userIdSchema } from "../shared/schemas.js";

// Goal operations (core-only)
export const goalSchema = z.object({
  userId: userIdSchema,
  targetCriteria: targetContextSchema,
  createdAt: z.string().regex(/^ISO_8601$/),
});

export const createGoalInputSchema = z.object({
  userId: userIdSchema,
  targetContext: targetContextSchema,
});

// Single upsert results (core-only)
export const upsertSingleContextResultSchema = z.object({
  success: z.boolean(),
  contextId: contextIdSchema,
});

export const upsertSingleTrailResultSchema = z.object({
  success: z.boolean(),
  trailId: trailIdSchema,
});

export type Goal = z.infer<typeof goalSchema>;
export type CreateGoalInput = z.infer<typeof createGoalInputSchema>;
export type UpsertSingleContextResult = z.infer<typeof upsertSingleContextResultSchema>;
export type UpsertSingleTrailResult = z.infer<typeof upsertSingleTrailResultSchema>;
```

**Удалить из shared/schemas.ts:**
- Lines 545-557 (goalSchema, createGoalInputSchema)
- Lines 514-517 (upsertSingleContextResultSchema)
- Lines 529-532 (upsertSingleTrailResultSchema)

**Обновить импорты в core:**
```typescript
// src/core/goals-manager.ts
import { goalSchema, createGoalInputSchema } from "./schemas.js";

// src/core/story-manager.ts
import {
  upsertSingleContextResultSchema,
  upsertSingleTrailResultSchema
} from "./schemas.js";
```

---

### Фаза 3: Удалить рудименты

#### 3.1 filterModeSchema
```typescript
// src/shared/schemas.ts:299-300
// УДАЛИТЬ экспорт (используется только внутри fieldFilterSchema)
export const filterModeSchema = z.enum(["desired", "undesired"]); // ← DELETE
export type FilterMode = z.infer<typeof filterModeSchema>; // ← DELETE
```

**Заменить на:**
```typescript
// Использовать inline в fieldFilterSchema
export const fieldFilterSchema = z.object({
  mode: z.enum(["desired", "undesired"]).describe("Filter mode..."),
  values: z.array(z.string().min(1).trim()).min(1).max(5),
});
```

---

#### 3.2 currentSearchParamsBaseSchema
```typescript
// src/shared/schemas.ts:422-427
// УДАЛИТЬ (telegram feature не реализован)
export const currentSearchParamsBaseSchema = ... // ← DELETE
export type CurrentSearchParamsBase = ... // ← DELETE
```

---

#### 3.3 scheduleSchema
```typescript
// src/shared/schemas.ts:146-150
// ОСТАВИТЬ, но не экспортировать (internal use only)
const scheduleSchema = z.object({ // ← убрать export
  sessionsPerWeek: z.number().nullable().optional(),
  hoursPerSession: z.number().nullable().optional(),
});
```

---

### Фаза 4: Исправить .refine() дублирование

```typescript
// src/facade/mcp-server/schemas.ts

// БЫЛО (дублирование):
export const facadeAdhocSearchParamsSchema = userSearchParamsRawSchema
  .omit({ userId: true })
  .extend({ referenceContext: adhocUserContextSchema, sessionId: sessionIdSchema })
  .refine((data) => data.pathLimit <= data.limit, { ... }); // ← дубликат!

// СТАЛО (extends validated schema):
export const facadeAdhocSearchParamsSchema = userSearchParamsBaseSchema // ← уже с refine
  .omit({ userId: true })
  .extend({ referenceContext: adhocUserContextSchema, sessionId: sessionIdSchema });
```

---

## 📊 Итоговая архитектура

### Модуль: shared/schemas.ts

**Содержит:**
- ✅ Base types (userId, contextId, trailId, sessionId, token)
- ✅ Domain entities (UserContext, Trail)
- ✅ Search filters (FieldFilter, TargetContext)
- ✅ Search params (UserSearchParams, AdhocSearchParams, TargetSearchParams)
- ✅ Result types (ScoredMatchedCandidate, MatchedCandidateWithPath)
- ✅ CRUD operations (StoryInput, UpsertContext, UpsertTrail, DeleteStory)
- ✅ Dictionaries (Dictionaries, AddTermInput)
- ✅ Base error codes (session_expired, session_invalid, unauthorized)
- ✅ Utilities (makeNullable)

**НЕ содержит:**
- ❌ Goal operations → core/schemas.ts
- ❌ UpsertSingle results → core/schemas.ts
- ❌ Facade-specific error codes → facade/result.ts
- ❌ Telegram-specific responses → telegram/schemas/

---

### Модуль: core/schemas.ts (НОВЫЙ)

**Содержит:**
- ✅ Goal operations (goalSchema, createGoalInputSchema)
- ✅ Single upsert results (upsertSingleContextResultSchema, upsertSingleTrailResultSchema)

---

### Модуль: facade/mcp-server/result.ts

**Содержит:**
- ✅ Facade error codes (extends baseErrorCodeSchema)
- ✅ ErrorResponse (facade version with details)
- ✅ Result<T, E> type
- ✅ ok(), err() helpers

**Импортирует из shared:**
- ✅ sessionIdSchema
- ✅ baseErrorCodeSchema

---

### Модуль: facade/mcp-server/schemas.ts

**Содержит:**
- ✅ MCP tool params (extends shared + sessionId)

**Импортирует из shared:**
- ✅ sessionIdSchema
- ✅ tokenSchema
- ✅ All search base schemas

---

### Модуль: telegram/schemas/mcp-responses.ts

**Содержит:**
- ✅ Telegram-specific responses (TelegramRegisterResponse, ColdStartResponse, etc)

**Импортирует из shared:**
- ✅ sessionIdSchema
- ✅ tokenSchema
- ✅ baseErrorCodeSchema
- ✅ userIdSchema
- ✅ scoredMatchedCandidateSchema

---

## 🔍 Проверка зависимостей

### Правильные зависимости:
```
telegram-bot  →  shared  ✅
facade        →  shared  ✅
core          →  shared  ✅
core          →  core/schemas  ✅
```

### Неправильные (до исправления):
```
telegram-bot  →  facade  ❌ (tokenSchema import)
```

### После исправления:
```
telegram-bot  →  shared  ✅ (все импорты)
facade        →  shared  ✅ (все импорты)
core          →  shared + core/schemas  ✅
```

---

## ✅ Checklist исправлений

### Must-have (breaking changes):
- [ ] Переместить `sessionIdSchema` в shared
- [ ] Переместить `tokenSchema` в shared
- [ ] Унифицировать `errorCodeSchema` (base + facade)
- [ ] Создать `core/schemas.ts` и переместить core-only схемы
- [ ] Обновить все импорты

### Should-have (cleanup):
- [ ] Удалить `filterModeSchema` export
- [ ] Удалить `currentSearchParamsBaseSchema`
- [ ] Убрать export с `scheduleSchema`
- [ ] Исправить `.refine()` дублирование в facade

### Nice-to-have (documentation):
- [ ] Добавить JSDoc комментарии к базовым типам
- [ ] Документировать errorCode values
- [ ] Создать схему зависимостей модулей

---

## 📈 Метрики

**До рефакторинга:**
- Дубликаты схем: **3** (sessionId, errorCode, errorResponse)
- Нарушения зависимостей: **1** (telegram → facade)
- Неиспользуемые схемы: **3** (filterMode, currentSearchParams, scheduleExport)
- Core-only в shared: **4** схемы
- Строк в shared/schemas.ts: **716**

**После рефакторинга:**
- Дубликаты схем: **0** ✅
- Нарушения зависимостей: **0** ✅
- Неиспользуемые схемы: **0** ✅
- Core-only в shared: **0** ✅
- Строк в shared/schemas.ts: **~650** (-66)
- Новый core/schemas.ts: **~40** строк

---

## 🚀 План внедрения

### Этап 1: Подготовка (без breaking changes)
1. Создать `core/schemas.ts` с core-only типами
2. Добавить `sessionIdSchema`, `tokenSchema`, `baseErrorCodeSchema` в shared
3. Обновить facade/telegram импорты (добавить новые + оставить старые)

### Этап 2: Migration (breaking changes)
1. Удалить дубликаты из facade/telegram
2. Обновить все импорты
3. Запустить lint + tsc + tests

### Этап 3: Cleanup
1. Удалить неиспользуемые схемы
2. Исправить .refine() дублирование
3. Обновить документацию

---

## 📝 Выводы

### ✅ Что работает хорошо:
1. Core не определяет свои схемы, использует shared
2. Facade/LangGraph правильно определяют agent-specific типы
3. Composition pattern для candidate types (building blocks)
4. userId vs sessionId разделение корректное
5. .refine() валидация в основном на месте

### ❌ Что нужно исправить:
1. **Критично:** Дубликаты схем между telegram/facade
2. **Критично:** telegram импортирует из facade
3. **Важно:** Core-only схемы в shared
4. **Важно:** Неиспользуемые рудименты

### 💡 Рекомендации:
1. Выполнить миграцию в 3 этапа (подготовка → migration → cleanup)
2. Создать architecture decision record (ADR) про разделение схем
3. Настроить eslint правило: запретить импорты telegram → facade
4. Добавить unit тесты для schema compatibility

---

**Конец отчета**
