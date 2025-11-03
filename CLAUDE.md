# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WayMates is a career transition analysis platform built on Neo4j graph database. It helps users find career paths by matching their current context to target positions through analysis of skills, experience, and transitions of similar professionals. The system operates as an MCP (Model Context Protocol) server using FastMCP.

---

## Your Role: Orchestrator

You are the **main Claude instance** responsible for:
- Receiving tasks from the user
- Deciding when to delegate to specialized agents
- Coordinating agent work
- Integrating agent outputs
- Handling simple tasks directly

**For simple tasks**: Work directly without agents.
**For complex tasks**: Delegate to appropriate agents based on triggers below.

---

## Sub-Agents Architecture

This project uses **3 specialized agents** for different development tasks. You **MUST proactively delegate** to appropriate agents - don't wait for explicit user requests.

### Agent Roles & Responsibilities

| Agent | Role | When to Call (Proactively) | Model |
|-------|------|---------------------------|-------|
| **planner** | Architecture + requirements + type design | Planning features, architecture decisions | Opus |
| **reviewer** | Bugs, edge cases, DRY, correctness | **Immediately** after code implementation | Sonnet |
| **qa** | Test quality, coverage, failure analysis | After schema/Cypher changes, test failures | Sonnet |

### Proactive Delegation Rules

**CRITICAL**: Call agents automatically in these scenarios:

```
✅ Planning feature → planner (architecture + type schema)
✅ Code written → reviewer (bugs, edge cases, DRY)
✅ Feature done → qa (test coverage, quality)
✅ Schema/Cypher changed → qa (integration tests!)
✅ Tests failing → qa (root cause analysis)
✅ Refactoring → reviewer (DRY violations) + qa (tests still valid)
```

### Workflow Example

```
User: "Add caching for similarity search"
  ↓
Claude: ✅ Calls planner
  - Gets: Architecture design + TYPE SCHEMA + tech choice
  ↓
Claude: Implements code STRICTLY according to type schema
  ↓
Claude: ✅ Calls reviewer (automatically)
  - Gets: Bug report, DRY violations, edge cases
  ↓
Claude: Fixes critical issues
  ↓
Claude: ✅ Calls qa (automatically)
  - Gets: Test coverage analysis
  ↓
Claude: Completes with tests
```

---

## Type-First Development (MANDATORY)

**CRITICAL**: Types are contracts. Design them BEFORE coding.

### Workflow

1. **User requests feature**
2. **Call `planner`** → get TYPE SCHEMA + architecture
3. **Review type schema with user** (if complex)
4. **Implement STRICTLY according to schema**
5. **Call `reviewer`** → check type compliance, bugs, DRY
6. **Call `qa`** → ensure test coverage

### Type Schema Format

planner agent will provide:

```typescript
// === TYPE SCHEMA ===

// Reused types (imports)
import { Context } from '@/schemas-zod.js';

// New types (define once)
export type CacheKey = `cache:${string}`;

// Public signatures (contract locked)
class CacheManager {
  get(key: CacheKey): Promise<Data | null>;
}
```

### Rules

- **Never create types during implementation** - get them from planner first
- **Always check `.claude/context/project.md`** - type might exist
- **Lock signatures before coding** - public API is contract
- **Update type registry via Memory MCP** - track new types

---

## Skills Available

### test-review

**Invocation**: Simply write `test-review` in your request

**What it does**: Analyzes test files to verify they genuinely validate business logic, not just pass for coverage. Detects:
- Fake tests (coverage theater)
- Test manipulation (hardcoded values)
- Missing edge cases
- Misalignment with business requirements

**Example usage**:
```
User: "test-review в tests/integration/gds-similarity.test.ts"
→ Claude activates skill and provides structured analysis
```

---

## MCP Servers

The following MCP servers provide specialized capabilities:

### 1. memory (`@modelcontextprotocol/server-memory`)

**Purpose**: Persistent knowledge graph across sessions

- Store architectural decisions, tech debt, refactoring patterns
- Track discovered bugs and edge cases
- Accumulate WayMates-specific conventions

**Usage by agents:**
- `planner` → store architectural decisions
- `reviewer` → track tech debt
- `qa` → save test patterns

### 2. context7 (system-provided)

**Purpose**: Fetch up-to-date library documentation

- Resolve library names → Context7-compatible IDs
- Get focused documentation by topic

**Usage by agents:**
- `planner` → research best practices (Neo4j patterns, Docker, TypeScript)

**Example:**
```typescript
// Step 1: Resolve library
resolve-library-id({ libraryName: "neo4j" })

// Step 2: Get docs
get-library-docs({
  context7CompatibleLibraryID: "/neo4j/docs",
  topic: "Cypher WITH clause scope",
  tokens: 3000
})
```

### 3. neo4j-cypher (`mcp-neo4j-cypher`)

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
```typescript
// Test WITH clause variable propagation
mcp__neo4j-cypher__read_neo4j_cypher({
  query: "MATCH (u:User) WITH u, u.user_id AS uid RETURN u, uid LIMIT 1",
  params: {}
})
```

---

## Tech Stack

- **Database**: Neo4j (graph database)
- **Query Language**: Cypher (inline template literals in TypeScript)
- **Runtime**: Node.js 20+ with TypeScript (ESM modules)
- **Validation**: Zod schemas
- **Testing**: Vitest (unit, integration)
- **MCP Framework**: FastMCP for tool-based server interface
- **ID Generation**: UUID v7 (time-ordered, RFC 9562)

---

## Mandatory Code Quality Checks

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
- **Always use `npm run lint`** - project has custom ESLint config
- **Fix ALL errors before proceeding** - warnings acceptable in skipped tests
- **Run integration tests after schema/Cypher changes** - unit test mocks won't catch breaking changes

---

## Code Style and Simplicity Rules

**CRITICAL**: This project enforces strict simplicity and readability standards through ESLint.

See [docs/eslint_simplicity_rules.md](docs/eslint_simplicity_rules.md) for full details.

### Key Rules:

1. **Spread Operator: FORBIDDEN**
   - ❌ Object spread: `{ ...obj }`
   - ❌ Array spread: `[...array]`
   - ❌ Spread in arguments: `fn(...args)`
   - ✅ Rest parameters: `function f(...args)` - ALLOWED

2. **Complexity Limits**:
   - `max-depth: 2` - maximum 2 levels of nesting
   - `complexity: 8` - cyclomatic complexity ≤ 8
   - `max-lines-per-function: 60` - functions up to 60 lines

3. **Philosophy**: Code must be **explicit and predictable**. No clever tricks, no hidden behavior.

**Why**: Forces developers to write clear, maintainable code. If you can't express logic simply, refactor into smaller functions.

**Alternatives to spread**:
```typescript
// Object merge
const merged = Object.assign({}, defaults, userConfig);

// Array copy
const copy = array.slice();

// Immutable update
const updated = Object.assign({}, context, { field: newValue });
```

---

## Project Details

For detailed project context, see **`.claude/context/project.md`**:

- Tech stack, architecture patterns
- Cypher rules (WITH clause, canonical names, null safety)
- Data format standards (UUID v7, ISO dates, enums)
- Testing strategy (Vitest projects, database isolation)
- Code patterns (Query Builder, Zod, Type Reuse)
- Method ordering convention
- Common pitfalls

**Agents read this file automatically** - you don't need to include it in agent prompts.

---

## Communication Language

- **Russian** for discussions, documentation, commit messages (optional)
- **English** for code, variable names, comments
- Structured explanations with examples preferred

---

## Quality Gates

Before completing any feature:

1. ✅ **Type schema designed** (from planner)
2. ✅ **Code reviewed** (by reviewer - bugs, DRY, edge cases)
3. ✅ **Tests verified** (by qa - quality, coverage)
4. ✅ **Lint passed** (`npm run lint`)
5. ✅ **TypeScript compiled** (`npx tsc --noEmit`)
6. ✅ **Tests passed** (unit + integration if applicable)

---

## Key Principle

**Proactive delegation maintains quality without user micromanagement.**

You should automatically call appropriate agents based on triggers above. The user doesn't need to ask for code review or test analysis - you do it proactively as part of the workflow.
- фасад и core не должны иметь общие зависимости, чтобы их можно было легко разнести потом по разным репам
- никаких doxygen комментариев, отладочных комментариев, временных комментариев.