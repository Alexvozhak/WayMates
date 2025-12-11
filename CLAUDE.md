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

## Execution Best Practices

### ALWAYS choose the SIMPLEST solution

Before executing any task, ask yourself: **"What is the SIMPLEST way?"**

**Examples:**
- Move file → `mv source dest` (NOT `read` + `write`)
- Rename file → `mv old new` (NOT `read` + `write` with new name)
- Copy file → `cp source dest` (NOT `read` + `write`)
- Change string → `sed -i` or Edit tool (NOT `read` + `write` entire file)
- Remove unused import → Edit tool (NOT rewrite entire imports section)

**Rule**: If one-line solution exists → use it. Don't overcomplicate.

### Code Review

When user asks "смущает код?" / "есть проблемы?" / "можно улучшить?":

**Follow the protocol**: See [`.claude/commands/code-review-protocol.md`](.claude/commands/code-review-protocol.md)

**Key principles:**
1. Start with what works CORRECTLY (don't jump to problems)
2. Check `package.json` for existing libraries before suggesting alternatives
3. Verify claims via context7/docs (don't guess API)
4. "Code is fine" is a VALID answer (don't invent problems)

---

## Asking Questions Pattern

When you need to gather user preferences, clarify ambiguous requirements, or make decisions during execution:

**MANDATORY**: Use `AskUserQuestion` tool with multiple questions in a SINGLE call.

**Key benefits**:
- Each question creates a separate tab in the UI (clean UX)
- Structured options (2-4 choices per question) vs free-form text
- Clear headers (max 12 chars) for tab labels
- Efficient batching (max 4 questions per call)

**Use cases**:
- Architecture decisions (library choice, pattern selection, technology stack)
- Data structure design (batch organization, test grouping, schema layout)
- Implementation approach (migration strategy, naming convention, refactoring path)
- Feature priorities (P0/P1/P2 trade-offs, what to implement first)
- Ambiguous requirements (multiple valid interpretations)

**Example**:
```typescript
AskUserQuestion({
  questions: [
    {
      question: "How to handle trajectories < 3 contexts for DTW tests?",
      header: "DTW data fix",
      multiSelect: false,
      options: [
        { label: "Extend U1/U2 to 3 contexts", description: "Minimal changes, reuse existing data" },
        { label: "Create new U10-U13", description: "Clean separation, more test coverage" }
      ]
    },
    {
      question: "How to organize batch data and setup?",
      header: "Setup pattern",
      multiSelect: false,
      options: [
        { label: "Single batch U1-U9", description: "Simple setup, load once" },
        { label: "Two batches: Adhoc + DTW", description: "Separation of concerns" }
      ]
    }
  ]
})
```

**DON'T**: Ask questions in plain text ("What do you think about X?") - use the tool for structured input.

**When NOT to use**:
- Obvious next steps (just do it)
- Single yes/no question (use tool anyway for consistency)
- User already provided clear direction

---

## Sub-Agents Architecture

This project uses **4 specialized agents** for different development tasks. You **MUST proactively delegate** to appropriate agents - don't wait for explicit user requests.

### Agent Roles & Responsibilities

| Agent | Role | When to Call (Proactively) | Model |
|-------|------|---------------------------|-------|
| **planner** | Architecture + requirements + type design | Planning features, architecture decisions | Opus |
| **cypher-expert** | Neo4j Cypher queries, optimization, schema validation | Writing/changing Cypher, query performance issues | Sonnet |
| **reviewer** | Bugs, edge cases, DRY, correctness | **Immediately** after code implementation | Sonnet |
| **qa** | Test quality, coverage, failure analysis | After schema/Cypher changes, test failures | Sonnet |

### Proactive Delegation Rules

**CRITICAL**: Call agents automatically in these scenarios:

```
✅ Planning feature → planner (architecture + type schema)
✅ Writing/modifying Cypher → cypher-expert (query design + optimization)
✅ Code written → reviewer (bugs, edge cases, DRY)
✅ Feature done → qa (test coverage, quality)
✅ Schema/Cypher changed → qa (integration tests!)
✅ Tests failing → qa (root cause analysis)
✅ Query performance issues → cypher-expert (PROFILE analysis + optimization)
✅ Refactoring → reviewer (DRY violations) + qa (tests still valid)
```

### Workflow Example

```
User: "Add flexible scoring for domains in current search"
  ↓
Claude: ✅ Calls planner
  - Gets: Architecture design + TYPE SCHEMA + tech choice
  ↓
Claude: ✅ Calls cypher-expert (for scoring query design)
  - Gets: Tested Cypher query + optimization notes
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

**Another example** (Cypher-focused task):

```
User: "Optimize the target search query - it's slow"
  ↓
Claude: ✅ Calls cypher-expert (immediately)
  - Expert runs PROFILE via MCP
  - Identifies missing index usage
  - Provides optimized query with USING INDEX hint
  ↓
Claude: Updates query builder with optimized query
  ↓
Claude: ✅ Calls qa (verify no regressions)
  - Runs integration tests
  ↓
Claude: Completes with performance improvement notes
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

### 4. filesystem (`@modelcontextprotocol/server-filesystem`)

**Purpose**: Direct file system access for reading/writing project files

- **Allowed directory**: `/home/alex/projects/WayMatesRemote`
- **Access level**: Full read/write

**When to use:**
- **Reading multiple files** for analysis (architecture review, codebase exploration)
- **Batch file operations** (renaming, moving, creating directory structures)
- **Documentation updates** across multiple files
- **Agent deep-dive analysis** when Read tool context is insufficient

**Usage by agents:**
- `planner` → read architecture docs, analyze codebase structure, update design documents
- `reviewer` → read multiple source files for cross-file DRY analysis
- `qa` → read test suites, analyze coverage patterns, update test plans
- `cypher-expert` → read all query builders for consistency analysis

**Examples:**
```typescript
// Agent reads all query builders to analyze patterns
mcp__filesystem__search_files({
  path: "/home/alex/projects/WayMatesRemote/src/core",
  pattern: "*-query-builder.ts"
})

// Agent updates architecture documentation
mcp__filesystem__write_file({
  path: "/home/alex/projects/WayMatesRemote/docs/decisions/ADR-005.md",
  content: "# ADR-005: Discriminated Union Pattern..."
})
```

**Note**: Prefer built-in Read/Write/Edit tools for single-file operations. Use filesystem for batch operations or agent deep analysis.

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

## Knowledge Modules

Для специализированных задач загружай соответствующий роутер:

| Тема | Роутер | Когда загружать |
|------|--------|-----------------|
| Cypher | [cypher/router.md](.claude/routers/cypher/router.md) | Пишешь/фиксишь Cypher queries |
| Test | [test/router.md](.claude/routers/test/router.md) | Пишешь/ревьюишь тесты |
| LangGraph | [langgraph/router.md](.claude/routers/langgraph/router.md) | StateGraph, interrupt, routing |
| Infrastructure | [infrastructure/router.md](.claude/routers/infrastructure/router.md) | Docker, env, setup |
| Architecture | [architecture/router.md](.claude/routers/architecture/router.md) | Планирование фич |

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

**Source of truth**: `eslint.config.mjs` (все правила, naming conventions, category-specific overrides)

### Key Rules:

1. **Complexity Limits** (строки 175-184):
   - `max-depth: 2` - maximum 2 levels of nesting
   - `complexity: 8` - cyclomatic complexity ≤ 8
   - `max-lines-per-function: 60` - functions up to 60 lines

2. **Philosophy**: Code must be **explicit and predictable**. No clever tricks, no hidden behavior.

**Why**: Forces developers to write clear, maintainable code. If you can't express logic simply, refactor into smaller functions.

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

---

## 📚 Memory Bank - Persistent Context

### Bugs Registry Workflow

**Use dedicated commands for bug management:**

1. **Add bug**: Use `/report-bug` command (see `.claude/commands/report-bug.md`)
2. **Fix bug**: Use `/fix-bug` command (see `.claude/commands/fix-bug.md`)
   - Provides interactive bug selection with `AskUserQuestion` tool
   - Auto-loads relevant context (affected files, tests, git history, Memory Bank)
   - Follows standard workflow with mandatory reviewer + qa checks
   - Auto-updates bug status to RESOLVED + links commit
   - Runs quality gates (lint + tsc + integration tests)

**Manual bug fixing (if not using /fix-bug):**

1. **During fix**: Update bug status to `RESOLVED` in Registry table
   ```markdown
   | #1 | 2025-11-11 | search-query-builder | Skills penalty when excluded | RESOLVED | 🔴 P0 |
   ```

2. **During `/sync-memory`**: Auto-cleanup triggers
   - Detects RESOLVED status → offers to archive
   - Moves to Resolved Bugs section with brief trace
   - Adds links to `decisions.md` + Memory MCP

**Principles**:
- ✅ Use `/report-bug` for adding bugs (structured with ACs)
- ✅ Use `/fix-bug` for fixing bugs (automated workflow)
- ✅ Let `/sync-memory` handle archiving RESOLVED bugs
- ❌ Don't delete bugs immediately after fix
- ❌ Don't manually move bugs to archive during coding

### Features Registry Workflow

**Use dedicated commands for feature management:**

1. **Add feature**: Use `/request-feature` command (see `.claude/commands/request-feature.md`)
   - Interactive gathering: title, component, priority, motivation, ACs, impact
   - Auto-assigns Feature ID
   - Adds to `memory-bank/knowledge/features-registry.md`

2. **Implement feature**: Use `/implement-feature` command (see `.claude/commands/implement-feature.md`)
   - Interactive feature selection from TODO list
   - Auto-updates status: TODO → IN_PROGRESS → DONE
   - Full workflow: **planner** → **cypher-expert** → implementation → **reviewer** → **qa**
   - Quality gates: lint + tsc + tests
   - Auto-updates registry with commit hash + implementation notes

**Workflow**:
```
/request-feature → TODO status in registry
  ↓
/implement-feature → IN_PROGRESS (auto)
  ↓
planner agent → TYPE SCHEMA + architecture
  ↓
cypher-expert agent → tested Cypher queries (if needed)
  ↓
Implementation → follow type schema
  ↓
reviewer agent → bugs, DRY, edge cases
  ↓
qa agent → test coverage
  ↓
Quality gates → lint + tsc + tests
  ↓
DONE status (auto) + commit hash + implementation notes
```

**During `/sync-memory`**: Auto-cleanup triggers
- Detects DONE status → offers to archive
- Moves to Completed Features section with brief summary
- Adds links to `decisions.md` + Memory MCP

**Principles**:
- ✅ Use `/request-feature` for adding features (structured with ACs)
- ✅ Use `/implement-feature` for implementation (automated workflow with planner)
- ✅ Break large features into sub-tasks in Acceptance Criteria
- ✅ Let `/sync-memory` handle archiving DONE features
- ❌ Don't skip planner call - type schema is mandatory
- ❌ Don't manually move features to archive during coding

### Session Management
Use `/sync-memory` command at the end of each session to:
1. Sync tasks with Vikunja
2. Update progress log
3. Save architectural decisions (creative-*.md)
4. Document lessons learned (reflect-*.md)
5. Update Memory MCP graph
6. **Archive resolved bugs** (auto-cleanup)

See: [.claude/commands/sync-memory.md](.claude/commands/sync-memory.md)