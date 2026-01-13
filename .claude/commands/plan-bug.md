---
description: "Проработка бага: PENDING → READY_FOR_WORK (Context, Fix Plan, DoD, Regression Prevention)"
allowed-tools: ["Read", "Edit", "AskUserQuestion"]
argument-hint: "[bug_id]"
---

# 🔍 Plan Bug (Detailed Analysis)

$ARGUMENTS

## Цель

Проработать баг из PENDING состояния в READY_FOR_WORK:
- Анализ Root Cause
- Определение Impact и рисков
- Составление Fix Plan
- Определение Context to Load (файлы для изучения)
- Формирование DoD и Regression Prevention
- Инструкции DO/DON'T для фикса

**Key Principle**: Детальная проработка ДО начала фикса экономит время и предотвращает регрессии.

---

## Workflow

### Phase 1: Load and Validate

1. **Read** `memory-bank/knowledge/bugs-registry.md`
2. **Find** bug by ID (from $ARGUMENTS or interactive selection via AskUserQuestion)
3. **Validate status**:
   - If status = PENDING → continue
   - If status = READY_FOR_WORK → "Bug already planned. Use /fix-bug to implement."
   - If status = RESOLVED/DONE → "Bug already resolved. Check registry."

4. **Read** task file `tasks/bugs/BUG-XXX.md` (PENDING state with minimal context)

---

### Phase 2: Interactive Planning (gather details through AskUserQuestion)

**Use multiple AskUserQuestion calls** (max 4 questions per call) to gather:

**2.1 Context to Load**

```
Question: "Какие файлы/документы изучить перед фиксом?"
Options (single select):
( ) Напишу сам через Other (список файлов с path:lines, документы в .claude/, memory-bank/)
```

User provides list of files/docs to study before fixing. Example:
```
- src/core/search-query-builder.ts (lines 140-160 - skill penalty logic)
- tests/integration/search-manager/adhoc-context-without-dtw.integration.ts (AC2 test)
- .claude/routers/cypher/cypher-rules.md (null safety, coalesce patterns)
- memory-bank/decisions.md (Skills Scoring Architecture Decision)
```

---

**2.2 Root Cause + Impact**

```
Question: "Root Cause - в чём причина бага?"
Options (single select):
( ) Напишу сам через Other (кратко: какой код/логика вызывает баг)

Question: "Impact - влияние на систему?"
Options (single select):
( ) Напишу сам через Other (какие компоненты затронуты, критичность, edge cases)
```

User provides:
- **Root Cause**: Brief analysis (which code/logic causes bug)
- **Impact**: Affected components, criticality, scope

**Example**:
```
Root Cause: Cypher CASE WHEN clause uses size(coalesce($excludedSkills, [])) instead of size(coalesce($skills, [])) for penalty calculation

Impact:
- Affects adhoc search when excludedSkills provided but skills empty
- Incorrect scoring (penalty applied when it shouldn't be)
- Integration test AC2 has wrong expected value (uses observed 0.99 instead of correct 1.0)
```

---

**2.3 Fix Approach + Edge Cases**

```
Question: "Fix Approach - пошаговый план фикса (что изменить, в каком порядке):"
Options (single select):
( ) Напишу сам через Other (конкретные шаги: Step 1, Step 2, Step 3...)

Question: "Edge Cases - какие граничные случаи проверить?"
Options (single select):
( ) Напишу сам через Other (null, empty, boundaries, outliers)
```

User provides:
- **Fix Approach**: Specific plan (what to change in code/Cypher/schema)
- **Edge Cases**: Boundary conditions to test

**Example**:
```
Fix Approach:
1. Change penalty calculation in search-query-builder.ts to use $skills array length
2. Update integration test AC2 expected value (0.99 → 1.0)
3. Add new test case for empty skills array

Edge Cases to Test:
- skills=[], excludedSkills=[] → penalty=0
- skills=[], excludedSkills=['react'] → penalty=0 (this validates the fix)
- skills=['python'], excludedSkills=[] → penalty based on skills
- skills=['python'], excludedSkills=['react'] → penalty based on skills (not excluded)
```

---

**2.4 Test Plan + DoD**

```
Question: "Test Plan - как проверить фикс?"
Options (single select):
( ) Напишу сам через Other (unit tests, integration tests, manual checks)

Question: "DoD - критерии готовности (что должно быть сделано/проверено)?"
Options (multiSelect):
[x] Bug reproduced with test case
[x] Fix implemented
[x] Integration tests pass
[x] Lint + tsc clean
[x] Code reviewed by reviewer agent
[x] QA validation passed
```

User provides:
- **Test Plan**: Specific tests to add/update
- **DoD**: Checklist of completion criteria

**Example**:
```
Test Plan:
- Add integration test case AC2b: skills=[], excludedSkills=['react'] → expect score=1.0
- Verify existing AC2 test passes with corrected expected value
- Run full integration test suite (no regressions)

DoD:
- [x] Bug reproduced with test case
- [x] Cypher query fixed (use $skills.length)
- [x] Integration test AC2b added
- [x] All integration tests pass
- [x] Lint + tsc clean
- [x] reviewer agent validation
- [x] qa agent validation
```

---

**2.5 Regression Prevention**

```
Question: "Regression Prevention - как предотвратить повторение?"
Options (single select):
( ) Напишу сам через Other (test case, documentation, code comment)
( ) Пропустить
```

User provides plan to prevent regression (usually a test).

**Example**:
```
Test: Add integration test case AC2b:
- Input: skills: [], excludedSkills: ['react']
- Expected: contextMatchScore = 1.0 (no penalty)
- Validates: penalty calculation uses correct array
- Prevents: future changes breaking empty skills logic
```

---

**2.6 General Instructions (DO/DON'T)**

```
Question: "General Instructions - что ДЕЛАТЬ и что НЕ ДЕЛАТЬ при фиксе?"
Options (single select):
( ) Напишу сам через Other (DO: ..., DON'T: ...)
( ) Пропустить (use defaults)
```

User provides specific instructions or skips for defaults.

**Example**:
```
DO:
- Use cypher-expert for query validation
- Add integration test for empty skills array case
- Verify AC2 test expectations (should be 0.99, not 1.0)

DON'T:
- Change scoring formula (only fix array reference)
- Skip integration tests (Cypher change)
- Modify excludedSkills logic (working as intended)
```

---

### Phase 3: Update Task File

**Expand** `tasks/bugs/BUG-XXX.md` with gathered information:

Add sections (keeping original Reproduction + Breadcrumbs):

```markdown
---

## Context to Load

**Перед фиксом изучить:**
[files/docs from Step 2.1]

---

## Analysis

**Root Cause**:
[from Step 2.2]

**Impact**:
[from Step 2.2]

---

## Fix Plan

**Approach**:
[from Step 2.3]

**Edge Cases to Test**:
[from Step 2.3]

---

## Test Plan

[from Step 2.4]

---

## General Instructions

**DO**:
[from Step 2.6]

**DON'T**:
[from Step 2.6]

---

## DoD (Definition of Done)

[checklist from Step 2.4]

---

## Regression Prevention

[from Step 2.5]
```

---

### Phase 4: Update Registry

**Edit** `memory-bank/knowledge/bugs-registry.md`:
- Find row with BUG-XXX
- Change status: PENDING → READY_FOR_WORK

```markdown
| BUG-XXX | 2025-11-15 | READY_FOR_WORK | [Title] | [Priority] | [Component] | [tasks/bugs/BUG-XXX.md](../../tasks/bugs/BUG-XXX.md) | [session] |
```

---

### Phase 5: Show Summary

```markdown
✅ Bug BUG-XXX planning complete!

**Status**: PENDING → READY_FOR_WORK
**File**: tasks/bugs/BUG-XXX.md (expanded with analysis, fix plan, DoD)
**Registry**: Updated to READY_FOR_WORK

**Added sections**:
- Context to Load ([N files/docs])
- Analysis (Root Cause + Impact)
- Fix Plan (Approach + Edge Cases)
- Test Plan
- General Instructions (DO/DON'T)
- DoD (N criteria)
- Regression Prevention

**Next step**:
Run `/fix-bug BUG-XXX` to implement fix (status check will pass)
```

---

### Phase 6: Offer TODO List

**Ask user**: Would you like to load Implementation Plan into TODO list?

Proposed tasks (from Fix Plan Approach):
```
- Step 1 from Fix Plan
- Step 2 from Fix Plan
- Step 3 from Fix Plan
- Call reviewer agent
- Call qa agent
- Run lint + tsc
- Run integration tests
- Update task file
- Update registry
```

If user agrees → call TodoWrite:
```typescript
TodoWrite({
  todos: [
    { content: "[Step 1 from Fix Plan]", status: "pending", activeForm: "[Step 1 in gerund]" },
    { content: "[Step 2 from Fix Plan]", status: "pending", activeForm: "[Step 2 in gerund]" },
    { content: "Call reviewer agent", status: "pending", activeForm: "Calling reviewer agent" },
    { content: "Call qa agent", status: "pending", activeForm: "Calling qa agent" },
    { content: "Run quality checks (lint + tsc)", status: "pending", activeForm: "Running quality checks" },
    { content: "Run integration tests", status: "pending", activeForm: "Running integration tests" },
    { content: "Update task file (Implementation Notes)", status: "pending", activeForm: "Updating task file" },
    { content: "Update registry (READY_FOR_WORK → RESOLVED)", status: "pending", activeForm: "Updating registry" }
  ]
})
```

---

## Important Notes

1. **Status validation**: MUST be PENDING to run /plan-bug
2. **Interactive gathering**: Use AskUserQuestion for ALL details (no guessing)
3. **File preservation**: Keep original Reproduction + Breadcrumbs sections
4. **Detailed planning**: More detail now = faster fix later
5. **Regression focus**: Always think about preventing recurrence

---

## Example Execution

```
User: /plan-bug BUG-001

Phase 1: Load and Validate
→ Read bugs-registry.md
→ Found BUG-001, status = PENDING ✓
→ Read tasks/bugs/BUG-001.md (minimal context)

Phase 2: Interactive Planning
→ AskUserQuestion: Context to Load?
  User: "src/core/search-query-builder.ts, tests/integration/..."

→ AskUserQuestion: Root Cause?
  User: "Cypher uses excludedSkills.length instead of skills.length"

→ AskUserQuestion: Impact?
  User: "Affects adhoc search, incorrect scoring"

→ AskUserQuestion: Fix Approach?
  User: "Change to $skills.length, update test expectations"

→ AskUserQuestion: Edge Cases?
  User: "Empty skills, empty excluded, both empty, both present"

→ AskUserQuestion: Test Plan?
  User: "Add AC2b test case, verify AC2 expectations"

→ AskUserQuestion: DoD?
  User: Selects all criteria

→ AskUserQuestion: Regression Prevention?
  User: "Integration test AC2b prevents regression"

→ AskUserQuestion: General Instructions?
  User: "DO: use cypher-expert, DON'T: change formula"

Phase 3: Update Task File
→ Edit tasks/bugs/BUG-001.md (add 7 sections: Context, Analysis, Fix Plan, Test Plan, Instructions, DoD, Regression Prevention)

Phase 4: Update Registry
→ Edit bugs-registry.md (PENDING → READY_FOR_WORK)

Phase 5: Show Summary
→ "✅ Bug BUG-001 planning complete. Run /fix-bug BUG-001 to implement."

Phase 6: Offer TODO List
→ Ask: "Load Implementation Plan into TODO list?"
→ If yes → TodoWrite with steps from Fix Plan + quality gates
```

---

## Next Steps After Planning

- Use `/fix-bug BUG-XXX` to implement fix (will load expanded task file with all planning details)

---

Would you like to:
1. Create git commit? `git add . && git commit -m "plan: Bug BUG-XXX analysis complete"`
2. Run /sync-memory to update Memory Bank?
