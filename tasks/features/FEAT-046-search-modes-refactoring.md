# FEAT-046: Рефакторинг режимов поиска (Search Modes)

**Статус:** DONE ✅
**Приоритет:** P1
**Ветка:** `feature/search-refactor`
**Коммит:** `fe886d7`
**Создано:** 2025-12-25
**Обновлено:** 2025-12-26

---

## Бизнес-логика (КРИТИЧНО понять перед кодом)

### Три семантических режима поиска

| Режим | Кого ищем | Ценность | Требует Goal |
|-------|-----------|----------|--------------|
| **searchWaymates** | Похожие люди с той же целью | Peers, networking, обмен опытом | Желательно |
| **searchPathfinders** | Кто прошёл ОТ нас К цели | Proof of transition, учиться на пути | ДА |
| **reverseSearchPathfinders** | Кто достиг target (любой старт) | Валидация цели, анализ откуда приходят | ДА |

### Определения (согласовано 2025-12-26)

**Waymate** = человек который:
1. Похож на нас по ТЕКУЩЕМУ контексту (match referenceContext)
2. Имеет ТУ ЖЕ ЦЕЛЬ что и мы
3. Ещё НЕ ДОСТИГ этой цели

**Pathfinder** = человек который:
1. БЫЛ в контексте похожем на наш (в ИСТОРИИ, не обязательно сейчас)
2. ДОСТИГ нашей цели (имеет контекст matching target)
3. Target ПОСЛЕ reference (доказательство прогрессии)

**reversePathfinder** = человек который:
1. ДОСТИГ конкретной цели (match targetContext)
2. Любой старт (неважно откуда пришёл)
3. Используется для: ОТКУДА, КАК, ЗА СКОЛЬКО, КОГДА пришёл к цели, доволен ли (feedback), куда ушёл

---

## Текущий статус

### Все фазы выполнены ✅

| Фаза | Описание | Коммит |
|------|----------|--------|
| 1 | Rename: `searchByTarget` → `reverseSearchPathfinders` | `aeabdcf` |
| 2 | Merge: `searchAdhoc` + `searchByUser` → `searchWaymates` | `e2399b0` |
| 3 | Chart cleanup: убран из explore.ts | — |
| 4 | Prompt improvements: убраны примеры, dictionary hints | `4b3f65e` |
| 5 | Adhoc validation: 4 required fields | `6e11200` |
| 6 | Goal inheritance: fillFromContext() | — |
| 7 | Router fix: `filter` в validateRoutes | `d447270` |
| 8.1 | `candidateType` → `isWaymate: boolean` | — |
| 8.2-8.4 | searchPathfinders (dual matching, dual recency) | — |
| 8.5 | Тесты G1-G5 переписаны | — |
| 8.6 | LIMIT 1 bug → `collect()[0]` per user | `fe886d7` |

---

## Фаза 8: searchPathfinders (DONE ✅)

### Бизнес-требования

**searchPathfinders** находит людей которые:
1. **Match reference:** Имели контекст похожий на наш в своей ИСТОРИИ
2. **Match target:** Достигли нашей цели (имеют контекст matching target)
3. **Temporal:** refContext.createdAt < targetContext.createdAt (proof of progression)
4. **Два recency фильтра:**
   - `targetRecencyMonths` — когда достиг цели (не показывать 10-летние)
   - `referenceRecencyMonths` — как давно был в нашем контексте (длина пути)
5. **excludedCreationReasons** — как в waymates
6. **excludedContextFields** — как в waymates (для reference matching)

### Ключевое решение: убрать pathfinder badge из waymates

**Было:**
```typescript
candidateType: 'pathfinder' | 'waymate' | null
```

**Проблема:** `pathfinder` в waymates — обман. Мы матчим по текущему контексту, не доказываем переход.

**Станет:**
```typescript
isWaymate: boolean
// true = та же цель
// false = нет goal ИЛИ другая цель
```

### Архитектура reuse (90%+)

**Модульные функции (уже есть):**
- `buildMatchedContextBase(filterByCurrentContext)` ✓
- `buildStrictWhereClause(fields, alias, param)` ✓
- `buildExcludedReasonsFilter(alias, passthrough)` ✓
- `buildOptionalMatchRelationships(alias)` ✓
- `buildWithCollect(alias, passthrough)` ✓
- `buildFullTrajectoryFromUser(...)` ✓
- `buildContextMapProjection(prefix)` ✓

**Подход:**
```
searchPathfinders = reversePathfinders + reference filter + dual recency
```

1. Извлечь `buildTargetFilterConditions()` из reversePathfinders
2. Использовать в обоих местах
3. Добавить reference matching как WHERE на trajectory
4. Добавить второй recency

### Schema (предложение)

```typescript
pathfinderSearchParamsSchema = {
  referenceContext: adhocContextBase,     // наш контекст
  targetContext: targetContextSchema,      // наша цель (FieldFilter)
  excludedContextFields: [],               // поля для пропуска при ref matching
  excludedCreationReasons: [],             // фильтр траектории
  targetRecencyMonths: number | null,      // recency на цель
  referenceRecencyMonths: number | null,   // recency на старт (длина пути)
  limit: number,
  userId: string,
}
```

### Подфазы реализации (все выполнены ✅)

**Фаза 8.1: Рефакторинг waymates**
- [x] `candidateType` → `isWaymate: boolean`
- [x] Убрать pathfinder classification из buildWaymatesSearchQuery
- [x] Обновить типы: ScoredMatchedCandidate
- [x] Обновить тесты

**Фаза 8.2-8.3: buildPathfinderSearchQuery**
- [x] Dual matching (ref + target)
- [x] Два recency фильтра (targetRecencyMonths + referenceRecencyMonths)
- [x] excludedContextFields для ref matching
- [x] Temporal ordering: `refContext.createdAt < matchedContext.createdAt`
- [x] LIMIT 1 bug fix → `collect()[0]` per (user, targetContext)

**Фаза 8.4: SearchManager + tRPC**
- [x] `searchPathfinders()` в SearchManager
- [x] `search.pathfinders` endpoint
- [x] `pathfinderSearchParamsSchema`, `pathfinderCandidateSchema`

**Фаза 8.5: Facade integration**
- [x] `validate_goal` использует `reversePathfinders` (правильно для валидации)
- [ ] **TODO:** UX выбор waymates/pathfinders после save goal

**Фаза 8.6: Тестирование**
- [x] G1-G5 тесты переписаны
- [x] Negative assertions (U8 НЕ найден)
- [x] 88/88 integration tests pass

---

## Ключевые решения (согласовано)

### filterByCurrentContext = false для Waymates ✓

Искать по ЛЮБОМУ контексту в истории. Recency filter отсеет неактуальные.

### isWaymate вместо candidateType ✓

Простой boolean:
- `true` = кандидат имеет ту же цель
- `false` = нет goal ИЛИ другая цель

### Два recency для Pathfinders ✓

1. **targetRecencyMonths** — не показывать старые достижения (10+ лет назад)
2. **referenceRecencyMonths** — не показывать тех кто шёл 10 лет

### Единое поведение search modes ✓

Все search modes (waymates, pathfinders, reversePathfinders) следуют одному паттерну:

1. **Много кандидатов (> threshold)** → показать facets для фильтрации
2. **≤ LIMIT кандидатов** → загрузить всех + chart

### Chart для всех search modes ✓

Chart показывается для ВСЕХ режимов:
- **Pathfinders** — путь от нашего контекста к цели
- **reversePathfinders** — путь к цели (любой старт)
- **Waymates** — их пройденные пути + общие цели (**ОТДЕЛЬНАЯ ЗАДАЧА: FEAT-047**)

### excludedContextFields как в Waymates ✓

Пользователь может исключить поля из matching (skills, countryCode, etc.)

### DTW только для profile mode ✓

Adhoc = пользователь ввёл контекст вручную, траектории нет.

---

## Файлы для изменения

### Фаза 8.1 (isWaymate)

| Файл | Изменение |
|------|-----------|
| `src/cypher/queries/search.ts` | candidateType → isWaymate |
| `src/shared/schemas.ts` | Обновить ScoredMatchedCandidate |
| `tests/core/integration/search-manager/*.ts` | Обновить assertions |

### Фаза 8.2-8.3 (Cypher)

| Файл | Изменение |
|------|-----------|
| `src/cypher/queries/search.ts` | buildTargetFilterConditions, buildPathfinderSearchQuery |
| `src/cypher/helpers/filters.ts` | (если нужно) |

### Фаза 8.4 (Core)

| Файл | Изменение |
|------|-----------|
| `src/shared/schemas.ts` | pathfinderSearchParamsSchema |
| `src/core/search-manager.ts` | searchPathfinders() |
| `src/core/routers/search.router.ts` | pathfinders endpoint |

### Фаза 8.5 (Facade)

| Файл | Изменение |
|------|-----------|
| `src/facade/langGraph/search-graph/nodes/search.ts` | Использовать pathfinders |
| `src/facade/langGraph/search-graph/types.ts` | DEFAULT_PATHFINDER_SEARCH_PARAMS |

---

## Quality Gates

- [ ] `npm run lint:fix` — 0 errors
- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `npm run test:integration:run` — all pass
- [ ] UX тест: adhoc → goal → pathfinders → результаты

---

## Промпт для продолжения

```
Изучи: tasks/features/FEAT-046-search-modes-refactoring.md

КОНТЕКСТ:
- Ветка: feature/search-refactor, коммит: fe886d7
- FEAT-046 DONE ✅, 88/88 integration tests pass

ЧТО СДЕЛАНО:
- searchWaymates (unified adhoc + profile)
- searchPathfinders (dual matching, dual recency)
- isWaymate: boolean вместо candidateType enum
- LIMIT 1 bug → collect()[0] per user

СЛЕДУЮЩИЕ ЗАДАЧИ:
1. UX: выбор waymates/pathfinders после save goal
2. UX тест как критичный пользователь
3. NLP стиль improvements
4. Chart improvements (FEAT-047)

БИЗНЕС-ЛОГИКА:
- Waymate = похожий + та же цель + ещё не достиг
- Pathfinder = был как мы + достиг нашей цели + temporal ordering
- reversePathfinder = достиг цели (любой старт), для валидации
```

---

## Коммиты

| Коммит | Описание |
|--------|----------|
| `aeabdcf` | Фаза 1: rename searchByTarget → reverseSearchPathfinders |
| `e2399b0` | Фаза 2: merge searchAdhoc + searchByUser → searchWaymates |
| `4b3f65e` | Фаза 4: prompt improvements |
| `6e11200` | Фазы 5-6: adhoc validation + goal inheritance |
| `d447270` | Фаза 7: filter в validateRoutes + searchPathfinders design |
| `fe886d7` | Фаза 8: LIMIT 1 bug fix + G2/G4 test improvements |
