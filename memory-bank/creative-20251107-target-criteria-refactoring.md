# Creative: TargetCriteria Refactoring - 2025-11-07

## Decision

Migrate TargetCriteria API from nested `{desired, undesired}` structure to **discriminated union pattern** with `{mode, values}`.

## Context

**Problem**: Current TargetCriteria has 3-level nesting with 10 parameters:
```typescript
{
  position?: string,
  desired?: {
    countries?: string[],
    domains?: string[],
    skills?: string[]
  },
  undesired?: {
    countries?: string[],
    domains?: string[],
    skills?: string[]
  }
}
```

**Issues**:
- Parameter explosion (10 params to Cypher)
- Mutual exclusivity not enforced (can have both desired + undesired)
- Complex parameter extraction in SearchManager
- Ambiguous empty array semantics (`[]` = "show all" or "show none"?)

## Solution: Discriminated Union + Snippet Functions

### New Schema
```typescript
// shared/schemas.ts (domain primitive)
export const FilterModeSchema = z.enum(["desired", "undesired"]);
export const FieldFilterSchema = z.object({
  mode: FilterModeSchema,  // Discriminator
  values: z.array(z.string().min(1).trim()).min(1).max(5)
});

export const TargetContextSchema = z.object({
  position: FieldFilterSchema.optional(),
  countries: FieldFilterSchema.optional(),
  domains: FieldFilterSchema.optional(),
  skills: FieldFilterSchema.optional(),
});
```

### Benefits
1. **Type Safety**: Discriminated union enforces mutual exclusivity at compile time
2. **Simplicity**: 6 parameters instead of 10
3. **Validation**: Empty arrays forbidden (`.min(1)`), whitespace trimmed
4. **Reusability**: FieldFilter as domain primitive (Shared layer)
5. **Clarity**: Single mode per field, explicit intent

### Cypher Implementation: Snippet Functions

Two reusable snippet generators for DRY Cypher:

```typescript
// Singular fields (position, country) - 1:1 relationship
function buildSingularFieldCase(paramName: string, cypherVar: string): string {
  return `
    CASE
      WHEN ${paramName} IS NULL THEN true
      WHEN ${paramName}.mode = 'desired' THEN ${cypherVar}.name IN ${paramName}.values
      WHEN ${paramName}.mode = 'undesired' THEN NOT ${cypherVar}.name IN ${paramName}.values
      ELSE true
    END
  `;
}

// Collected fields (domains, skills) - 1:N relationship
function buildCollectedFieldCase(paramName: string, arrayVar: string): string {
  return `
    CASE
      WHEN ${paramName} IS NULL THEN true
      WHEN ${paramName}.mode = 'desired' THEN ANY(item IN ${arrayVar} WHERE item IN ${paramName}.values)
      WHEN ${paramName}.mode = 'undesired' THEN NONE(item IN ${arrayVar} WHERE item IN ${paramName}.values)
      ELSE true
    END
  `;
}
```

**Why two types?**
- **Singular**: Match scalar node property (`p.name IN [...]`)
- **Collected**: Match array from collect(DISTINCT) (`ANY(item IN array WHERE ...)`)

## Critical Implementation Details

### 1. Null Safety (Mandatory!)
```cypher
-- ❌ WRONG: Property access on null → runtime error
CASE $param.mode WHEN 'desired' THEN ...

-- ✅ CORRECT: Null check first
CASE
  WHEN $param IS NULL THEN true  -- Must precede .mode access
  WHEN $param.mode = 'desired' THEN ...
```

**Validated via MCP**: Tested against neo4j-test DB (bolt://localhost:7689)

### 2. Empty Array Handling
```typescript
// ❌ WRONG: Ambiguous semantics
values: []  // "show all" or "show none"? Cypher IN [] → false

// ✅ CORRECT: Forbid in schema
values: z.array(...).min(1)  // Use undefined for "no filter"
```

**Rationale**: Cypher `p.name IN []` → `false` (0 results), contradicts "show all" intent.

### 3. Goals System Integration
Goals now store target criteria as single property:

```cypher
-- Before
MERGE (g:Goal)
SET g.desired = $desired,
    g.undesired = $undesired

-- After
MERGE (g:Goal)
SET g.target_criteria = $target_criteria  -- Single map property
```

**TypeScript**:
```typescript
// Before
setGoal({ userId, targetContextId })

// After
setGoal({ userId, targetCriteria: TargetContext })
```

## Agent Review Process

### 1. Planner Agent
**Found 5 critical issues**:
- Empty arrays ambiguity → Fixed: `.min(1)` validation
- FieldFilter location → Fixed: Moved to Shared
- TargetContext mismatch → Fixed: Unified schemas
- Position multi-value → Approved with `.max(5)` limit
- Snippet separation → Approved (explicit > clever)

### 2. Reviewer Agent
**Found 3 critical bugs**:
- Null parameter handling → Fixed: `WHEN $param IS NULL`
- Empty array semantics → Fixed: Schema forbids
- Whitespace in values → Fixed: `.trim()` validation

### 3. Cypher Testing (MCP neo4j-cypher)
**6 test cases validated**:
1. Null parameter (safe) ✅
2. Empty array behavior ✅
3. Singular field desired ✅
4. Singular field undesired ✅
5. Collected field ANY (desired) ✅
6. Collected field NONE (undesired) ✅

## Type Schema (Complete)

```typescript
// === DOMAIN PRIMITIVES (shared/schemas.ts) ===
export type FilterMode = "desired" | "undesired";
export type FieldFilter = { mode: FilterMode; values: string[] };
export type TargetContext = {
  position?: FieldFilter;
  countries?: FieldFilter;
  domains?: FieldFilter;
  skills?: FieldFilter;
};

// === GOALS SCHEMAS (shared/schemas.ts) ===
export type Goal = {
  goal_id: GoalId;
  user_id: UserId;
  target_criteria: TargetContext;  // Changed from target_context_id
  created_at: string;
};

export type CreateGoalInput = {
  userId: UserId;
  targetCriteria: TargetContext;  // Changed from targetContextId
};

// === SEARCH FILTERS (core/schemas.ts) ===
export type TargetSearchFilters = SearchFilters & {
  criteria: TargetContext;  // Uses FieldFilter pattern
};
```

## Breaking Changes

### API Changes
1. **TargetSearchFilters**: `{desired, undesired}` → `{mode, values}`
2. **CreateGoalInput**: `targetContextId` → `targetCriteria: TargetContext`
3. **Goal node**: `g.desired, g.undesired` → `g.target_criteria`

### Migration Path
```typescript
// Before
const filters = {
  desired: { countries: ["US"], skills: ["backend"] },
  undesired: { skills: ["frontend"] }
};

// After
const filters = {
  countries: { mode: "desired", values: ["US"] },
  skills: { mode: "desired", values: ["backend"] }
  // Note: Cannot have both desired AND undesired for same field (mutual exclusivity)
};
```

### Database Migration
```cypher
// Migrate existing Goal nodes (if any)
MATCH (g:Goal)
WHERE g.desired IS NOT NULL OR g.undesired IS NOT NULL
WITH g,
     CASE
       WHEN g.desired IS NOT NULL THEN { mode: 'desired', values: ... }
       WHEN g.undesired IS NOT NULL THEN { mode: 'undesired', values: ... }
       ELSE null
     END AS target_criteria
SET g.target_criteria = target_criteria
REMOVE g.desired, g.undesired
```

## Implementation Notes

### Query Builder Pattern 1
```typescript
// Returns string only, parameters built separately
export function buildTargetSearchWithPathsQuery(params: TargetOnlySearchParams): string {
  // ...build query using snippets...
}

// Usage in SearchManager
const query = buildTargetSearchWithPathsQuery(params);
const queryParams = {
  userId,
  position: criteria?.position,
  countries: criteria?.countries,
  // ... (6 params instead of 10)
};
const result = await tx.run(query, queryParams);
```

**Why Pattern 1?**
- Separation of concerns (structure vs data)
- Easier testing (query is pure string)
- No parameter name conflicts

### Files Modified (7)
1. `src/shared/schemas.ts` - FieldFilter, TargetContext, Goals
2. `src/core/schemas.ts` - Import from Shared
3. `src/core/target-query-builder.ts` - Snippets + refactor
4. `src/core/search-manager.ts` - Updated params
5. `src/core/goals-manager.ts` - targetCriteria
6. `src/core/goals-query-builder.ts` - target_criteria
7. `docs/architecture/TARGET_CRITERIA_REFACTORING_PLAN.md` - Plan + reviews

## Lessons Learned

1. **Agent reviews catch what you miss**: 8 critical issues found by planner + reviewer
2. **MCP Cypher testing is essential**: Null safety bug caught before runtime
3. **Empty arrays are dangerous**: Ambiguous semantics, forbid in schema
4. **Discriminated unions > nested objects**: Type safety + simplicity
5. **Domain primitives belong in Shared**: FieldFilter reusable by Facade + Core
6. **Snippet functions need JSDoc**: Explain singular vs collected patterns

## Next Steps

1. Update facade/goal-mapper.ts for new API
2. Write integration tests for FieldFilter
3. Database migration script (if Goals exist)
4. Update API documentation
5. Consider versioning for breaking change

## References

- Commit: `5ba3014` (refactoring)
- Plan: `docs/architecture/TARGET_CRITERIA_REFACTORING_PLAN.md`
- MCP tests: neo4j-test DB (bolt://localhost:7689)
- Agent reviews: Planner (5 issues) + Reviewer (3 bugs)

---

**Status**: ✅ COMPLETED & COMMITTED
**Duration**: ~1.5 hours (planning + implementation + validation)
**Quality**: ESLint ✅, TypeScript ✅, Cypher ✅, Agents ✅
