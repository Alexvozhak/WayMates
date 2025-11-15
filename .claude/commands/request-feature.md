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

### Step 1: Gather Minimal Info (ONE question)

Use `AskUserQuestion` with **2 questions**:

**Question 1: Feature Title + Description**
- Prompt: "Название фичи и краткое описание (1 предложение):"
- header: "Title"
- Only "Other" field for custom input
- Example: "Add languages B2+ support | Добавить фильтрацию по языкам B2+ в поиске карьерных путей"
- Format: Title | Description (single line)

**Question 2: Priority**
- Prompt: "Приоритет фичи?"
- header: "Priority"
- Single select:
  - 🔴 P0 (Critical) - Blocking MVP, security issue, critical business value
  - 🟡 P1 (Important) - High business value, important for MVP
  - 🟢 P2 (Nice-to-have) - Enhancement after MVP, optimization

---

### Step 2: Generate and Save

1. **Read** `memory-bank/knowledge/features-registry.md` to get next Feature ID:
   - Parse table, find max ID (FEAT-001, FEAT-002, etc.)
   - Next ID = max + 1
   - Format: `FEAT-XXX` (zero-padded 3 digits: FEAT-001, FEAT-010, FEAT-100)

2. **Parse** Title and Description from Step 1 (split by " | ")

3. **Create** `tasks/features/FEAT-XXX.md` with MINIMAL PENDING template:

```markdown
# [Title from Step 1]

**Priority**: [priority emoji from Step 1]

[Description from Step 1 - single line]
```

**That's it.** 3 lines total. User Story, AS IS, TO BE создаются в `/plan-feature`.

4. **Add registry entry** to `memory-bank/knowledge/features-registry.md`:
   - Find table section (after `# Features Registry`)
   - Add new row:

```markdown
| FEAT-XXX | YYYY-MM-DD | PENDING | [Feature Title] | [Priority] | Multiple | [tasks/features/FEAT-XXX.md](../../tasks/features/FEAT-XXX.md) | session-[current] |
```

**Note**:
- Component = "Multiple" (default, уточняется в /plan-feature)
- Session ID = current Claude session (timestamp или env)

5. **Show summary** to user:

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

**Priority**: [🔴 P0 / 🟡 P1 / 🟢 P2]

[Single line description]
```

**Example**:
```markdown
# Add languages B2+ support to Context

**Priority**: 🟡 P1

Добавить фильтрацию по языкам с уровнем B2+ в поиске карьерных путей.
```

**That's it.** User Story, AS IS, TO BE, Component, Architecture → всё добавляется в `/plan-feature`.

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

1. **Minimal PENDING file**: Only Title + Priority + 1-line description (3 lines total)
2. **Feature ID assignment**: Always max(existing IDs) + 1, zero-padded 3 digits
3. **Date format**: YYYY-MM-DD (ISO)
4. **Status**: Always "PENDING" при создании
5. **Session ID**: timestamp или env variable
6. **File path**: Relative link from registry: `../../tasks/features/FEAT-XXX.md`
7. **Component**: Default "Multiple" в registry (уточняется в /plan-feature)
8. **Planning**: User Story, AS IS, TO BE, Type Schema → всё создаётся в `/plan-feature`
9. **Single question**: Ask Title+Description | Priority в ONE AskUserQuestion call (2 questions)

---

## Example Execution

```
User: /request-feature

Step 1: Ask Title+Description and Priority (ONE call, 2 questions)
→ Question 1: "Название фичи и краткое описание (1 предложение):"
  User writes: "Add languages B2+ support | Добавить фильтрацию по языкам B2+ в поиске"

→ Question 2: "Приоритет?"
  User selects: 🟡 P1

Step 2: Parse input
→ Title: "Add languages B2+ support"
→ Description: "Добавить фильтрацию по языкам B2+ в поиске"
→ Priority: 🟡 P1

Step 3: Create FEAT-018.md (3 lines)
```markdown
# Add languages B2+ support

**Priority**: 🟡 P1

Добавить фильтрацию по языкам B2+ в поиске.
```

Step 4: Add to registry
| FEAT-018 | 2025-11-15 | PENDING | Add languages B2+ support | 🟡 P1 | Multiple | [...] | session-2025-11-15 |

Step 5: Show summary
→ "✅ FEAT-018 created (PENDING). Run /plan-feature FEAT-018 for Type Schema + Architecture."
```

---

## Next Steps After Creation

- Use `/plan-feature FEAT-XXX` to design Type Schema, Architecture, Implementation Plan (PENDING → READY_FOR_WORK)
- Use `/implement-feature FEAT-XXX` to implement (requires READY_FOR_WORK status)

---

Would you like to:
1. Create git commit? `git add . && git commit -m "request: Feature FEAT-XXX - [title]"`
2. Run /sync-memory to update Memory Bank?
