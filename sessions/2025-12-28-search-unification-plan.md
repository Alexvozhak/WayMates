# План унификации архитектуры поиска

**Дата:** 2025-12-28
**Статус:** APPROVED — реализация по фазам 1-4
**Предыдущие сессии:**
- `sessions/2025-12-27-dtw-for-pathfinders.md`
- `sessions/2025-12-27-search-unification-refactor.md`

---

## Цель

Унифицировать архитектуру waymates и pathfinders:
- Один flow: Cypher → trajectoryCollector → DTW enrichment → sort → slice
- Общий базовый тип кандидата
- Устранить дублирование кода

---

## Текущее состояние

### Архитектура

| Режим | Cypher | Path/Trails | DTW | Сортировка |
|-------|--------|-------------|-----|------------|
| Waymates | Без path | trajectoryCollector | ✅ | dtwTotal + contextMatchScore |
| Pathfinders | С path (Phase 3-4) | Inline в Cypher | ✅ | Только dtwTotal |

### Типы кандидатов

```
ScoredMatchedCandidate (waymates):
├── userId
├── matchedContext
├── timeSinceMatchedMonths
├── contextMatchScore
├── isWaymate
├── path?          ← optional
├── trails?        ← optional
├── dtwMetrics?
└── dtwTotal?

PathfinderCandidate (pathfinders):
├── userId
├── matchedContext (target)
├── referenceContext        ← уникальное
├── timeSinceTargetMonths
├── timeSinceReferenceMonths ← уникальное
├── path           ← required
├── trails         ← required
├── dtwMetrics?
└── dtwTotal?
```

---

## Целевое состояние

### Архитектура (унифицированная)

```
Cypher (без path/trails)
    ↓
trajectoryCollector (batch: path + trails)
    ↓
DTW enrichment (если userTrajectory >= 3)
    ↓
Sort (dtwTotal + contextMatchScore)
    ↓
slice(pathLimit)
```

### Типы кандидатов (унифицированные)

```
CandidateBase (общий):
├── userId
├── matchedContext
├── timeSinceTargetMonths    ← переименовано из timeSinceMatchedMonths
├── contextMatchScore
├── path                      ← required
├── trails                    ← required
├── dtwMetrics?
└── dtwTotal?

WaymateCandidate extends CandidateBase:
└── isWaymate: boolean

PathfinderCandidate extends CandidateBase:
├── referenceContext
└── timeSinceReferenceMonths
```

---

## План работ

### Фаза 1: Унификация типов

| # | Задача | Файл | LOC+ | LOC- |
|---|--------|------|------|------|
| 1.1 | Создать `candidateBaseSchema` | schemas.ts | +15 | 0 |
| 1.2 | Переименовать `timeSinceMatchedMonths` → `timeSinceTargetMonths` | schemas.ts | 0 | 0 | ~5 |
| 1.3 | `path`, `trails` сделать required в base | schemas.ts | +2 | -2 |
| 1.4 | `ScoredMatchedCandidate` = base + isWaymate | schemas.ts | ~5 | ~10 |
| 1.5 | `PathfinderCandidate` = base + referenceContext + timeSinceReferenceMonths | schemas.ts | ~3 | ~8 |
| 1.6 | Обновить импорты и использования | *.ts | ~20 | ~20 |

**Итого Фаза 1:** +40 LOC, -40 LOC, Net: 0

---

### Фаза 2: Унификация Cypher

| # | Задача | Файл | LOC+ | LOC- |
|---|--------|------|------|------|
| 2.1 | Создать `buildPathfinderSearchQueryLight()` (без Phase 3-4) | search.ts | +45 | 0 |
| 2.2 | Удалить Phase 3-4 из `buildPathfinderSearchQuery()` | search.ts | 0 | -50 |
| 2.3 | Создать `PathfinderCandidateLight` для парсинга Cypher | schemas.ts | +10 | 0 |
| 2.4 | Обновить waymates Cypher — вернуть `timeSinceTargetMonths` | search.ts | ~2 | ~2 |
| 2.5 | Вынести skills scoring в `helpers/scoring.ts` | helpers/scoring.ts | +45 | 0 |
| 2.6 | Использовать `buildSkillsScoringBlock()` в waymates | search.ts | +2 | -35 |
| 2.7 | Использовать `buildSkillsScoringBlock()` в pathfinders | search.ts | +5 | 0 |

**Итого Фаза 2:** +105 LOC, -85 LOC, Net: +20

---

### Фаза 3: Унификация search-manager

| # | Задача | Файл | LOC+ | LOC- |
|---|--------|------|------|------|
| 3.1 | `searchPathfinders()` → использовать trajectoryCollector | search-manager.ts | +20 | -5 |
| 3.2 | Удалить `enrichPathfinderWithDTW()` (использовать общий) | search-manager.ts | 0 | -13 |
| 3.3 | Унифицировать сортировку: `dtwTotal + contextMatchScore` | search-manager.ts | ~2 | ~2 |
| 3.4 | Waymates без DTW: добавить `.slice(pathLimit)` | search-manager.ts | +1 | 0 |
| 3.5 | Обновить `enrichCandidateWithDTW()` для обоих типов | search-manager.ts | ~5 | ~5 |

**Итого Фаза 3:** +25 LOC, -20 LOC, Net: +5

---

### Фаза 4: Обновление Facade и тестов

| # | Задача | Файл | LOC+ | LOC- |
|---|--------|------|------|------|
| 4.1 | Обновить `toChartCandidate()` под новые типы | show-results.ts | ~3 | ~3 |
| 4.2 | Обновить state типы если нужно | state.ts | ~2 | ~2 |
| 4.3 | Обновить integration тесты | tests/*.ts | ~10 | ~10 |
| 4.4 | Добавить assertions на path/trails в тестах | tests/*.ts | +5 | 0 |

**Итого Фаза 4:** +15 LOC, -15 LOC, Net: 0

---

## Итоговая оценка

| Фаза | LOC+ | LOC- | Net |
|------|------|------|-----|
| 1. Типы | +40 | -40 | 0 |
| 2. Cypher (helper extraction + scoring) | +105 | -85 | +20 |
| 3. search-manager | +25 | -20 | +5 |
| 4. Facade/тесты | +15 | -15 | 0 |
| **Всего** | **+185** | **-160** | **+25** |

---

## Риски и митигация

| Риск | Серьёзность | Митигация |
|------|-------------|-----------|
| Zod parse сломается после удаления Phase 3-4 | 🔴 Критический | PathfinderCandidateLight промежуточный тип |
| Breaking change в API | 🟠 Высокий | timeSinceMatchedMonths → timeSinceTargetMonths — обновить Facade |
| Тесты упадут | 🟡 Средний | Обновить fixtures и assertions |
| trajectoryCollector для пустых userIds | 🟢 Низкий | Уже обрабатывается (return empty Map) |

---

## Проверка

```bash
# После каждой фазы
npm run lint:fix
npx tsc --noEmit

# После всех фаз
npm run test:integration
npx tsx poc/test-pathfinders.ts
```

---

## Бизнес-логика (не меняется)

| Аспект | Waymates | Pathfinders |
|--------|----------|-------------|
| Что ищем | Похожих людей | Proof of transition |
| Match | referenceContext | referenceContext + targetContext |
| Recency | На matched context | На target context |
| Результат | isWaymate: true/false | referenceContext + matchedContext |
| DTW | Если userTrajectory >= 3 | Если userTrajectory >= 3 |

---

## Файлы для изменения

### Core
- `src/shared/schemas.ts` — типы кандидатов
- `src/cypher/queries/search.ts` — Cypher queries
- `src/core/search-manager.ts` — логика поиска

### Facade
- `src/facade/langGraph/search-graph/nodes/show-results.ts` — toChartCandidate
- `src/facade/langGraph/search-graph/state.ts` — state types (если нужно)

### Tests
- `tests/core/integration/search-manager/*.ts` — integration tests
- `tests/core/helpers/fixture-search-manager.ts` — fixtures

---

## Решения (согласовано 2025-12-28)

1. **contextMatchScore для pathfinders** — считать реально, консистентно с waymates

2. **Breaking changes** — делаем сразу, batch через filesystem MCP

3. **Порядок фаз** — последовательно: Фаза 1 → 2 → 3 → 4

---

## Промпт для следующей сессии

```
/mvp-implement sessions/2025-12-28-search-unification-plan.md

Статус: План согласован, реализация по фазам 1-4.

Начни с Фазы 1: унификация типов в schemas.ts.
```
