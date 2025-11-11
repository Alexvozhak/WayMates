# Cypher Conventions

## Checklist (перед code review)

Перед отправкой Cypher query на review, проверь:

- [ ] ✅ **Map projection** используется (`.property` syntax)
- [ ] ✅ **Canonical variable names** (context, user, position, workDomain, skill, industry, city, country)
- [ ] ✅ **Null safety** с `coalesce()` для всех array операций
- [ ] ✅ **WITH clause scope** корректен (explicit carry-over)
- [ ] ✅ **Variable-length patterns** имеют upper bounds (`*0..20`)
- [ ] ✅ **Parameters** используются (не literals)
- [ ] ✅ **TESTED** via MCP neo4j-cypher (если возможно)

---

## 1. Map Projection (MANDATORY)

**ALWAYS** используй `.property` syntax:

```cypher
// ✅ CORRECT
RETURN c {
  .contextId,
  .createdAt,
  position: p.name,
  skills: collect(DISTINCT s.name)
} AS matchedContext

// ❌ WRONG - Manual enumeration
RETURN {
  contextId: c.contextId,
  createdAt: c.createdAt,
  position: p.name
} AS matchedContext
```

---

## 2. Canonical Variable Names

| Entity | Variable Name | OLD (deprecated) |
|--------|---------------|------------------|
| Context | `context` | c, ctx |
| User | `user` | u |
| Position | `position` | p |
| WorkDomain | `workDomain` | wd |
| Skill | `skill` | s |
| Industry | `industry` | i |
| City | `city` | ci |
| Country | `country` | co |

**Exception**: Trajectory variables используют `InPath` suffix (contextInPath, positionInPath) когда sharing scope с matched context.

---

## 3. Null Safety

**ALWAYS** используй `coalesce()` для arrays в predicates:

```cypher
// ✅ CORRECT
WHERE ANY(d IN coalesce($domains, []) WHERE d IN c.domains)

// ❌ WRONG - Crashes if $domains is null
WHERE ANY(d IN $domains WHERE d IN c.domains)
```

---

## 4. WITH Clause Scope

Neo4j drops ALL variables не listed в WITH:

```cypher
// ✅ Keep all variables
WITH *, u.userId AS uid

// ✅ Explicit carry-over
WITH u, c, newVar

// ❌ WRONG - drops 'u'
WITH u.userId AS uid
RETURN u  // Error!
```

---

## 5. Bounded Patterns

**ALWAYS** set upper bounds для variable-length patterns:

```cypher
// ✅ CORRECT
MATCH path = (c)-[:PREVIOUS_CONTEXT*0..20]->(start)

// ❌ WRONG - Can explode!
MATCH path = (c)-[:PREVIOUS_CONTEXT*]->(start)
```

---

## Паттерны

См. Memory MCP для деталей:
- `Cypher_Null_Safety_Pattern` - CASE WHEN $param IS NULL guard
- `OPTIONAL_MATCH_CONTEXT_RELATIONSHIPS_Constant` - DRY для relationship блоков

См. также:
- [knowledge/cypher-mistakes.md](../knowledge/cypher-mistakes.md) - Типовые ошибки
- [.claude/agents/cypher-expert.md](../../.claude/agents/cypher-expert.md) - Полный reference

---

*Last updated: 2025-11-11*
