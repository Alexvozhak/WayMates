# Session: Унификация архитектуры поиска (waymates + pathfinders)

**Дата:** 2025-12-27
**Статус:** APPROVED — готов к реализации
**Предыдущая сессия:** `sessions/2025-12-27-dtw-for-pathfinders.md`

---

## Что сделано в этой сессии

### Фаза 1: Исследование архитектуры
- Изучили как waymates получает path (pathCollector batch запрос)
- Изучили как pathfinders получает path (в Cypher Phase 3-4)
- Поняли почему архитектура разная (исторически сложилось)

### Фаза 2: Обнаружение проблем
1. **Архитектурное расхождение** waymates vs pathfinders
2. **Баг: trails НЕ попадают в waymates** → LLM advisor не видит курсы кандидатов
3. **pathLimit не передаётся** в pathfinders из Facade
4. **userTrajectory не передаётся** в pathfinders

### Фаза 3: Планирование рефакторинга
- Решено унифицировать оба поиска на одну архитектуру
- Создать trajectoryCollector (path + trails batch)
- ~210 LOC, 8 шагов

### Ключевые файлы изученные
- `src/core/search-manager.ts` — логика поиска
- `src/core/path-collector.service.ts` — текущий batch для path
- `src/cypher/queries/search.ts` — Cypher запросы
- `src/cypher/queries/paths.ts` — batch path query
- `src/cypher/helpers/trajectory.ts` — trajectory collection helpers
- `src/facade/langGraph/search-graph/nodes/search-pathfinders.ts` — Facade node
- `src/facade/env.ts` — лимиты из env

---

## Следующие шаги (реализация)

| # | Файл | Изменение |
|---|------|-----------|
| 1 | `src/cypher/queries/paths.ts` | +buildTrajectoryQuery (path + trails) |
| 2 | `src/core/trajectory-collector.service.ts` | Новый сервис |
| 3 | `src/core/search-manager.ts` | Waymates → trajectoryCollector |
| 4 | `src/cypher/queries/search.ts` | +buildPathfinderSearchQueryLight (без Phase 3-4) |
| 5 | `src/core/search-manager.ts` | Pathfinders → trajectoryCollector + DTW |
| 6 | `src/facade/.../search-pathfinders.ts` | +pathLimit, +userTrajectory |
| 7 | `src/facade/.../show-results.ts` | toChartCandidate +dtwMetrics |
| 8 | `src/core/path-collector.service.ts` | Удалить |

---

## Контекст

### Исходная задача
Добавить DTW и Spider chart для Pathfinders (как у Waymates).

### Обнаруженные проблемы

1. **Архитектурное расхождение:**
   - Waymates: Cypher (без path) → pathCollector (path) → DTW
   - Pathfinders: Cypher (с path + trails) → возврат

2. **Баг: trails не попадают в waymates:**
   - pathCollector возвращает только `Map<userId, path>`
   - trails НЕ загружаются для waymates
   - LLM advisor НЕ видит trails для waymates кандидатов

3. **Проблема с лимитами в pathfinders:**
   - `limit: config.CANDIDATES_FETCH_LIMIT` — передаётся ✅
   - `pathLimit` — НЕ передаётся ❌
   - `userTrajectory` — НЕ передаётся ❌

### Решение
Унифицировать оба поиска на одну архитектуру:
1. Cypher → кандидаты БЕЗ path/trails
2. trajectoryCollector → path + trails (batch)
3. DTW enrichment (если userTrajectory >= 3)
4. Sort + slice(pathLimit)

---

## План реализации

### Шаг 1: Создать trajectoryCollector

**Файл:** `src/core/trajectory-collector.service.ts` (новый)

**Что делает:**
- Batch запрос за path + trails для списка userIds
- Возвращает `Map<userId, { path: UserContext[], trails: Trail[] }>`

**Cypher:** Создать `buildTrajectoryQuery` в `src/cypher/queries/paths.ts`

**LOC:** ~50

---

### Шаг 2: Рефакторинг waymates на trajectoryCollector

**Файл:** `src/core/search-manager.ts`

**Изменения:**
- Заменить `pathCollector.collectTrajectories()` на `trajectoryCollector.collect()`
- В `enrichCandidateWithDTW` добавить trails

**LOC:** ~20 изменений

---

### Шаг 3: Упростить Cypher pathfinders

**Файл:** `src/cypher/queries/search.ts`

**Изменения:**
- Убрать Phase 3 (`buildFullTrajectoryFromUser`)
- Убрать Phase 4 (trails collection)
- Новая функция: `buildPathfinderSearchQueryLight`

**LOC:** ~30

---

### Шаг 4-5: Рефакторинг pathfinders + DTW

**Файл:** `src/core/search-manager.ts`

**Паттерн:**
```
Cypher → базовые кандидаты
  → trajectoryCollector (path + trails)
  → DTW enrichment (если userTrajectory >= 3)
  → sort + slice(pathLimit)
```

**LOC:** ~70

---

### Шаг 6: Обновить Facade

**Файлы:**
- `src/facade/langGraph/search-graph/nodes/search-pathfinders.ts`
- `src/facade/langGraph/search-graph/nodes/show-results.ts`

**Изменения:**
- Передать `pathLimit: config.CANDIDATES_DISPLAY_LIMIT`
- Передать `userTrajectory` (если >= 3 контекстов)
- В `toChartCandidate` копировать `dtwMetrics`, `dtwTotal`

**Лимиты из env:**
- `CANDIDATES_FETCH_LIMIT: default(50)` — limit
- `CANDIDATES_DISPLAY_LIMIT: default(20)` — pathLimit

**LOC:** ~15

---

### Шаг 7-8: Типы + удаление старого кода

- Типы уже добавлены (userTrajectory, dtwMetrics, dtwTotal)
- Удалить `src/core/path-collector.service.ts`

---

## Ожидаемый результат

1. **Унифицированная архитектура** — оба поиска используют trajectoryCollector
2. **Исправлен баг trails** — LLM advisor видит курсы для всех кандидатов
3. **DTW для pathfinders** — Spider chart работает
4. **Консистентные лимиты** — из env через config

---

## Проверка

```bash
npx tsc --noEmit
npm run lint:fix
npm run test:integration
```

---

## Промпт для rewind

```
/mvp-implement sessions/2025-12-27-search-unification-refactor.md

Статус: План APPROVED, реализация по шагам 1-8.

Контекст сессии:
- Унификация waymates + pathfinders на одну архитектуру
- Создание trajectoryCollector (path + trails batch)
- Исправление бага: trails не попадали в waymates
- Добавление DTW к pathfinders
- Консистентные лимиты из env (CANDIDATES_FETCH_LIMIT, CANDIDATES_DISPLAY_LIMIT)

Ключевые файлы:
- src/core/search-manager.ts — основная логика
- src/cypher/queries/paths.ts — batch query
- src/facade/langGraph/search-graph/nodes/search-pathfinders.ts — Facade

Начни с шага 1: создание trajectoryCollector.
```
