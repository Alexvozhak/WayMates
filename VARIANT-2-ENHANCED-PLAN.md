# План рефакторинга: Вариант 2 Enhanced (+ ADR-031)

**Дата:** 2025-12-17
**Основание:** SCHEMAS-REFACTORING-RESEARCH.md + ADR-031-type-layering-strategy.md
**Статус:** Ready for execution
**Подход:** Code first (pragmatic)

---

## Executive Summary

**Цель:** Объединить DRY improvements (Вариант 2) + ADR-031 critical type safety fixes

**Ключевые изменения:**
1. ✅ Убрать дублирование pathLimit transform (5 мест → 1 helper)
2. ✅ Создать adhocContextBase с .partial() для type safety
3. ✅ **КРИТИЧНО:** Добавить validation после normalizer (bug fix)
4. ✅ Переместить makeNullable в facade/utils/llm-schemas.ts
5. ✅ Изолировать internal facade MCP schemas

**Breaking Changes:** 7 BC (детально в §6)
**Время:** 2.5-3 часа
**LOC:** ~+100 net

---

## Содержание

1. [Контекст и цели](#1-контекст-и-цели)
2. [Три фазы работ](#2-три-фазы-работ)
3. [Фаза 1: DRY Improvements](#3-фаза-1-dry-improvements)
4. [Фаза 2: ADR-031 Critical](#4-фаза-2-adr-031-critical)
5. [Фаза 3: Consolidation](#5-фаза-3-consolidation)
6. [Breaking Changes Analysis](#6-breaking-changes-analysis)
7. [Validation Plan](#7-validation-plan)
8. [Rollback Strategy](#8-rollback-strategy)
9. [Appendix: Code Examples](#9-appendix-code-examples)

---

## 1. Контекст и цели

### Проблемы в текущем коде

| # | Проблема | Критичность | Источник |
|---|----------|-------------|----------|
| 1 | pathLimit transform дублируется 5 раз | Low | Вариант 2 |
| 2 | userSearchParamsSchema — бесполезный алиас | Low | Вариант 2 |
| 3 | adhocUserContextSchema использует nullable вместо optional | **HIGH** | ADR-031 |
| 4 | **Нет validation после normalizer** | **CRITICAL** | ADR-031 |
| 5 | makeNullable экспортируется из shared | Medium | ADR-031 |
| 6 | Internal facade MCP types в shared | Medium | ADR-031 |

### Цели рефакторинга

1. ✅ **Type safety:** adhocContextBase с .optional() соответствует runtime после normalizer
2. ✅ **Security:** validation после normalizer предотвращает invalid data в Core API
3. ✅ **DRY:** убрать дублирование pathLimit transform
4. ✅ **Clean Architecture:** изолировать facade concerns от shared
5. ✅ **Подготовка к Фазе 3:** правильное разделение shared vs facade для repo split

---

## 2. Три фазы работ

| Фаза | Scope | BC | LOC | Время | Критичность |
|------|-------|-----|-----|-------|-------------|
| **1** | DRY Improvements | 2 | +20 | 30 мин | Low |
| **2** | ADR-031 Critical | 5 | +80 | 1.5-2 ч | **CRITICAL** |
| **3** | Consolidation | 0 | -20 | 30 мин | Low |

**Можно разделить на 2 PR:**
- PR #1: Фаза 1 (independent, low risk)
- PR #2: Фаза 2 + 3 (ADR-031, critical)

---

## 3. Фаза 1: DRY Improvements

### Scope

1. pathLimit transform helper
2. Удалить userSearchParamsSchema алиас
3. Добавить .describe() где отсутствует
4. Комментарии для internal exports

**Breaking Changes:** 2
**Время:** 30 мин

---

### 3.1. pathLimit transform helper

#### ✅ Чеклист ДО изменений

```bash
# Проверить текущие дублирования
grep -n "pathLimit: Math.min" src/shared/schemas.ts

# Ожидаемый результат (5 мест):
# 456:    pathLimit: Math.min(data.pathLimit, data.limit),
# 473:    pathLimit: Math.min(data.pathLimit, data.limit),
# 484:    pathLimit: Math.min(data.pathLimit, data.limit),
# 1255:    pathLimit: Math.min(data.pathLimit, data.limit),
# 1271:    pathLimit: Math.min(data.pathLimit, data.limit),
```

#### 📝 Изменения

**Файл:** `src/shared/schemas.ts`

**Шаг 1:** Добавить helper после функции makeNullable (после строки 75)

```typescript
// === НОВЫЙ КОД (вставить после строки 75) ===

/**
 * Apply pathLimit transform: clamp pathLimit to limit.
 * Used in search params schemas to ensure pathLimit <= limit.
 */
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
```

**Шаг 2:** Заменить 5 использований

**Место 1 (строка 454-457):**
```typescript
// БЫЛО:
export const userSearchParamsBaseSchema = userSearchParamsRawSchema.transform((data) => ({
  ...data,
  pathLimit: Math.min(data.pathLimit, data.limit),
}));

// СТАЛО:
export const userSearchParamsBaseSchema = withPathLimitTransform(userSearchParamsRawSchema);
```

**Место 2 (строка 467-474):**
```typescript
// БЫЛО:
export const adhocSearchParamsSchema = userSearchParamsRawSchema
  .extend({
    referenceContext: adhocUserContextSchema,
  })
  .transform((data) => ({
    ...data,
    pathLimit: Math.min(data.pathLimit, data.limit),
  }));

// СТАЛО:
export const adhocSearchParamsSchema = withPathLimitTransform(
  userSearchParamsRawSchema.extend({
    referenceContext: adhocUserContextSchema,
  })
);
```

**Место 3 (строка 482-485):**
```typescript
// БЫЛО:
export const currentSearchParamsBaseSchema = userSearchParamsRawSchema.omit({ userId: true }).transform((data) => ({
  ...data,
  pathLimit: Math.min(data.pathLimit, data.limit),
}));

// СТАЛО:
export const currentSearchParamsBaseSchema = withPathLimitTransform(
  userSearchParamsRawSchema.omit({ userId: true })
);
```

**Место 4 (строка 1247-1256):**
```typescript
// БЫЛО:
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

// СТАЛО:
export const mcpSearchCareersParamsSchema = withPathLimitTransform(
  userSearchParamsRawSchema
    .omit({ userId: true })
    .extend({
      referenceContext: adhocUserContextSchema,
      sessionId: sessionIdSchema,
    })
);
```

**Место 5 (строка 1264-1272):**
```typescript
// БЫЛО:
export const mcpSearchUserCareersParamsSchema = userSearchParamsRawSchema
  .omit({ userId: true })
  .extend({
    sessionId: sessionIdSchema,
  })
  .transform((data) => ({
    ...data,
    pathLimit: Math.min(data.pathLimit, data.limit),
  }));

// СТАЛО:
export const mcpSearchUserCareersParamsSchema = withPathLimitTransform(
  userSearchParamsRawSchema
    .omit({ userId: true })
    .extend({
      sessionId: sessionIdSchema,
    })
);
```

#### ✅ Чеклист ПОСЛЕ изменений

```bash
# 1. Проверить что helper добавлен
grep -A 10 "function withPathLimitTransform" src/shared/schemas.ts

# 2. Проверить что все 5 мест заменены
grep -n "withPathLimitTransform" src/shared/schemas.ts
# Ожидается: 5 совпадений

# 3. Проверить что старые .transform удалены
grep -n "pathLimit: Math.min" src/shared/schemas.ts
# Ожидается: 0 совпадений (кроме самого helper)

# 4. TypeScript compilation
npx tsc --noEmit

# 5. Tests (quick smoke)
npm run test:unit -- src/shared/schemas.spec.ts
```

---

### 3.2. Удалить userSearchParamsSchema алиас

#### ✅ Чеклист ДО изменений

```bash
# Найти все использования
grep -rn "userSearchParamsSchema" src/ tests/

# Ожидаемые файлы:
# - src/shared/schemas.ts (определение)
# - src/core/routers/search.router.ts (импорт)
# - tests/core/integration/search-manager/*.ts (типы)
```

#### 📝 Изменения

**Шаг 1:** Удалить алиас из schemas.ts

**Файл:** `src/shared/schemas.ts` (строка 463)

```typescript
// БЫЛО:
export const userSearchParamsSchema = userSearchParamsBaseSchema;

export type UserSearchParams = z.infer<typeof userSearchParamsSchema>;

// СТАЛО:
// (удалить обе строки)

export type UserSearchParams = z.infer<typeof userSearchParamsBaseSchema>;
```

**Шаг 2:** Обновить импорты в affected files

**Файл:** `src/core/routers/search.router.ts`

```typescript
// БЫЛО:
import { userSearchParamsSchema, type UserSearchParams } from "@/schemas";

// СТАЛО:
import { userSearchParamsBaseSchema, type UserSearchParams } from "@/schemas";

// Использование (если есть):
// userSearchParamsSchema.parse(...) → userSearchParamsBaseSchema.parse(...)
```

**Шаг 3:** Обновить tests (если используют)

```bash
# Найти и заменить в тестах
find tests/core -name "*.ts" -exec sed -i 's/userSearchParamsSchema/userSearchParamsBaseSchema/g' {} +
```

#### ✅ Чеклист ПОСЛЕ изменений

```bash
# 1. Проверить что алиас удалён
grep -n "userSearchParamsSchema" src/shared/schemas.ts
# Ожидается: 0 совпадений

# 2. Проверить что импорты обновлены
grep -rn "userSearchParamsSchema" src/core/

# 3. TypeScript compilation
npx tsc --noEmit

# 4. Tests
npm run test:unit -- src/core/routers/search.router.spec.ts
```

**Breaking Change #1:** `userSearchParamsSchema` → `userSearchParamsBaseSchema`

---

### 3.3. Добавить .describe() где отсутствует

#### 📝 Изменения

**Файл:** `src/shared/schemas.ts`

**Место 1 (строка 317, после .refine()):**
```typescript
export const userContextSchema = userContextSchemaBase
  .refine(
    (data) => { ... },
    { message: "...", path: ["salaryExact"] }
  )
  .describe("User career context with salary validation");
```

**Место 2 (строка 129):**
```typescript
export const errorCodeSchema = z.enum([...])
  .describe("Error codes for MCP tools and Core API");
```

**Место 3 (строка 142):**
```typescript
export const errorResponseSchema = z.object({...})
  .describe("Standard error response format");
```

**Место 4 (строка 152):**
```typescript
// Добавить JSDoc комментарий перед Result<T,E>
/**
 * Result discriminated union for MCP tools.
 * Success case: { ok: true, value: T }
 * Error case: { ok: false, error: E }
 */
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
```

**Место 5 (строка 463, после изменений 3.2):**
```typescript
export type UserSearchParams = z.infer<typeof userSearchParamsBaseSchema>;
// Добавить JSDoc:
/**
 * User search parameters for Core API.
 * Base schema with userId (domain concern).
 */
export type UserSearchParams = z.infer<typeof userSearchParamsBaseSchema>;
```

#### ✅ Чеклист ПОСЛЕ

```bash
# Проверить что .describe() добавлены
grep -n ".describe(" src/shared/schemas.ts | wc -l
# Ожидается: ~50+ (было ~45)
```

---

### 3.4. Комментарии для internal exports

#### 📝 Изменения

**Файл:** `src/shared/schemas.ts`

**Место 1 (строка 342, перед export userContextSchemaBase):**
```typescript
/**
 * ⚠️ INTERNAL USE ONLY
 * Base schema without validation, exported for Facade .omit()/.partial() operations.
 * DO NOT use directly in business logic - use userContextSchema instead.
 *
 * Used by:
 * - Facade: extraction-models.ts, link-contexts-with-trail.tool.ts
 * - Tests: validation.spec.ts
 */
export { userContextSchemaBase };
```

**Место 2 (строка 59, перед export makeNullable):**
```typescript
/**
 * ⚠️ FACADE-SPECIFIC UTILITY (temporary location)
 * Transforms schema for OpenAI Structured Output compatibility.
 * Used only in Facade LangGraph agents (extract-goal, clarify-goal).
 *
 * TODO (Фаза 2): Move to facade/utils/llm-schemas.ts
 * See: ADR-031-type-layering-strategy.md
 */
export function makeNullable<T extends z.ZodObject<z.ZodRawShape>>(...) { ... }
```

**Место 3 (строка 423, перед userSearchParamsRawSchema):**
```typescript
/**
 * ⚠️ INTERNAL COMPOSITION BASE
 * Raw schema WITHOUT pathLimit validation - for extending in derived schemas.
 * Schema is exported for composition, but type is NOT exported (internal).
 */
export const userSearchParamsRawSchema = z.object({...});

// НЕ экспортируем type:
// export type UserSearchParamsRaw = z.infer<typeof userSearchParamsRawSchema>; ← удалить эту строку
```

#### ✅ Чеклист ПОСЛЕ

```bash
# Проверить что комментарии добавлены
grep -B 3 "export { userContextSchemaBase }" src/shared/schemas.ts
grep -B 3 "export function makeNullable" src/shared/schemas.ts

# Проверить что UserSearchParamsRaw type удалён
grep "UserSearchParamsRaw" src/shared/schemas.ts
# Ожидается: 0 совпадений (только в комментарии про internal)
```

**Breaking Change #2:** `UserSearchParamsRaw` type removed from exports

---

### 3.5. Фаза 1 Validation

```bash
# 1. TypeScript compilation
npx tsc --noEmit

# 2. Lint
npm run lint:fix

# 3. Unit tests (schemas)
npm run test:unit -- schemas

# 4. Smoke test (Core API)
npm run test:integration -- search-manager

# 5. Commit
git add src/shared/schemas.ts src/core/routers/search.router.ts tests/
git commit -m "refactor(schemas): DRY improvements (Variant 2 Phase 1)

- Add withPathLimitTransform helper (remove 5 duplications)
- Delete userSearchParamsSchema alias (use Base directly)
- Add .describe() to 5 types
- Add JSDoc warnings for internal exports
- Remove UserSearchParamsRaw type from exports

Breaking changes:
- userSearchParamsSchema → userSearchParamsBaseSchema (2 BC)

See: VARIANT-2-ENHANCED-PLAN.md"
```

---

## 4. Фаза 2: ADR-031 Critical

### Scope

1. **КРИТИЧНО:** Создать adhocContextBase с .partial()
2. **КРИТИЧНО:** Validation после normalizer
3. Переместить makeNullable в facade/utils/llm-schemas.ts
4. Обновить load-context.ts для локального makeNullable
5. Обновить search-careers.tool.ts (validation)

**Breaking Changes:** 5
**Время:** 1.5-2 часа
**Критичность:** **HIGH** (bug fix + type safety)

---

### 4.1. Создать adhocContextBase

#### ✅ Чеклист ДО изменений

```bash
# Проверить текущую структуру adhocUserContextSchema
grep -A 5 "adhocUserContextSchema" src/shared/schemas.ts

# Найти все использования
grep -rn "adhocUserContextSchema" src/ tests/
```

#### 📝 Изменения

**Файл:** `src/shared/schemas.ts`

**Шаг 1:** Создать adhocContextBase (вставить после строки 342, перед adhocUserContextSchema)

```typescript
// === НОВЫЙ КОД (вставить после export { userContextSchemaBase }) ===

/**
 * Adhoc context base schema for search reference context.
 * Contains subset of userContext fields used for adhoc search.
 *
 * Design:
 * - Uses .pick().partial() for all optional fields (ADR-031 Правило 4)
 * - Runtime type matches normalizer output (partial object with .optional())
 * - LLM extraction wraps with makeNullable() locally (not exported)
 *
 * Used by:
 * - adhocSearchParamsSchema (Core API)
 * - mcpSearchCareersParamsSchema (Facade MCP, inline in tool after Phase 2)
 * - load-context.ts (LLM extraction via makeNullable wrapper)
 */
export const adhocContextBase = userContextSchemaBase
  .pick({
    position: true,
    domains: true,
    skills: true,
    industry: true,
    cityName: true,
    countryCode: true,
    languages: true,
  })
  .partial();

export type AdhocContextBase = z.infer<typeof adhocContextBase>;
```

**Шаг 2:** Обновить adhocSearchParamsSchema (строка 467-474)

```typescript
// БЫЛО:
export const adhocSearchParamsSchema = withPathLimitTransform(
  userSearchParamsRawSchema.extend({
    referenceContext: adhocUserContextSchema,  // ← makeNullable (wrong)
  })
);

// СТАЛО:
export const adhocSearchParamsSchema = withPathLimitTransform(
  userSearchParamsRawSchema.extend({
    referenceContext: adhocContextBase,  // ← .optional() (correct)
  })
);
```

**Шаг 3:** Удалить adhocUserContextSchema (строка 312)

```typescript
// БЫЛО:
export const adhocUserContextSchema = makeNullable(userContextSchemaBase);
export type AdhocUserContext = z.infer<typeof adhocUserContextSchema>;

// СТАЛО:
// (удалить обе строки — adhocContextBase заменяет)
```

**Шаг 4:** Обновить mcpSearchCareersParamsSchema (строка 1247-1256)

```typescript
// БЫЛО:
export const mcpSearchCareersParamsSchema = withPathLimitTransform(
  userSearchParamsRawSchema
    .omit({ userId: true })
    .extend({
      referenceContext: adhocUserContextSchema,  // ← старый тип
      sessionId: sessionIdSchema,
    })
);

// СТАЛО:
export const mcpSearchCareersParamsSchema = withPathLimitTransform(
  userSearchParamsRawSchema
    .omit({ userId: true })
    .extend({
      referenceContext: adhocContextBase,  // ← новый тип
      sessionId: sessionIdSchema,
    })
);
```

#### ✅ Чеклист ПОСЛЕ изменений

```bash
# 1. Проверить что adhocContextBase создан
grep -A 10 "export const adhocContextBase" src/shared/schemas.ts

# 2. Проверить что adhocUserContextSchema удалён
grep "adhocUserContextSchema" src/shared/schemas.ts
# Ожидается: 0 совпадений

# 3. Проверить что 2 места обновлены (adhocSearchParams, mcpSearchCareersParams)
grep -n "referenceContext: adhocContextBase" src/shared/schemas.ts
# Ожидается: 2 совпадения

# 4. TypeScript compilation
npx tsc --noEmit
# Ожидается: ошибки в файлах, которые импортируют adhocUserContextSchema
# Это ожидаемо — исправим в следующих шагах
```

**Breaking Change #3:** `adhocUserContextSchema` removed (use `adhocContextBase`)

---

### 4.2. Переместить makeNullable в facade/utils/llm-schemas.ts

#### ✅ Чеклист ДО изменений

```bash
# Найти все импорты makeNullable
grep -rn "import.*makeNullable" src/facade/

# Ожидаемые файлы:
# - src/facade/langGraph/search-graph/nodes/extract-goal.ts
# - src/facade/langGraph/search-graph/nodes/clarify-goal.ts
# - src/facade/langGraph/shared-tools/extraction-models.ts
```

#### 📝 Изменения

**Шаг 1:** Создать новый файл facade/utils/llm-schemas.ts

**Новый файл:** `src/facade/utils/llm-schemas.ts`

```typescript
import { z } from "zod";
import type { ZodTypeAny } from "zod";

/**
 * LLM Schema Utilities
 *
 * Utilities for transforming Zod schemas for OpenAI Structured Output API.
 * Used only in Facade LangGraph agents for LLM extraction.
 *
 * @see ADR-031-type-layering-strategy.md (Правило 2: makeNullable только локально)
 */

// === INTERNAL HELPERS ===

function unwrapSchema(schema: ZodTypeAny): ZodTypeAny {
  if (schema instanceof z.ZodOptional) {
    return unwrapSchema(schema.unwrap());
  }
  if (schema instanceof z.ZodDefault) {
    return unwrapSchema(schema.removeDefault());
  }
  return schema;
}

function makeFieldNullable(schema: ZodTypeAny): z.ZodNullable<ZodTypeAny> {
  const unwrapped = unwrapSchema(schema);

  if (unwrapped instanceof z.ZodObject) {
    /* eslint-disable-next-line @typescript-eslint/consistent-type-assertions */
    const shape = unwrapped.shape as Record<string, ZodTypeAny>;
    const newShape: Record<string, z.ZodNullable<ZodTypeAny>> = {};

    for (const [key, value] of Object.entries(shape)) {
      newShape[key] = makeFieldNullable(value);
    }

    return z.object(newShape).nullable();
  }

  if (unwrapped instanceof z.ZodArray) {
    return unwrapped.nullable();
  }

  return unwrapped.nullable();
}

// === PUBLIC API ===

/**
 * Transforms a Zod object schema making all fields nullable at all levels.
 *
 * Used for OpenAI Structured Output which requires:
 * - Root type MUST be "object" (not nullable)
 * - All fields MUST be nullable (not optional)
 *
 * Handles: ZodObject (recursive), ZodArray, ZodEnum, primitives
 * Does NOT handle: ZodUnion, ZodIntersection, ZodEffects
 *
 * @example
 * // In graph node (local wrapper):
 * import { makeNullable } from '@/facade/utils/llm-schemas';
 * import { adhocContextBase } from '@/schemas';
 *
 * const extractableSchema = makeNullable(adhocContextBase);
 * const extractor = getModel("extraction").withStructuredOutput(extractableSchema);
 *
 * @param schema - Base Zod object schema with .optional() fields
 * @returns Schema with all fields nullable (for OpenAI API)
 */
export function makeNullable<T extends z.ZodObject<z.ZodRawShape>>(
  schema: T
): z.ZodObject<z.ZodRawShape> {
  const unwrapped = unwrapSchema(schema);

  if (!(unwrapped instanceof z.ZodObject)) {
    throw new TypeError("makeNullable requires a ZodObject schema at root level");
  }

  /* eslint-disable-next-line @typescript-eslint/consistent-type-assertions */
  const shape = unwrapped.shape as Record<string, ZodTypeAny>;
  const newShape: Record<string, z.ZodNullable<ZodTypeAny>> = {};

  for (const [key, value] of Object.entries(shape)) {
    newShape[key] = makeFieldNullable(value);
  }

  return z.object(newShape);
}
```

**Шаг 2:** Удалить makeNullable из schemas.ts

**Файл:** `src/shared/schemas.ts` (строки 11-75)

```typescript
// БЫЛО:
function unwrapSchema(schema: ZodTypeAny): ZodTypeAny { ... }
function makeFieldNullable(schema: ZodTypeAny): z.ZodNullable<ZodTypeAny> { ... }
export function makeNullable<T extends z.ZodObject<z.ZodRawShape>>(...) { ... }

// СТАЛО:
// (удалить все 3 функции — перемещены в facade/utils/llm-schemas.ts)
```

**Шаг 3:** Обновить импорты в facade (3 файла)

**Файл 1:** `src/facade/langGraph/search-graph/nodes/extract-goal.ts`

```typescript
// БЫЛО:
import { makeNullable, targetContextSchema } from "@/schemas";

// СТАЛО:
import { targetContextSchema } from "@/schemas";
import { makeNullable } from "@/facade/utils/llm-schemas";
```

**Файл 2:** `src/facade/langGraph/search-graph/nodes/clarify-goal.ts`

```typescript
// БЫЛО:
import { makeNullable, targetContextSchema } from "@/schemas";

// СТАЛО:
import { targetContextSchema } from "@/schemas";
import { makeNullable } from "@/facade/utils/llm-schemas";
```

**Файл 3:** `src/facade/langGraph/shared-tools/extraction-models.ts`

```typescript
// БЫЛО:
import { makeNullable, userContextSchemaBase, trailSchemaBase } from "@/schemas";

// СТАЛО:
import { userContextSchemaBase, trailSchemaBase } from "@/schemas";
import { makeNullable } from "@/facade/utils/llm-schemas";
```

#### ✅ Чеклист ПОСЛЕ изменений

```bash
# 1. Проверить что новый файл создан
ls -la src/facade/utils/llm-schemas.ts

# 2. Проверить что makeNullable удалён из schemas.ts
grep -n "function makeNullable" src/shared/schemas.ts
# Ожидается: 0 совпадений

# 3. Проверить что импорты обновлены (3 файла)
grep -rn "from.*llm-schemas" src/facade/
# Ожидается: 3 совпадения

# 4. TypeScript compilation
npx tsc --noEmit

# 5. Tests (facade agents)
npm run test:integration -- extract-goal
npm run test:integration -- clarify-goal
```

**Breaking Change #4:** `makeNullable` import path changed

---

### 4.3. Обновить load-context.ts (локальный makeNullable)

#### ✅ Чеклист ДО изменений

```bash
# Проверить текущий код
grep -A 10 "adhocUserContextSchema" src/facade/langGraph/search-graph/nodes/load-context.ts
```

#### 📝 Изменения

**Файл:** `src/facade/langGraph/search-graph/nodes/load-context.ts`

```typescript
// БЫЛО:
import { adhocUserContextSchema } from "@/schemas";

// Где-то в коде (найти через grep):
// const extractor = getModel("extraction").withStructuredOutput(adhocUserContextSchema);

// СТАЛО:
import { adhocContextBase } from "@/schemas";
import { makeNullable } from "@/facade/utils/llm-schemas";

// В коде:
const extractableSchema = makeNullable(adhocContextBase);
const extractor = getModel("extraction").withStructuredOutput(extractableSchema);
```

**Примечание:** точное место замены зависит от структуры файла. Нужно найти где используется adhocUserContextSchema для LLM extraction.

#### ✅ Чеклист ПОСЛЕ изменений

```bash
# 1. Проверить импорты
grep "import.*adhocContextBase" src/facade/langGraph/search-graph/nodes/load-context.ts
grep "import.*makeNullable" src/facade/langGraph/search-graph/nodes/load-context.ts

# 2. Проверить что adhocUserContextSchema больше не используется
grep "adhocUserContextSchema" src/facade/langGraph/search-graph/nodes/load-context.ts
# Ожидается: 0 совпадений

# 3. TypeScript compilation
npx tsc --noEmit

# 4. Tests (SearchGraph)
npm run test:integration -- load-context
npm run test:integration -- search-graph
```

**Breaking Change #5:** `load-context.ts` uses `adhocContextBase` instead of `adhocUserContextSchema`

---

### 4.4. КРИТИЧНО: Validation после normalizer

#### ✅ Чеклист ДО изменений

```bash
# Проверить текущий код (нет validation)
grep -A 10 "normalizeAdhocContext" src/facade/mcp-server/tools/search-careers.tool.ts

# Ожидается:
# const normalized = await this.normalizer.normalizeAdhocContext(...);
# return this.coreClient.client.search.adhoc.query({
#   referenceContext: normalized,  // ← БЕЗ ПРОВЕРКИ!
# });
```

#### 📝 Изменения

**Файл:** `src/facade/mcp-server/tools/search-careers.tool.ts`

**Найти метод executeImpl (строка ~14-29):**

```typescript
// БЫЛО:
protected async executeImpl(params: McpSearchCareersParams, userId: UserId): Promise<ScoredMatchedCandidate[]> {
  const hasAnyField = Object.keys(params.referenceContext).length > 0;
  if (!hasAnyField) {
    throw new ValidationError("At least one field is required in reference context");
  }

  const normalized = await this.normalizer.normalizeAdhocContext(params.referenceContext, userId);

  const { sessionId: _sessionId, referenceContext: _ref, ...searchParams } = params;

  return this.coreClient.client.search.adhoc.query({
    userId,
    ...searchParams,
    referenceContext: normalized,  // ← БЕЗ ПРОВЕРКИ!
  });
}

// СТАЛО:
protected async executeImpl(params: McpSearchCareersParams, userId: UserId): Promise<ScoredMatchedCandidate[]> {
  const hasAnyField = Object.keys(params.referenceContext).length > 0;
  if (!hasAnyField) {
    throw new ValidationError("At least one field is required in reference context");
  }

  // 1. Normalizer returns partial object
  const normalizedPartial = await this.normalizer.normalizeAdhocContext(params.referenceContext, userId);

  // 2. VALIDATION (ADR-031 Правило 3: validation после normalizer)
  // Ensures:
  // - All fields match schema (min length, min array size)
  // - Partial object is valid (.optional() fields)
  // - Throws ZodError if invalid (caught by MCP error handler)
  const validated = adhocContextBase.parse(normalizedPartial);

  const { sessionId: _sessionId, referenceContext: _ref, ...searchParams } = params;

  return this.coreClient.client.search.adhoc.query({
    userId,
    ...searchParams,
    referenceContext: validated,  // ← ✅ ПРОВЕРЕННЫЙ ТИП!
  });
}
```

**Добавить импорт:**

```typescript
// В начале файла
import { adhocContextBase } from "@/schemas";
```

#### ✅ Чеклист ПОСЛЕ изменений

```bash
# 1. Проверить что validation добавлен
grep -A 5 "adhocContextBase.parse" src/facade/mcp-server/tools/search-careers.tool.ts

# 2. Проверить импорт
grep "import.*adhocContextBase" src/facade/mcp-server/tools/search-careers.tool.ts

# 3. TypeScript compilation
npx tsc --noEmit

# 4. Integration tests (search-careers tool)
npm run test:integration -- search-careers

# 5. Проверить что ZodError обрабатывается
# (должен быть test case для invalid normalizer output)
```

**КРИТИЧНО:** Это bug fix! Отсутствие validation — security/stability issue.

---

### 4.5. Фаза 2 Validation

```bash
# === ПОЛНАЯ ПРОВЕРКА ФАЗЫ 2 ===

# 1. TypeScript compilation (критично!)
npx tsc --noEmit
# Ожидается: 0 ошибок

# 2. Lint
npm run lint:fix

# 3. Unit tests (schemas)
npm run test:unit -- schemas

# 4. Integration tests (Facade agents)
npm run test:integration -- extract-goal
npm run test:integration -- clarify-goal
npm run test:integration -- load-context
npm run test:integration -- search-careers

# 5. Integration tests (SearchGraph)
npm run test:integration -- search-graph

# 6. Проверить что все breaking changes применены
echo "Checking breaking changes..."

# BC #3: adhocUserContextSchema removed
grep -r "adhocUserContextSchema" src/ tests/
# Ожидается: 0 совпадений

# BC #4: makeNullable import path changed
grep -r "makeNullable.*schemas" src/facade/
# Ожидается: 0 совпадений (должны быть llm-schemas)

# BC #5: load-context uses adhocContextBase
grep "adhocContextBase" src/facade/langGraph/search-graph/nodes/load-context.ts
# Ожидается: 1+ совпадений

# 7. Commit
git add src/
git commit -m "refactor(schemas+facade): ADR-031 critical type safety (Variant 2 Phase 2)

CRITICAL CHANGES:
- Create adhocContextBase with .partial() (ADR-031 Правило 1)
- Add validation after normalizer (BUG FIX, ADR-031 Правило 3)
- Move makeNullable to facade/utils/llm-schemas.ts (ADR-031 Правило 2)
- Update load-context.ts for local makeNullable wrapper
- Update search-careers.tool.ts with validation

Breaking changes:
- adhocUserContextSchema removed (use adhocContextBase) (BC #3)
- makeNullable import path changed (shared → facade/utils) (BC #4)
- load-context.ts API change (BC #5)

Type safety improvements:
- adhocContextBase .optional() fields match normalizer output
- Validation catches invalid data before Core API
- makeNullable isolated in facade (LLM concern)

See: ADR-031-type-layering-strategy.md, VARIANT-2-ENHANCED-PLAN.md"
```

---

## 5. Фаза 3: Consolidation

### Scope

1. mcpSearchCareersParamsSchema → inline в facade tool
2. mcpSearchUserCareersParamsSchema → consolidate (optional)

**Breaking Changes:** 0 (internal facade changes)
**Время:** 30 мин

---

### 5.1. mcpSearchCareersParamsSchema → inline

#### Обоснование

**ADR-031 + обсуждение:**
- mcpSearchCareersParamsSchema — internal facade MCP type
- Используется ТОЛЬКО в search-careers.tool.ts
- Telegram НЕ импортирует (только response schemas)
- Должна быть в facade, не в shared

#### 📝 Изменения

**Шаг 1:** Удалить из shared/schemas.ts

**Файл:** `src/shared/schemas.ts` (строки 1247-1258)

```typescript
// БЫЛО:
export const mcpSearchCareersParamsSchema = withPathLimitTransform(
  userSearchParamsRawSchema
    .omit({ userId: true })
    .extend({
      referenceContext: adhocContextBase,
      sessionId: sessionIdSchema,
    })
);

export type McpSearchCareersParams = z.infer<typeof mcpSearchCareersParamsSchema>;

// СТАЛО:
// (удалить обе секции)
```

**Шаг 2:** Добавить inline в facade tool

**Файл:** `src/facade/mcp-server/tools/search-careers.tool.ts`

```typescript
// В начале файла (после импортов)

/**
 * MCP params schema for search_careers tool.
 * Internal facade type (not in shared).
 *
 * Structure:
 * - sessionId: auth mapping (interface concern)
 * - referenceContext: adhocContextBase (domain fields)
 * - search filters: excludedContextFields, limit, etc
 */
const mcpSearchCareersParamsSchema = z.object({
  sessionId: sessionIdSchema,
  referenceContext: adhocContextBase,
  excludedContextFields: z.array(contextFieldSchema).default([]),
  excludedCreationReasons: z.array(newContextReasonSchema).default([]),
  recencyThresholdMonths: z.number().min(1).optional(),
  limit: z.number().min(1).max(100).default(20),
  pathLimit: z.number().min(1).max(100).default(20),
}).transform((data) => ({
  ...data,
  pathLimit: Math.min(data.pathLimit, data.limit),
}));

type McpSearchCareersParams = z.infer<typeof mcpSearchCareersParamsSchema>;

// Использование в tool:
export class SearchCareersTool extends BaseTool<McpSearchCareersParams, ScoredMatchedCandidate[]> {
  // ...
}
```

**Добавить импорты:**

```typescript
import { z } from "zod";
import {
  adhocContextBase,
  sessionIdSchema,
  contextFieldSchema,
  newContextReasonSchema,
  type ScoredMatchedCandidate,
} from "@/schemas";
```

**Шаг 3:** Удалить из mcp-server.ts registry (если используется)

**Файл:** `src/facade/mcp-server/mcp-server.ts`

```bash
# Проверить что schema НЕ регистрируется через mcpSearchCareersParamsSchema из shared
grep "mcpSearchCareersParamsSchema" src/facade/mcp-server/mcp-server.ts

# Если есть — обновить на локальную версию из tool
```

#### ✅ Чеклист ПОСЛЕ

```bash
# 1. Проверить что schema удалена из shared
grep "mcpSearchCareersParamsSchema" src/shared/schemas.ts
# Ожидается: 0 совпадений

# 2. Проверить что schema добавлена в tool
grep "mcpSearchCareersParamsSchema" src/facade/mcp-server/tools/search-careers.tool.ts
# Ожидается: 2+ совпадений (определение + использование)

# 3. TypeScript compilation
npx tsc --noEmit

# 4. Tests
npm run test:integration -- search-careers
```

**Примечание:** это НЕ breaking change для telegram (не импортирует эту schema).

---

### 5.2. mcpSearchUserCareersParamsSchema (optional)

**Аналогично 5.1**, но для `search-user-careers.tool.ts`.

**Можно пропустить**, если времени мало — это low priority consolidation.

---

### 5.3. Фаза 3 Validation

```bash
# 1. TypeScript compilation
npx tsc --noEmit

# 2. Lint
npm run lint:fix

# 3. Integration tests (MCP tools)
npm run test:integration -- search-careers
npm run test:integration -- search-user-careers

# 4. Проверить что telegram не затронут
npm run test:integration -- telegram

# 5. Commit
git add src/
git commit -m "refactor(facade): isolate internal MCP schemas (Variant 2 Phase 3)

- Move mcpSearchCareersParamsSchema to facade tool (inline)
- Remove from shared/schemas.ts (internal facade concern)

Rationale:
- Internal facade MCP types should not be in shared
- Telegram does NOT import these schemas (only response)
- Reduces shared package scope for Фаза 3 (repo split)

Breaking changes: 0 (internal facade only)

See: VARIANT-2-ENHANCED-PLAN.md §5"
```

---

## 6. Breaking Changes Analysis

### Итоговый список

| # | Breaking Change | Фаза | Affected Layers | Affected Files | Mitigation |
|---|-----------------|------|-----------------|----------------|------------|
| 1 | userSearchParamsSchema → Base | 1 | Core | 2-3 | TypeScript error guides |
| 2 | UserSearchParamsRaw type removed | 1 | - | 0 | Unused (internal) |
| 3 | adhocUserContextSchema removed | 2 | Facade | 3 | Use adhocContextBase |
| 4 | makeNullable import path | 2 | Facade | 3 | Update imports |
| 5 | load-context API change | 2 | Facade | 1 | Internal node |
| 6 | McpSearchCareersParams.referenceContext type | 2 | Facade | 1 | Runtime compatible |
| 7 | McpSearchUserCareersParams.referenceContext type | 2 | Facade | 1 | Runtime compatible |

**Итого:** 7 BC, все изолированы в Core/Facade, Telegram не затронут

---

### Cascade Analysis

#### BC #1: userSearchParamsSchema → Base

**Cascade:**
```
Core router import → TypeScript error → Fix import (1 line)
  ↓
Core tests type → TypeScript error → Fix type (1 line)
```

**Protection:** TypeScript compilation error

---

#### BC #3-5: adhocContextBase changes

**Cascade:**
```
adhocUserContextSchema removed
  ↓
load-context.ts import → TypeScript error
  ↓
Update to adhocContextBase + makeNullable wrapper (2 lines)

makeNullable moved
  ↓
3 files import → TypeScript error
  ↓
Update import path (1 line each)
```

**Protection:** TypeScript compilation error

---

#### BC #6-7: referenceContext type change

**Runtime impact:** ZERO (nullable vs optional, normalizer handles both)

**Type impact:** Facade internal (не влияет на external contracts)

---

## 7. Validation Plan

### 7.1. Pre-flight Checks (перед началом)

```bash
# 1. Clean working directory
git status
# Ожидается: no uncommitted changes

# 2. Create feature branch
git checkout -b refactor/schemas-variant-2-enhanced

# 3. Baseline tests (all passing)
npm run test:unit
npm run test:integration
npx tsc --noEmit
npm run lint

# 4. Backup (optional)
git branch refactor/schemas-variant-2-enhanced-backup
```

---

### 7.2. After Each Phase

**Фаза 1:**
```bash
npx tsc --noEmit
npm run lint:fix
npm run test:unit -- schemas
npm run test:integration -- search-manager
git commit -m "Phase 1: DRY improvements"
```

**Фаза 2:**
```bash
npx tsc --noEmit
npm run lint:fix
npm run test:unit -- schemas
npm run test:integration -- extract-goal clarify-goal load-context search-careers search-graph
git commit -m "Phase 2: ADR-031 critical"
```

**Фаза 3:**
```bash
npx tsc --noEmit
npm run lint:fix
npm run test:integration -- search-careers search-user-careers telegram
git commit -m "Phase 3: Consolidation"
```

---

### 7.3. Final Validation (перед PR)

```bash
# === ПОЛНАЯ ПРОВЕРКА ===

# 1. TypeScript (критично!)
npx tsc --noEmit
# Ожидается: 0 ошибок

# 2. Lint
npm run lint:fix
# Ожидается: 0 errors

# 3. All unit tests
npm run test:unit
# Ожидается: все проходят

# 4. All integration tests
npm run test:integration
# Ожидается: все проходят

# 5. Build
npm run build
# Ожидается: successful build

# 6. Manual smoke test (optional)
# - Start dev server
# - Test search_careers via Telegram
# - Test search_user_careers via Telegram
# - Verify responses match expected format

# 7. Check breaking changes applied
echo "=== Breaking Changes Verification ==="

# BC #1: userSearchParamsSchema
grep -r "userSearchParamsSchema" src/core/ tests/
# Ожидается: 0 совпадений

# BC #3: adhocUserContextSchema
grep -r "adhocUserContextSchema" src/ tests/
# Ожидается: 0 совпадений

# BC #4: makeNullable in shared
grep "makeNullable" src/shared/schemas.ts
# Ожидается: 0 совпадений

grep -r "makeNullable.*schemas" src/facade/
# Ожидается: 0 совпадений (должны быть llm-schemas)

# BC #5: adhocContextBase usage
grep "adhocContextBase" src/facade/langGraph/search-graph/nodes/load-context.ts
# Ожидается: 1+ совпадений

# 8. Git log check
git log --oneline refactor/schemas-variant-2-enhanced ^main
# Ожидается: 3 commits (Phase 1, 2, 3)
```

---

## 8. Rollback Strategy

### 8.1. Per-Phase Rollback

**Если Фаза 1 не прошла validation:**
```bash
# Откат последнего коммита
git reset --hard HEAD~1

# Проверка
npm run test:integration
npx tsc --noEmit
```

**Если Фаза 2 не прошла validation:**
```bash
# Откат 1 коммита (оставляем Фазу 1)
git reset --hard HEAD~1

# ИЛИ откат обеих фаз
git reset --hard HEAD~2
```

---

### 8.2. Full Rollback

**Откат всех изменений:**
```bash
# Вернуться на main
git checkout main

# Удалить feature branch
git branch -D refactor/schemas-variant-2-enhanced

# Восстановить из backup (если создавали)
git checkout refactor/schemas-variant-2-enhanced-backup
git branch -m refactor/schemas-variant-2-enhanced
```

---

### 8.3. Partial Rollback (cherry-pick)

**Сценарий:** Фаза 2 имеет проблемы, но хотим оставить Фазу 1

```bash
# 1. Создать новую ветку от main
git checkout main
git checkout -b refactor/schemas-phase-1-only

# 2. Cherry-pick только коммит Фазы 1
git cherry-pick <commit-hash-phase-1>

# 3. Проверка
npm run test:integration
npx tsc --noEmit

# 4. Если OK — создать PR только с Фазой 1
```

---

## 9. Appendix: Code Examples

### A. adhocContextBase Final Structure

```typescript
// === SHARED/SCHEMAS.TS ===

/**
 * Adhoc context base schema for search reference context.
 * Contains subset of userContext fields used for adhoc search.
 */
export const adhocContextBase = userContextSchemaBase
  .pick({
    position: true,
    domains: true,
    skills: true,
    industry: true,
    cityName: true,
    countryCode: true,
    languages: true,
  })
  .partial();

export type AdhocContextBase = z.infer<typeof adhocContextBase>;
```

---

### B. makeNullable Final Location

```typescript
// === FACADE/UTILS/LLM-SCHEMAS.TS ===

/**
 * Transforms Zod schema for OpenAI Structured Output.
 * All fields become nullable (T | null).
 */
export function makeNullable<T extends z.ZodObject<z.ZodRawShape>>(
  schema: T
): z.ZodObject<z.ZodRawShape> {
  // ... implementation
}
```

---

### C. Validation After Normalizer Pattern

```typescript
// === SEARCH-CAREERS.TOOL.TS ===

protected async executeImpl(params: McpSearchCareersParams, userId: UserId) {
  // 1. Normalizer (returns partial object)
  const normalizedPartial = await this.normalizer.normalizeAdhocContext(
    params.referenceContext,
    userId
  );

  // 2. VALIDATION (ADR-031 Правило 3)
  const validated = adhocContextBase.parse(normalizedPartial);

  // 3. Core API (validated data)
  return this.coreClient.client.search.adhoc.query({
    userId,
    referenceContext: validated,  // ← type-safe!
  });
}
```

---

### D. LLM Extraction Pattern

```typescript
// === LOAD-CONTEXT.TS ===

import { adhocContextBase } from "@/schemas";
import { makeNullable } from "@/facade/utils/llm-schemas";

// Local wrapper (not exported)
const extractableSchema = makeNullable(adhocContextBase);

// LLM extraction
const extractor = getModel("extraction").withStructuredOutput(extractableSchema);
const extracted = await extractor.invoke(userMessage);

// After normalizer + validation
const validated = adhocContextBase.parse(extracted);
```

---

## Summary Checklist

### Фаза 1 (30 мин)
- [ ] pathLimit helper добавлен
- [ ] 5 мест заменены на helper
- [ ] userSearchParamsSchema алиас удалён
- [ ] UserSearchParamsRaw type удалён
- [ ] .describe() добавлены (5 мест)
- [ ] JSDoc warnings добавлены (3 места)
- [ ] Tests pass
- [ ] Commit created

### Фаза 2 (1.5-2 ч)
- [ ] adhocContextBase создан (.pick().partial())
- [ ] adhocUserContextSchema удалён
- [ ] adhocSearchParamsSchema обновлён
- [ ] mcpSearchCareersParamsSchema обновлён
- [ ] makeNullable перемещён в facade/utils/llm-schemas.ts
- [ ] makeNullable удалён из shared/schemas.ts
- [ ] Импорты makeNullable обновлены (3 файла)
- [ ] load-context.ts обновлён (локальный makeNullable)
- [ ] **КРИТИЧНО:** Validation добавлен в search-careers.tool.ts
- [ ] Tests pass (integration!)
- [ ] Commit created

### Фаза 3 (30 мин)
- [ ] mcpSearchCareersParamsSchema перемещён в facade tool (inline)
- [ ] mcpSearchCareersParamsSchema удалён из shared
- [ ] Tests pass
- [ ] Commit created

### Final Validation
- [ ] npx tsc --noEmit (0 errors)
- [ ] npm run lint:fix (0 errors)
- [ ] npm run test:unit (all pass)
- [ ] npm run test:integration (all pass)
- [ ] Breaking changes verified (7 BC)
- [ ] Git log clean (3 commits)
- [ ] Ready for PR

---

## Changelog

**2025-12-17:** Initial plan created
- Combined Variant 2 (DRY) + ADR-031 (type safety)
- 3 phases: DRY → Critical → Consolidation
- 7 breaking changes (all isolated in Core/Facade)
- Detailed validation + rollback strategies
