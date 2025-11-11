# Breaking Changes History

## 2025-11-10: Cypher Variable Naming
**Commits**: 9a6179a, b6e362a, 7ac20d8
**What**: Renamed all Cypher variables to canonical names (c→context, u→user, p→position, wd→workDomain, s→skill, i→industry, ci→city, co→country)

**Impact**:
- Query builders (8 files)
- Integration tests (search queries)

**Symptoms**:
- "Variable already declared" errors
- Wrong data returned from queries
- Query returns empty results

**Fix**:
1. Use canonical names everywhere
2. Use InPath suffix for trajectory variables (contextInPath, positionInPath) when sharing scope with matched context
3. Short names (p, i, wd, s) in write queries to avoid parameter alias conflicts

**Commits**: 9a6179a, b6e362a, 7ac20d8

**Root cause**: Variable conflict in nested scopes (trajectory vs matched context)

**См. Memory MCP**: `QueryBuilderRefactoring_Nov10`, `CypherNamingConflict_TargetQueryBuilder`

---

## 2025-11-10: Neo4j LIMIT Type
**Commit**: 9a6179a
**What**: disableLosslessIntegers НЕ работает для input parameters

**Impact**:
- All queries with LIMIT clause
- JavaScript number → Neo4j Float error

**Symptoms**:
- Neo4jError: Type mismatch (expected Integer, got Float)

**Fix**:
Use `toInteger()` cast in Cypher:
```cypher
// ✅ CORRECT
LIMIT toInteger($limit)

// ❌ WRONG
LIMIT $limit
```

**Commit**: 9a6179a

**Root cause**: disableLosslessIntegers only affects RETURNED values, not input parameters

**См. Memory MCP**: `Neo4j 5 GQL Parameter Handling`

---

## 2025-11-10: Adhoc Search Query Pattern
**Commit**: 9a6179a
**What**: Adhoc search incorrectly searched only user.currentContextId (latest context)

**Impact**:
- adhoc search returned incomplete results
- Missing historical contexts

**Symptoms**:
- Search returns fewer candidates than expected
- Old contexts not found

**Fix**:
```cypher
// ✅ CORRECT - Search ALL contexts
MATCH (user:User)-[:HAS_CONTEXT]->(context:Context)

// ❌ WRONG - Only current context
MATCH (user:User)-[:HAS_CONTEXT]->(context:Context {contextId: user.currentContextId})
```

**Commit**: 9a6179a

**Root cause**: Incorrect business logic assumption

**См. Memory MCP**: `Adhoc Search Query Pattern`

---

## 2025-11-08: camelCase Migration
**Commits**: 7ac20d8, f5eb17c
**What**: All TypeScript + database properties snake_case → camelCase

**Impact**:
- All schemas (80+ properties)
- Query builders (8 files)
- Database constraints (13) + indexes (13)
- Test data (U1-U13)

**Symptoms**:
- Property undefined errors
- Zod validation errors
- Neo4j query errors

**Fix**:
Consistent camelCase everywhere:
- `user_id` → `userId`
- `context_id` → `contextId`
- `created_at` → `createdAt`
- `creation_reason` → `creationReason`
- `previous_context_id` → `previousContextId`
- `next_context_id` → `nextContextId`
- Plus 70+ more mappings

**Commit**: 7ac20d8

**Root cause**: Inconsistency across TypeScript, API, Database layers

**См. Memory MCP**: `ESLint Strict Migration 2025-11-10`

---

## 2025-11-07: TargetCriteria Discriminated Union
**Commit**: f5eb17c
**What**: Migrated TargetCriteria to discriminated union pattern with FieldFilter

**Impact**:
- Goals API: `CreateGoalInput.targetContextId` → `CreateGoalInput.targetCriteria`
- TargetSearchFilters API: `{desired: {}, undesired: {}}` → `{mode, values}`

**Symptoms**:
- Type errors on Goals API
- Search not working with old filter format

**Fix**:
Use new FieldFilter pattern:
```typescript
// NEW API
{
  mode: 'include' | 'exclude' | 'any',
  values: string[]  // min 1 value
}

// OLD API (deprecated)
{
  desired: { position: ['Developer'] },
  undesired: { industry: ['Finance'] }
}
```

**Commit**: f5eb17c

**Root cause**: Need flexible filtering (singular vs collected fields)

**См. Memory MCP**: `Empty_Array_Validation_Decision`

---

## 2025-11-09: DTW Metrics camelCase
**Commit**: b6e362a
**What**: DTWMetrics schema properties snake_case → camelCase

**Impact**:
- DTW response format changed
- Frontend/API consumers need update

**Symptoms**:
- undefined properties in DTW response

**Fix**:
```typescript
// NEW
{
  shapeSimilarity: 0.85,
  tempoSimilarity: 0.72,
  stabilityScore: 0.90
}

// OLD (deprecated)
{
  shape_similarity: 0.85,
  tempo_similarity: 0.72,
  stability_score: 0.90
}
```

**Commit**: b6e362a

**Root cause**: Naming convention migration

**См. Memory MCP**: `DTW Trajectory Similarity Implementation`

---

*Add new breaking changes at the top (reverse chronological order)*
