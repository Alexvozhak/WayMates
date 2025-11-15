# Cypher Rules - Правила написания Cypher в WayMates

**Назначение**: Универсальные Neo4j правила + адаптированные уроки из исправленных WayMates багов
**Когда загружать**: Новый query, рефакторинг, code review, фикс бага

---

## 1. Map Projection (CRITICAL)

**Правило**: Всегда используй `.property` синтаксис для node properties в RETURN.

**✅ Правильно**:
```cypher
RETURN node {
  .property1,
  .property2,
  computed: other.field,
  aggregated: collect(x)
} AS result
```

**❌ Неправильно**:
```cypher
RETURN {
  property1: node.property1,  // ❌ verbose
  property2: node.property2
} AS result
```

**Почему**: Cleaner, стандартный Neo4j синтаксис, меньше ошибок, лучше performance.

---

## 2. WITH Clause Scope

**Правило**: WITH создает новый scope. Только переменные в WITH доступны дальше.

**✅ Правильно**:
```cypher
MATCH (u:User)
WITH u, u.user_id AS uid
RETURN u.name, uid  // ✅ u в WITH, доступен
```

**❌ Неправильно**:
```cypher
MATCH (u:User)
WITH u.user_id AS uid
RETURN u.name  // ❌ u не в WITH, undefined!
```

**Почему**: Scope rules Neo4j - переменные за пределами WITH теряются.

### 2.1 WITH Clause Variable Propagation

**Правило**: Every variable used AFTER a WITH must be declared IN that WITH. В цепочке WITH переменные нужно явно передавать.

**✅ Правильно**:
```cypher
WITH a, b, c
MATCH (x)
WITH a, b, c, x  // ✅ Re-declare all needed variables
MATCH (y)
WITH a, b, c, x, y  // ✅ Chain continues
RETURN a, b, c, x, y
```

**❌ Неправильно (частая ошибка)**:
```cypher
WITH a, b, c
MATCH (x)
WITH a, b, x  // ❌ Потеряли c!
MATCH (y)
WITH a, b, c, x, y  // ❌ c уже undefined на предыдущем шаге
RETURN a, b, c  // ❌ c = null
```

**Проверка**: Trace variable through entire query - if lost in chain → bug

**Пример реального бага (FEAT-018)**:
```cypher
// Line 58: Declare languages
WITH context, user, $ctx.languages AS languages

// Line 66: Lost languages here!
WITH context, work_domains, skills  // ❌ languages dropped

// Line 91: Try to use languages
WITH context, citizenships, languages  // ❌ languages = undefined!
```

**Как избежать**: В каждом WITH явно перечисляй ВСЕ переменные, которые нужны дальше.

---

## 3. Null Safety

**Правило**: Всегда `coalesce($array, [])` для параметров-массивов.

**✅ Правильно**:
```cypher
WHERE ANY(item IN coalesce($arrayParam, []) WHERE condition)
```

**❌ Неправильно**:
```cypher
WHERE ANY(item IN $arrayParam WHERE condition)  // ❌ если null → error
```

**Почему**: Cypher не может итерировать по null, нужен fallback на пустой массив.

---

## 4. Bounded Patterns

**Правило**: НИКОГДА не используй `*` без ограничения. Всегда `*0..N`.

**✅ Правильно**:
```cypher
MATCH path = (start)-[*0..5]->(end)  // ✅ максимум 5 hops
```

**❌ Неправильно**:
```cypher
MATCH path = (start)-[*]->(end)  // ❌ может пойти по всему графу!
```

**Почему**: Unbounded pattern может вызвать бесконечный обход графа и зависание query.

---

## 5. Parameter Binding

**Правило**: Всегда используй `$param` для значений, НЕ литералы в query.

**✅ Правильно**:
```cypher
WHERE u.user_id = $userId
AND u.name IN $names
```

**❌ Неправильно**:
```cypher
WHERE u.user_id = "123"  // ❌ literal в query
AND u.name IN ["Alice", "Bob"]  // ❌ literal массив
```

**Почему**: Query plan caching, безопасность (SQL injection аналог), гибкость.

---

## 6. Index Hints

**Правило**: Используй `USING INDEX` только если PROFILE показывает full scan + index exists.

**Когда нужен**:
1. Запусти `PROFILE query` через MCP
2. Проверь: есть ли `NodeByLabelScan` вместо `NodeIndexSeek`?
3. Проверь: существует ли index на этом property?
4. Если оба да → добавь hint

**✅ Правильно**:
```cypher
MATCH (u:User)
USING INDEX u:User(user_id)
WHERE u.user_id = $userId
```

**❌ Когда НЕ нужен**:
- Neo4j уже использует index (видно в PROFILE)
- Index не существует на property
- Query и так быстрый

**Почему**: Hint может ухудшить performance, если Neo4j optimizer уже выбрал лучший план.

---

## 7. DISTINCT в Aggregations

**Правило**: Используй `DISTINCT` в aggregations для уникальных значений.

**✅ Правильно**:
```cypher
RETURN collect(DISTINCT skill.name) AS skills
```

**❌ Может быть проблема**:
```cypher
RETURN collect(skill.name) AS skills  // Дубликаты если multiple paths
```

**Когда важно**: Multiple MATCH patterns могут создать duplicate rows.

---

## 8. Понимай Business Logic перед фильтрами

**Правило**: Перед добавлением фильтра (WHERE) понимай бизнес-требования.

**Типовая ошибка**: Добавить `currentContextId` filter, который ломает search modes.

**✅ Правильно**:
```cypher
// Minimal base query - фильтры добавляются по необходимости
MATCH (matchedUser:User)-[:HAS_CONTEXT]->(matchedContext:Context)
// Фильтр добавляется только если search mode требует
```

**❌ Неправильно**:
```cypher
// Universal base с жестким фильтром
MATCH (matchedUser:User)-[:HAS_CONTEXT]->(matchedContext:Context {contextId: matchedUser.currentContextId})
// ❌ Breaks searchAdhoc/searchByTarget (нужны ALL contexts!)
```

**Почему**: 90% search багов = неправильный фильтр. Сначала проверь `business-logic.md` → decision tree.

---

## 9. Integer Parameters - Explicit Cast

**Правило**: Используй `toInteger($param)` для числовых параметров в LIMIT/SKIP.

**✅ Правильно**:
```cypher
LIMIT toInteger($limit)
SKIP toInteger($offset)
```

**❌ Неправильно**:
```cypher
LIMIT $limit  // ❌ JS number → Neo4j Float → Type mismatch error
```

**Почему**: `disableLosslessIntegers` работает только для RETURNED values, не для input.

---

## 10. UNWIND вместо FOREACH для фильтрации

**Правило**: Используй `UNWIND` если нужна фильтрация (WHERE), не `FOREACH`.

**✅ Правильно**:
```cypher
UNWIND list AS item
WITH item
WHERE item > 10
CREATE (n:Node {value: item})
```

**❌ Неправильно**:
```cypher
FOREACH (item IN list | CREATE (n:Node {value: item}))
WHERE n.value > 10  // ❌ Invalid syntax after FOREACH
```

**Почему**: FOREACH не поддерживает WHERE после себя. UNWIND + WITH дает больше гибкости.

---

## 11. Избегай Variable Naming Conflicts

**Правило**: Node variables ≠ alias variables. Используй разные имена.

**✅ Правильно**:
```cypher
WITH context, $ctx.position AS positionName
MERGE (p:Position {name: positionName})  // ✅ p ≠ positionName
```

**❌ Неправильно**:
```cypher
WITH context, $ctx.position AS position
MERGE (position:Position {name: position})  // ❌ Conflict!
```

**Почему**: Cypher не допускает redeclaration переменных в одном scope.

---

## 12. MATCH перед OPTIONAL MATCH

**Правило**: Обязательные MATCH сначала, OPTIONAL MATCH потом.

**✅ Правильно**:
```cypher
MATCH (u:User)-[:HAS_CONTEXT]->(c:Context)
OPTIONAL MATCH (c)-[:HAS_POSITION]->(p:Position)
```

**❌ Неправильно**:
```cypher
OPTIONAL MATCH (u:User)-[:HAS_CONTEXT]->(c:Context)
MATCH (c)-[:HAS_POSITION]->(p:Position)  // ❌ Если u не найден, c = null → MATCH fails
```

**Почему**: Null propagation от OPTIONAL MATCH сломает последующие обязательные MATCH.

---

## Quick Reference Checklist

Перед submit query, проверь:

- [ ] ✅ Map projection: `node { .property, computed: value }`
- [ ] ✅ WITH scope: все нужные переменные в WITH
- [ ] ✅ Null safety: `coalesce($array, [])`
- [ ] ✅ Bounded patterns: `*0..N` (не `*`)
- [ ] ✅ Parameters: `$param` (не literals)
- [ ] ✅ Index hints: только если PROFILE показывает нужно
- [ ] ✅ DISTINCT: в aggregations где нужны unique values
- [ ] ✅ Business logic: проверил фильтры в `business-logic.md`
- [ ] ✅ Integer params: `toInteger($limit)` для LIMIT/SKIP
- [ ] ✅ UNWIND: используй вместо FOREACH если нужен WHERE
- [ ] ✅ Variable names: нет конфликтов (node ≠ alias)
- [ ] ✅ MATCH order: обязательные MATCH перед OPTIONAL MATCH

---

## Когда обновлять

- ✅ Найден новый Neo4j best practice (универсальный)
- ✅ Исправлен WayMates баг → адаптируй урок в checklist-style
- ✅ `/reflect cypher` предложил добавить правило
- ❌ НЕ добавляй WayMates naming rules (они в conventions.md)
- ❌ НЕ дублируй bug tracking (он в bugs-registry.md)
