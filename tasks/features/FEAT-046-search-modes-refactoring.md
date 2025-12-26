# FEAT-046: Рефакторинг режимов поиска (Search Modes)

**Статус:** IN PROGRESS
**Приоритет:** P1
**Ветка:** `feature/search-refactor`
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

### Выполнено

- [x] **Фаза 1: Rename** — `searchByTarget` → `reverseSearchPathfinders` (коммит `aeabdcf`)
- [x] **Фаза 2: Waymates merge** — объединение searchAdhoc + searchByUser (коммит `e2399b0`)
- [x] **Фаза 3: Chart cleanup** — убран из explore.ts
- [x] **Фаза 4: Prompt improvements** — убраны примеры, dictionary hints (коммит `4b3f65e`)
- [x] **Фаза 5: Adhoc validation** — 4 required fields (коммит `6e11200`)
- [x] **Фаза 6: Goal inheritance** — fillFromContext()
- [x] **Фаза 7: Router fix** — добавлен `filter` в validateRoutes (uncommitted)

### В работе

- [ ] **Фаза 8: searchPathfinders** — реализовать полноценный поиск pathfinders

---

## Фаза 8: searchPathfinders (СЛЕДУЮЩАЯ СЕССИЯ)

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

### Подфазы реализации

**Фаза 8.1: Рефакторинг waymates (~5% контекста)**
- [ ] `candidateType` → `isWaymate: boolean`
- [ ] Убрать pathfinder classification из buildWaymatesSearchQuery
- [ ] Обновить типы: ScoredMatchedCandidate
- [ ] Обновить тесты

**Фаза 8.2: Извлечь buildTargetFilterConditions (~5% контекста)**
- [ ] Извлечь target filtering из buildReversePathfinderSearchQuery
- [ ] Переиспользовать в reversePathfinders
- [ ] Тесты без изменения поведения

**Фаза 8.3: buildPathfinderSearchQuery (~10% контекста)**
- [ ] Создать query с dual matching (ref + target)
- [ ] Два recency фильтра
- [ ] excludedContextFields для ref matching
- [ ] excludedCreationReasons для траектории
- [ ] Temporal ordering

**Фаза 8.4: SearchManager + tRPC (~5% контекста)**
- [ ] Добавить searchPathfinders в SearchManager
- [ ] Добавить endpoint в search.router.ts
- [ ] pathfinderSearchParamsSchema

**Фаза 8.5: Facade integration (~5% контекста)**
- [ ] Обновить search node: с goal → pathfinders
- [ ] Или добавить выбор waymates/pathfinders после save

**Фаза 8.6: Тестирование (~5% контекста)**
- [ ] Unit тесты для buildPathfinderSearchQuery
- [ ] Integration тесты для searchPathfinders
- [ ] E2E: adhoc → goal → pathfinders

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
Изучи: tasks/features/FEAT-046-search-modes-refactoring.md (Фаза 8)

КОНТЕКСТ:
- Ветка: feature/search-refactor
- Фазы 1-7 — DONE
- Фаза 8 (searchPathfinders) — IN PROGRESS

ЧТО ДЕЛАТЬ (по подфазам):
8.1: candidateType → isWaymate: boolean
8.2: Извлечь buildTargetFilterConditions()
8.3: buildPathfinderSearchQuery (dual matching, dual recency)
8.4: SearchManager + tRPC
8.5: Facade integration
8.6: Тесты

КЛЮЧЕВЫЕ РЕШЕНИЯ (согласовано):
- isWaymate: boolean (не candidateType enum)
- Два recency: targetRecencyMonths + referenceRecencyMonths
- excludedContextFields как в waymates
- excludedCreationReasons на траекторию
- 90%+ reuse существующего кода

БИЗНЕС-ЛОГИКА:
- Pathfinder = был как мы + достиг нашей цели + temporal ordering
- Waymate = похожий + та же цель + ещё не достиг
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
| PENDING | Фаза 7: filter в validateRoutes |
