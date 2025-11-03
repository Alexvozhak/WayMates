# WayMates Project Context

Last updated: 2025-01-23

## Project Overview

WayMates is a career transition analysis platform built on Neo4j graph database. It helps users find career paths by matching their current context to target positions through analysis of skills, experience, and transitions of similar professionals. The system operates as an MCP (Model Context Protocol) server using FastMCP.

---

## Tech Stack

- **Database**: Neo4j (graph database) with GDS plugin
- **Query Language**: Cypher (inline template literals in TypeScript)
- **Runtime**: Node.js 20+ with TypeScript (ESM modules)
- **Validation**: Zod schemas
- **Testing**: Vitest (unit, integration)
- **MCP Framework**: FastMCP for tool-based server interface
- **ID Generation**: UUID v7 (time-ordered, RFC 9562)

---

## Architecture Patterns

### Core Components

1. **MCP Server** (`src/mcp-server.ts`)
   - Exposes tools via FastMCP
   - Tools: current_to_target, current_only, target_only
   - Persistence tools: create/update contexts, trails, user stories

2. **Search Manager** (`src/search-manager.ts`)
   - Orchestrates search operations
   - Coordinates QueryBuilder and Neo4j driver
   - Processes different search modes

3. **Persistence Manager** (`src/persistence-manager.ts`)
   - Handles data creation/updates
   - Context, Trail, User Story management

4. **Query Builder** (`src/orcestrator/search-query-builder.ts`)
   - Constructs Cypher queries
   - Uses preset configurations
   - Builds strict (WHERE) and flexible (scoring) conditions

### Query System

**Current approach**: Cypher queries written inline in TypeScript

```typescript
const query = `
  MATCH (u:User {user_id: $userId})
  RETURN u
`;
const result = await tx.run(query, { userId });
```

**NOT used**: `.cypher` files with compilation step (legacy)

**database/init.cypher**:
- Schema initialization only (constraints, indexes)
- Used by Docker containers on startup

### Preset System

Presets define common search configurations:
- Loaded dynamically from `config/current-presets.json` and `config/target-presets.json`
- Specify strict fields (WHERE filters) and flexible fields (scoring)
- Validated at runtime using Zod schemas

---

## Critical Cypher Rules

### WITH Clause Scope Management

Neo4j's `WITH` clause drops all variables not explicitly listed:

- `WITH x, y` → only x and y remain in scope
- `WITH *` → all variables remain in scope
- `WITH *, newVar` → all old variables + newVar

**Always verify variable consistency across WITH clauses in multi-step queries.**

### Canonical Variable Names

The codebase enforces strict variable naming conventions in Cypher queries:

| Stage   | Requested Context | DB Context        | Score Alias                        |
|---------|-------------------|-------------------|------------------------------------|
| Current | `requestedCurrentContext` | `dbCurrentContext` | `currentContextCompatibilityScore` |
| Target  | `requestedTargetContext`  | `dbTargetContext`  | `targetContextCompatibilityScore`  |

**Important**: These names are hardcoded in Cypher builders. Do NOT pass variable names from TypeScript.

### Null Safety

Always use `coalesce()` for array fields:

```cypher
// ✅ GOOD
WHERE ANY(skill IN coalesce(c.skills, []) WHERE skill IN $requestedSkills)

// ❌ BAD - fails on null
WHERE ANY(skill IN c.skills WHERE skill IN $requestedSkills)
```

### O(n²) Operations

Avoid `reduce()` with `NOT IN` (list scans):

```cypher
// ❌ BAD - O(n²)
reduce(count = 0, skill IN skills |
  CASE WHEN NOT skill IN matchedSkills THEN count + 1 ELSE count END)

// ✅ GOOD - O(n)
UNWIND skills AS skill
WITH skill WHERE NOT skill IN matchedSkills
RETURN count(DISTINCT skill)
```

### Cypher Map Projection

Return objects directly from Cypher instead of field mapping in TypeScript:

```cypher
// ✅ GOOD - Type conversions in Cypher
RETURN {
  reason: reason,
  avgDuration: avgDuration,
  transitionsCount: toInteger(count(*))
} AS result
```

```typescript
// ✅ Clean TypeScript - single cast
return records.map(record => record.get('result') as MyType);
```

---

## Data Format Standards

### UUID v7 Format

- **36 characters** (hex format with dashes: `01234567-89ab-cdef-0123-456789abcdef`)
- Time-ordered (RFC 9562 standard)
- Check schemas: `grep "UUID_V7_PATTERN" src/schemas-zod.ts`

### ISO Date Format

- `"2025-01-01T00:00:00Z"` (trailing Z required)
- Use `new Date().toISOString()` in TypeScript
- Calculate timestamps based on duration, not hardcoded dates

### Enum Values

- Exact match with schemas: `"startup"` not `"Startup"`
- Check schema definitions before creating test data

---

## Code Patterns

### Neo4j Query Builder Pattern

**CRITICAL**: If query uses `$paramName`, builder function should NOT have `paramName` parameter.

```typescript
// ❌ BAD
function buildQuery(userId: string, context: Context) {
  return `MATCH (u:User {user_id: $userId}) ...`; // userId param conflicts!
}

// ✅ GOOD
function buildQuery(orderedFields: string[]) {
  return `MATCH (u:User {user_id: $userId}) ...`; // Only params affecting conditional logic
}
```

### Zod Schema Usage

Don't manually map Neo4j properties field-by-field:

```typescript
// ❌ BAD
const parsed = Schema.parse({
  id: data.properties.id,
  name: data.properties.name,
  // ... 20 more fields
});

// ✅ GOOD - let Zod validate structure
const parsed = Schema.parse(data.properties);
```

### Type Reuse

Check if type already exists before creating new one:

```typescript
// ❌ BAD - duplicating existing type
type UserKey = 'u1' | 'u2' | 'u3';

// ✅ GOOD - import from test-data-manager.ts
import type { UserKey } from './test-data-manager.js';
```

### Preemptive Optimization Detection

Flag generic `min*`, `max*`, `cutoff` parameters without business justification:

```typescript
// ❌ BAD - why is this a parameter?
function analyze(minTransitionsCount: number = 1) { }

// ✅ GOOD - hardcode unless business requirement
function analyze() {
  const MIN_TRANSITIONS = 1; // Business rule: at least 1 transition required
}
```

---

## Method Ordering Convention

Classes should organize members in this order:

1. **Static constants**
2. **Instance properties**
3. **Constructor**
4. **Public methods** (API first, importance order)
5. **Private helpers** (alphabetical)

**Rationale**: Public-first makes API visible immediately (TypeScript/Node.js standard).

**Example**:
```typescript
class GdsSimilarityService {
  // 1. Static constants
  private static readonly MAX_TOP_K = 10000;

  // 2. Instance properties
  private cache: Map<string, Data>;

  // 3. Constructor
  constructor(private driver: Driver) {}

  // 4. Public methods (API first)
  async findSimilarBy(...) {}

  // 5. Private helpers (alphabetical)
  private validateCount(...) {}
  private validateMatchScore(...) {}
}
```

---

## Testing Infrastructure

### Vitest Projects

**5 active projects** (run sequentially):

1. **unit** - No database, parallel threads
   - Include: `tests/unit/**/*.spec.ts`
   - Pool: threads, isolate: false

2. **gds-projection-tests** - Projection lifecycle (create/drop)
   - Include: `tests/integration/gds/services/projection.test.ts`
   - singleThread: true (modifies state)
   - No setupFiles (manages own projections)

3. **gds-similarity-tests** - GDS similarity algorithms
   - Include: `tests/integration/gds/services/similarity.test.ts`
   - singleThread: false (read-only, safe to parallelize)
   - setupFiles: Load U1-U7 + create projection once

4. **reason-tests** - Reason-based search with dynamic users
   - Include: `tests/integration/reason-based/**/*.test.ts`
   - singleThread: true (creates users)
   - setupFiles: Import Reasons once

5. **gds-pathfinding-tests** - Yen's K-Shortest + Reason Analytics
   - Include: `tests/integration/gds/services/pathfinding.test.ts`, `reason-analytics.test.ts`
   - singleThread: false (read-only queries)
   - setupFiles: Load U8-U9 + create NEXT relationships

**Why sequential?**
- Projects run SEQUENTIALLY (`sequence.concurrent: false`)
- Prevent data races (different fixtures, projection conflicts)
- Within project: singleThread controls parallelism

**Within project parallelism:**
- **singleThread: true** → tests run sequentially (modify DB state)
- **singleThread: false** → tests run parallel (read-only, safe)

### Database Isolation

**Two Neo4j containers:**

| Container | Ports | Usage | Config |
|-----------|-------|-------|--------|
| neo4j-prod | 7687 (bolt), 7474 (http) | Production | .env.prod |
| neo4j-test | 7689 (bolt), 7476 (http) | All tests | .env.test |

**Why only two?**
- Test isolation via Vitest projects (not separate containers)
- Projects run sequentially (prevent data races)
- Different fixtures per project (setupFiles)

**MCP neo4j-cypher connection:**
- Connected to: neo4j-test (bolt://localhost:7689)
- Credentials: neo4j / testpassword123
- Database: neo4j

**Browser access:**
- Production: http://localhost:7474 (bolt: 7687)
- Test: http://localhost:7476 (bolt: 7689)

### Direct Cypher Validation (MANDATORY)

Before writing integration tests for Cypher-related code, ALWAYS validate queries directly using `mcp__neo4j-cypher__read_neo4j_cypher`.

**Why:**
- WayMates has history of WITH clause scope bugs
- Mocks hide null handling issues
- Direct testing catches query logic errors

**Validation workflow:**

1. **Inspect schema**: `mcp__neo4j-cypher__get_neo4j_schema()`
2. **Test query with edge cases**:
   ```cypher
   MATCH (u:User)-[:HAS_CONTEXT]->(c:Context)
   WHERE ANY(r IN coalesce(c.creation_reason, []) WHERE r IN $reasons)
   WITH u, c
   RETURN u, c LIMIT 5
   ```
3. **Test edge cases**:
   - null values: `params: { reasons: null }`
   - Empty arrays: `params: { reasons: [] }`
   - Missing properties: contexts without `creation_reason`
   - WITH clause scope: verify variable propagation

### Test Fixture Organization

**MANDATORY**: Test fixtures go in `data/trails/users/`

**Rules:**
- ❌ DON'T dump JSON structures inside test files
- ✅ DO create separate JSON files (`user_edge_cases_01.json`)
- ✅ DO follow U1-U9 naming convention
- ✅ DO reference fixtures by `user_id` in tests
- ✅ DO reuse `UserKey` type from test-data-manager.ts
- ✅ DO reuse TestDataManager helpers

**Example:**
```typescript
// ❌ BAD - data dump in test file
it('test case', async () => {
  const fixture = { user_id: 'test_01', contexts: [/* 50 lines */] };
});

// ✅ GOOD - data in separate file
// File: data/trails/users/user_edge_cases_01.json
it('test case', async () => {
  const results = await searchManager.search({...});
  expect(results.find(r => r.user.user_id === 'user_edge_01')).toBeDefined();
});
```

### Test Data Format Compliance

**Before creating test data**, verify formats:

```bash
# Check validation patterns
grep -A 2 "UUID_V7_PATTERN\|USER_ID_PATTERN" src/schemas-zod.ts

# Verify format matches existing
cat data/trails/users/u1.json | jq '.user_id, .contexts[0].context_id'
```

---

## Data Model

**Core Nodes**:
- `User`: User accounts
- `Context`: Career position/role at a specific time (the central node)
- `Trail`: Learning paths between contexts (courses, platforms, duration, cost)

**Reference Nodes**:
- `Position`, `Industry`, `WorkDomain`, `Skill`, `SkillCategory`
- `Country`, `City`, `Platform`

**Key Relationships**:
- `(:User)-[:HAS_CONTEXT]->(:Context)` - User's career history
- `(:User)-[:HAS_TRAIL]->(:Trail)` - User's learning paths
- `(:Trail)-[:STEPS_ON]->(:Context)` - Trail originates from context
- `(:Trail)-[:STEPS_TO]->(:Context)` - Trail leads to context
- `(:Context)-[:USES_SKILL]->(:Skill)` - Skills in a context

**Context Properties**:
- `context_id`, `position`, `industry`, `company_size`
- `work_type`, `country_code`, `city_name`
- `domains` (array), `skills` (array), `citizenships` (array)
- `previous_context_id`, `next_context_id` (temporal navigation)

---

## Common Pitfalls

1. **WITH clause scope**: Forgetting to carry forward variables through `WITH` clauses
2. **Hardcoding variable names**: Don't pass Cypher variable names from TypeScript
3. **Test isolation**: Integration tests run sequentially to avoid DB conflicts
4. **Null handling**: Always use `coalesce()` for array fields in Cypher
5. **Type duplication**: Check existing types before creating new ones
6. **Mock reliance**: Schema/Cypher changes require integration tests with real DB

---

## Development Commands

### Essential Commands

```bash
# Development
npm run dev                 # Run MCP server

# Build
npm run build              # Build TypeScript

# Lint
npm run lint               # ESLint check
npm run lint:fix           # ESLint auto-fix

# Type check
npx tsc --noEmit          # TypeScript compilation check
```

### Testing Commands

```bash
# Run all tests
npm run test:all

# Run specific test types
npm run test:unit                    # Unit tests (no DB)
npm run test:integration             # Integration tests (with test DB)

# Test setup
npm run test:setup                   # Start neo4j-test + initialize
npm run docker:test:down             # Stop neo4j-test
```

### Database Commands

```bash
# Production database
npm run docker:prod:up               # Start Neo4j container
npm run docker:prod:down             # Stop and remove container
npm run db:prod:init                 # Initialize schema
npm run db:prod:clean                # Delete all nodes
npm run db:prod:status               # Count nodes

# Test database
npm run db:test:init                 # Initialize test schema
```

### Mandatory Code Quality Checks

**CRITICAL**: After ANY code changes, ALWAYS run these checks:

```bash
# 1. Linter (MANDATORY - use project script)
npm run lint

# 2. TypeScript compilation check (MANDATORY)
npx tsc --noEmit

# 3. Tests (when applicable)
npm run test:unit                    # After logic changes
npm run test:integration             # After Cypher/schema changes
```

**Important workflow rules:**
- **Always use `npm run lint`** - project has custom ESLint config
- **Fix ALL errors before proceeding** - warnings acceptable in skipped tests
- **Run integration tests after schema/Cypher changes** - mocks won't catch breakage
