# Session: DTW для Pathfinders

**Дата:** 2025-12-27
**Статус:** PLAN APPROVED, реализация в следующей сессии
**Цель:** Pathfinders должны показывать Spider chart и DTW Similarity Metrics (как Waymates)

---

## Что сделано в этой сессии

### Фаза 1: Исследование архитектуры

**Ключевые открытия:**

1. **DTW вычисляется в TypeScript, не в Cypher**
   - Сервис: `TrajectorySimilarityService.computeDTWMetrics()`
   - Для waymates: вызывается в `SearchManager.executeCoreSearchWithDTW()`
   - Для pathfinders: **НЕ вызывается**

2. **PathfinderCandidate уже содержит `path`** (траекторию кандидата)
   - Данные для DTW есть, просто не вычисляются

3. **`state.userTrajectory` доступен в Facade**
   - Можно передать в Core для DTW расчёта

### Фаза 2: Выбор решения

Выбран **Вариант A: Расширить Core API**
- Добавить `userTrajectory` в `PathfinderSearchParams`
- Вычислять DTW в `SearchManager.searchPathfinders()`
- Чистая архитектура: вся DTW логика в Core

### Фаза 3: Детальное планирование

План из 5 шагов с конкретными файлами и изменениями (см. ниже).

---

## Что делать в следующей сессии

**Реализовать план по шагам 1-5:**

1. `src/shared/schemas.ts` — добавить `userTrajectory` в params, `dtwMetrics/dtwTotal` в candidate
2. `src/core/search-manager.ts` — добавить `enrichPathfinderWithDTW()` метод
3. `src/facade/langGraph/search-graph/nodes/search-pathfinders.ts` — передать `userTrajectory`
4. `src/facade/langGraph/search-graph/nodes/show-results.ts` — копировать `dtwMetrics/dtwTotal` в `toChartCandidate()`
5. Проверка: `tsc`, `lint`, smoke test

---

## Контекст

### Текущее состояние:
| Режим | DTW | Spider Chart |
|-------|-----|--------------|
| searchWaymates (profile mode) | ✅ | ✅ |
| searchWaymates (adhoc mode) | ❌ | ❌ |
| searchPathfinders | ❌ | ❌ |

### Почему pathfinders не имеют DTW:
1. `PathfinderSearchParams` не принимает `userTrajectory`
2. `SearchManager.searchPathfinders()` просто выполняет Cypher и парсит результат
3. `PathfinderCandidate` не имеет полей `dtwMetrics`, `dtwTotal`

### Ключевой инсайт:
- DTW вычисляется в **TypeScript** (`TrajectorySimilarityService`), не в Cypher
- `PathfinderCandidate` уже содержит `path` (траекторию кандидата)
- `state.userTrajectory` доступен в Facade

---

## План реализации

### Шаг 1: Расширить PathfinderSearchParams
**Файл:** `src/shared/schemas.ts`

```typescript
export const pathfinderSearchParamsSchema = withPathLimitTransform(
  userSearchParamsRawSchema.omit({ recencyThresholdMonths: true }).extend({
    referenceContext: adhocContextBase,
    targetContext: targetContextSchema,
    userTrajectory: z.array(userContextSchema).optional(), // ← ДОБАВИТЬ
    // ... остальные поля
  }),
);
```

### Шаг 2: Расширить PathfinderCandidate
**Файл:** `src/shared/schemas.ts`

```typescript
export const pathfinderCandidateSchema = z.object({
  userId: userIdSchema,
  matchedContext: userContextSchema,
  referenceContext: userContextSchema,
  timeSinceTargetMonths: z.number().min(0),
  timeSinceReferenceMonths: z.number().min(0),
  path: z.array(userContextSchema),
  trails: z.array(trailSchema),
  dtwMetrics: dtwMetricsSchema.optional(),  // ← ДОБАВИТЬ
  dtwTotal: z.number().min(0).max(3).optional(),  // ← ДОБАВИТЬ
});
```

### Шаг 3: Добавить DTW расчёт в SearchManager
**Файл:** `src/core/search-manager.ts`

```typescript
async searchPathfinders(params: PathfinderSearchParams): Promise<PathfinderCandidate[]> {
  // 1. Существующий Cypher запрос
  const results = await this.db.read(...);

  // 2. НОВОЕ: Если userTrajectory передана и >= 3 контекстов → DTW
  if (params.userTrajectory && params.userTrajectory.length >= 3) {
    return results.map(candidate => this.enrichPathfinderWithDTW(candidate, params.userTrajectory!));
  }

  return results;
}

private enrichPathfinderWithDTW(
  candidate: PathfinderCandidate,
  userTrajectory: UserContext[],
): PathfinderCandidate {
  if (candidate.path.length < 3) {
    return candidate; // Без DTW если траектория слишком короткая
  }

  const dtwMetrics = this.trajectorySimilarity.computeDTWMetrics(userTrajectory, candidate.path);
  const dtwTotal = dtwMetrics.shapeSimilarity + dtwMetrics.tempoSimilarity + dtwMetrics.alignmentScore;

  return { ...candidate, dtwMetrics, dtwTotal };
}
```

### Шаг 4: Передать userTrajectory в Facade
**Файл:** `src/facade/langGraph/search-graph/nodes/search-pathfinders.ts`

```typescript
const results = await coreClient.client.search.pathfinders.query({
  userId,
  referenceContext,
  targetContext: storedGoal.targetContext,
  userTrajectory: state.userTrajectory.length >= 3 ? state.userTrajectory : undefined, // ← ДОБАВИТЬ
  // ... остальные параметры
});
```

### Шаг 5: Обновить toChartCandidate в show-results.ts
**Файл:** `src/facade/langGraph/search-graph/nodes/show-results.ts`

```typescript
function toChartCandidate(pf: PathfinderCandidate): ScoredMatchedCandidate {
  return {
    userId: pf.userId,
    matchedContext: pf.matchedContext,
    contextMatchScore: 0,
    isWaymate: false,
    path: pf.path,
    trails: pf.trails,
    timeSinceMatchedMonths: pf.timeSinceTargetMonths,
    dtwMetrics: pf.dtwMetrics,  // ← ДОБАВИТЬ
    dtwTotal: pf.dtwTotal,      // ← ДОБАВИТЬ
  };
}
```

---

## Файлы для изменения

| Файл | Изменение |
|------|-----------|
| `src/shared/schemas.ts` | +userTrajectory в params, +dtwMetrics/dtwTotal в candidate |
| `src/core/search-manager.ts` | +enrichPathfinderWithDTW метод |
| `src/facade/langGraph/search-graph/nodes/search-pathfinders.ts` | +userTrajectory в запрос |
| `src/facade/langGraph/search-graph/nodes/show-results.ts` | +dtwMetrics/dtwTotal в toChartCandidate |

---

## Проверка

1. **tsc**: `npx tsc --noEmit`
2. **lint**: `npm run lint`
3. **Smoke test**: запустить `poc/chart-smoke-test.ts` с pathfinder mode
4. **Визуальная проверка**: открыть chart URL, проверить Spider chart

---

## Ожидаемый результат

После реализации:
- Pathfinders с profile mode (userTrajectory >= 3) → показывают Spider chart
- Pathfinders с adhoc mode (нет userTrajectory) → без Spider chart (текущее поведение)
- Chart URL включает DTW метрики для pathfinders

---

## Рефлексия

### Что сделано правильно

1. **Системное исследование** — изучил архитектуру DTW через grep, чтение кода, сравнение waymates vs pathfinders
2. **Выбор через AskUserQuestion** — дал три варианта (Core API, Facade, без изменений), пользователь выбрал
3. **Детальный план** — 5 конкретных шагов с файлами и изменениями

### Ошибок не было

Сессия была исследовательской + планирование. Реализация начнётся в следующей сессии.

---

## Ценный инсайт для проекта

**DTW архитектура в WayMates:**

| Слой | Роль в DTW |
|------|------------|
| **Cypher** | Возвращает кандидатов с `path` (траекторией) |
| **Core TypeScript** | `TrajectorySimilarityService.computeDTWMetrics()` вычисляет метрики |
| **SearchManager** | Orchestrator: получает кандидатов → обогащает DTW → возвращает |

**Условие для DTW:**
- `userTrajectory.length >= 3` (минимум 3 контекста)
- `candidate.path.length >= 3` (минимум 3 контекста)

---

## Артефакты

- **План реализации:** `sessions/2025-12-27-dtw-for-pathfinders.md` (этот файл)
- **Smoke test для chart:** `poc/chart-smoke-test.ts`
- **Предыдущая сессия DTW:** `sessions/2025-12-27-dtw-metrics-analysis.md`

---

## Связанные документы

- **Бизнес-логика поиска:** `mvp-test-final/BUSINESS-LOGIC-MVP.md` (секция 5)
- **Knowledge Base:** `mvp-test-final/KNOWLEDGE-BASE.md` (секция 11 Search Architecture)
- **DTW теория:** `docs/business/_archive/DTW_TRAJECTORY_MATCHING.md`
