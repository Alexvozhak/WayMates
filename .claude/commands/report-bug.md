---
description: "Добавить production bug в bugs-registry.md с полным описанием и критериями приемки"
allowed-tools: ["Read", "Edit", "AskUserQuestion", "mcp__memory__*"]
argument-hint: "[optional: bug title]"
---

# 🐛 Report Bug для WayMates

$ARGUMENTS

## Цель

Зарегистрировать production bug или design flaw в `memory-bank/knowledge/bugs-registry.md` через интерактивный сбор информации.

**Key Principle**: DON'T invent details - ask user for everything through `AskUserQuestion`.

---

## Workflow

### Step 1: Gather Basic Info (обязательные поля)

Use `AskUserQuestion` to gather:

**1.1 Bug Title**
- Short, descriptive (≤ 60 chars)
- User writes through "Other" option
- Example: "Skills penalty applied when skills excluded"

**1.2 Component**
- Single select (user can pick one primary component)
- Options: search-query-builder, target-query-builder, goals-query-builder, persistence-query-builder, search-manager, goals-manager, story-manager, schemas, integration tests, etc.
- Provide "Other" for custom component name

**1.3 Priority**
- Single select: 🔴 P0 (Critical) / 🟡 P1 (Important) / 🟢 P2 (Minor)
- Guidelines:
  - 🔴 P0: Data corruption, incorrect business logic, security issue, blocking
  - 🟡 P1: UX issue, performance degradation, maintainability problem
  - 🟢 P2: Minor issue, edge case, nice-to-have fix

---

### Step 2: Standard Sections (всегда спрашиваем последовательно)

**2.1 How to Reproduce**

```
Question: "How to Reproduce - опиши минимальный пример:"
Options (single select):
( ) Напишу сам (через Other - пользователь пишет текстом)
```

User provides:
- Code snippet
- Test case name
- API call with parameters
- Steps to reproduce

**Example**:
```typescript
const result = await searchManager.searchByUser({
  userId: 'usr_1',
  mode: 'adhoc',
  referenceContext: { skills: [], excludedSkills: ['react'] }
});
// Bug: penalty applied even though skills array is empty
```

---

**2.2 Expected vs Actual**

```
Question: "Expected vs Actual - что ожидаешь и что получаешь:"
Options (single select):
( ) Напишу сам (через Other)
```

User provides structured description:
- **Expected**: [what should happen]
- **Actual**: [what actually happens]

**Example**:
```
Expected: No skill penalty when skills=[] and excludedSkills=['react']
Actual: Penalty 0.01 applied (1 excluded skill * default penalty 1.0)
```

---

**2.3 Root Cause** (optional, но рекомендуется)

```
Question: "Root Cause - если известен, опиши:"
Options (single select):
( ) Напишу сам (через Other)
( ) Пока не знаю (requires investigation)
```

User provides:
- Cypher query snippet with comment
- Code logic explanation
- Configuration issue description

**Example**:
```cypher
// Bug: penalty calculated from excludedSkills length, not skills length
WITH size(coalesce($excludedSkills, [])) AS numExcluded
RETURN 1.0 - (numExcluded * $skillPenalty / 100.0) AS score
// Should use: size(coalesce($skills, []))
```

---

**2.4 Impact**

```
Question: "Impact - опиши последствия:"
Options (single select):
( ) Напишу сам (через Other)
```

User provides bullet list with ❌ (critical) or ⚠️ (warning):

**Example**:
```
❌ Scoring mismatch: excluded skills penalize when they shouldn't
⚠️ Affects adhoc search when excludedSkills provided
⚠️ Integration test doesn't catch this (uses wrong expected value)
```

---

**2.5 Acceptance Criteria**

```
Question: "Acceptance Criteria - выбери нужные пункты для bug fix:"
Options (multiSelect):
[ ] Bug reproduced with test case
[ ] Root cause identified and documented
[ ] Fix implemented in affected component
[ ] Test updated to catch regression
[ ] All integration tests pass (no regressions)
[ ] Code reviewed (by reviewer agent or manually)
[ ] Documentation updated (if logic changed)
```

---

### Step 3: Optional Sections

```
Question: "Заполнить дополнительные секции?"
Options (multiSelect):
[ ] Fix Ideas (варианты решения с Pros/Cons)
[ ] References (links to tests, related bugs, Memory MCP entities)
[ ] Context (как обнаружен, в каком сценарии)
```

If user selects any → ask follow-up:

**3.1 Fix Ideas** (if selected):
```
Question: "Fix Ideas - опиши варианты решения:"
Options (single select):
( ) Напишу сам (через Other)
```

User provides structured options:

**Example**:
```
**Option 1**: Use skills.length instead of excludedSkills.length
- Pros: Correct logic, minimal change
- Cons: None

**Option 2**: Remove penalty logic entirely
- Pros: Simpler code
- Cons: Changes scoring behavior
```

**3.2 References** (if selected):
```
Question: "References - какие ссылки добавить:"
Options (multiSelect):
[ ] Test file (укажи путь)
[ ] Related bug ID
[ ] Memory MCP entity
[ ] Git commit / PR
[ ] Documentation link
[ ] Other (напишу сам)
```

**3.3 Context** (if selected):
```
Question: "Context - как обнаружен:"
Options (single select):
( ) Напишу сам (через Other)
```

User provides discovery context:

**Example**:
```
Discovered during Feature #4 implementation (integration test improvements).
Reviewer agent flagged AC2 test with hardcoded expected score 0.99.
Investigation revealed penalty calculation uses wrong array.
```

---

### Step 4: Assembly and Save

1. **Read** `bugs-registry.md` to get next Bug ID (max ID + 1)
2. **Generate bug entry** based on collected info
3. **Add to table** in Registry section
4. **Add detailed section** in Bug Details
5. **Create Memory MCP entity** (ALWAYS)
6. **Show summary** to user with Bug ID

---

## Template Structure

### Registry Table Entry:

```markdown
| #N | YYYY-MM-DD | component-name | Bug title | Open | 🔴 P0 |
```

### Bug Details Section:

```markdown
### #N: Bug Title

**Discovered**: YYYY-MM-DD ([context if provided])

**Component**: `path/to/file.ts:lines` or component name

**How to Reproduce**:
[code block or steps from Step 2.1]

**Expected**:
[description from Step 2.2]

**Actual**:
[description from Step 2.2]

**Root Cause**: [if provided from Step 2.3]
[explanation + code snippet]

**Impact**:
[bullet list from Step 2.4]

**Fix Ideas**: [if provided from Step 3.1]
**Option 1**: Description
- Pros: ...
- Cons: ...

**Acceptance Criteria**: [from Step 2.5]
- [ ] Criteria 1
- [ ] Criteria 2

**Decision**: PENDING

**References**: [if provided from Step 3.2]
- [links]
```

### Memory MCP Entity (ALWAYS):

```typescript
mcp__memory__create_entities({
  entities: [{
    name: "Bug #N: Bug Title",
    entityType: "bug",
    observations: [
      "Component: [component]",
      "Priority: [priority]",
      "Status: Open",
      "Root cause: [brief if known]",
      "Impact: [main impact]",
      "Discovered: YYYY-MM-DD"
    ]
  }]
})
```

---

## Priority Guidelines

- **🔴 P0 (Critical)**: Data corruption, incorrect business logic results, security issue, blocking production
- **🟡 P1 (Important)**: UX confusion, performance issue, maintainability problem, affects many users
- **🟢 P2 (Minor)**: Edge case, cosmetic issue, minor inconsistency

---

## Important Notes

1. **NEVER invent details** - always ask through `AskUserQuestion`
2. **Bug ID assignment**: Always max(existing IDs) + 1
3. **Date format**: YYYY-MM-DD (ISO)
4. **Status**: Always "Open" при создании
5. **Code snippets**: Use ```typescript or ```cypher blocks
6. **Impact bullets**: Start with ❌ (critical) or ⚠️ (warning)
7. **Memory MCP**: Create entity ALWAYS (for tracking across sessions)
8. **Decision**: Always "PENDING" initially (approve/reject during fix planning)

---

## Example Execution

```
User: /report-bug

Step 1.1: Bug Title?
→ User writes: "Skills penalty applied when skills excluded"

Step 1.2: Component?
→ User selects: "search-query-builder"

Step 1.3: Priority?
→ User selects: 🔴 P0

Step 2.1: How to Reproduce?
→ User writes: "Call searchByUser with skills=[], excludedSkills=['react']"

Step 2.2: Expected vs Actual?
→ User writes:
   Expected: No penalty (skills array empty)
   Actual: Penalty 0.01 applied

Step 2.3: Root Cause?
→ User writes: "Cypher uses excludedSkills.length instead of skills.length"

Step 2.4: Impact?
→ User writes:
   ❌ Scoring mismatch
   ⚠️ Integration test uses wrong expected value

Step 2.5: Acceptance Criteria?
→ User selects: [Bug reproduced, Fix implemented, Test updated, All tests pass]

Step 3: Additional sections?
→ User selects: [Fix Ideas, Context]

Step 3.1: Fix Ideas?
→ User writes: "Use skills.length instead"

Step 3.3: Context?
→ User writes: "Discovered during Feature #4"

Step 4: Generate Bug #3, add to registry, create Memory MCP entity, show summary
→ "✅ Bug #3 registered. Use `/fix-bug 3` to start fix workflow."
```

---

## Next Steps After Registration

- Use `/fix-bug N` to start fix workflow (loads context, implements fix, runs tests)
- Or manually implement fix and update bug status to RESOLVED in registry
- Use `/sync-memory` to archive RESOLVED bugs
