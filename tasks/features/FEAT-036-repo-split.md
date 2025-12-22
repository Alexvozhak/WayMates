# FEAT-036: Repo Split — Подготовка к разделению репозитория

**Статус:** TODO
**Приоритет:** P1
**Зависимости:** FEAT-032 (Pino), FEAT-033 (Sentry)
**Блокирует:** Фаза 3 (физический split), Фаза 7 (Deploy)
**Связь:** MVP-RELEASE-PLAN.md → Фаза 3

---

## Цель

Подготовить кодовую базу к разделению на два репозитория:
- **waymates-core/** (private) — core + cypher (бизнес-логика, Cypher запросы)
- **waymates-app/** (public) — shared, facade, telegram-bot, chart (презентация для работодателей)

---

## Проблема

Сейчас `facade` зависит от `core` через tRPC type inference:

```typescript
// shared/types.ts
export type { AppRouter } from "../core/routers/app.router.js";

// facade/core-client.ts
import type { AppRouter } from "../shared/types.js";
const client = createTRPCProxyClient<AppRouter>(...);
```

После split путь `../core/...` не существует — нужен явный контракт.

---

## Решение: ICoreApi Interface

Создать явный интерфейс API в shared. Facade использует интерфейс, не реализацию.

### Структура после split

```
waymates-core/              (private repo)
└── src/
    └── core/
        ├── routers/        # tRPC роутеры
        ├── cypher/         # Cypher запросы (перенести из src/cypher/)
        ├── managers/       # SearchManager, StoryManager, etc.
        └── index.ts

waymates-app/               (public repo)
└── src/
    ├── shared/             # schemas, logger, env, core-api-contract
    ├── facade/             # MCP Server, LangGraph agents
    ├── telegram-bot/
    └── chart/
```

---

## Дизайн

### 1. Новый файл: `src/shared/core-api-contract.ts` (~80 LOC)

```typescript
import type {
  // IDs
  UserId, ContextId, TrailId,
  // Search
  AdhocSearchParams, TargetSearchParams, UserSearchParamsBase,
  ScoredMatchedCandidate, MatchedCandidateWithPath,
  // Story
  StoryInput, UpsertStoryResult, UserContext, Trail,
  // Context
  UpsertContextInput, UpsertSingleContextResult, CoreUpdateContextParams,
  // Trail
  UpsertTrailInput, UpsertSingleTrailResult,
  // Goal
  CreateGoalInput, Goal, OperationResult,
  // Dictionaries
  Dictionaries, AddTermInput,
  // User
  UserState,
} from "./schemas.js";

/**
 * Core API контракт — интерфейс для tRPC client wrapper.
 * Позволяет разделить репозитории: facade импортирует только интерфейс.
 */
export interface ICoreApi {
  search: {
    adhoc(params: AdhocSearchParams): Promise<ScoredMatchedCandidate[]>;
    byUser(params: UserSearchParamsBase): Promise<ScoredMatchedCandidate[]>;
    byTarget(params: TargetSearchParams): Promise<MatchedCandidateWithPath[]>;
  };

  story: {
    upsertStory(input: StoryInput): Promise<UpsertStoryResult>;
    getStory(userId: UserId): Promise<{ contexts: UserContext[]; trails: Trail[] }>;
    deleteStory(userId: UserId): Promise<{ deletedContexts: number; deletedTrails: number }>;
  };

  context: {
    upsertContext(input: UpsertContextInput): Promise<UpsertSingleContextResult>;
    update(input: CoreUpdateContextParams): Promise<UserContext>;
    delete(userId: UserId, contextId: ContextId): Promise<void>;
  };

  trail: {
    upsert(input: UpsertTrailInput): Promise<UpsertSingleTrailResult>;
    delete(userId: UserId, trailId: TrailId): Promise<void>;
  };

  goal: {
    set(input: CreateGoalInput): Promise<{ goalId: string }>;
    getByUser(userId: UserId): Promise<Goal | null>;
    delete(userId: UserId): Promise<OperationResult>;
  };

  dictionaries: {
    getVerified(): Promise<Dictionaries>;
    addTerm(input: AddTermInput): Promise<void>;
  };

  user: {
    getState(userId: UserId): Promise<UserState>;
  };
}
```

### 2. Перенести схемы в `src/shared/schemas.ts`

Из `src/core/schemas.ts` добавить:

```typescript
export const upsertSingleContextResultSchema = z.object({
  success: z.boolean(),
  contextId: contextIdSchema,
});

export const upsertSingleTrailResultSchema = z.object({
  success: z.boolean(),
  trailId: trailIdSchema,
});

export type UpsertSingleContextResult = z.infer<typeof upsertSingleContextResultSchema>;
export type UpsertSingleTrailResult = z.infer<typeof upsertSingleTrailResultSchema>;
```

### 3. Рефакторинг `src/facade/core-client.ts` (~70 LOC)

```typescript
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import { CoreApiError } from "./errors.js";
import type { ICoreApi } from "../shared/core-api-contract.js";

export class CoreClient implements ICoreApi {
  private trpc: ReturnType<typeof createTRPCProxyClient<any>>;

  constructor(coreUrl: string) {
    this.trpc = createTRPCProxyClient({
      links: [httpBatchLink({ url: coreUrl })],
    });
  }

  search = {
    adhoc: (params) => this.trpc.search.adhoc.query(params),
    byUser: (params) => this.trpc.search.byUser.query(params),
    byTarget: (params) => this.trpc.search.byTarget.query(params),
  };

  story = {
    upsertStory: (input) => this.trpc.story.upsertStory.mutate(input),
    getStory: (userId) => this.trpc.story.getStory.query({ userId }),
    deleteStory: (userId) => this.trpc.story.deleteStory.mutate({ userId }),
  };

  context = {
    upsertContext: (input) => this.trpc.context.upsertContext.mutate(input),
    update: (input) => this.trpc.context.update.mutate(input),
    delete: (userId, contextId) => this.trpc.context.delete.mutate({ userId, contextId }),
  };

  trail = {
    upsert: (input) => this.trpc.trail.upsert.mutate(input),
    delete: (userId, trailId) => this.trpc.trail.delete.mutate({ userId, trailId }),
  };

  goal = {
    set: (input) => this.trpc.goal.set.mutate(input),
    getByUser: (userId) => this.trpc.goal.getByUser.query({ userId }),
    delete: (userId) => this.trpc.goal.delete.mutate({ userId }),
  };

  dictionaries = {
    getVerified: () => this.trpc.dictionaries.getVerified.query(),
    addTerm: (input) => this.trpc.dictionaries.addTerm.mutate(input),
  };

  user = {
    getState: (userId) => this.trpc.user.getState.query({ userId }),
  };

  async withErrorHandling<T>(operation: () => Promise<T>, context: string): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      throw new CoreApiError(`Core API ${context} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
```

### 4. Рефакторинг вызовов в facade (~30 файлов)

**До:**
```typescript
await this.coreClient.client.search.byTarget.query({ ... });
await coreClient.client.story.getStory.query({ userId });
```

**После:**
```typescript
await this.coreClient.search.byTarget({ ... });
await coreClient.story.getStory(userId);
```

**Затронутые файлы:**
- `services/dictionaries-cache.ts`
- `services/normalizer.ts`
- `services/orchestrator/*.ts` (4 файла)
- `mcp-server/tools/*.ts` (~10 файлов)
- `langGraph/*/nodes/*.ts` (~15 файлов)

### 5. Удалить устаревшие файлы

| Файл | Причина |
|------|---------|
| `src/shared/types.ts` | Заменён на `core-api-contract.ts` |
| `src/core/schemas.ts` | Схемы перенесены в `shared/schemas.ts` |

---

## Acceptance Criteria

- [ ] `src/shared/core-api-contract.ts` создан с `ICoreApi` interface
- [ ] Схемы `upsertSingleContextResultSchema`, `upsertSingleTrailResultSchema` перенесены в `shared/schemas.ts`
- [ ] `src/facade/core-client.ts` реализует `ICoreApi`
- [ ] Все вызовы `.client.xxx.query/mutate()` заменены на `.xxx()`
- [ ] `src/shared/types.ts` удалён
- [ ] `src/core/schemas.ts` удалён (или очищен)
- [ ] `npm run lint` — 0 errors
- [ ] `npx tsc --noEmit` — 0 errors
- [ ] Все тесты проходят (unit + integration)

---

## План реализации

| # | Шаг | LOC |
|---|-----|-----|
| 1 | Перенести схемы в `shared/schemas.ts` | +20 |
| 2 | Создать `shared/core-api-contract.ts` | +80 |
| 3 | Рефакторинг `facade/core-client.ts` | ~70 |
| 4 | Рефакторинг вызовов в facade (~30 файлов) | -60 |
| 5 | Удалить `shared/types.ts` | -2 |
| 6 | Удалить `core/schemas.ts` | -21 |
| 7 | lint + tsc + tests | — |

**Итого:** ~100 LOC нового кода, ~30 файлов затронуто

---

## Что остаётся после этой задачи

Кодовая база готова к физическому split:
- Facade не импортирует из core напрямую
- Контракт API определён в shared
- Типы в shared/schemas.ts

**Следующий шаг (отдельная задача):**
- Создание двух репозиториев
- Настройка CI/CD
- Перенос файлов

---

## Связь с Фазой 3 MVP

Эта задача — **подготовительный этап** для Фазы 3 (Repo Split) из MVP-RELEASE-PLAN.md.

После выполнения FEAT-035:
1. Можно безопасно разделить код на два репо
2. Facade продолжит работать через HTTP с core
3. Public репо не содержит секретной логики (Cypher)
