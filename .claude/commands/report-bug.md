---
description: "Создать BUG-XXX.md (PENDING) + запись в bugs-registry.md"
allowed-tools: ["Read", "Write", "AskUserQuestion", "Bash"]
argument-hint: "[optional: bug title]"
---

# 🐛 Report Bug (New Workflow)

$ARGUMENTS

## Цель

Создать МИНИМАЛЬНЫЙ task file (PENDING) + запись в bugs-registry.md для дальнейшей проработки через /plan-bug.

**Key Principle**: Быстрая фиксация проблемы, детальная проработка - позже.

---

## Workflow

### Step 1: Gather Minimal Context (обязательные поля)

Use `AskUserQuestion` to gather:

**1.1 Bug Title**
- Short, descriptive (≤ 60 chars)
- User writes through "Other" option
- Example: "Skills penalty applied when skills excluded"

**1.2 Component**
- Single select (user can pick one primary component)
- Options: search-query-builder, target-query-builder, goals-query-builder, persistence-query-builder, search-manager, goals-manager, story-manager, schemas, integration tests, trajectory-similarity, test-infrastructure, etc.
- Provide "Other" for custom component name

**1.3 Priority**
- Single select: 🔴 P0 (Critical) / 🟡 P1 (Important) / 🟢 P2 (Minor)
- Guidelines:
  - 🔴 P0: Data corruption, incorrect business logic, security issue, blocking
  - 🟡 P1: UX issue, performance degradation, maintainability problem
  - 🟢 P2: Minor issue, edge case, nice-to-have fix

---

### Step 2: Reproduction Details

**2.1 Steps to Reproduce**

```
Question: "How to Reproduce - минимально достаточный пример (код/шаги):"
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

User provides:
- **Expected**: [what should happen]
- **Actual**: [what actually happens]

**Example**:
```
Expected: No skill penalty when skills=[] and excludedSkills=['react']
Actual: Penalty 0.01 applied (1 excluded skill * default penalty 1.0)
```

---

**2.3 Breadcrumbs (optional, 1-2 sentences)**

```
Question: "Breadcrumbs - куда копать, с чего начать (1-2 предложения, опционально):"
Options (single select):
( ) Напишу сам (через Other)
( ) Пропустить (проработаю в /plan-bug)
```

User provides brief hint or skips.

**Example**:
```
Cypher query в search-query-builder.ts использует excludedSkills.length вместо skills.length для расчёта penalty. Проверить CASE WHEN логику в scoring секции.
```

---

### Step 3: Generate and Save

1. **Read** `memory-bank/knowledge/bugs-registry.md` to get next Bug ID:
   - Parse table, find max ID (BUG-001, BUG-002, etc.)
   - Next ID = max + 1
   - Format: `BUG-XXX` (zero-padded 3 digits: BUG-001, BUG-010, BUG-100)

2. **Create** `tasks/bugs/BUG-XXX.md` with PENDING template:

```markdown
# [Bug Title from Step 1.1]

**Component**: [component from Step 1.2]

**Priority**: [priority emoji from Step 1.3]

---

## Reproduction

**Steps**:
[steps from Step 2.1]

**Expected**:
[expected from Step 2.2]

**Actual**:
[actual from Step 2.2]

---

## Breadcrumbs

[breadcrumbs from Step 2.3, or empty if skipped]
```

3. **Add registry entry** to `memory-bank/knowledge/bugs-registry.md`:
   - Find table section (after `# Bugs Registry`)
   - Add new row:

```markdown
| BUG-XXX | YYYY-MM-DD | PENDING | [Bug Title] | [Priority] | [Component] | [tasks/bugs/BUG-XXX.md](../../tasks/bugs/BUG-XXX.md) | session-[current] |
```

**Note**: Session ID = current Claude session (можно взять из env или генерировать timestamp)

4. **Show summary** to user:

```markdown
✅ Bug BUG-XXX created!

**Status**: PENDING (needs planning)
**File**: tasks/bugs/BUG-XXX.md
**Registry**: memory-bank/knowledge/bugs-registry.md

**Next steps**:
1. Run `/plan-bug BUG-XXX` to analyze and prepare fix plan (PENDING → READY_FOR_WORK)
2. Run `/fix-bug BUG-XXX` to implement fix (requires READY_FOR_WORK status)
```

---

## Template: BUG-XXX.md (PENDING)

```markdown
# [Bug Title]

**Component**: [component-name]

**Priority**: [🔴 P0 / 🟡 P1 / 🟢 P2]

---

## Reproduction

**Steps**:
[user-provided steps]

**Expected**:
[user-provided expected behavior]

**Actual**:
[user-provided actual behavior]

---

## Breadcrumbs

[user-provided hint or empty]
```

---

## Registry Entry Format

Table in `memory-bank/knowledge/bugs-registry.md`:

```markdown
| ID | Date | Status | Title | Priority | Component | File | Session |
|----|------|--------|-------|----------|-----------|------|---------|
| BUG-001 | 2025-11-15 | PENDING | Skills penalty when excluded | 🔴 P0 | search-query-builder | [tasks/bugs/BUG-001.md](../../tasks/bugs/BUG-001.md) | session-abc123 |
```

---

## Important Notes

1. **NEVER invent details** - always ask through `AskUserQuestion`
2. **Bug ID assignment**: Always max(existing IDs) + 1, zero-padded 3 digits
3. **Date format**: YYYY-MM-DD (ISO)
4. **Status**: Always "PENDING" при создании
5. **Session ID**: timestamp или env variable
6. **File path**: Relative link from registry: `../../tasks/bugs/BUG-XXX.md`
7. **Minimal context**: Just reproduction + breadcrumbs, проработка в /plan-bug

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

Step 2.3: Breadcrumbs?
→ User writes: "Cypher uses excludedSkills.length instead of skills.length"

Step 3: Generate BUG-001, create task file, add registry entry, show summary
→ "✅ Bug BUG-001 created. Run /plan-bug BUG-001 to prepare fix plan."
```

---

## Next Steps After Creation

- Use `/plan-bug BUG-XXX` to analyze and prepare detailed fix plan (PENDING → READY_FOR_WORK)
- Use `/fix-bug BUG-XXX` to implement fix (requires READY_FOR_WORK status)

---

Would you like to:
1. Create git commit? `git add . && git commit -m "report: Bug BUG-XXX - [title]"`
2. Run /sync-memory to update Memory Bank?
