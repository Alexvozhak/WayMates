# Cypher Router - Точка входа в Cypher-контекст

**Назначение**: Навигация по Cypher-контексту
**Когда загружать**: Всегда при работе с Cypher queries, при неуверенности куда идти, нужен overview

---

## Таблица роутинга

| Задача | Загрузить автоматически | Загрузить по требованию | Делегировать агенту? |
|--------|-------------------------|------------------------|---------------------|
| **Новый query** | cypher-rules.md<br>conventions.md<br>business-logic.md | - | ✅ **cypher-expert** (всегда) |
| **Фикс бага** | cypher-rules.md<br>debugging-workflow.md | business-logic.md<br>conventions.md | ⚠️ Сначала проверь cypher-rules → known pattern → фикси сам,<br>потом **cypher-expert** (если unknown) |
| **Рефакторинг** | cypher-rules.md<br>conventions.md | business-logic.md | ⚠️ Сам (если простое DRY/naming),<br>✅ **cypher-expert** (если сложная логика) |
| **Оптимизация<br>(PROFILE)** | debugging-workflow.md | cypher-rules.md<br>conventions.md | ✅ **cypher-expert** (всегда - нужен MCP access) |
| **Code review** | cypher-rules.md<br>conventions.md | business-logic.md | ❌ **reviewer** агент (НЕ cypher-expert!) |

---

## FAQ: Типовые проблемы

### Q1: Query возвращает 0 results - проверь фильтры
**Загрузи**:
- `cypher-rules.md` → #8 (Business Logic перед фильтрами)
- `business-logic.md` → mapping table (какие фильтры должны быть?)

**Типовые причины**:
- Лишний фильтр currentContextId (90% search багов!)
- Забыл параметр в WHERE
- Неправильное понимание бизнес-логики (какие данные искать)

---

### Q2: Как назвать переменную - canonical naming
**Загрузи**: `conventions.md` → Canonical naming pattern

**Правило**: `[owner][pathModifier?][property]`

**Когда применять**:
- Есть несколько контекстов в query (left/right, searching/matched)
- Нужно различать контексты пользователя и кандидата
- Работа с path contexts (траектории)

---

### Q3: WITH clause - переменная undefined после WITH
**Загрузи**: `cypher-rules.md` → #2 (WITH Clause Scope)

**Правило**: WITH создает новый scope. Только переменные в WITH доступны дальше.

**❌ Ошибка**:
```cypher
MATCH (u:User)
WITH u.user_id AS uid
RETURN u.name  // ❌ u undefined!
```

**✅ Правильно**:
```cypher
MATCH (u:User)
WITH u, u.user_id AS uid
RETURN u.name  // ✅ u в WITH, доступен
```

---

### Q4: Когда нужен USING INDEX hint?
**Загрузи**: `cypher-rules.md` → #6 (Index Hints)

**Правило**: Только если PROFILE показывает full scan + index exists.

**Workflow**:
1. Запусти query через MCP `mcp__neo4j-cypher__read_neo4j_cypher`
2. Запусти `PROFILE query` через MCP
3. Проверь вывод: есть ли `NodeByLabelScan` вместо `NodeIndexSeek`?
4. Если да → добавь `USING INDEX node:Label(property)`

---

### Q5: Map projection syntax error
**Загрузи**: `cypher-rules.md` → #1 (Map Projection CRITICAL)

**Правило**: ✅ `.property` для node properties, без точки для computed.

**✅ Правильно**:
```cypher
RETURN node {
  .property1,            // node property
  .property2,            // node property
  computed: other.field, // computed (другой node)
  aggregated: collect(x) // computed (aggregation)
} AS result
```

**❌ Ошибка**:
```cypher
RETURN node {
  property: node.property,  // ❌ verbose
  computed: .computed       // ❌ нет такого node property
}
```

---

### Q6: Array параметр может быть null - ошибка в aggregation
**Загрузи**: `cypher-rules.md` → #3 (Null Safety)

**Правило**: Всегда `coalesce($array, [])` для параметров-массивов.

**❌ Ошибка**:
```cypher
WHERE ANY(item IN $arrayParam WHERE condition)  // ❌ если $arrayParam = null → error
```

**✅ Правильно**:
```cypher
WHERE ANY(item IN coalesce($arrayParam, []) WHERE condition)
```

---

### Q7: Unbounded pattern - query висит или медленный
**Загрузи**: `cypher-rules.md` → #4 (Bounded Patterns)

**Правило**: НИКОГДА не используй `*` без ограничения. Всегда `*0..N`.

**❌ Ошибка**:
```cypher
MATCH path = (start)-[*]->(end)  // ❌ может пойти по всему графу!
```

**✅ Правильно**:
```cypher
MATCH path = (start)-[*0..5]->(end)  // ✅ максимум 5 hops
```

---

### Q8: Zod validation fails - "Expected string, received null"
**Правило**: Use `.nullish()` for optional Neo4j properties (Neo4j returns `null`, not `undefined`)

**❌ Ошибка**:
```typescript
feedback: z.string().max(200).nullable().optional()  // ❌ redundant
```

**✅ Правильно**:
```typescript
feedback: z.string().max(200).nullish()  // ✅ accepts both null and undefined
```

---

## Описания документов

### cypher-rules.md (280+ строк)
Универсальные Neo4j правила + адаптированные уроки из исправленных WayMates багов. Checklist-style с примерами ✅/❌.
**Содержит**: Map projection, WITH scope, null safety, bounded patterns, параметры, index hints, DISTINCT, business logic фильтры, integer cast, UNWIND vs FOREACH, variable conflicts, MATCH order.
**Когда**: Новый query, рефакторинг, code review, фикс бага.

### conventions.md (100-120 строк)
WayMates-specific naming conventions: canonical pattern `[owner][pathModifier?][property]`, таблица переменных (searchingContext, matchedContext, searchingPathContext, matchedPathContext), примеры использования, анти-паттерны.
**Когда**: Новый query, рефакторинг, code review.

### business-logic.md (60+ строк)
Bridge между бизнес-задачами и Cypher: mapping table (задача→docs→query→файл) + ссылки на полную бизнес-документацию. НЕ дублирует содержимое docs/.
**Когда**: Новый query (понять WHAT), фикс бага (понять правило).

### debugging-workflow.md (30-40 строк)
Краткий workflow отладки (5 фаз) + ссылка на полный гайд (docs/cypher_debugging_guide.md), quick reference MCP commands.
**Когда**: Начало отладки, нужен quick reference.
