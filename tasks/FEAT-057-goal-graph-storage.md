# FEAT-057: Goal как граф, не JSON blob

**Дата:** 2025-12-31
**Статус:** READY_FOR_WORK
**Приоритет:** P2
**Компонент:** Core, Cypher, Schema
**Оценка:** ~415 LOC, 10 файлов, 2 дня

---

## Проблема

Сейчас Goal хранится как JSON string в одном поле:

```cypher
(:Goal {
  userId: "usr_123",
  createdAt: "2025-12-31T10:00:00Z",
  targetContext: '{"position":{"mode":"desired","values":["senior"]},...}'
})
```

**Ограничения:**
1. Нельзя искать через Cypher: `MATCH (g:Goal) WHERE "senior" IN g.position`
2. JSON parsing на каждый read (`goals-manager.ts:29,48`)
3. isWaymate detection через хак `CONTAINS` (`search.ts:175`)
4. Нет graph traversal — теряем преимущества графовой БД
5. Нельзя связать Goal с Dictionary nodes

---

## Решение: Вариант C — Graph

Goal node связывается с существующими Dictionary nodes через typed relationships.

### Целевая структура

```
(:User {userId})
    │
    └──[:HAS_GOAL]──▶ (:Goal {userId, createdAt})
                           │
                           ├──[:TARGETS_POSITION {mode: "desired"}]──▶ (:Position "senior")
                           ├──[:TARGETS_POSITION {mode: "desired"}]──▶ (:Position "lead")
                           │
                           ├──[:TARGETS_ROLE {mode: "desired"}]──▶ (:Role "backend")
                           │
                           ├──[:TARGETS_DOMAIN {mode: "desired"}]──▶ (:WorkDomain "platform")
                           ├──[:TARGETS_DOMAIN {mode: "desired"}]──▶ (:WorkDomain "ai")
                           │
                           └──[:TARGETS_COUNTRY {mode: "desired"}]──▶ (:Country "NL")
```

### 10 Relationship Types

| Relationship | Target Node | Key Field |
|-------------|-------------|-----------|
| `TARGETS_POSITION` | Position | canonicalName |
| `TARGETS_ROLE` | Role | canonicalName |
| `TARGETS_DOMAIN` | WorkDomain | canonicalName |
| `TARGETS_SKILL` | Skill | canonicalName |
| `TARGETS_INDUSTRY` | Industry | canonicalName |
| `TARGETS_CITY` | City | canonicalName |
| `TARGETS_COUNTRY` | Country | name |
| `TARGETS_LANGUAGE` | Language | code |
| `TARGETS_CITIZENSHIP` | Country | name (reuse) |
| `TARGETS_EDUCATION` | EducationLevel | canonicalName |

**Mode property:** `"desired"` | `"undesired"`

**Семантика:**
- `desired` — цель, куда хочу
- `undesired` — страх/фильтр, чего избегаю
- Один mode per field (все relationships одного типа имеют одинаковый mode)

### Плюсы

- Полноценный граф — используем Neo4j как граф
- Связь с Dictionary nodes — переиспользование существующих нод
- Индексы работают — Dictionary nodes уже проиндексированы
- Cypher поиск: `MATCH (g:Goal)-[:TARGETS_POSITION]->(:Position {canonicalName: "senior"})`
- isWaymate через graph traversal, не CONTAINS hack

### Минусы

- Сложнее queries (OPTIONAL MATCH для каждого поля)
- Breaking change (но пользователей нет)

---

## План работ

### Phase 1: Types & Mapper (Day 1 AM)

| Файл | Действие | LOC |
|------|----------|-----|
| `src/shared/goal-types.ts` | **Новый** — relationship type enums | +20 |
| `src/core/goals-graph-mapper.ts` | **Новый** — TargetContext ↔ Graph | +30 |

### Phase 2: Cypher Queries (Day 1 PM)

| Файл | Действие | LOC |
|------|----------|-----|
| `src/cypher/queries/goals.ts` | Перепись: set/get/delete с relationships | +120 |
| `src/cypher/queries/goals-helpers.ts` | **Новый** — UNWIND helpers | +30 |

### Phase 3: Core & Search (Day 2 AM)

| Файл | Действие | LOC |
|------|----------|-----|
| `src/core/goals-manager.ts` | Убрать JSON.stringify/parse, использовать mapper | +50 |
| `src/cypher/queries/search.ts` | isWaymate через MATCH path, убрать CONTAINS | +15 |

### Phase 4: Schema & Indexes (Day 2 PM)

| Файл | Действие | LOC |
|------|----------|-----|
| `src/shared/schemas.ts` | Minor type updates | +20 |
| `database/init.cypher` | Relationship indexes (10 штук) | +15 |

### Phase 5: Tests (Day 2 PM)

| Файл | Действие | LOC |
|------|----------|-----|
| `tests/core/integration/goals-manager/*.ts` | Адаптация под graph | +40 |
| `tests/core/helpers/drivers/goals-driver.ts` | Cleanup relationships | +20 |

---

## Acceptance Criteria

- [ ] Goal node не содержит targetContext JSON
- [ ] Goal связан с Dictionary nodes через TARGETS_* relationships
- [ ] `setGoal` создаёт relationships с mode
- [ ] `getUserGoal` собирает TargetContext из relationships
- [ ] `deleteGoal` удаляет Goal node и все relationships
- [ ] isWaymate detection через graph traversal
- [ ] Indexes на relationship types
- [ ] Тесты GM1-GM4, G1-G5 проходят

---

## Пример Cypher

### setGoal (упрощённо)

```cypher
MERGE (u:User {userId: $userId})
MERGE (u)-[:HAS_GOAL]->(g:Goal)
ON CREATE SET g.userId = $userId, g.createdAt = $createdAt

// Clear old relationships
WITH g
OPTIONAL MATCH (g)-[r]->() WHERE type(r) STARTS WITH 'TARGETS_'
DELETE r

// Create position relationships
WITH g
UNWIND $positions AS pos
MATCH (p:Position {canonicalName: pos.value})
MERGE (g)-[:TARGETS_POSITION {mode: pos.mode}]->(p)

// ... repeat for each field type
```

### getUserGoal

```cypher
MATCH (u:User {userId: $userId})-[:HAS_GOAL]->(g:Goal)

OPTIONAL MATCH (g)-[rp:TARGETS_POSITION]->(p:Position)
OPTIONAL MATCH (g)-[rr:TARGETS_ROLE]->(r:Role)
// ... 8 more OPTIONAL MATCH

WITH g,
  CASE WHEN count(p) > 0
    THEN {mode: head(collect(DISTINCT rp.mode)), values: collect(DISTINCT p.canonicalName)}
    ELSE null
  END AS position,
  // ... repeat

RETURN g {
  .userId, .createdAt,
  targetContext: {position, role, domains, ...}
} AS goal
```

### isWaymate (новый)

```cypher
// Вместо CONTAINS hack
// Только desired — undesired это фильтры, не часть общей цели
OPTIONAL MATCH (candidateUser)-[:HAS_GOAL]->(candidateGoal:Goal)
  -[:TARGETS_POSITION {mode: "desired"}]->(pos:Position)
WHERE pos.canonicalName IN $searchingDesiredPositions

WITH ..., count(pos) > 0 AS isWaymate
```

---

## Связанные файлы

| # | Файл | Действие | LOC |
|---|------|----------|-----|
| 1 | `src/shared/goal-types.ts` | **Новый** | +20 |
| 2 | `src/core/goals-graph-mapper.ts` | **Новый** | +30 |
| 3 | `src/cypher/queries/goals.ts` | Перепись | +120 |
| 4 | `src/cypher/queries/goals-helpers.ts` | **Новый** | +30 |
| 5 | `src/core/goals-manager.ts` | Update | +50 |
| 6 | `src/cypher/queries/search.ts` | isWaymate | +15 |
| 7 | `src/shared/schemas.ts` | Minor | +20 |
| 8 | `database/init.cypher` | Indexes | +15 |
| 9 | `tests/core/integration/goals-manager/*.ts` | Adapt | +40 |
| 10 | `tests/core/helpers/drivers/goals-driver.ts` | Cleanup | +20 |

**Итого:** ~415 LOC, 10 файлов

---

## Решённые вопросы

| # | Вопрос | Решение |
|---|--------|---------|
| 1 | isWaymate для multiple positions | **ANY match** — если кандидат хочет хотя бы одну из позиций searching user |
| 2 | Relationship indexes | **Достаточно существующих** — Dictionary nodes уже проиндексированы (unique constraints) |
| 3 | Mode validation | **Zod schema = source of truth** — дополнительная валидация не нужна |
| 4 | Modes в схеме | **`desired` и `undesired`** — из filterModeSchema, не required/exclude |
| 5 | isWaymate и mode | **Только `desired`** — `undesired` это фильтры/страхи, не часть общей цели |
| 6 | undesired в Goal | **Валидный сценарий** — пользователь может не знать чего хочет, но знать чего избегает |

---

## Оценка

- **Сложность:** Medium-High
- **Риск:** Low (нет пользователей, breaking changes OK)
- **Время:** 2 дня
- **Зависимости:** Dictionary nodes должны существовать (MERGE создаст если нет)
- **Верификация:** ✅ План соответствует conventions и Neo4j best practices (Explore agent)
