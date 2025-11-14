---
description: Add new feature request to features registry with structured template
---

# Request Feature Command

**Purpose**: Add a new feature to `memory-bank/knowledge/features-registry.md` with structured information gathered interactively through `AskUserQuestion` tool.

**Key Principle**: DON'T invent details - ask user for everything through structured questions.

---

## Workflow

### Step 1: Gather Basic Info (обязательные поля)

Use `AskUserQuestion` to gather:

**1.1 Feature Title**
- Provide 3-4 options based on context or let user write their own (Other)
- Short, descriptive (5-10 words)

**1.2 Component/Module**
- MultiSelect: which components affected?
- Options: Facade MCP, Core Manager, LangGraph workflow, Schema, Admin CLI, Integration tests, Client integration, etc.

**1.3 Priority**
- Single select: 🔴 P0 (Critical) / 🟡 P1 (Important) / 🟢 P2 (Nice-to-have)

**1.4 Motivation**
- Provide 3-4 typical motivations or let user write (Other)
- Examples: "Lower barrier to entry", "Fix critical bug", "Improve UX", "Technical debt"

---

### Step 2: Standard Sections (всегда спрашиваем последовательно)

**2.1 User Story**

```
Question: "User Story - выбери подходящую:"
Options (single select):
( ) [Generate 3-4 options based on motivation and component]
( ) Пропустить User Story (not needed)
( ) Напишу свою (через Other)
```

**Example options** (for Resume Upload feature):
- As a user with resume, I want to upload PDF for quick start, so that AI extracts info and asks clarifying questions
- As a user, I want to start with resume instead of full conversation, so that I save time on data entry

---

**2.2 Acceptance Criteria**

```
Question: "Acceptance Criteria - выбери нужные пункты:"
Options (multiSelect):
[Generate 5-10 typical AC items based on component type - see templates below]
```

**AC Templates by Component:**

**Facade MCP tools:**
- [ ] New MCP tool definition with Zod schema
- [ ] Auth validation (userId from token)
- [ ] Error handling (UserError for user-facing errors)
- [ ] Integration with Core/LangGraph
- [ ] Tool description for LLM
- [ ] Unit tests (auth, validation, business logic)
- [ ] Integration tests (full MCP → manager flow)

**LangGraph workflow:**
- [ ] Workflow nodes implementation ([list specific nodes])
- [ ] State annotation with reducers for parallel fields
- [ ] Interrupt handling (clarify, confirm)
- [ ] Checkpointer integration (Redis, TTL 7 days)
- [ ] Error handling in nodes (try/catch)
- [ ] Unit tests (individual nodes with mocks)
- [ ] Integration tests (full workflow with real DB/Redis)

**Core Manager:**
- [ ] New manager methods ([list method names])
- [ ] Cypher queries (new/modified in query builders)
- [ ] Schema validation (Zod)
- [ ] Error handling (business logic errors)
- [ ] Unit tests (manager logic with mocked Neo4j)
- [ ] Integration tests (real Neo4j queries)

**Schema changes:**
- [ ] Update schema definition (Zod + TypeScript types)
- [ ] Migration script (database/migrations/)
- [ ] Update affected query builders
- [ ] Update indexes/constraints (database/init.cypher)
- [ ] Integration tests (schema validation)
- [ ] Documentation (schema comments in shared/schemas.ts)

**Admin CLI:**
- [ ] CLI commands implementation ([list commands])
- [ ] Interactive prompts (inquirer or similar)
- [ ] Integration with Core managers
- [ ] Error handling (graceful failures, continue on error)
- [ ] Progress logging (per-item, per-batch, summary)
- [ ] Usage documentation (README or --help)

**Client integration:**
- [ ] Client setup (config files, docker-compose)
- [ ] MCP connection config
- [ ] Auth integration (JWT/API keys)
- [ ] System prompts (instructions for LLM)
- [ ] User documentation (setup guide)

**PDF/Parser services:**
- [ ] Parser service implementation
- [ ] Library integration ([specify library: pdf-parse, csv-parse, etc.])
- [ ] Error handling (invalid input, corrupted files)
- [ ] Unit tests (valid/invalid inputs)
- [ ] Edge case handling (empty, malformed data)

**Integration tests:**
- [ ] Test coverage plan ([list test scenarios])
- [ ] Test data setup (fixtures, test users)
- [ ] Edge cases (boundary values, error conditions)
- [ ] Performance checks (if applicable)
- [ ] Documentation (test expectations in comments)

---

**2.3 Impact Assessment**

```
Question: "Impact Assessment - что затронуто?"
Options (multiSelect):
[ ] Schema change (добавление/изменение полей в Neo4j)
[ ] Breaking change (несовместимость с текущим API/contracts)
[ ] Migration required (нужен скрипт миграции данных)
[ ] Affected: Core managers
[ ] Affected: Facade MCP tools
[ ] Affected: LangGraph workflows
[ ] Affected: Integration tests
[ ] Affected: Admin CLI
[ ] Affected: Client integration (LibreChat/Telegram)
[ ] New dependencies ([ask which libraries])
```

---

**2.4 Tests**

```
Question: "Tests - выбери test cases (с указанием типа теста):"
Options (multiSelect - generate based on AC):
[Provide 5-10 specific test cases with test type in parentheses]
```

**Test Case Templates:**

**For Facade MCP tools:**
- [ ] Valid input → tool executes successfully (unit)
- [ ] Invalid input → validation error (unit)
- [ ] Unauthenticated request → auth error (unit)
- [ ] Full workflow: MCP call → manager → Neo4j (integration)

**For LangGraph workflow:**
- [ ] Single node execution with valid state (unit, mocked dependencies)
- [ ] Interrupt handling → state persisted to Redis (integration)
- [ ] Full workflow: start → clarify → confirm → persist (integration)
- [ ] Resume from checkpoint after interrupt (integration)
- [ ] Error in node → graceful handling (unit + integration)

**For Core Manager:**
- [ ] Manager method with valid input → correct output (unit, mocked Neo4j)
- [ ] Manager method with invalid input → business logic error (unit)
- [ ] Cypher query execution → correct Neo4j results (integration)
- [ ] Edge case: empty result set (integration)

**For Schema changes:**
- [ ] Migration script → schema updated correctly (integration)
- [ ] New properties added to existing nodes (integration)
- [ ] Queries use new schema fields (integration)

**For PDF/Parser services:**
- [ ] Valid PDF → text extracted correctly (unit)
- [ ] Invalid/corrupted PDF → error handling (unit)
- [ ] Empty file → graceful error (unit)
- [ ] Unsupported format → user-friendly error message (unit)

**For Integration tests quality:**
- [ ] Test validates business logic (not Zod guarantees)
- [ ] Test uses exact expectations (not weak assertions like `length > 0`)
- [ ] Test covers edge cases (boundary values, null, empty arrays)

---

### Step 3: Additional Sections (опциональные, спрашиваем multiSelect)

```
Question: "Заполнить дополнительные секции?"
Options (multiSelect):
[ ] Technical Design Notes (архитектурные решения, выбор библиотек, patterns)
[ ] Timeline/Dependencies (когда делать, что блокирует, prerequisites)
[ ] Out of Scope (что явно НЕ входит в feature, отложено в after MVP)
[ ] Philosophy/Context (как в Feature #13 - vision, why it matters, user value)
```

If user selects any → ask follow-up questions for each with structured options.

**Example for Technical Design Notes:**
```
Question: "Technical Design Notes - выбери что документировать:"
Options (multiSelect):
[ ] Library choice rationale (why pdf-parse vs pdfjs-dist?)
[ ] Architecture pattern (why this approach vs alternatives?)
[ ] State management strategy (why reducers vs manual merge?)
[ ] Performance considerations (caching, batching, optimization)
[ ] Security considerations (auth, validation, sanitization)
```

**Example for Timeline/Dependencies:**
```
Question: "Timeline/Dependencies:"
Options (multiSelect):
[ ] Blocked by: Feature #X (specify)
[ ] Depends on: Q&A resolution (specify which questions from 00_open_questions.md)
[ ] Implement before MVP
[ ] Implement after MVP (Phase 2)
[ ] Implement after Feature #X completes
```

**Example for Out of Scope:**
```
Question: "Out of Scope - что НЕ делаем в этой feature:"
Options (multiSelect):
[ ] Advanced features (specify: OCR for scanned PDFs, bulk import, etc.)
[ ] Performance optimization (defer to later)
[ ] UI/UX polish (focus on functionality first)
[ ] Edge cases handling (specify which edge cases to skip)
[ ] Integration with external services (specify which)
```

---

### Step 4: Assembly and Save

1. **Read** `features-registry.md` to get next Feature ID
2. **Generate feature entry** based on collected info
3. **Add to table** in "Pending Features" section
4. **Add detailed section** with all filled sections
5. **Show summary** to user with Feature ID and confirm

---

## Template Structure

```markdown
### Feature #N: [Title]
**Component**: [component(s)]
**Date**: [today's date YYYY-MM-DD]
**Priority**: [🔴 P0 / 🟡 P1 / 🟢 P2]

**Motivation**:
[Why needed - from Step 1.4]

**User Story**: [if provided in Step 2.1]
[As a X, I want Y, so that Z]

**Acceptance Criteria**: [from Step 2.2]
- [ ] [Criterion 1]
- [ ] [Criterion 2]
- [ ] Tests cover [specific scenarios from Step 2.4]

**Impact Assessment**: [from Step 2.3]
- Schema change: YES/NO
- Breaking change: YES/NO
- Requires migration: YES/NO
- Affected components: [list]
- New dependencies: [list if any]

**Tests**: [from Step 2.4]
- [ ] [Test case 1 with type]
- [ ] [Test case 2 with type]

[Optional sections from Step 3:]

**Technical Design Notes**: [if selected]
[Architecture decisions, library choices, patterns]

**Timeline/Dependencies**: [if selected]
- Blocked by: [list]
- Implement: [when - before/after MVP, after Feature #X]

**Out of Scope**: [if selected]
- [Item 1 not included in this feature]
- [Item 2 deferred to after MVP]

**Philosophy/Context**: [if selected]
[Vision, user value, why it matters]
```

---

## Priority Guidelines

- **🔴 P0 (Critical)**: Blocking MVP launch, security issue, data corruption risk, must have immediately
- **🟡 P1 (Important)**: High business value, user requested, improves UX significantly, important for MVP
- **🟢 P2 (Nice-to-have)**: Enhancement after MVP, optimization, quality-of-life improvement

---

## Important Notes

1. **NEVER invent details** - always ask through `AskUserQuestion`
2. **Use multiSelect** wherever user might want multiple options
3. **Provide "Other" option** for text input when appropriate
4. **Auto-assign Feature ID** by reading registry and finding next number
5. **Show summary** after adding feature for user confirmation
6. **Don't implement** - this command only adds to registry. Use `/implement-feature` to start work
7. **Update table** in "Pending Features" section with one-line summary
8. **Add detailed section** at the end of file with full information

---

## Example Execution

```
User: /request-feature

Step 1.1: Feature Title?
→ User selects: "Resume Upload Entry Point"

Step 1.2: Components?
→ User selects: [Facade MCP tools, LangGraph workflow, PDF Parser service]

Step 1.3: Priority?
→ User selects: 🟢 P2

Step 1.4: Motivation?
→ User selects: "Lower barrier to entry"

Step 2.1: User Story?
→ User selects: "As a user with resume, I want to upload PDF..."

Step 2.2: Acceptance Criteria?
→ User selects: [PDF parser service, LLM extraction, Integration with LangGraph, Full validation, Error handling]

Step 2.3: Impact Assessment?
→ User selects: [Affected: Facade MCP tools, New dependencies: pdf-parse]

Step 2.4: Tests?
→ User selects: [Valid PDF parsing (unit), Full workflow (integration), Edge case: corrupted PDF (unit)]

Step 3: Additional sections?
→ User selects: [Philosophy/Context, Out of Scope]

Step 3.1: Philosophy/Context?
→ User provides text about "Resume as starting point, not truth"

Step 3.2: Out of Scope?
→ User selects: [OCR for scanned PDFs, Bulk import, LinkedIn integration]

Step 4: Generate Feature #13, add to registry, show summary
→ "✅ Feature #13 added to registry. Use `/implement-feature 13` to start work."
```
