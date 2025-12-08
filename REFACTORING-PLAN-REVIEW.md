# Ревью Плана Рефакторинга

> **Дата**: 2025-12-08
> **Ревьюер**: Claude Sonnet 4.5 (с "незамыленным взглядом")
> **Документ на ревью**: `ARCHITECTURAL-DECISIONS-FINAL.md`
> **Статус**: ⚠️ **План требует критической доработки**

---

## 1. Анализ Полноты Миграции

### 1.1. Inventory (что РЕАЛЬНО есть сейчас)

#### Params schemas в `facade/mcp-server/schemas.ts`: **17 schemas** ✅

```bash
$ grep "export const.*ParamsSchema = " src/facade/mcp-server/schemas.ts | wc -l
17
```

Полный список:
1. `getStoryParamsSchema`
2. `facadeAdhocSearchParamsSchema`
3. `searchUserCareersParamsSchema`
4. `setGoalParamsSchema`
5. `updateContextParamsSchema`
6. `getGoalParamsSchema`
7. `deleteGoalParamsSchema`
8. `searchByTargetParamsSchema`
9. `deleteContextParamsSchema`
10. `upsertContextParamsSchema`
11. `coldStartParamsSchema`
12. `resetColdStartParamsSchema`
13. `upsertTrailParamsSchema`
14. `deleteTrailParamsSchema`
15. `authParamsSchema`
16. `telegramRegisterParamsSchema`
17. `telegramLinkParamsSchema`

**Совпадает с планом!** ✅

---

#### Primitives в `facade/mcp-server/result.ts`: **3 Zod schemas + 2 utility types**

```typescript
// Zod schemas + types
export const sessionIdSchema = z.string().regex(...);
export type SessionId = z.infer<typeof sessionIdSchema>;

export const errorCodeSchema = z.enum([...]);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const errorResponseSchema = z.object({...});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;

// ❌ ПЛАН НЕ УПОМИНАЕТ эти utility types:
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
export function ok<T>(value: T): Result<T, never>;
export function err<E>(error: E): Result<never, E>;
```

**ПРОБЛЕМА #1**: План упоминает "primitives: sessionId, token, errorCode", НО:
- ❌ `tokenSchema` находится в `facade/schemas.ts:143`, **НЕ в result.ts!**
- ❌ `Result<T, E>` type и `ok/err` helpers **НЕ УПОМЯНУТЫ** в миграции

---

#### Response types в facade: **4 TypeScript types** (НЕ Zod schemas!)

**Файл**: `src/facade/mcp-server/auth.service.ts`

```typescript
export type RegisterResult = { token: Token; sessionId: SessionId; warning: string };
export type AuthenticateResult = { sessionId: SessionId };
export type TelegramRegisterResult = { userId: string; token: Token; sessionId: SessionId; isNewUser: boolean; hasStory: boolean };
export type TelegramLinkResult = { userId: string; sessionId: SessionId };
```

**НО!** Остальные 13 tools используют **СУЩЕСТВУЮЩИЕ domain types из shared**:
- `search_by_target`, `search_careers`, `search_user_careers` → `MatchedCandidateWithPath[]`
- `get_story` → `StoryInput`
- `upsert_context` → `UpsertContextResult`
- `upsert_trail` → `UpsertTrailResult`
- `set_goal`, `get_goal` → `Goal`
- `delete_*` → просто `{ success: true }`

**ПРОБЛЕМА #2**: План предлагает создать response schemas для **ВСЕХ 17 tools** (~200 строк), НО:
- ✅ 13 tools УЖЕ используют domain types из shared
- ❌ Нужно создать **ТОЛЬКО 4-5 schemas** для auth и delete operations (~80 строк, не 200!)

---

#### Файлы, импортирующие `facade/mcp-server/schemas.ts`: **1 файл**

```bash
$ grep -r "from.*facade/mcp-server/schemas" src/ --include="*.ts"
src/facade/mcp-server/facade-mcp-server.ts:import { authParamsSchema, ... } from "./schemas.js";
```

**Только внутренние файлы facade!** Никто ВНЕ facade не импортирует schemas напрямую ✅

---

#### Файлы, импортирующие `facade/mcp-server/result.ts`: **3 файла**

```bash
$ grep -r "from.*facade.*result" src/ --include="*.ts" | grep "from"
src/facade/mcp-server/schemas.ts:13:import { sessionIdSchema } from "./result.js";
src/facade/mcp-server/session-middleware.ts:import { sessionIdSchema } from "./result.js";
src/facade/errors.ts:1:import type { ErrorResponse } from "./mcp-server/result.js";
```

**КРИТИЧЕСКИ ВАЖНО**: После удаления `facade/result.ts` сломаются:
1. `facade/mcp-server/schemas.ts` (строка 13)
2. `facade/mcp-server/session-middleware.ts`
3. `facade/errors.ts` (строка 1)

---

#### Размер `shared/schemas.ts` СЕЙЧАС: **755 строк**

```bash
$ wc -l src/shared/schemas.ts
755 src/shared/schemas.ts
```

**После миграции**: 755 + 35 (primitives) + 100 (params) + 80 (responses) = **~970 строк**

План завышает оценку (+200 строк для responses вместо +80), но это не критично.

---

### 1.2. Пропущенное в плане

#### ❌ Пропущен Result<T, E> type и ok/err helpers

**Где используется**: ВСЕ facade tools возвращают `Result<SomeType, ErrorResponse>`

```typescript
// Примеры
async execute(params: AuthParams): Promise<Result<AuthenticateResult | RegisterResult, ErrorResponse>>
async execute(params: GetStoryParams): Promise<Result<StoryInput, ErrorResponse>>
```

**План НЕ ГОВОРИТ, куда переместить Result!**

**Варианты решения**:
- A) Создать `facade/utils/result.ts` (оставить в facade - это utility, не MCP contract)
- B) Переместить в shared (НО это не domain type!)

**Рекомендация**: **Вариант A** - Result это внутренний utility facade, не часть MCP contract

---

#### ❌ Пропущен шаг "Обновить импорты в facade"

**План**:
- Шаг 1: Переместить schemas из facade в shared
- Шаг 2: Создать response schemas в shared
- Шаг 3: Удалить facade/schemas.ts и facade/result.ts ← **СЛОМАЕТ БИЛД!**

**Что сломается** после шага 3:

1. **facade-mcp-server.ts:6-24** - импортирует ВСЕ 17 params schemas из `./schemas.js`
   ```typescript
   import {
     authParamsSchema,
     coldStartParamsSchema,
     // ... 15 ещё
   } from "./schemas.js"; // ❌ Файл удалён!
   ```

2. **session-middleware.ts** - импортирует `sessionIdSchema` из `./result.js`

3. **errors.ts:1** - импортирует `ErrorResponse` type из `./mcp-server/result.js`

**ОБЯЗАТЕЛЬНО добавить Шаг 2.5**:
```markdown
### Шаг 2.5: Обновить импорты в facade

**Файлы для изменения**:
1. `facade-mcp-server.ts` (строки 6-24):
   - Заменить `from "./schemas.js"` → `from "../../shared/schemas.js"`

2. `session-middleware.ts`:
   - Заменить `from "./result.js"` → `from "../../shared/schemas.js"`

3. `errors.ts` (строка 1):
   - Заменить `from "./mcp-server/result.js"` → `from "../shared/schemas.js"`

**Проверка**:
```bash
npx tsc --noEmit
# Должно пройти без ошибок
```
```

---

#### ❌ Дублирование типов между auth.service.ts и shared

**Проблема**: После миграции будет **дублирование типов**:

**В auth.service.ts** (СЕЙЧАС):
```typescript
export type TelegramRegisterResult = {
  userId: string;
  token: Token;
  sessionId: SessionId;
  isNewUser: boolean;
  hasStory: boolean;
};
```

**В shared/schemas.ts** (ПОСЛЕ миграции):
```typescript
export const telegramRegisterResponseSchema = z.object({
  userId: userIdSchema,
  token: tokenSchema,
  sessionId: sessionIdSchema,
  isNewUser: z.boolean(),
  hasStory: z.boolean(),
});
export type TelegramRegisterResponse = z.infer<typeof telegramRegisterResponseSchema>;
```

**План НЕ ОБЪЯСНЯЕТ, как разрешить конфликт!**

**Рекомендация**:
1. Удалить `TelegramRegisterResult` из auth.service.ts
2. Заменить на `TelegramRegisterResponse` из shared
3. То же для `RegisterResult`, `AuthenticateResult`, `TelegramLinkResult`

---

## 2. Конфликты между Решениями

### 2.1. Решение #1 (schemas в shared) vs Принцип CLAUDE.md

**Принцип CLAUDE.md**: "фасад и core не должны иметь общие зависимости"

**План после миграции**:
```
@waymates/shared (BASE)
   ↑
   ├── @waymates/facade (импортирует shared)
   └── @waymates/telegram-bot (импортирует shared)
```

**НО СЕЙЧАС архитектура**:
```
src/
├── shared/        (domain types)
├── core/          (Neo4j, бизнес-логика)
├── facade/        (MCP server, использует core через tRPC)
└── telegram-bot/  (UI)
```

**После разделения на пакеты РЕАЛЬНО будет**:
```
@waymates/shared (domain types + MCP contract)
   ↑
   ├── @waymates/core (Neo4j, search logic)
   ├── @waymates/facade (MCP server, использует core через tRPC)
   └── @waymates/telegram-bot (UI)
```

**Вопрос**: Нарушает ли это принцип?

**Ответ**: **НЕТ!** ✅
- shared - это **НЕЗАВИСИМЫЙ BASE** пакет (domain types)
- Core импортирует shared для domain types (UserContext, Trail)
- Facade импортирует shared для domain types + MCP schemas
- Telegram импортирует shared для MCP schemas (Tool Registry)

**Это НЕ "общая зависимость"** - это BASE dependency pattern. Правильная архитектура.

**Конфликта НЕТ** ✅

---

### 2.2. Решение #1 vs Решение #2 (SessionService)

**Решение #2**: SessionService.initialize() вызывает `callTool("register_telegram")`

**Цепочка зависимостей**:
```
Telegram → BotServices → SessionService → McpClient → Tool Registry → shared
```

**Вопрос**: Циклическая зависимость?

**Ответ**: **НЕТ!** ✅
- shared НЕ импортирует telegram
- Односторонний поток: telegram → shared

**Конфликта НЕТ** ✅

---

### 2.3. Решение #1 vs Решение #3 (BotServices)

**Решение #3**: BotServices содержит mcpClient

**Цепочка**:
```
BotContext → BotServices → McpClient → Tool Registry → shared/schemas.ts
```

**Проверка**: Зависимости корректны?

**Ответ**: **ДА!** ✅
- Telegram зависит от shared (односторонне)
- НЕТ обратной зависимости

**Конфликта НЕТ** ✅

---

## 3. Проблемы с Порядком Выполнения

### 3.1. Пропущенные шаги

**План СЕЙЧАС**:
- Шаг 1: Переместить schemas из facade в shared
- Шаг 2: Создать response schemas в shared
- Шаг 3: Удалить facade/schemas.ts и facade/result.ts

**❌ КРИТИЧЕСКАЯ ПРОБЛЕМА**: Шаг 3 **СЛОМАЕТ БИЛД!**

Между шагом 2 и 3 отсутствует:

#### **Шаг 2.5: Обновить импорты в facade** ⚠️ ОБЯЗАТЕЛЬНО

**Файлы для изменения**:

1. **facade-mcp-server.ts** (строки 6-24):
   ```diff
   - } from "./schemas.js";
   + } from "../../shared/schemas.js";
   ```

2. **session-middleware.ts**:
   ```diff
   - import { sessionIdSchema } from "./result.js";
   + import { sessionIdSchema } from "../../shared/schemas.js";
   ```

3. **errors.ts** (строка 1):
   ```diff
   - import type { ErrorResponse } from "./mcp-server/result.js";
   + import type { ErrorResponse } from "../shared/schemas.js";
   ```

4. **auth.service.ts**:
   ```diff
   - import type { SessionId } from "./result.js";
   - import type { Token } from "./schemas.js";
   + import type { SessionId, Token } from "../../shared/schemas.js";
   ```

**Проверка после шага 2.5**:
```bash
npx tsc --noEmit
npm run lint
# Должны пройти БЕЗ ОШИБОК
```

**ТОЛЬКО ПОСЛЕ этого можно выполнять Шаг 3!**

---

### 3.2. Зависимости между шагами

**Правильный порядок**:

1. **Шаг 1**: Переместить primitives + params schemas в shared (**НЕ удаляя** facade/schemas.ts)
2. **Шаг 2**: Создать response schemas в shared
3. **Шаг 2.5**: Обновить импорты в facade ← **ПРОПУЩЕН В ПЛАНЕ!**
4. **Шаг 2.6**: Проверка билда (`npx tsc --noEmit`)
5. **Шаг 3**: Удалить facade/schemas.ts и facade/result.ts
6. **Шаг 4**: Финальная проверка (lint + tsc + tests)

---

## 4. Риски при Разделении на Пакеты

### 4.1. Архитектурные риски

#### ⚠️ Риск #1: План НЕ УПОМИНАЕТ @waymates/core

**План предлагает**:
```
@waymates/shared
   ↑
   ├── @waymates/facade
   └── @waymates/telegram-bot
```

**РЕАЛЬНОСТЬ**:
```
@waymates/shared (domain types + MCP contract)
   ↑
   ├── @waymates/core (Neo4j, search logic) ← НЕ УПОМЯНУТ!
   ├── @waymates/facade (MCP server + session)
   └── @waymates/telegram-bot (UI)
```

**Facade использует core через tRPC**, но ОБА импортируют shared.

**Это КОРРЕКТНО?** ✅ ДА! Shared - BASE пакет.

---

### 4.2. Технические риски

#### ℹ️ Размер shared/schemas.ts

**СЕЙЧАС**: 755 строк
**ПОСЛЕ миграции**: ~970 строк

**Критичность**: НЕ критично (приемлемо до 1200 строк)

**Альтернатива** (если файл вырастет >1200 строк):
```
shared/
├── schemas.ts              (domain: UserContext, Trail, Goal)
├── mcp-primitives.ts       (sessionId, token, errorCode)
├── mcp-params-schemas.ts   (17 params schemas)
├── mcp-response-schemas.ts (response schemas)
└── index.ts                (re-export)
```

**Рекомендация**: Пока оставить в одном файле, НО добавить **секции с комментариями**:
```typescript
// ==========================================
// === MCP PRIMITIVES ===
// ==========================================

// ==========================================
// === MCP PARAMS SCHEMAS ===
// ==========================================

// ==========================================
// === MCP RESPONSE SCHEMAS ===
// ==========================================
```

---

## 5. Рекомендации

### 5.1. Критические изменения (ОБЯЗАТЕЛЬНО)

#### 1. ❌ Добавить Шаг 2.5: "Обновить импорты в facade"

**Без этого шага билд СЛОМАЕТСЯ!**

См. раздел "3.1. Пропущенные шаги" для деталей.

---

#### 2. ❌ Решить судьбу Result<T, E> type

**Проблема**: План не упоминает Result<T, E>, но все facade tools его используют.

**Варианты**:
- A) Создать `facade/utils/result.ts` (оставить в facade)
- B) Переместить в shared (НО это не domain type!)

**Рекомендация**: **Вариант A**

**Обоснование**: Result<T, E> - это internal utility facade, не часть MCP contract. Telegram Bot НЕ ДОЛЖЕН знать про Result - он получает JSON response через MCP HTTP.

**Реализация**:
```typescript
// facade/utils/result.ts (НОВЫЙ ФАЙЛ)
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
```

**Обновить импорты**:
```typescript
// facade/mcp-server/tools/*.ts
- import type { Result } from "../result.js";
+ import type { Result } from "../utils/result.js";
```

---

#### 3. ❌ Удалить дублирование auth types

**Проблема**: auth.service.ts имеет TypeScript types, план создаёт Zod schemas.

**Решение**:
1. Создать Zod schemas в shared:
   ```typescript
   export const telegramRegisterResponseSchema = z.object({
     userId: userIdSchema,
     token: tokenSchema,
     sessionId: sessionIdSchema,
     isNewUser: z.boolean(),
     hasStory: z.boolean(),
   });
   export type TelegramRegisterResponse = z.infer<typeof telegramRegisterResponseSchema>;
   ```

2. Удалить типы из auth.service.ts:
   ```diff
   - export type TelegramRegisterResult = { ... };
   - export type RegisterResult = { ... };
   - export type AuthenticateResult = { ... };
   - export type TelegramLinkResult = { ... };
   ```

3. Заменить использование:
   ```diff
   - async registerViaTelegram(...): Promise<TelegramRegisterResult> {
   + async registerViaTelegram(...): Promise<TelegramRegisterResponse> {
   ```

---

### 5.2. Улучшения (желательно)

#### 4. ℹ️ Уточнить response schemas: НЕ создавать для всех 17 tools

**План говорит**: "Создать response schemas для ВСЕХ 17 tools (~200 строк)"

**РЕАЛЬНОСТЬ**: 13 tools УЖЕ используют domain types из shared!

**Response schemas нужны ТОЛЬКО для**:
- `auth`, `register_telegram`, `link_telegram` → auth response schemas (4 schemas)
- `delete_goal`, `delete_context`, `delete_trail` → delete response schema (1 schema)

**НЕ нужны для**:
- `search_by_target`, `search_careers`, `search_user_careers` → используют `MatchedCandidateWithPath[]` ✅
- `get_story` → использует `StoryInput` ✅
- `upsert_context` → использует `UpsertContextResult` ✅
- `upsert_trail` → использует `UpsertTrailResult` ✅
- `set_goal`, `get_goal` → используют `Goal` ✅

**Итого**: **~5 response schemas** (~80 строк), НЕ 17 (~200 строк)

**Рекомендация**: Обновить план, убрать избыточные response schemas.

---

#### 5. ℹ️ Добавить секции в shared/schemas.ts

**Для читаемости** после миграции:

```typescript
// ==========================================
// === ZOD UTILITIES ===
// ==========================================

// ==========================================
// === ID PATTERNS & BASE SCHEMAS ===
// ==========================================

// ==========================================
// === DOMAIN ENTITIES ===
// ==========================================

// ==========================================
// === MCP PRIMITIVES ===    ← НОВОЕ
// ==========================================
export const sessionIdSchema = z.string().regex(...);
export const tokenSchema = z.string().uuid();
export const errorCodeSchema = z.enum([...]);

// ==========================================
// === MCP PARAMS SCHEMAS ===    ← НОВОЕ
// ==========================================
export const telegramRegisterParamsSchema = z.object({...});
// ... 16 ещё

// ==========================================
// === MCP RESPONSE SCHEMAS ===    ← НОВОЕ
// ==========================================
export const telegramRegisterResponseSchema = z.object({...});
// ... 4 ещё
```

---

## 6. Обновлённый План Миграции

### Шаг 1: Переместить Primitives в shared

**Файл**: `shared/schemas.ts`

**Добавить секцию** (после "=== DOMAIN ENTITIES ==="):

```typescript
// ==========================================
// === MCP PRIMITIVES ===
// ==========================================

export const sessionIdSchema = z
  .string()
  .regex(/^sess_[0-9a-f]{32}$/, "Session ID must be in format sess_<32-char-hex>")
  .describe("Session ID in format sess_<32-char-hex>");

export type SessionId = z.infer<typeof sessionIdSchema>;

export const tokenSchema = z
  .string()
  .uuid()
  .describe("User token (UUID v7 format) for authentication");

export type Token = z.infer<typeof tokenSchema>;

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

export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const errorResponseSchema = z.object({
  code: errorCodeSchema,
  message: z.string(),
  details: z.record(z.unknown()).optional(),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;
```

**Проверка**:
```bash
npx tsc --noEmit
# Должно пройти (facade/result.ts ещё НЕ удалён)
```

---

### Шаг 2: Переместить Params Schemas в shared

**Файл**: `shared/schemas.ts`

**Добавить секцию** (после "=== MCP PRIMITIVES ==="):

```typescript
// ==========================================
// === MCP PARAMS SCHEMAS ===
// ==========================================

// Auth
export const authParamsSchema = z.object({
  token: tokenSchema.optional(),
});

export type AuthParams = z.infer<typeof authParamsSchema>;

export const telegramRegisterParamsSchema = z.object({
  telegramUserId: z.number().int().positive().describe("Telegram internal user ID (ctx.from.id)"),
  telegramUsername: z.string().optional().describe("Telegram username (without @)"),
  telegramFirstName: z.string().optional().describe("Telegram first name"),
});

export type TelegramRegisterParams = z.infer<typeof telegramRegisterParamsSchema>;

export const telegramLinkParamsSchema = z.object({
  token: tokenSchema.describe("Token from LibreChat account to link"),
  telegramUserId: z.number().int().positive().describe("Telegram internal user ID (ctx.from.id)"),
  telegramUsername: z.string().optional().describe("Telegram username (without @)"),
  telegramFirstName: z.string().optional().describe("Telegram first name"),
});

export type TelegramLinkParams = z.infer<typeof telegramLinkParamsSchema>;

// Story
export const getStoryParamsSchema = z.object({
  targetUserId: userIdSchema.optional(),
  sessionId: sessionIdSchema,
});

export type GetStoryParams = z.infer<typeof getStoryParamsSchema>;

// Cold Start
export const coldStartParamsSchema = z.object({
  message: z.string().min(1).describe("User message (career history or confirmation)"),
  sessionId: sessionIdSchema,
});

export type ColdStartParams = z.infer<typeof coldStartParamsSchema>;

export const resetColdStartParamsSchema = z.object({
  sessionId: sessionIdSchema,
});

export type ResetColdStartParams = z.infer<typeof resetColdStartParamsSchema>;

// Search
export const facadeAdhocSearchParamsSchema = userSearchParamsRawSchema
  .omit({ userId: true })
  .extend({
    referenceContext: adhocUserContextSchema,
    sessionId: sessionIdSchema,
  })
  .refine((data) => data.pathLimit <= data.limit, {
    message: "pathLimit must be <= limit (cannot return more results than fetched from DB)",
    path: ["pathLimit"],
  });

export type FacadeAdhocSearchParams = z.infer<typeof facadeAdhocSearchParamsSchema>;

export const searchUserCareersParamsSchema = userSearchParamsRawSchema
  .omit({ userId: true })
  .extend({
    sessionId: sessionIdSchema,
  })
  .refine((data) => data.pathLimit <= data.limit, {
    message: "pathLimit must be <= limit (cannot return more results than fetched from DB)",
    path: ["pathLimit"],
  });

export type SearchUserCareersParams = z.infer<typeof searchUserCareersParamsSchema>;

export const searchByTargetParamsSchema = targetSearchParamsBaseSchema.extend({
  sessionId: sessionIdSchema,
});

export type SearchByTargetParams = z.infer<typeof searchByTargetParamsSchema>;

// Goals
export const setGoalParamsSchema = z.object({
  targetContext: targetContextSchema,
  sessionId: sessionIdSchema,
});

export type SetGoalParams = z.infer<typeof setGoalParamsSchema>;

export const getGoalParamsSchema = z.object({
  targetUserId: userIdSchema.optional(),
  sessionId: sessionIdSchema,
});

export type GetGoalParams = z.infer<typeof getGoalParamsSchema>;

export const deleteGoalParamsSchema = z.object({
  sessionId: sessionIdSchema,
});

export type DeleteGoalParams = z.infer<typeof deleteGoalParamsSchema>;

// Contexts
export const updateContextParamsSchema = z.object({
  message: z
    .string()
    .min(10)
    .describe(
      "User message describing context updates in natural language. " +
        "Example: 'Добавь React в мои навыки' or 'Измени позицию на Senior Developer'",
    ),
  sessionId: sessionIdSchema,
});

export type UpdateContextParams = z.infer<typeof updateContextParamsSchema>;

export const upsertContextParamsSchema = z.object({
  message: z
    .string()
    .min(10)
    .describe(
      "User message describing a new career context in natural language. " +
        "Example: 'Я работаю senior backend в Яндексе с 2023 года в Москве, пишу на Python и Go'",
    ),
  sessionId: sessionIdSchema,
});

export type UpsertContextParams = z.infer<typeof upsertContextParamsSchema>;

export const deleteContextParamsSchema = z.object({
  contextId: contextIdSchema,
  sessionId: sessionIdSchema,
});

export type DeleteContextParams = z.infer<typeof deleteContextParamsSchema>;

// Trails
export const upsertTrailParamsSchema = z.object({
  message: z
    .string()
    .min(10)
    .describe(
      "User message describing a learning trail in natural language. " +
        "Example: 'I took a React course on Udemy for 8 weeks'",
    ),
  fromContextId: contextIdSchema
    .nullable()
    .optional()
    .describe("Source context ID if trail originates from a specific context"),
  sessionId: sessionIdSchema,
});

export type UpsertTrailParams = z.infer<typeof upsertTrailParamsSchema>;

export const deleteTrailParamsSchema = z.object({
  trailId: trailIdSchema,
  sessionId: sessionIdSchema,
});

export type DeleteTrailParams = z.infer<typeof deleteTrailParamsSchema>;
```

**Проверка**:
```bash
npx tsc --noEmit
# Должно пройти
```

---

### Шаг 3: Создать Response Schemas в shared

**Файл**: `shared/schemas.ts`

**Добавить секцию** (после "=== MCP PARAMS SCHEMAS ==="):

```typescript
// ==========================================
// === MCP RESPONSE SCHEMAS ===
// ==========================================

// Auth responses
export const registerResponseSchema = z.object({
  token: tokenSchema,
  sessionId: sessionIdSchema,
  warning: z.string(),
});

export type RegisterResponse = z.infer<typeof registerResponseSchema>;

export const authenticateResponseSchema = z.object({
  sessionId: sessionIdSchema,
});

export type AuthenticateResponse = z.infer<typeof authenticateResponseSchema>;

export const telegramRegisterResponseSchema = z.object({
  userId: userIdSchema,
  token: tokenSchema,
  sessionId: sessionIdSchema,
  isNewUser: z.boolean(),
  hasStory: z.boolean(),
});

export type TelegramRegisterResponse = z.infer<typeof telegramRegisterResponseSchema>;

export const telegramLinkResponseSchema = z.object({
  userId: userIdSchema,
  sessionId: sessionIdSchema,
  hasStory: z.boolean(),
});

export type TelegramLinkResponse = z.infer<typeof telegramLinkResponseSchema>;

// Delete response (generic for delete_goal, delete_context, delete_trail)
export const deleteResponseSchema = z.object({
  success: z.boolean(),
});

export type DeleteResponse = z.infer<typeof deleteResponseSchema>;

// NOTE: Остальные tools используют СУЩЕСТВУЮЩИЕ domain types:
// - search_by_target, search_careers, search_user_careers → MatchedCandidateWithPath[]
// - get_story → StoryInput
// - upsert_context → UpsertContextResult
// - upsert_trail → UpsertTrailResult
// - set_goal, get_goal → Goal
```

**Проверка**:
```bash
npx tsc --noEmit
# Должно пройти
```

---

### Шаг 4: Создать facade/utils/result.ts

**НОВЫЙ ФАЙЛ**: `src/facade/utils/result.ts`

```typescript
/**
 * Result type for facade tools.
 * Discriminated union pattern for success/error handling.
 *
 * NOT part of MCP contract - internal facade utility.
 */
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
```

**Проверка**:
```bash
npx tsc --noEmit
# Должно пройти
```

---

### Шаг 5: Обновить импорты в facade ⚠️ КРИТИЧНО

#### 5.1. facade-mcp-server.ts

```diff
+ import { throwToolError } from "../errors.js";
- import { throwToolError } from "../errors.js";
-
- import { AuthService } from "./auth.service.js";
- import {
-   authParamsSchema,
-   coldStartParamsSchema,
-   deleteContextParamsSchema,
-   deleteGoalParamsSchema,
-   deleteTrailParamsSchema,
-   facadeAdhocSearchParamsSchema,
-   getGoalParamsSchema,
-   getStoryParamsSchema,
-   resetColdStartParamsSchema,
-   searchByTargetParamsSchema,
-   searchUserCareersParamsSchema,
-   setGoalParamsSchema,
-   telegramLinkParamsSchema,
-   telegramRegisterParamsSchema,
-   updateContextParamsSchema,
-   upsertContextParamsSchema,
-   upsertTrailParamsSchema,
- } from "./schemas.js";
+ import {
+   authParamsSchema,
+   coldStartParamsSchema,
+   deleteContextParamsSchema,
+   deleteGoalParamsSchema,
+   deleteTrailParamsSchema,
+   facadeAdhocSearchParamsSchema,
+   getGoalParamsSchema,
+   getStoryParamsSchema,
+   resetColdStartParamsSchema,
+   searchByTargetParamsSchema,
+   searchUserCareersParamsSchema,
+   setGoalParamsSchema,
+   telegramLinkParamsSchema,
+   telegramRegisterParamsSchema,
+   updateContextParamsSchema,
+   upsertContextParamsSchema,
+   upsertTrailParamsSchema,
+ } from "../../shared/schemas.js";
+ import { AuthService } from "./auth.service.js";
import { AuthTool } from "./tools/auth.tool.js";
```

---

#### 5.2. session-middleware.ts

```diff
- import { sessionIdSchema } from "./result.js";
+ import { sessionIdSchema } from "../../shared/schemas.js";
```

---

#### 5.3. errors.ts

```diff
- import type { ErrorResponse } from "./mcp-server/result.js";
+ import type { ErrorResponse } from "../shared/schemas.js";
```

---

#### 5.4. auth.service.ts

```diff
- import type { SessionId } from "./result.js";
- import type { Token } from "./schemas.js";
+ import type { SessionId, Token, TelegramRegisterResponse, RegisterResponse, AuthenticateResponse, TelegramLinkResponse } from "../../shared/schemas.js";

// Удалить старые type definitions
- export type RegisterResult = { ... };
- export type AuthenticateResult = { ... };
- export type TelegramRegisterResult = { ... };
- export type TelegramLinkResult = { ... };

// Обновить signatures
- async register(): Promise<RegisterResult> {
+ async register(): Promise<RegisterResponse> {

- async authenticate(token: Token): Promise<AuthenticateResult> {
+ async authenticate(token: Token): Promise<AuthenticateResponse> {

- async registerViaTelegram(...): Promise<TelegramRegisterResult> {
+ async registerViaTelegram(...): Promise<TelegramRegisterResponse> {

- async linkTelegram(...): Promise<TelegramLinkResult> {
+ async linkTelegram(...): Promise<TelegramLinkResponse> {
```

---

#### 5.5. tools/base-tool.ts (и все остальные tools)

```diff
- import type { Result } from "../result.js";
+ import type { Result } from "../utils/result.js";
```

**Файлы для изменения**:
- `tools/auth.tool.ts`
- `tools/cold-start.tool.ts`
- `tools/reset-cold-start.tool.ts`
- `tools/get-story.tool.ts`
- `tools/search-by-target.tool.ts`
- `tools/search-careers.tool.ts`
- `tools/search-user-careers.tool.ts`
- `tools/set-goal.tool.ts`
- `tools/get-goal.tool.ts`
- `tools/delete-goal.tool.ts`
- `tools/update-context.tool.ts`
- `tools/upsert-context.tool.ts`
- `tools/delete-context.tool.ts`
- `tools/upsert-trail.tool.ts`
- `tools/delete-trail.tool.ts`

**Команда для массовой замены**:
```bash
cd src/facade/mcp-server/tools
sed -i 's|from "../result.js"|from "../utils/result.js"|g' *.ts
```

---

### Шаг 6: Проверка билда

```bash
npx tsc --noEmit
npm run lint
```

**Должно пройти БЕЗ ОШИБОК!** ✅

---

### Шаг 7: Удалить facade/schemas.ts и facade/result.ts

```bash
rm src/facade/mcp-server/schemas.ts
rm src/facade/mcp-server/result.ts
```

**Проверка**:
```bash
npx tsc --noEmit
npm run lint
# Должны пройти БЕЗ ОШИБОК
```

---

### Шаг 8: Финальная проверка

```bash
# 1. TypeScript
npx tsc --noEmit

# 2. Linter
npm run lint

# 3. Unit tests
npm run test:unit

# 4. Integration tests
npm run test:integration

# 5. Проверка импортов
grep -r "from.*facade/mcp-server/schemas" src/
grep -r "from.*facade/mcp-server/result" src/
# Должны вернуть 0 результатов
```

---

## 7. Итоговая Оценка

### ⚠️ План требует доработки

**Критические проблемы** (блокируют выполнение):
1. ❌ Пропущен Шаг 2.5: "Обновить импорты в facade"
2. ❌ Result<T, E> type НЕ УПОМЯНУТ в миграции
3. ❌ Дублирование типов между auth.service.ts и shared

**Важные уточнения**:
4. ⚠️ Response schemas - план предлагает ~200 строк для ВСЕХ 17 tools, НО нужно только ~80 строк для 5 schemas
5. ⚠️ tokenSchema находится в facade/schemas.ts, НЕ в result.ts

**Некритические замечания**:
6. ℹ️ План НЕ УПОМИНАЕТ @waymates/core при разделении на пакеты

**Конфликты между решениями**: ✅ НЕТ

**Конфликты со старым REFACTORING-PLAN.md**: ✅ НЕТ

---

### Рекомендация

**План НЕЛЬЗЯ выполнять в текущем виде** - он сломает билд.

**Обязательные изменения**:
1. Добавить Шаг 2.5 (обновить импорты)
2. Добавить Шаг 4 (создать facade/utils/result.ts)
3. Обновить Шаг 3 (удалить дублирование auth types)
4. Уточнить response schemas (только 5, не 17)

**После доработки план будет готов к выполнению** ✅

---

### Приоритет выполнения

**ПОСЛЕ доработки плана**:

1. **P0** (КРИТИЧНО): Миграция schemas (этот план)
2. **P1** (ВАЖНО): REFACTORING-PLAN.md (9 задач - независимые от миграции)
3. **P2** (ОПЦИОНАЛЬНО): Разделение на пакеты (в будущем)

**Планы НЕ КОНФЛИКТУЮТ** - можно выполнять независимо после доработки.
