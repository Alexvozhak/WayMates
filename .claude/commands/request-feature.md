---
description: "Создать FEAT-XXX.md (PENDING) + запись в features-registry.md"
allowed-tools: ["Read", "Write", "AskUserQuestion", "Bash"]
argument-hint: "[optional: feature title]"
---

# ✨ Request Feature (New Workflow)

$ARGUMENTS

## Цель

Создать МИНИМАЛЬНЫЙ task file (PENDING) + запись в features-registry.md для дальнейшей проработки через /plan-feature.

**Key Principle**: Быстрая фиксация идеи, детальная проработка (Type Schema, Architecture) - позже.

---

## Workflow

### Step 1: Gather Minimal Context (обязательные поля)

Use `AskUserQuestion` to gather:

**1.1 Feature Title**
- Short, descriptive (5-10 words)
- User writes through "Other" option
- Example: "Add salary range to Context schema"

**1.2 Component/Module**
- Single select: which component affected?
- Options: Facade MCP, Core Manager, LangGraph workflow, Schema, Admin CLI, Integration tests, Client integration, Context schema, Search query builder, etc.
- Provide "Other" for custom component

**1.3 Priority**
- Single select: 🔴 P0 (Critical) / 🟡 P1 (Important) / 🟢 P2 (Nice-to-have)
- Guidelines:
  - 🔴 P0: Blocking MVP, security issue, critical business value
  - 🟡 P1: High business value, important for MVP, user requested
  - 🟢 P2: Enhancement after MVP, optimization, nice-to-have

---

### Step 2: Feature Context

**2.1 User Story**

```
Question: "User Story - опиши в формате As a X, I want Y, so that Z:"
Options (single select):
( ) Напишу сам (через Other)
```

User provides:
```
As a [user type], I want [goal], so that [benefit].
```

**Example**:
```
As a user planning career transition, I want to see salary ranges for contexts, so that I can filter realistic opportunities matching my financial expectations.
```

---

**2.2 AS IS (current state)**

```
Question: "AS IS - текущее состояние (кратко, лаконично, по делу):"
Options (single select):
( ) Напишу сам (через Other)
```

User provides brief current state description.

**Example**:
```
Context schema has no salary information. Users cannot filter by salary or see typical compensation progression in career paths.
```

---

**2.3 TO BE (desired state)**

```
Question: "TO BE - желаемое состояние (кратко, лаконично, по делу):"
Options (single select):
( ) Напишу сам (через Other)
```

User provides brief desired state description.

**Example**:
```
Context schema extended with `salaryMin`, `salaryMax` (optional, USD). Search supports salary range filtering. Map projection returns salary fields. Test data demonstrates usage.
```

---

### Step 3: Generate and Save

1. **Read** `memory-bank/knowledge/features-registry.md` to get next Feature ID:
   - Parse table, find max ID (FEAT-001, FEAT-002, etc.)
   - Next ID = max + 1
   - Format: `FEAT-XXX` (zero-padded 3 digits: FEAT-001, FEAT-010, FEAT-100)

2. **Create** `tasks/features/FEAT-XXX.md` with PENDING template:

```markdown
# [Feature Title from Step 1.1]

**Component**: [component from Step 1.2]

**Priority**: [priority emoji from Step 1.3]

---

## User Story

[user story from Step 2.1]

---

## AS IS

[current state from Step 2.2]

---

## TO BE

[desired state from Step 2.3]
```

3. **Add registry entry** to `memory-bank/knowledge/features-registry.md`:
   - Find table section (after `# Features Registry`)
   - Add new row:

```markdown
| FEAT-XXX | YYYY-MM-DD | PENDING | [Feature Title] | [Priority] | [Component] | [tasks/features/FEAT-XXX.md](../../tasks/features/FEAT-XXX.md) | session-[current] |
```

**Note**: Session ID = current Claude session (timestamp или env)

4. **Show summary** to user:

```markdown
✅ Feature FEAT-XXX created!

**Status**: PENDING (needs planning)
**File**: tasks/features/FEAT-XXX.md
**Registry**: memory-bank/knowledge/features-registry.md

**Next steps**:
1. Run `/plan-feature FEAT-XXX` to design Type Schema and Architecture (PENDING → READY_FOR_WORK)
2. Run `/implement-feature FEAT-XXX` to implement (requires READY_FOR_WORK status)
```

---

## Template: FEAT-XXX.md (PENDING)

```markdown
# [Feature Title]

**Component**: [component-name]

**Priority**: [🔴 P0 / 🟡 P1 / 🟢 P2]

---

## User Story

[As a X, I want Y, so that Z]

---

## AS IS

[Текущее состояние - кратко, лаконично, ёмко, по делу]

---

## TO BE

[Желаемое состояние - кратко, лаконично, ёмко, по делу]
```

---

## Registry Entry Format

Table in `memory-bank/knowledge/features-registry.md`:

```markdown
| ID | Date | Status | Title | Priority | Component | File | Session |
|----|------|--------|-------|----------|-----------|------|---------|
| FEAT-001 | 2025-11-15 | PENDING | Add salary range to Context | 🟡 P1 | context-schema | [tasks/features/FEAT-001.md](../../tasks/features/FEAT-001.md) | session-abc123 |
```

---

## Important Notes

1. **NEVER invent details** - always ask through `AskUserQuestion`
2. **Feature ID assignment**: Always max(existing IDs) + 1, zero-padded 3 digits
3. **Date format**: YYYY-MM-DD (ISO)
4. **Status**: Always "PENDING" при создании
5. **Session ID**: timestamp или env variable
6. **File path**: Relative link from registry: `../../tasks/features/FEAT-XXX.md`
7. **Minimal context**: Just User Story + AS IS + TO BE, проработка (Type Schema, Architecture) в /plan-feature
8. **Brevity**: AS IS и TO BE должны быть минимально достаточными, без воды

---

## Example Execution

```
User: /request-feature

Step 1.1: Feature Title?
→ User writes: "Add salary range to Context schema"

Step 1.2: Component?
→ User selects: "context-schema"

Step 1.3: Priority?
→ User selects: 🟡 P1

Step 2.1: User Story?
→ User writes: "As a user planning career transition, I want to see salary ranges, so that I can filter realistic opportunities"

Step 2.2: AS IS?
→ User writes: "Context schema has no salary info"

Step 2.3: TO BE?
→ User writes: "Context with salaryMin/salaryMax fields, map projection returns them"

Step 3: Generate FEAT-001, create task file, add registry entry, show summary
→ "✅ Feature FEAT-001 created. Run /plan-feature FEAT-001 to design Type Schema."
```

---

## Next Steps After Creation

- Use `/plan-feature FEAT-XXX` to design Type Schema, Architecture, Implementation Plan (PENDING → READY_FOR_WORK)
- Use `/implement-feature FEAT-XXX` to implement (requires READY_FOR_WORK status)

---

Would you like to:
1. Create git commit? `git add . && git commit -m "request: Feature FEAT-XXX - [title]"`
2. Run /sync-memory to update Memory Bank?
