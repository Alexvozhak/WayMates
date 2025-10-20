# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WayMates is a career transition analysis platform built on Neo4j graph database. It helps users find career paths by matching their current context to target positions through analysis of skills, experience, and transitions of similar professionals. The system operates as an MCP (Model Context Protocol) server using FastMCP.

## Sub-Agents Architecture

This project uses **specialized sub-agents** for different development tasks. Claude Code **MUST proactively delegate** to appropriate agents based on context - don't wait for explicit user requests.

### Agent Roles & Responsibilities

| Agent | Role | When to Call (Proactively) | Model |
|-------|------|---------------------------|-------|
| **waymates-code-reviewer** | Tactical code review: bugs, edge cases, correctness | **Immediately** after code implementation | Sonnet |
| **waymates-tech-lead** | Architectural review: SOLID, elegance, refactoring, tech debt | After feature completion, before commits | Sonnet |
| **waymates-qa-engineer** | Test coverage, test quality, failure analysis | After schema/Cypher changes, test failures | Sonnet |
| **waymates-architect** | System design, tech selection, component interactions | Planning features, architecture decisions | Opus |
| **waymates-business-analyst** | Requirements, UX, user flows, product decisions | Defining features, UX questions | Opus |

### Proactive Delegation Rules

**CRITICAL**: Call agents automatically in these scenarios:

```
✅ Code written → waymates-code-reviewer (bugs/edge cases)
✅ Feature done → waymates-tech-lead (architecture review)
✅ Schema/Cypher changed → waymates-qa-engineer (integration tests!)
✅ Tests fail → waymates-qa-engineer (root cause analysis)
✅ New feature planned → waymates-architect (design first)
✅ UX question → waymates-business-analyst (user convenience)
✅ Refactoring → waymates-tech-lead + waymates-architect (if large)
✅ Performance issue → waymates-architect (bottleneck analysis)
```

**Workflow example:**
```
User: "Add skill scoring to search-manager.ts"
  ↓
Claude: Implements code
  ↓
Claude: ✅ Calls waymates-code-reviewer (tactical review)
  ↓
Claude: Fixes critical issues
  ↓
Claude: ✅ Calls waymates-tech-lead (architectural review)
  ↓
Claude: ✅ Calls waymates-qa-engineer (test coverage check)
  ↓
Claude: Completes with tests
```

## MCP Servers

The following MCP servers provide specialized capabilities:

### 1. **memory** (`@modelcontextprotocol/server-memory`)
**Purpose**: Persistent knowledge graph across sessions
- Store architectural decisions, tech debt, refactoring patterns
- Track discovered bugs and edge cases
- Accumulate WayMates-specific conventions

**Usage by agents:**
- `waymates-tech-lead` → track tech debt
- `waymates-qa-engineer` → save test patterns
- `waymates-architect` → store architectural decisions

### 2. **filesystem** (`@modelcontextprotocol/server-filesystem`)
**Purpose**: Fast file operations, search, tree navigation
- Scoped to `/home/alex/projects/WayMatesRemote`
- Use for bulk reads, pattern search, directory analysis
- Prefer over individual Read tool for multiple files

**Usage:**
- Reading multiple test files simultaneously
- Finding code duplication patterns
- Analyzing directory structure

### 3. **neo4j-cypher** (`mcp-neo4j-cypher`)
**Purpose**: Direct Cypher query execution on test database
- **Connected to**: `neo4j-test` (bolt://localhost:7689)
- **Credentials**: neo4j / testpassword123
- **Database**: neo4j

**Critical capabilities:**
- `get_neo4j_schema` - inspect schema, constraints, indexes
- `read_neo4j_cypher` - execute read queries with parameters
- `write_neo4j_cypher` - execute write queries (use carefully!)

**Usage:**
- Validate generated Cypher queries before integration tests
- Test edge cases (null values, empty arrays, boundary conditions)
- Inspect schema after migrations
- Debug query performance with EXPLAIN/PROFILE

**Example:**
```cypher
// Test WITH clause variable propagation
read_neo4j_cypher({
  query: "MATCH (u:User) WITH u, u.user_id AS uid RETURN u, uid LIMIT 1",
  params: {}
})
```

### 4. **context7** (system-provided)
**Purpose**: Fetch up-to-date library documentation
- Resolve library names → Context7-compatible IDs
- Get focused documentation by topic

**Usage by agents:**
- `waymates-architect` → research best practices (Neo4j patterns, Docker, TypeScript)
- `waymates-tech-lead` → validate coding patterns (Vitest, Zod, FastMCP)

**Example:**
```typescript
// Step 1: Resolve library
resolve-library-id({ libraryName: "neo4j" })
// → Returns: /neo4j/docs

// Step 2: Get docs
get-library-docs({
  context7CompatibleLibraryID: "/neo4j/docs",
  topic: "Cypher WITH clause scope",
  tokens: 3000
})
```

## Tech Stack

- **Database**: Neo4j (graph database)
- **Query Language**: Cypher (stored in `.cypher` files, compiled to TypeScript)
- **Runtime**: Node.js 20+ with TypeScript (ESM modules)
- **Validation**: Zod schemas
- **Testing**: Vitest (unit, integration, functional)
- **MCP Framework**: FastMCP for tool-based server interface
- **ID Generation**: ULID

## Build and Development Commands

### Essential Commands

```bash
# Development - run the MCP server
npm run dev

# Build everything (presets + Cypher + TypeScript)
npm run build

# Lint
npm run lint
npm run lint:fix

# Cypher regeneration (CRITICAL - run after any .cypher file changes)
npm run build:cypher
```

### Testing Commands

```bash
# Run all tests
npm run test:all

# Run specific test types
npm run test:unit                    # Unit tests only (no DB)
npm run test:integration             # Integration tests with test DB
npm run test:functional              # Functional/E2E tests

# Individual test file
npx vitest run tests/unit/snippets-extractor.spec.ts
npx vitest run tests/integration/search-manager.test.ts
```

### Docker & Database Commands

```bash
# Production database
npm run docker:prod:up               # Start Neo4j container
npm run docker:prod:down             # Stop and remove container
npm run db:prod:init                 # Initialize schema
npm run db:prod:clean                # Delete all nodes
npm run db:prod:status               # Count nodes

# Test database (integration tests)
npm run test:setup                   # Start test DB and initialize
npm run docker:test:down             # Stop test DB
```

### Mandatory Code Quality Checks

**CRITICAL**: After ANY code changes, ALWAYS run these checks before marking work as complete:

```bash
# 1. Linter (MANDATORY - use project script, NOT npx eslint directly)
npm run lint

# 2. TypeScript compilation check (MANDATORY)
npx tsc --noEmit

# 3. Tests (when applicable)
npm run test:unit                    # After logic changes
npm run test:integration             # After Cypher/schema changes
```

**Important workflow rules:**
- **Always use `npm run lint`** - project has custom ESLint config, do NOT use `npx eslint` directly
- **Fix ALL errors before proceeding** - warnings are acceptable in skip-ped tests, but errors must be resolved
- **Use MCP filesystem tools when available** - prefer `mcp__filesystem__read_multiple_files` and `mcp__filesystem__search_files` over grep/find for bulk operations
- **Run integration tests after schema/Cypher changes** - unit test mocks won't catch breaking changes in database queries

## Architecture

### Core Components

1. **MCP Server** (`src/mcp-server.ts`): Exposes tools via FastMCP
   - `current_to_target`: Find career transitions from current → target position
   - `current_only`: Find similar contexts to current position
   - `target_only`: Find contexts matching target position
   - Persistence tools: Create/update contexts, trails (learning paths), user stories

2. **Search Manager** (`src/search-manager.ts`): Orchestrates search operations
   - Coordinates between query builder and Neo4j driver
   - Processes different search modes (pipeline, current-only, target-only)

3. **Persistence Manager** (`src/persistence-manager.ts`): Handles data creation/updates
   - Context creation and updates
   - Trail (learning path) management
   - User story persistence

4. **Query Builder** (`src/orcestrator/search-query-builder.ts`): Constructs Cypher queries
   - Uses preset configurations for common searches
   - Builds strict (WHERE) and flexible (scoring) conditions
   - Combines multiple Cypher processors

### Cypher Query System

**CRITICAL WORKFLOW**: Cypher queries are NOT edited directly in TypeScript. They live in `.cypher` files and are compiled:

```
src/cypher/
├── processors/     # Multi-step query processors (scoring, results assembly)
├── finders/        # Single-purpose finders (cohort matches, trails)
└── upserts/        # Data modification queries

↓ npm run build:cypher

generated/queries.generated.ts  # Auto-generated TypeScript constants
```

**Cypher Processors** are composable query blocks:
- `processors/compatibility-score.cypher`: Calculates match metrics between contexts
- `processors/search-results.cypher`: Main search pipeline orchestrator
- `finders/cohort-matches.cypher`: Finds similar users
- `finders/target-achievers.cypher`: Finds users who reached target positions

### Canonical Variable Names in Cypher

The codebase enforces strict variable naming conventions in Cypher queries:

| Stage   | Requested Context | DB Context        | Score Alias                        |
|---------|-------------------|-------------------|------------------------------------|
| Current | `requestedCurrentContext` | `dbCurrentContext` | `currentContextCompatibilityScore` |
| Target  | `requestedTargetContext`  | `dbTargetContext`  | `targetContextCompatibilityScore`  |

**Important**: These names are hardcoded in Cypher builders. Do NOT pass variable names from TypeScript.

### WITH Clause Scope Management

Neo4j's `WITH` clause drops all variables not explicitly listed:
- `WITH x, y` → only x and y remain in scope
- `WITH *` → all variables remain in scope
- `WITH *, newVar` → all old variables + newVar

Always verify variable consistency across `WITH` clauses in multi-step queries.

### Preset System

Presets (`src/orcestrator/presets.ts`) define common search configurations:
- Generated from `data/trails/presets/*.json`
- Specify strict fields (WHERE filters) and flexible fields (scoring)
- Regenerated via `npm run generate:presets`

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
- `context_id`, `position`, `industry`, `company_size`, `team_size`
- `work_type`, `country_code`, `city_name`
- `domains` (array), `skills` (array), `citizenships` (array)
- `previous_context_id`, `next_context_id` (temporal navigation)

## Testing Strategy

### Three Test Tiers

1. **Unit Tests** (`tests/unit/**/*.spec.ts`)
   - No database, fast execution
   - Test query builders, snippet extractors, validators
   - Run: `npm run test:unit`

2. **Integration Tests** (`tests/integration/**/*.test.ts`)
   - Real Neo4j test database (`neo4j-test` container)
   - Test managers, full query execution
   - Sequential execution (no parallelism)
   - Run: `npm run test:integration`

3. **Functional Tests** (`tests/functional/**/*.test.ts`)
   - Currently disabled, planned for end-to-end scenarios

### Test Database Isolation

Each test environment uses isolated Neo4j instances:
- **prod**: `neo4j-prod` (7687:7687, 7474:7474)
- **test**: `neo4j-test` (7689:7687, 7476:7474)

Test setup automatically starts containers and initializes schema.

## Development Workflow

### Working with Cypher Queries

1. Edit `.cypher` files in `src/cypher/processors/`, `finders/`, or `upserts/`
2. **MANDATORY**: Run `npm run build:cypher` to regenerate TypeScript constants
3. **✅ PROACTIVE**: Call `waymates-code-reviewer` to check for:
   - WITH clause variable scope issues
   - Missing null/empty array handling
   - Canonical variable naming violations
4. **✅ PROACTIVE**: Call `waymates-qa-engineer` to ensure integration test coverage (mocks won't catch Cypher breakage!)
5. Test queries with `neo4j-cypher` MCP for edge cases
6. Run integration tests: `npm run test:integration`

### Schema Changes

1. Edit `database/init.cypher` for constraints and indexes
2. Reinitialize database: `npm run db:prod:init` or `npm run db:test:init`
3. Update Zod schemas in `src/schemas-zod.ts` if needed
4. **✅ PROACTIVE**: Call `waymates-qa-engineer` to review schema impact on tests

### Debugging Cypher Queries

**Use `neo4j-cypher` MCP server** for direct query testing:

```typescript
// 1. Inspect current schema
mcp__neo4j-cypher__get_neo4j_schema()

// 2. Test query with edge cases
mcp__neo4j-cypher__read_neo4j_cypher({
  query: `
    MATCH (u:User {user_id: $userId})
    WITH u, u.user_id AS uid
    RETURN u, uid
  `,
  params: { userId: "user_01" }
})

// 3. Test WITH clause variable propagation
mcp__neo4j-cypher__read_neo4j_cypher({
  query: "MATCH (c:Context) WITH c, c.skills AS skills WHERE size(skills) > 0 RETURN c, skills LIMIT 5",
  params: {}
})
```

**For production queries**, use Neo4j Browser:
- Prod: http://localhost:7474 (7687)
- Test: http://localhost:7476 (7689)

## Project Conventions

### Code Style
- TypeScript strict mode enabled
- ESM modules (use `.js` extensions in imports)
- Prefer explicit temporary variables over complex chained operations
- Extract helper functions for repeated logic
- Avoid spread operator when possible

### Naming
- Use canonical Cypher variable names (see table above)
- Keep Cypher variable names consistent across query blocks
- Use descriptive names for TypeScript functions and variables

### Documentation Files
- Dated format: `YYYY_MM_DD_HH_MM_название.md` (Russian naming)
- Located in `docs/` directory

## Important Rules

### Before Making Changes

1. **Never modify generated files**: `src/generated/queries.generated.ts`, `src/generated/presets.generated.ts`
2. **Always regenerate after Cypher edits**: `npm run build:cypher`
3. **Check test coverage**: Especially for schema/query changes that mocks won't catch
4. **Verify preset validity**: SearchQueryBuilder validates presets on startup

### Proactive Agent Usage (MANDATORY)

**Claude Code MUST call agents automatically** - don't wait for user requests:

| Trigger | Agent | Purpose |
|---------|-------|---------|
| 🔧 **Code written/modified** | `waymates-code-reviewer` | Catch bugs, edge cases, null handling |
| ✅ **Feature completed** | `waymates-tech-lead` → `waymates-qa-engineer` | Architecture review → test coverage |
| 🗄️ **Schema/Cypher changed** | `waymates-qa-engineer` | Integration tests (mocks hide breakage!) |
| ❌ **Tests failing** | `waymates-qa-engineer` | Root cause: test outdated or code bug? |
| 🎨 **Planning new feature** | `waymates-architect` | Design before implementation |
| 🔄 **Refactoring proposed** | `waymates-tech-lead` (small) or `waymates-architect` (large) | Break into steps, avoid tech debt |
| 🤔 **UX/Product question** | `waymates-business-analyst` | User convenience first |
| ⚡ **Performance issue** | `waymates-architect` | Bottleneck analysis, indexing strategy |

**Key principle**: Proactive delegation maintains quality without user micromanagement.

### Testing Philosophy

**CRITICAL PRINCIPLE**: Tests validate business logic, not implementation details.

- **Mocks hide breaking changes** in schema, queries, and integration
- After architectural changes, if tests pass suspiciously easily → **investigate thoroughly**
- **Integration tests with real DB are MANDATORY** for Cypher refactoring
- **Never blindly adjust tests to match code** - determine if test or code is wrong
- **✅ PROACTIVE**: Call `waymates-qa-engineer` when:
  - Schema/Cypher queries changed (mocks won't catch breakage)
  - Tests fail (root cause analysis: test outdated vs. code bug)
  - Feature completed (ensure adequate coverage)
  - Refactoring done (verify tests still validate business logic)

### Communication Language

- **Russian** for discussions, documentation, commit messages (optional)
- **English** for code, variable names, comments
- Structured explanations with examples preferred

## Common Pitfalls

1. **Forgetting `npm run build:cypher`**: Changes to `.cypher` files won't appear until regeneration
2. **WITH clause scope**: Forgetting to carry forward variables through `WITH` clauses
3. **Hardcoding variable names**: Don't pass Cypher variable names from TypeScript
4. **Test isolation**: Integration tests run sequentially to avoid DB conflicts
5. **Parameter format**: Neo4j Browser requires `:param name => value;` syntax

## Useful Resources

- Cypher cookbook: `.cursor/rules/training.md`
- Cypher variable conventions: `.cursor/rules/cypher.rules.mdc`
- Project workflow rules: `.cursor/rules/rules.mdc`
- Architecture discussions: `docs/2025_10_11_arch.md`
