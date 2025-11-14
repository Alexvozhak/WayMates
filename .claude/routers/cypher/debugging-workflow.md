# Cypher Debugging Workflow - Краткий гайд

**Назначение**: Краткий overview процесса отладки + quick reference
**Когда загружать**: Начало отладки, нужен quick reference
**Полный гайд**: [docs/cypher_debugging_guide.md](../../../docs/cypher_debugging_guide.md) (453 строки, детальный step-by-step)

---

## 5 Фаз Debugging

### Phase 1: Understand WHAT (Business Logic)
- Загрузи `business-logic.md` → mapping table
- Прочитай `docs/search_modes_business_logic.md` → понять WHAT query должен делать
- Проверь фильтры: нужен ли currentContextId? userId?

### Phase 2: Verify Data
- Запусти query через MCP `mcp__neo4j-cypher__read_neo4j_cypher`
- Проверь реальные данные: есть ли в DB то, что ищешь?
- Проверь параметры: правильные значения? Null?

### Phase 3: Test Query via MCP
- Тестируй query напрямую через neo4j-cypher MCP
- Добавляй RETURN statements постепенно (проверяй каждый шаг)
- Используй `LIMIT 1` для быстрой проверки

### Phase 4: Check Cypher Rules
- Загрузи `cypher-rules.md` → checklist
- Проверь: WITH scope? Null safety? Bounded patterns?
- Проверь `conventions.md` → canonical naming правильный?

### Phase 5: PROFILE (Performance)
- Запусти `PROFILE query` через MCP
- Проверь: есть ли `NodeByLabelScan` вместо `NodeIndexSeek`?
- Добавь index hints если нужно

---

## Quick Reference: MCP Commands

### Get Schema
```typescript
mcp__neo4j-cypher__get_neo4j_schema({ sample_size: 1000 })
```

### Test Query (Read)
```typescript
mcp__neo4j-cypher__read_neo4j_cypher({
  query: "MATCH (u:User) WHERE u.user_id = $userId RETURN u LIMIT 1",
  params: { userId: "test-user-1" }
})
```

### Profile Query (Performance)
```typescript
mcp__neo4j-cypher__read_neo4j_cypher({
  query: "PROFILE MATCH (u:User) WHERE u.user_id = $userId RETURN u",
  params: { userId: "test-user-1" }
})
```

### Write Query (Use Carefully!)
```typescript
mcp__neo4j-cypher__write_neo4j_cypher({
  query: "CREATE (u:User {user_id: $userId})",
  params: { userId: "test-user-new" }
})
```

---

## Delegation Rules

### ✅ Делегируй cypher-expert если:
- Unknown error (не в cypher-rules.md)
- Нужен PROFILE analysis
- Сложная оптимизация
- Schema changes

### ⚠️ Фикси сам если:
- Known pattern в cypher-rules.md
- Простой фильтр (currentContextId)
- Null safety (coalesce)
- WITH scope ошибка

---

## Когда обновлять

- ✅ Изменился debugging процесс (5 фаз)
- ✅ Новая MCP команда стала полезной
- ✅ Изменились правила делегирования
- ❌ НЕ дублируй полный гайд (он в docs/cypher_debugging_guide.md)
