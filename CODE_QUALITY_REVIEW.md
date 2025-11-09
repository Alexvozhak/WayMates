# Code Quality Review - src/core/

**Дата анализа**: 2025-11-06
**Проанализированные файлы**: 16 файлов TypeScript в /src/core/

---

## Сводная статистика

| Категория | Критичные (🔴) | Средние (🟡) | Низкие (🟢) | Всего |
|-----------|----------------|--------------|-------------|-------|
| DRY Violations | 1 | 2 | 0 | 3 |
| Bugs & Issues | 2 | 1 | 0 | 3 |
| Performance | 0 | 2 | 1 | 3 |
| Code Smells | 1 | 4 | 2 | 7 |
| Architecture | 0 | 2 | 1 | 3 |
| TypeScript | 0 | 1 | 2 | 3 |
| Cypher Issues | 0 | 3 | 1 | 4 |
| **ИТОГО** | **4** | **15** | **7** | **26** |

**Рекомендации по приоритизации:**
1. Исправить 4 критичные проблемы немедленно
2. Запланировать рефакторинг для 15 средних проблем
3. Учесть 7 низких проблем при следующем рефакторинге

---

## 1. DRY Violations & Code Duplication

### 🔴 1.1 Massive Duplication: collectBackwardPath() vs collectUserTrajectory()

**Где**: `path-collector.service.ts:7-57` и `path-collector.service.ts:59-107`

**Проблема**: Два метода отличаются ТОЛЬКО:
- Строкой 14: `{context_id: $matchedContextId}` vs строкой 64: `{context_id: u.current_context_id}`
- Параметром: `matchedContextId` vs `userId`

**Дублирование**: 90% кода идентичны (50 строк из 55)

**Примеры идентичного кода**:
```typescript
// Строки 10-44 === Строки 65-94 (identичный Cypher)
OPTIONAL MATCH (c)-[:HAS_POSITION]->(p:Position)
OPTIONAL MATCH (c)-[:IN_WORK_DOMAIN]->(wd:WorkDomain)
// ... 35 одинаковых строк
```

**Рекомендация**: Унифицировать через enum mode:

```typescript
// ✅ UNIFIED VERSION
private async collectPath(
  mode: 'backward' | 'user',
  id: string
): Promise<UserContext[]> {
  const matchClause = mode === 'backward'
    ? 'MATCH (end:Context {context_id: $id})'
    : `MATCH (u:User {user_id: $id})
       MATCH (end:Context {context_id: u.current_context_id})`;

  const query = `
    ${matchClause}
    MATCH path = (start:Context)-[:NEXT_CONTEXT*0..]->(end)
    WHERE start.previous_context_id IS NULL
    // ... остальные 50 строк БЕЗ дублирования
  `;

  return this.db.read(async (tx) => {
    const result = await tx.run(query, { id });
    const record = result.records[0];
    if (!record) return [];
    const contexts = record.get("contexts");
    return contexts.map((ctx: unknown) => UserContextSchema.parse(ctx));
  });
}

// Wrapper methods (2 строки каждый)
async collectBackwardPath(userId: string, matchedContextId: string) {
  return this.collectPath('backward', matchedContextId);
}

async collectUserTrajectory(userId: string) {
  return this.collectPath('user', userId);
}
```

**Усилия**: 30 минут
**Экономия**: Удаление 50 строк дублирования, упрощение тестирования

---

### 🟡 1.2 Duplication: buildPathsQuery() modes

**Где**: `dtw-query-builder.ts:1-16` (buildPathEntryPoint)

**Проблема**: Функция возвращает два почти идентичных Cypher-блока, отличающихся только:
- Параметром: `$contextIds` vs `$userIds`
- Строкой: `MATCH path = (c:Context {context_id: id})` vs `MATCH (u:User {user_id: id}) MATCH path = (current:Context {context_id: u.current_context_id})`

**Рекомендация**: Вынести общую часть, использовать template literals:

```typescript
function buildPathEntryPoint(pathEnd: 'toMatched' | 'toTarget'): string {
  const [paramName, matchNode] = pathEnd === 'toMatched'
    ? ['contextIds', 'MATCH path = (c:Context {context_id: id})']
    : ['userIds', 'MATCH (u:User {user_id: id}) MATCH path = (current:Context {context_id: u.current_context_id})'];

  return `
    UNWIND $${paramName} AS id
    ${matchNode}<-[:PREVIOUS_CONTEXT*0..]-(start:Context)
    WHERE start.previous_context_id IS NULL
    WITH id, [node IN nodes(path) | node] AS pathNodes
  `;
}
```

**Усилия**: 10 минут

---

### 🟡 1.3 Duplication: tool() helper duplicated

**Где**: `core-mcp-server.ts:25-41` (core) - DUPLICATED from facade

**Проблема**: Комментарий признает: "not exported - duplicated in facade"

**Код**:
```typescript
// Helper function to create typed MCP tools (not exported - duplicated in facade)
function tool<TSchema extends z.ZodTypeAny, TResult>(
  name: string,
  description: string,
  schema: TSchema,
  handler: (params: z.infer<TSchema>) => Promise<TResult> | TResult
) { /* ... 15 строк */ }
```

**Рекомендация**: Создать shared утилиту:

```typescript
// File: src/shared/mcp-tool-helper.ts
export function createMcpTool<TSchema extends z.ZodTypeAny, TResult>(
  name: string,
  description: string,
  schema: TSchema,
  handler: (params: z.infer<TSchema>) => Promise<TResult> | TResult
) {
  return {
    name,
    description,
    parameters: schema,
    execute: async (args: unknown) => {
      const parsed = schema.parse(args);
      const result = await handler(parsed);
      return JSON.stringify(result, null, 2);
    },
  };
}

// Usage in core:
import { createMcpTool as tool } from '../shared/mcp-tool-helper.js';
```

**Усилия**: 15 минут
**Примечание**: Учесть ограничение "фасад и core не должны иметь общие зависимости" - создать в shared/

---

## 2. Bugs and Potential Issues

### 🔴 2.1 Critical: Missing null check before map in StoryManager

**Где**: `story-manager.ts:104-107`

**Проблема**: listAvailableReasons() не проверяет пустой результат перед map

**Код**:
```typescript
async listAvailableReasons(): Promise<Reason[]> {
  return this.db.read(async (tx) => {
    const result = await tx.run(LIST_REASONS_QUERY);
    return result.records.map((rec) => { // ❌ Что если records = []?
      const reasonData = rec.get('reason');
      return ReasonSchema.parse(reasonData);
    });
  });
}
```

**Сценарий**: Если БД пуста, `result.records` будет `[]`, map вернет `[]` (не ошибка).
**НО**: Если запрос вернул null (connection timeout, ошибка парсинга), код упадет.

**Исправление**:
```typescript
async listAvailableReasons(): Promise<Reason[]> {
  return this.db.read(async (tx) => {
    const result = await tx.run(LIST_REASONS_QUERY);
    if (!result || !result.records) {
      return [];
    }
    return result.records.map((rec) => {
      const reasonData = rec.get('reason');
      return ReasonSchema.parse(reasonData);
    });
  });
}
```

**Усилия**: 5 минут

---

### 🔴 2.2 Critical: TrajectorySimilarityService - все методы кидают Error

**Где**: `trajectory-similarity.service.ts:3-31`

**Проблема**: Класс используется в production (`search-manager.ts:226`), но все методы выбрасывают `"Not implemented"`

**Код**:
```typescript
export class TrajectorySimilarityService {
  computeDTWMetrics(...): Promise<DTWMetrics> {
    throw new Error("Not implemented");
  }
  // ... 3 других метода с throw
}
```

**Сценарий**:
- Вызов `searchPath()` → `executeCoreSearchWithDTW()` → `computeDTWScores()` → **CRASH**
- Production runtime exception гарантирован

**Исправление**:
1. Temporary fix: Вернуть default metrics вместо throw
```typescript
computeDTWMetrics(): Promise<DTWMetrics> {
  console.warn('DTW not implemented, returning mock data');
  return Promise.resolve({
    shape_similarity: 0,
    tempo_similarity: 0,
    stability_score: 0,
  });
}
```

2. Long-term: Реализовать DTW алгоритм или удалить метод searchPath() из API

**Усилия**:
- Temporary: 10 минут
- Long-term: 4-8 часов (реализация DTW)

---

### 🟡 2.3 Potential: NEXT vs NEXT_CONTEXT relationship mismatch

**Где**: `persistence-query-builder.ts:57` vs `path-collector.service.ts:15`

**Проблема**: Inconsistent relationship names:

```cypher
// persistence-query-builder.ts:57
MERGE (prev)-[:NEXT]->(c)

// path-collector.service.ts:15
MATCH path = (start:Context)-[:NEXT_CONTEXT*0..]->(end)
```

**Сценарий**: Если отношения называются `:NEXT`, запрос с `:NEXT_CONTEXT` вернет пустой результат.

**Проверка**: Запустить integration test или проверить БД напрямую

**Исправление**: Унифицировать имя (рекомендация: `:NEXT_CONTEXT` для ясности)

**Усилия**: 20 минут + regression tests

---

## 3. Performance Issues

### 🟡 3.1 O(n²) в loadCandidatePaths()

**Где**: `search-manager.ts:186-214`

**Проблема**:
1. Строка 192: `contextIds.map()` - O(n)
2. Строка 210: `candidates.filter()` - O(n)
3. Внутри filter: `pathsMap.has()` - O(1), но .get() вызывается дважды (строки 210 и 213)

**Код**:
```typescript
return candidates
  .filter((c) => pathsMap.has(c.matched_context.context_id)) // O(n)
  .map((c) => ({
    ...c,
    path: pathsMap.get(c.matched_context.context_id)!, // O(1) но второй вызов
  }));
```

**Рекомендация**: Убрать дублирование .get():
```typescript
return candidates
  .map((c) => {
    const path = pathsMap.get(c.matched_context.context_id);
    return path ? { ...c, path } : null;
  })
  .filter((c): c is NonNullable<typeof c> => c !== null);
```

**Усилия**: 5 минут
**Выгода**: Убрать двойной вызов .get() для каждого кандидата

---

### 🟡 3.2 Sequential trail insertion in upsertTrails()

**Где**: `story-manager.ts:169-194`

**Проблема**: Trails вставляются последовательно в цикле (строка 175), блокируя транзакцию

**Код**:
```typescript
for (const trail of trails) {
  const trail_id = this.generateTrailId();
  const result = await tx.run(UPSERT_TRAILS_QUERY, { /* ... */ }); // ❌ Sequential await
  // ...
}
```

**Рекомендация**: Batch insert через UNWIND:
```cypher
UNWIND $trails AS trail
MERGE (t:Trail {trail_id: trail.trail_id})
SET t.skill = trail.skill,
    t.platform = trail.platform
    // ... остальные поля
RETURN collect(t.trail_id) AS trail_ids
```

**Усилия**: 1 час (переписать запрос + тесты)
**Выгода**: 10x ускорение для пользователей с >5 trails

---

### 🟢 3.3 Redundant map projection in dtw-query-builder.ts

**Где**: `dtw-query-builder.ts:49-66`

**Проблема**: Проекция context_id, created_at и других полей вручную (15 полей), можно использовать `.*, но замены на relationship fields

**Рекомендация**: Использовать Cypher map projection `.*, кроме когда надо заменить поля:
```cypher
WITH id, collect(ctx {
  .*,
  position: p.name,
  domains: domains,
  skills: skills,
  industry: i.name,
  country_code: co.name,
  city_name: ci.name
}) AS trajectory
```

**Усилия**: 10 минут
**Выгода**: Меньше кода, проще поддерживать

---

## 4. Code Smells

### 🔴 4.1 God Function: buildCurrentSearchQuery()

**Где**: `search-query-builder.ts:152-209`

**Проблема**: Функция строит Cypher из 5 компонентов (58 строк), сложность > 8

**Метрики**:
- Lines: 58
- Cyclomatic complexity: ~6
- Dependencies: 4 helper functions

**Признаки God Function**:
- Строит WHERE, WITH, CALL, scoring, goalFilter, return в одной функции
- Параметры смешаны: goal, strictFields, userId, recencyThresholdMonths, limit

**Рекомендация**: Разбить на pipeline:
```typescript
function buildCurrentSearchQuery(goal: Goal | null, strictFields: string[], params: {...}): string {
  const builder = new SearchQueryBuilder();
  return builder
    .addMatchedContextBase()
    .addWhereClause(strictFields, params)
    .addTimingScoringWith()
    .addExcludedReasonsFilter()
    .addSkillsPenaltyScoring()
    .addGoalFilter(goal, params.userId)
    .addReturnClause(params.limit)
    .build();
}
```

**Усилия**: 2 часа
**Выгода**: Проще тестировать, добавлять условия

---

### 🟡 4.2 Magic Strings: HTTP_STATUS constants

**Где**: `rest-server.ts:24-27`

**Проблема**: Определены только 2 статус-кода, остальные hardcoded в других местах (например 200)

**Код**:
```typescript
const HTTP_STATUS = {
  BAD_REQUEST: 400,
  INTERNAL_SERVER_ERROR: 500,
} as const;
```

**Рекомендация**: Добавить все используемые коды:
```typescript
const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
} as const;
```

**Усилия**: 5 минут

---

### 🟡 4.3 Dead Code: StoryInputSchema in persistence-query-builder.ts

**Где**: `persistence-query-builder.ts:500-504` (в schemas.ts, но не используется в query-builder)

**Проблема**: Файл `persistence-query-builder.ts` экспортирует только Cypher queries, но schemas.ts импортирует и переэкспортирует StoryInputSchema, который используется в story-manager.ts

**Вывод**: Не dead code, но плохая организация - schemas.ts смешивает domain types и query schemas

**Рекомендация**: Переместить persistence schemas в story-manager.ts или отдельный файл

**Усилия**: 30 минут

---

### 🟡 4.4 Unclear naming: computeStrictFields()

**Где**: `search-manager.ts:32-36` и `target-query-builder.ts:10-14`

**Проблема**: Название вводит в заблуждение - функция НЕ вычисляет strict fields, а фильтрует все поля минус excluded

**Код**:
```typescript
function computeStrictFields(excludedFields: ContextField[]): ContextField[] {
  return CONTEXT_FIELD_NAMES.filter(
    (field): field is ContextField => !excludedFields.includes(field)
  );
}
```

**Рекомендация**: Переименовать:
```typescript
function getStrictFieldsFromExcluded(excludedFields: ContextField[]): ContextField[] {
  // или
function invertExcludedFields(excludedFields: ContextField[]): ContextField[] {
```

**Усилия**: 10 минут (rename + обновить комментарии)

---

### 🟡 4.5 Inconsistent error messages format

**Где**: Разные форматы в `story-manager.ts`, `goals-manager.ts`

**Примеры**:
```typescript
// story-manager.ts:55
throw new Error(`getUserStory: no record returned for user ${userId}`);

// goals-manager.ts:26
throw new Error(`setGoal: no result returned for user=${params.userId}`);

// story-manager.ts:130
throw new Error(`createNewReason: no result returned for reason_id ${reasonId}`);
```

**Проблема**: Inconsistent format - иногда `for user`, иногда `for user=`, иногда без префикса

**Рекомендация**: Унифицировать формат:
```typescript
throw new Error(`[${methodName}] No result for userId=${userId}`);
```

**Усилия**: 15 минут

---

### 🟢 4.6 Commented code: Variable scope comments

**Где**: `search-query-builder.ts:42-43`

**Код**:
```typescript
/**
 * ВАЖНО (Cypher scope): После этого блока переменные wd и s ИСЧЕЗАЮТ из scope.
 * Доступны ТОЛЬКО: u, c, p, i, ci, co, domains (массив), skills (массив)
 */
```

**Проблема**: Хороший комментарий, но дублируется и в других местах. Создать convention в project.md

**Рекомендация**: Достаточно ссылки на project.md Cypher rules

**Усилия**: 5 минут

---

### 🟢 4.7 Unused parameter: _userId in collectBackwardPath

**Где**: `path-collector.service.ts:7-8`

**Код**:
```typescript
async collectBackwardPath(
  _userId: string, // ❌ UNUSED
  matchedContextId: string
)
```

**Проблема**: Параметр не используется (префикс `_` указывает на это)

**Рекомендация**: Убрать параметр или объяснить зачем он нужен

**Усилия**: 2 минуты

---

## 5. Architecture Anti-patterns

### 🟡 5.1 Circular dependency risk: core-mcp-server imports CoreContext

**Где**: `core-mcp-server.ts:18-22`

**Проблема**: CoreContext определен внутри файла, но должен быть shared type

**Код**:
```typescript
interface CoreContext {
  newSearchManager?: NewSearchManager;
  storyManager: StoryManager;
  goalsManager: GoalsManager;
}
```

**Проблема**: Если другой файл захочет использовать CoreContext, возникнет circular dependency

**Рекомендация**: Вынести в `src/core/types.ts`:
```typescript
// src/core/types.ts
export interface CoreContext {
  searchManager?: SearchManager;
  storyManager: StoryManager;
  goalsManager: GoalsManager;
}
```

**Усилия**: 10 минут

---

### 🟡 5.2 Tight coupling: SearchManager depends on 5 services

**Где**: `search-manager.ts:39-45`

**Проблема**: Constructor injection 5 зависимостей - признак God Object

**Код**:
```typescript
constructor(
  private db: DatabaseContext,
  private selectivity: SelectivityService,
  private trajectorySimilarity: TrajectorySimilarityService,
  private pathCollector: PathCollectorService,
  private goalsManager: GoalsManager
) {}
```

**Рекомендация**:
1. Temporary: Extract DTW logic to separate DtwSearchManager
2. Long-term: Apply Hexagonal Architecture (ports/adapters)

**Усилия**:
- Temporary: 2 часа
- Long-term: 8-16 часов

---

### 🟢 5.3 Leaky abstraction: Query builders return raw Cypher strings

**Где**: Все `*-query-builder.ts` файлы

**Проблема**: Builders возвращают сырые Cypher strings, нет абстракции над Neo4j

**Пример**:
```typescript
export function buildResolveContextQuery(): string {
  return `MATCH (u:User {user_id: $userId})...`;
}
```

**Проблема**: Если захотим мигрировать на другой graph DB (ArangoDB, TigerGraph), придется переписать ВСЕ query builders

**Рекомендация**: Создать Query DSL (если планируется multi-DB support):
```typescript
const query = QueryBuilder
  .match('User', { user_id: '$userId' })
  .relation('HAS_CONTEXT')
  .to('Context', { context_id: 'u.current_context_id' })
  .return('c { .*, position: p.name }')
  .build();
```

**НО**: Для MVP с Neo4j-only это overkill.

**Усилия**: 40+ часов (не рекомендуется сейчас)

---

## 6. TypeScript Issues

### 🟡 6.1 Type assertion abuse: path-collector.service.ts

**Где**: `path-collector.service.ts:55, 105`

**Проблема**: Assertion `as unknown` для избежания type checking

**Код**:
```typescript
return contexts.map((ctx: unknown) => UserContextSchema.parse(ctx));
```

**Почему плохо**: `unknown` скрывает реальный тип Neo4j Record, нет compile-time проверки

**Рекомендация**: Определить Neo4j Record type:
```typescript
interface Neo4jContextRecord {
  context_id: string;
  position: string | null;
  // ... все поля
}

return contexts.map((ctx: Neo4jContextRecord) => UserContextSchema.parse(ctx));
```

**Усилия**: 20 минут

---

### 🟢 6.2 Missing return type: helper functions

**Где**: `target-query-builder.ts:24-28, 30-44, 46-60`

**Проблема**: Вспомогательные функции не имеют явного return type

**Пример**:
```typescript
function addPositionCondition(
  conditions: string[],
  position: string | undefined,
  strictFields: ContextField[]
): void { // ✅ Есть void
  // ...
}

function buildTargetWhereConditions(
  userId: string,
  // ... 8 параметров
) { // ❌ НЕТ return type
  const conditions: string[] = [];
  // ...
  return conditions;
}
```

**Рекомендация**: Добавить `: string[]`

**Усилия**: 5 минут

---

### 🟢 6.3 Inconsistent type imports

**Где**: `search-manager.ts:6-12` vs `goals-manager.ts:2`

**Проблема**: Иногда `import type`, иногда обычный import

**Примеры**:
```typescript
// search-manager.ts:6
import type { GoalsManager } from "./goals-manager.js";

// goals-manager.ts:2
import type { CreateGoalInput, Goal, UserId } from '../shared/schemas.js';
```

**Рекомендация**: Всегда использовать `import type` для types-only imports (TypeScript best practice)

**Усилия**: 10 минут (ESLint rule `@typescript-eslint/consistent-type-imports`)

---

## 7. Cypher Query Issues

### 🟡 7.1 Hardcoded LIMIT in buildCurrentSearchQuery

**Где**: `search-query-builder.ts:135`

**Проблема**: LIMIT параметризован через `$limit`, но нет валидации в query builder

**Код**:
```typescript
LIMIT $limit // ❌ Что если limit = 0 или 10000?
```

**Рекомендация**: Валидация в builder или schema:
```typescript
// В SearchFiltersSchema уже есть валидация:
limit: z.number().min(1).max(100).default(20)
```

**НО**: В buildCurrentSearchQuery нет проверки, что params.limit соответствует схеме

**Исправление**: Проверить integration tests покрывают edge cases (limit=0, limit=1000)

**Усилия**: 15 минут (добавить тесты)

---

### 🟡 7.2 Potential NULL issues in buildGoalFilterClause

**Где**: `search-query-builder.ts:106-130`

**Проблема**: Логика `searchingUserGoal.desired.positions IS NOT NULL` может упасть если `desired` сам null

**Код**:
```cypher
WHEN searchingUserGoal.desired.positions IS NOT NULL
     AND p.name IN searchingUserGoal.desired.positions
```

**Сценарий**: Если `searchingUserGoal.desired = null`, Neo4j вернет `null.positions` → error

**Исправление**:
```cypher
WHEN searchingUserGoal IS NOT NULL
     AND searchingUserGoal.desired IS NOT NULL
     AND searchingUserGoal.desired.positions IS NOT NULL
     AND p.name IN searchingUserGoal.desired.positions
```

**Усилия**: 10 минут

---

### 🟡 7.3 Missing coalesce() in UPSERT_CONTEXTS_QUERY

**Где**: `persistence-query-builder.ts:35-37`

**Проблема**: UNWIND на domains/skills без coalesce

**Код**:
```cypher
WITH c, $context.domains AS work_domains
UNWIND work_domains AS wdName // ❌ Что если domains = null?
```

**Сценарий**: Если context.domains = null (вместо []), UNWIND упадет

**Исправление**:
```cypher
WITH c, coalesce($context.domains, []) AS work_domains
UNWIND work_domains AS wdName
```

**Усилия**: 5 минут

---

### 🟢 7.4 Non-optimal: collect(DISTINCT) in tight loop

**Где**: `path-collector.service.ts:26-27`

**Проблема**: `collect(DISTINCT wd.name)` выполняется для КАЖДОГО context в пути

**Код**:
```cypher
UNWIND contextNodes AS c
OPTIONAL MATCH (c)-[:IN_WORK_DOMAIN]->(wd:WorkDomain)
WITH c, p.name AS position, collect(DISTINCT wd.name) AS domains
```

**Рекомендация**: Проверить EXPLAIN PLAN - может быть O(n²) для пользователей с длинными траекториями

**Усилия**: 30 минут (analyze + optimize if needed)

---

## 8. Refactoring Opportunities

### 🟡 8.1 Extract common Cypher projection pattern

**Где**: `dtw-query-builder.ts:49-66`, `target-query-builder.ts:136-153`

**Проблема**: Проекция context с position/domains/skills повторяется 4 раза

**Рекомендация**: Создать helper:
```typescript
function buildContextProjection(ctxVar: string, pVar: string, ...): string {
  return `{
    context_id: ${ctxVar}.context_id,
    position: ${pVar}.name,
    domains: ctxDomains,
    skills: ctxSkills,
    // ... остальные поля
  }`;
}
```

**Усилия**: 1 час

---

### 🟡 8.2 Consolidate error handling patterns

**Где**: `story-manager.ts`, `goals-manager.ts`

**Проблема**: Повторяющийся паттерн:
```typescript
const record = result.records[0];
if (!record) {
  throw new Error(`methodName: no result returned for userId=${userId}`);
}
```

**Рекомендация**: Утилита:
```typescript
function getFirstRecordOrThrow(
  result: QueryResult,
  context: { method: string; params: Record<string, unknown> }
): Record {
  const record = result.records[0];
  if (!record) {
    throw new Error(
      `[${context.method}] No result for ${JSON.stringify(context.params)}`
    );
  }
  return record;
}

// Usage:
const record = getFirstRecordOrThrow(result, {
  method: 'getUserStory',
  params: { userId }
});
```

**Усилия**: 30 минут

---

### 🟡 8.3 Create SearchQueryPipeline class

**Где**: `search-query-builder.ts` (весь файл)

**Проблема**: Функции строят query по частям, но нет единого pipeline

**Рекомендация**:
```typescript
class SearchQueryPipeline {
  private parts: string[] = [];

  addMatchedContextBase() {
    this.parts.push(buildMatchedContextBase());
    return this;
  }

  addWhereClause(conditions: string[]) {
    if (conditions.length > 0) {
      this.parts.push(`WHERE ${conditions.join(' AND ')}`);
    }
    return this;
  }

  build(): string {
    return this.parts.join('\n\n').trim();
  }
}
```

**Усилия**: 3 часа

---

### 🟢 8.4 Move constants to config file

**Где**: `rest-server.ts:24-27`, hardcoded port в `index.ts:30`

**Проблема**: Magic numbers разбросаны по файлам

**Рекомендация**: Создать `src/core/config.ts`:
```typescript
export const CORE_CONFIG = {
  DEFAULT_PORT: 9000,
  DEFAULT_HOST: '0.0.0.0',
  HTTP_STATUS: {
    OK: 200,
    BAD_REQUEST: 400,
    NOT_FOUND: 404,
    INTERNAL_SERVER_ERROR: 500,
  },
} as const;
```

**Усилия**: 20 минут

---

### 🟢 8.5 Create type registry for Neo4j → TypeScript mapping

**Где**: Все `*-query-builder.ts` и parsers

**Проблема**: Нет единого места, где описано какие Neo4j properties мапятся на какие TypeScript types

**Рекомендация**: Документация + interface:
```typescript
interface Neo4jContext {
  context_id: string;
  created_at: string; // ISO 8601
  position: string | null;
  domains: string[]; // Always array, never null (use coalesce)
  // ...
}
```

**Усилия**: 1 час

---

## Summary & Action Plan

### Priority 1: Critical Fixes (1-2 дня)

1. 🔴 **2.2**: Реализовать mock DTW или документировать "Not Available" (30 минут)
2. 🔴 **2.1**: Добавить null checks в StoryManager (5 минут)
3. 🔴 **1.1**: Рефакторить path-collector duplication (30 минут)
4. 🔴 **4.1**: Упростить buildCurrentSearchQuery() (2 часа)

**Оценка**: 3-4 часа

---

### Priority 2: Important Refactoring (3-5 дней)

1. 🟡 **3.2**: Batch insert для trails (1 час)
2. 🟡 **5.2**: Extract DtwSearchManager из SearchManager (2 часа)
3. 🟡 **8.1**: Создать Cypher projection helpers (1 час)
4. 🟡 **8.2**: Consolidate error handling (30 минут)
5. 🟡 **1.2**: Унифицировать buildPathEntryPoint (10 минут)
6. 🟡 **7.2**: Фиксы NULL safety в Cypher (30 минут)

**Оценка**: 5-6 часов

---

### Priority 3: Quality Improvements (фоновая работа)

1. 🟢 **6.2**: Добавить return types (5 минут)
2. 🟢 **6.3**: Consistent type imports (10 минут + ESLint rule)
3. 🟢 **4.5**: Унифицировать error messages (15 минут)
4. 🟢 **8.4**: Move constants to config (20 минут)
5. 🟢 **4.6**: Cleanup comments (5 минут)

**Оценка**: 1 час

---

### Total Effort Estimate

- **Critical**: 4 часа
- **Important**: 6 часов
- **Quality**: 1 час
- **Total**: 11 часов (~1.5 рабочих дня)

---

## Recommendations

1. **Немедленно**: Исправить 2.2 (DTW mock) - блокирует production
2. **На этой неделе**: Рефакторить path-collector (1.1) - экономия 50 строк
3. **В следующем спринте**: Упростить SearchManager (5.2) - снизить coupling
4. **Continuous**: Добавить ESLint rules для type consistency, unused vars

---

**Заключение**: Код в целом хорошего качества, основные проблемы - дублирование (path-collector) и незавершенная реализация (DTW service). Критичных багов найдено 2, оба легко исправляются.
