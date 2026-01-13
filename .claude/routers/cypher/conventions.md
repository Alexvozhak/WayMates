# WayMates Cypher Naming Conventions

**Назначение**: WayMates-specific naming rules (НЕ универсальные Neo4j правила)
**Когда загружать**: Новый query, рефакторинг, code review

---

## Canonical Naming Pattern

**Формула**: `[owner][pathModifier?][property]`

- **owner**: `searching` (left side, кто ищет) | `matched` (right side, кого нашли)
- **pathModifier** (optional): `Path` (для траекторий с PREVIOUS_CONTEXT relationships)
- **property**: `Context`, `Position`, `Skills`, `Domains`, `Industries`, etc.

**Примеры**:
- `searchingContext` = контекст пользователя (кто ищет)
- `matchedContext` = контекст кандидата (кого нашли)
- `searchingPathContext` = контекст в траектории пользователя
- `matchedPathContext` = контекст в траектории кандидата

---

## Таблица переменных

| Переменная | Использование | Owner | Path? | Примечания |
|-----------|---------------|-------|-------|-----------|
| `searchingContext` | Single context query | searching | ❌ | Текущий/целевой контекст user'а |
| `matchedContext` | Single context query | matched | ❌ | Контекст candidate'а |
| `searchingPathContext` | Trajectory/DTW query | searching | ✅ | Контекст в траектории user'а |
| `matchedPathContext` | Trajectory/DTW query | matched | ✅ | Контекст в траектории candidate'а |
| `searchingPosition` | Position property | searching | ❌ | Position.name для user'а |
| `matchedPosition` | Position property | matched | ❌ | Position.name для candidate'а |
| `searchingSkills` | Skills collection | searching | ❌ | collect(Skill.name) для user'а |
| `matchedSkills` | Skills collection | matched | ❌ | collect(Skill.name) для candidate'а |

---

## Примеры использования

### Single Context Query

```cypher
MATCH (searching:User)-[:HAS_CONTEXT]->(sc:Context)
MATCH (matched:User)-[:HAS_CONTEXT]->(mc:Context)
WHERE searching.user_id = $userId

// sc = searchingContext
// mc = matchedContext
RETURN sc { .context_id } AS searchingContext,
       mc { .context_id } AS matchedContext
```

### Trajectory/DTW Query

```cypher
MATCH path = (searching:User)-[:HAS_CONTEXT]->(:Context)-[:PREVIOUS_CONTEXT*0..20]->(spc:Context)
MATCH path2 = (matched:User)-[:HAS_CONTEXT]->(:Context)-[:PREVIOUS_CONTEXT*0..20]->(mpc:Context)

// spc = searchingPathContext
// mpc = matchedPathContext
RETURN spc { .context_id } AS searchingPathContext,
       mpc { .context_id } AS matchedPathContext
```

### Loop with Canonical Names

```cypher
UNWIND $targetContexts AS tc
  MATCH (searching:User)-[:HAS_CONTEXT]->(sc:Context)
  MATCH (matched:User)-[:HAS_CONTEXT]->(mc:Context {context_id: tc.contextId})

  // Внутри UNWIND:
  // sc = searchingContext (current user context)
  // mc = matchedContext (каждый target context из массива)
  RETURN sc, mc
```

---

## Правила Enforce

### ✅ DO: Используй canonical naming

```cypher
// ✅ Правильно
MATCH (searching:User)-[:HAS_CONTEXT]->(sc:Context)
MATCH (matched:User)-[:HAS_CONTEXT]->(mc:Context)
RETURN sc AS searchingContext, mc AS matchedContext
```

### ❌ DON'T: Не используй короткие/неясные имена

```cypher
// ❌ Неправильно
MATCH (u1:User)-[:HAS_CONTEXT]->(c1:Context)
MATCH (u2:User)-[:HAS_CONTEXT]->(c2:Context)
RETURN c1, c2  // Какой c1? Какой c2? Непонятно!
```

---

## Анти-паттерны

**❌ Не используй**:
- `c`, `ctx`, `context` (амбигуозно - чей контекст?)
- `c1`, `c2`, `context1`, `context2` (нет семантики)
- `userContext`, `candidateContext` (не следует canonical pattern)
- `temp`, `data`, `item` (слишком generic)
- `leftContext`, `rightContext` (spatial метафора вместо role-based)

**✅ Вместо этого**:
- `searchingContext` (ясно: контекст user'а, кто ищет)
- `matchedContext` (ясно: контекст candidate'а, кого нашли)
- `searchingPathContext` (ясно: контекст в траектории user'а)
- `matchedPathContext` (ясно: контекст в траектории candidate'а)

---

## Когда НЕ применять Canonical Naming

**Исключения** (можно использовать короткие имена):
- **Utility nodes**: `u:User`, `p:Position`, `s:Skill`, `d:Domain`, `i:Industry` (общепринятые abbreviations)
- **Single entity в query**: Если только один Context в query, можно `c:Context`
- **Intermediate variables**: `WITH count(*) AS cnt` (технические переменные)

**Canonical naming ОБЯЗАТЕЛЕН**:
- Два и более контекста в query (searching/matched)
- Path contexts (траектории)
- Возвращаемые значения (RETURN AS)

---

## Quick Reference

Перед submit query, проверь naming:

- [ ] ✅ Два контекста? → `searchingContext`, `matchedContext`
- [ ] ✅ Траектории? → `searchingPathContext`, `matchedPathContext`
- [ ] ✅ Нет `c1`, `c2`, `ctx`, `temp`?
- [ ] ✅ Utility nodes → короткие ok (`u:User`, `p:Position`)
- [ ] ✅ RETURN AS использует canonical names?

---

## Когда обновлять

- ✅ Изменился canonical pattern (breaking change! редко)
- ✅ Добавлена новая переменная, которая следует pattern
- ❌ НЕ добавляй universal Neo4j rules (они в best-practices.md)
- ❌ НЕ добавляй примеры конкретных ошибок (они в mistakes-registry.md)
