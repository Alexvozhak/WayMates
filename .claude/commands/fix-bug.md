---
description: "Исправить баг с проверкой статуса + использование task file"
allowed-tools: ["Read", "Write", "Edit", "Task", "AskUserQuestion", "Bash"]
argument-hint: "[optional: bug_id]"
---

# 🔧 Fix Bug (Implementation)

$ARGUMENTS

## Цель

Исправить баг, используя детальный plan из task file (READY_FOR_WORK).

**Workflow**: Load task file → Load context → Fix → reviewer → qa → tests → Update registry

**Key Principle**: Следуй Fix Plan из task file, не изобретай решение заново.

---

## Workflow

### Phase 1: Select Bug (Interactive)

1. **Read** `memory-bank/knowledge/bugs-registry.md`
2. **Parse** all bugs (exclude RESOLVED/DONE if user wants)
3. **Show interactive selection** using `AskUserQuestion`:

```typescript
AskUserQuestion({
  questions: [{
    question: "Which bug do you want to fix?",
    header: "Select bug",
    multiSelect: false,
    options: [
      {
        label: "#BUG-001 | search-query-builder | P0 🔴",
        description: "Skills penalty applied when excluded. Status: READY_FOR_WORK"
      },
      {
        label: "#BUG-002 | trajectory-similarity | P1 🟡",
        description: "DTW metrics calculation. Status: PENDING (needs /plan-bug first!)"
      }
    ]
  }]
})
```

**Format для options**:
- **label**: `#BUG-XXX | component | Priority emoji` (max 50 chars)
- **description**: Brief description + Status

---

### Phase 2: Validate Status

**CRITICAL**: Check status in registry BEFORE loading task file.

```
If status = PENDING:
  → Show error message:
    "❌ Bug BUG-XXX is PENDING (not planned yet).

    Run /plan-bug BUG-XXX first to:
    - Analyze Root Cause
    - Prepare Fix Plan
    - Define DoD and Regression Prevention

    Then run /fix-bug BUG-XXX again."
  → STOP (do NOT proceed)

If status = READY_FOR_WORK:
  → Continue to Phase 3

If status = RESOLVED or DONE:
  → Show message: "Bug BUG-XXX already resolved. Check registry for details."
  → STOP
```

---

### Phase 3: Load Context

1. **Read** `tasks/bugs/BUG-XXX.md` (READY_FOR_WORK state with full planning)

2. **Parse sections**:
   - Reproduction (Steps, Expected, Actual)
   - Context to Load (files/docs to study)
   - Analysis (Root Cause, Impact)
   - Fix Plan (Approach, Edge Cases)
   - Test Plan
   - General Instructions (DO/DON'T)
   - DoD
   - Regression Prevention

3. **Show brief summary**:

```markdown
📋 Bug BUG-XXX loaded: [Title]

**Component**: [component]
**Priority**: [priority]
**Status**: READY_FOR_WORK ✓

📂 Context to Load ([N files/docs]):
[list files from Context to Load section]

🔍 Root Cause:
[brief from Analysis section]

🛠️ Fix Approach:
[brief from Fix Plan section]

Ready to fix. Proceeding to load context files...
```

4. **Load files** from Context to Load section:
   - Use Read tool for each file/doc
   - Load relevant line ranges if specified
   - Load .claude/ docs if referenced

---

### Phase 3.5: Quick Analysis (Show Understanding)

**Before implementing, show analysis**:

```markdown
📊 Quick Analysis:

**Root Cause**: [1-2 sentences from Analysis section]

**Fix Approach**: [1-2 sentences from Fix Plan]

**Files to Change**:
- [file1.ts] - [what will be changed]
- [file2.ts] - [what will be changed]

**Tests to Add/Update**:
- [test name] - [purpose]

Proceeding with implementation...
```

**Purpose**: Demonstrate understanding before action, allow user to stop if analysis is wrong.

---

### Phase 4: Implement Fix

**Follow Fix Plan strictly**:
1. Apply Fix Approach from task file
2. Follow General Instructions (DO/DON'T)
3. Handle Edge Cases identified in plan
4. Add/update tests per Test Plan

**Track Progress**: Mark todos as completed using TodoWrite as you finish steps.

**DO NOT**:
- Deviate from Fix Plan without justification
- Skip steps outlined in Implementation section
- Ignore Edge Cases
- Skip tests

**If Cypher queries involved**:
- Call `cypher-expert` agent if query changes needed
- Provide cypher-expert with Fix Approach context

---

### Phase 5: Quality Gates (MANDATORY)

**5.0 Pre-flight Checks**

Before running tests, verify test infrastructure:

```bash
# Check Neo4j test DB is running (required for integration tests)
docker ps | grep neo4j-test
```

If neo4j-test not running:
```
⚠️ Warning: neo4j-test container not running.

Integration tests will fail. Start it with:
  docker compose up -d neo4j-test

Continue anyway? (y/n)
```

---

**5.1 Call reviewer Agent**

```
Automatically call reviewer agent:
- Provide: changed files, Fix Plan context
- Check: bugs, edge cases, DRY violations, type compliance
- Fix: critical issues before proceeding
```

---

**5.2 Call qa Agent**

```
Automatically call qa agent:
- Provide: test changes, DoD from task file
- Check: test coverage, quality, business logic validation
- Verify: DoD criteria met
```

---

**5.3 Run Quality Checks**

```bash
# MANDATORY - always run
npm run lint:fix
npx tsc --noEmit

# If logic changed
npm run test:unit

# If Cypher/schema changed (check task file Impact section)
npm run test:integration
```

**Fix ALL errors** before proceeding.

**Note**: Warnings from pre-existing code are acceptable, but NO NEW errors.

---

### Phase 6: Update Task File

**Add Implementation Notes** to `tasks/bugs/BUG-XXX.md`:

```markdown
---

## Implementation Notes

**Date**: YYYY-MM-DD
**Implemented by**: Claude session [session-id]

**Changes**:
- [List specific changes made]
- [Files modified with brief description]
- [Tests added/updated]

**Verification**:
- reviewer agent: [status - passed/issues fixed]
- qa agent: [status - passed]
- Lint: PASSED ✓
- TypeScript: PASSED ✓
- Tests: [X/Y passed]

**Commit**: [hash if committed, or "pending commit"]

**DoD Status**:
[Copy DoD checklist from task file with checkmarks updated]
```

---

### Phase 7: Update Registry

**Edit** `memory-bank/knowledge/bugs-registry.md`:
- Find row with BUG-XXX
- Change status: READY_FOR_WORK → RESOLVED

```markdown
| BUG-XXX | 2025-11-15 | RESOLVED | [Title] | [Priority] | [Component] | [tasks/bugs/BUG-XXX.md](../../tasks/bugs/BUG-XXX.md) | [session] |
```

**Optional**: Add commit hash column if committed.

---

### Phase 8: Report Results

```markdown
✅ Bug BUG-XXX fixed and marked as RESOLVED!

📝 **Changes**:
- [Summary of changes]
- [Files modified]
- [Tests added]

✅ **Quality checks**:
- reviewer agent: PASSED ✓ ([N issues fixed])
- qa agent: PASSED ✓
- npm run lint:fix: PASSED ✓
- npx tsc --noEmit: PASSED ✓
- Integration tests: PASSED ✓ ([X/Y])

✅ **Updated**:
- tasks/bugs/BUG-XXX.md (added Implementation Notes)
- memory-bank/knowledge/bugs-registry.md (READY_FOR_WORK → RESOLVED)

**Regression Prevention**:
[Summary from Regression Prevention section]

**Next steps**:
- Optional: Create git commit
- Optional: Run /sync-memory to archive resolved bug

---

Would you like to:
1. Create git commit? `git add . && git commit -m "fix: Bug BUG-XXX - [title]"`
2. Run /sync-memory to update Memory Bank?
```

---

## Important Notes

1. **Status check MANDATORY**: MUST be READY_FOR_WORK to proceed
2. **Follow Fix Plan**: Don't improvise, use planning from /plan-bug
3. **Load context**: Read ALL files from Context to Load section
4. **Quality gates**: reviewer + qa are NOT optional
5. **Tests**: Run integration tests if Cypher/schema changed
6. **Update both files**: task file (Implementation Notes) + registry (status)

---

## Example Execution

```
User: /fix-bug

Phase 1: Interactive Selection
→ AskUserQuestion shows list of bugs
→ User selects: "#BUG-001 | search-query-builder | P0 🔴"

Phase 2: Validate Status
→ Read registry, check status
→ Status = READY_FOR_WORK ✓

Phase 3: Load Context
→ Read tasks/bugs/BUG-001.md
→ Parse sections: Context to Load, Fix Plan, Instructions, DoD
→ Show summary:
  "📋 Bug BUG-001: Skills penalty when excluded
   Root Cause: Cypher uses excludedSkills.length
   Fix: Change to $skills.length
   Context: 4 files to load..."
→ Load files: search-query-builder.ts, AC2 test, cypher-rules.md, decisions.md

Phase 4: Implement Fix
→ Change penalty calculation (use $skills.length)
→ Update AC2 test expected value (0.99 → 1.0)
→ Add new test case AC2b (empty skills array)
→ Follow DO/DON'T instructions

Phase 5: Quality Gates
→ Call reviewer agent
  - Found: minor code style issue
  - Fixed: applied suggestion
→ Call qa agent
  - Verified: test quality good, DoD met
→ Run lint + tsc + integration tests
  - All passed ✓

Phase 6: Update Task File
→ Edit BUG-001.md (add Implementation Notes section)

Phase 7: Update Registry
→ Edit bugs-registry.md (READY_FOR_WORK → RESOLVED)

Phase 8: Report Results
→ "✅ Bug BUG-001 fixed!
   Changes: penalty calculation fixed, 2 tests updated/added
   Quality: all checks passed
   Regression: AC2b test prevents future breakage"
```

---

## Error Handling

**If status = PENDING**:
```
❌ Cannot fix BUG-XXX: status is PENDING.

The bug needs planning first. Run:
  /plan-bug BUG-XXX

This will:
- Analyze Root Cause and Impact
- Prepare detailed Fix Plan
- Define Edge Cases and Test Plan
- Create DoD and Regression Prevention strategy

After planning completes (status → READY_FOR_WORK), run:
  /fix-bug BUG-XXX
```

**If status = RESOLVED**:
```
ℹ️ Bug BUG-XXX is already RESOLVED.

Check tasks/bugs/BUG-XXX.md for implementation details.
```

**If task file missing sections**:
```
⚠️ Warning: BUG-XXX.md is missing planning sections.

Expected sections:
- Context to Load
- Fix Plan
- General Instructions
- DoD

This suggests the bug wasn't planned with /plan-bug.

Options:
1. Run /plan-bug BUG-XXX to add missing sections
2. Proceed with minimal context (NOT recommended)

What would you like to do?
```

---

## Next Steps After Fix

- Optional: Commit changes using standard git workflow
- Optional: Run /sync-memory at end of session to archive resolved bug
