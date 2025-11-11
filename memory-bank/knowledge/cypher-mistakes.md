# Cypher Mistakes (Типовые ошибки)

## 1. disableLosslessIntegers НЕ помогает для input parameters

**Ошибка**:
```cypher
// JavaScript
const params = { limit: 10 };  // number → Neo4j Float
// Cypher
LIMIT $limit  // ❌ Neo4jError: Type mismatch (expected Integer, got Float)
```

**Правильно**:
```cypher
LIMIT toInteger($limit)  // ✅ Explicit cast
```

**Урок**: `disableLosslessIntegers` работает только для RETURNED values, не для input.

**См. Memory MCP**: `Neo4j 5 GQL Parameter Handling`

---

## 2. Variable scope теряется после WITH

**Ошибка**:
```cypher
WITH $context AS ctx
MERGE (c:Context {contextId: $context.contextId})  // ❌ $context undefined
```

**Правильно**:
```cypher
WITH $context AS ctx
MERGE (c:Context {contextId: ctx.contextId})  // ✅ Use aliased variable

// OR carry all variables explicitly
WITH u, c, newVar
MATCH (c)-[:HAS_POSITION]->(p)  // ✅ u, c still in scope
```

**Урок**: Neo4j drops ALL variables не listed в WITH. Используй `WITH *, newVar` или list explicitly.

---

## 3. Reserved keywords ("context")

**Ошибка**:
```cypher
WITH $context AS context  // ❌ "context" might be reserved in Neo4j 5
```

**Правильно**:
```cypher
WITH $context AS ctx  // ✅ Avoid potential reserved words
```

**Урок**: Если параметр называется как ключевое слово, лучше переименовать.

---

## 4. WHERE после FOREACH (syntax error)

**Ошибка**:
```cypher
FOREACH (item IN list | CREATE (n:Node {value: item}))
WHERE n.value > 10  // ❌ Invalid input 'WHERE' after FOREACH
```

**Правильно**:
```cypher
UNWIND list AS item
WITH item
WHERE item > 10
CREATE (n:Node {value: item})  // ✅ Use UNWIND instead of FOREACH
```

**Урок**: WHERE не может следовать сразу после FOREACH. Используй UNWIND + WITH для фильтрации.

---

## 5. Variable naming conflicts в nested scopes

**Ошибка**:
```cypher
WITH context, $ctx.position AS position
MERGE (position:Position {name: position})
// ❌ Variable 'position' already declared
```

**Правильно**:
```cypher
WITH context, $ctx.position AS position
MERGE (p:Position {name: position})
// ✅ Use short node name 'p' instead of 'position'
```

**Урок**: Избегай конфликтов имён: node variables ≠ alias variables. Используй короткие имена для nodes (p, i, wd) или суффиксы (positionInPath).

**См. Memory MCP**: `Cypher Variable Naming Conflicts`

---

## 6. OPTIONAL MATCH до MATCH (порядок важен)

**Ошибка**:
```cypher
OPTIONAL MATCH (u:User)-[:HAS_CONTEXT]->(c:Context)
MATCH (c)-[:HAS_POSITION]->(p:Position)
// ❌ Если u не найден, c будет null, MATCH провалится
```

**Правильно**:
```cypher
MATCH (u:User)-[:HAS_CONTEXT]->(c:Context)
OPTIONAL MATCH (c)-[:HAS_POSITION]->(p:Position)
// ✅ Сначала MATCH обязательное, потом OPTIONAL
```

**Урок**: MATCH сначала, OPTIONAL MATCH потом. Иначе null propagation сломает query.

---

## 7. Null arrays в ANY/ALL predicates

**Ошибка**:
```cypher
WHERE ANY(d IN $domains WHERE d IN c.domains)
// ❌ Crashes if $domains is null
```

**Правильно**:
```cypher
WHERE ANY(d IN coalesce($domains, []) WHERE d IN c.domains)
// ✅ coalesce provides default empty array
```

**Урок**: ALWAYS use coalesce() для array parameters перед ANY/ALL/NONE predicates.

**См. Memory MCP**: `Cypher_Null_Safety_Pattern`

---

## 8. Unbounded variable-length patterns

**Ошибка**:
```cypher
MATCH path = (c)-[:PREVIOUS_CONTEXT*]->(start)
// ❌ Can explode (traverse entire graph!)
```

**Правильно**:
```cypher
MATCH path = (c)-[:PREVIOUS_CONTEXT*0..20]->(start)
// ✅ Bounded upper limit prevents explosion
```

**Урок**: ALWAYS set upper bounds для variable-length patterns (`*0..N`). Unbounded patterns опасны в production.

---

## 9. Using literals instead of parameters

**Ошибка**:
```cypher
MATCH (u:User {userId: "12345"})
// ❌ No query plan caching, potential injection risk
```

**Правильно**:
```cypher
MATCH (u:User {userId: $userId})
// ✅ Parameterized, query plan cached
```

**Урок**: Используй parameters ($param) вместо literals. Лучше performance (plan caching) и безопаснее.

---

*Добавляй новые ошибки по мере открытия!*
