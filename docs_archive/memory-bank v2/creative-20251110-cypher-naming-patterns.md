# Cypher Variable Naming Patterns

**Date**: 2025-11-10
**Type**: Architectural Decision
**Status**: ✅ Implemented
**Scope**: Query Builders (Cypher)

---

## Context

Query builders в проекте используют inline Cypher queries с дублированием OPTIONAL MATCH блоков (~24 строки дублирования). Также использовались inconsistent variable names (c, ctx, tp, twd, ctx_domains).

**Problem**: Maintenance burden + readability issues.

---

## Decision

### 1. Canonical Variable Naming

**Rule**: Всегда использовать полные имена, без сокращений.

**Стандартные имена**:
```cypher
// Nodes
context:Context
user:User
position:Position
workDomain:WorkDomain
skill:Skill
industry:Industry
city:City
country:Country

// Collected arrays
domains (from workDomain.name)
skills (from skill.name)
```

**Reasoning**: Читаемость > краткость. Cypher queries читаются как documentation.

---

### 2. InPath Suffix Pattern (Naming Conflict Resolution)

**Problem**: В trajectory queries переменные из matched context (context, position, domains) конфликтуют с переменными из path elements.

**Solution**: Добавить `InPath` suffix для trajectory variables.

**Example**:
```cypher
// Matched context (current context кандидата)
MATCH (user:User)-[:HAS_CONTEXT]->(context:Context {contextId: user.currentContextId})
OPTIONAL MATCH (context)-[:HAS_POSITION]->(position:Position)
WITH user, context, position, domains, skills, ...

// Trajectory (path elements)
MATCH path = (context)<-[:PREVIOUS_CONTEXT*0..]-(start:Context)
UNWIND pathNodes AS contextInPath  // ← InPath suffix

OPTIONAL MATCH (contextInPath)-[:HAS_POSITION]->(positionInPath:Position)
OPTIONAL MATCH (contextInPath)-[:IN_WORK_DOMAIN]->(workDomainInPath:WorkDomain)
WITH user, context, position, domains, skills,  // matched (original)
     contextInPath, positionInPath, domainsInPath, skillsInPath  // trajectory
```

**When to use**:
- ✅ When trajectory and matched context variables share WITH scope
- ❌ When contexts are in separate query fragments

**Alternatives considered**:
1. `matchedContext`/`trajContext` - rejected (too verbose, matched is implicit)
2. Prefixes `tp`, `twd` - rejected (hard to read, inconsistent with canonical names)

---

### 3. OPTIONAL_MATCH_CONTEXT_RELATIONSHIPS Constant

**Location**: `src/orcestrator/cypher-snippets.ts`

**Content**:
```typescript
export const OPTIONAL_MATCH_CONTEXT_RELATIONSHIPS = `
OPTIONAL MATCH (context)-[:HAS_POSITION]->(position:Position)
OPTIONAL MATCH (context)-[:IN_WORK_DOMAIN]->(workDomain:WorkDomain)
OPTIONAL MATCH (context)-[:USES_SKILL]->(skill:Skill)
OPTIONAL MATCH (context)-[:IN_INDUSTRY]->(industry:Industry)
OPTIONAL MATCH (context)-[:IN_CITY]->(city:City)
OPTIONAL MATCH (context)-[:IN_COUNTRY]->(country:Country)
`.trim();
```

**Usage**:
```typescript
export function buildPathQuery(): string {
  return `
    MATCH (user:User {userId: $userId})
    ${OPTIONAL_MATCH_CONTEXT_RELATIONSHIPS}
    WITH context, position, workDomain, skill, ...
  `;
}
```

**Applied in**:
- `src/core/path-query-builder.ts` (1 occurrence)
- `src/core/search-query-builder.ts` (2 occurrences)

**NOT applicable in**:
- `src/core/target-query-builder.ts` - uses `contextInPath/positionInPath`
- `src/core/persistence-query-builder.ts` - has additional `[:IN_CATEGORY]` relationships

**Code savings**: ~18 lines removed, 1 constant added (7 lines), **net -11 lines**

---

## Consequences

### Positive
✅ **Readability**: Full variable names self-document queries
✅ **Maintainability**: Single source of truth for OPTIONAL MATCH
✅ **Consistency**: Clear naming pattern across all query builders
✅ **Conflict resolution**: InPath suffix pattern prevents variable shadowing

### Negative
⚠️ **Constant not universal**: Only 2 out of 4 query builders can use it
⚠️ **Verbosity**: Longer variable names (but acceptable trade-off)

### Neutral
➖ **Breaking change**: Internal only (no API changes)
➖ **No tests impact**: Validation passed (ESLint 0 errors, TypeScript 0 errors)

---

## Implementation

**Files modified**: 10 (1 created, 9 updated)

**PHASE 1: Mass rename** (8 files)
- c→context, u→user, p→position, wd→workDomain, s→skill, i→industry, ci→city, co→country

**PHASE 2: Create constant**
- `src/orcestrator/cypher-snippets.ts` - new file

**PHASE 3: Apply constant**
- `src/core/path-query-builder.ts` - replaced 6 lines
- `src/core/search-query-builder.ts` - replaced 12 lines (2 places)

**PHASE 4: Fix conflicts**
- `src/core/target-query-builder.ts` - added InPath suffix

**Validation**: ESLint 0 errors, TypeScript 0 new errors

---

## Future Work

1. **Document in project docs** - Add Cypher naming conventions to `.claude/context/project.md`
2. **Audit other patterns** - Check for other duplicated Cypher snippets
3. **Lint rule** (optional) - Enforce naming conventions programmatically

---

## Related

- **Naming Convention Migration** (2025-11-08) - camelCase для TypeScript/DB properties
- **Query Builder Pattern** (2025-11-06) - Pattern 1 (return string only)
- **Target Criteria Refactoring** (2025-11-07) - Discriminated union pattern

---

*Архитектурное решение одобрено через практическую реализацию и code review.*
