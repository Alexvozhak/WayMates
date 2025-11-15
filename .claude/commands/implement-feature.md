---
description: "Реализовать фичу с проверкой статуса + использование task file (без planner)"
allowed-tools: ["Read", "Write", "Edit", "Task", "AskUserQuestion", "Bash"]
argument-hint: "[optional: feature_id]"
---

# 🚀 Implement Feature (Implementation)

$ARGUMENTS

## Цель

Реализовать фичу, используя Type Schema и Implementation Plan из task file (READY_FOR_WORK).

**Workflow**: Load task file → Load context → Implement per Type Schema → reviewer → qa → tests → Update registry

**Key Principle**: Type Schema уже спроектирован в /plan-feature, реализуем СТРОГО по нему.

---

## Workflow

### Phase 1: Select Feature (Interactive)

1. **Read** `memory-bank/knowledge/features-registry.md`
2. **Parse** all features (filter by status if user wants)
3. **Show interactive selection** using `AskUserQuestion`:

```typescript
AskUserQuestion({
  questions: [{
    question: "Which feature do you want to implement?",
    header: "Select feature",
    multiSelect: false,
    options: [
      {
        label: "#FEAT-001 | context-schema | P1 🟡",
        description: "Add salary range to Context. Status: READY_FOR_WORK"
      },
      {
        label: "#FEAT-002 | context-schema | P1 🟡",
        description: "Education level property. Status: PENDING (needs /plan-feature first!)"
      }
    ]
  }]
})
```

**Format для options**:
- **label**: `#FEAT-XXX | component | Priority emoji` (max 50 chars)
- **description**: Brief description + Status

---

### Phase 2: Validate Status

**CRITICAL**: Check status in registry BEFORE loading task file.

```
If status = PENDING:
  → Show error message:
    "❌ Feature FEAT-XXX is PENDING (not planned yet).

    Run /plan-feature FEAT-XXX first to:
    - Design Type Schema (via planner agent)
    - Define Architecture Decisions
    - Create Implementation Plan
    - Prepare Test Plan and DoD

    Then run /implement-feature FEAT-XXX again."
  → STOP (do NOT proceed)

If status = READY_FOR_WORK:
  → Continue to Phase 3

If status = DONE:
  → Show message: "Feature FEAT-XXX already implemented. Check registry for details."
  → STOP
```

---

### Phase 3: Load Context

1. **Read** `tasks/features/FEAT-XXX.md` (READY_FOR_WORK state with full planning)

2. **Parse sections**:
   - User Story (original motivation)
   - AS IS / TO BE (current vs desired state)
   - Context to Study (files/docs to review)
   - Type Schema (from planner agent)
   - Architecture Decisions (from planner agent)
   - Implementation Plan (step-by-step)
   - Test Plan (tests to add)
   - Insights (task-specific notes)
   - Guidelines (DO/DON'T)
   - DoD
   - Impact Assessment
   - Edge Cases & Risks

3. **Show brief summary**:

```markdown
📋 Feature FEAT-XXX loaded: [Title]

**Component**: [component]
**Priority**: [priority]
**Status**: READY_FOR_WORK ✓

📂 Context to Study ([N files/docs]):
[list files from Context to Study section]

📐 Type Schema:
[brief summary - public API, key types]

🛠️ Implementation Plan:
[list steps from Implementation Plan section]

📝 Test Plan:
[count tests to add]

Ready to implement. Proceeding to load context files...
```

4. **Load files** from Context to Study section:
   - Use Read tool for each file/doc
   - Load relevant line ranges if specified
   - Load .claude/ docs if referenced

---

### Phase 3.5: Quick Analysis (Show Understanding)

**Before implementing, show analysis**:

```markdown
📊 Quick Analysis:

**Type Schema Summary**: [brief - public API signatures]

**Implementation Steps**:
1. [Step 1 from Implementation Plan]
2. [Step 2 from Implementation Plan]
...

**Files to Create/Modify**:
- [file1.ts] - [what will be changed]
- [file2.ts] - [what will be changed]

**Tests to Add**:
- [test name] - [business case]

**Key Guidelines**:
- DO: [top 2-3 from Guidelines]
- DON'T: [top 2-3 from Guidelines]

Proceeding with implementation per Type Schema...
```

**Purpose**: Demonstrate understanding before action, verify Type Schema interpretation is correct.

---

### Phase 4: Implement Feature

**Follow Type Schema STRICTLY**:
- Type Schema defines contracts → implement per schema
- Public API signatures are LOCKED
- Internal implementation can vary within type constraints

**Follow Implementation Plan step-by-step**:
1. Execute steps in order specified in plan
2. Follow Guidelines (DO/DON'T) for each step
3. Handle Edge Cases identified in plan
4. Add tests per Test Plan

**Track Progress**: Mark todos as completed using TodoWrite as you finish steps.

**DO NOT**:
- Call planner agent (Type Schema already in task file)
- Deviate from Type Schema (contracts are locked)
- Skip steps in Implementation Plan
- Ignore Edge Cases
- Skip tests

---

**If Cypher queries needed**:
- Call `cypher-expert` agent for query design
- Provide cypher-expert with Type Schema context
- Get tested queries via MCP neo4j-cypher
- Integrate queries per Type Schema

---

**Update Acceptance Criteria** (if present in task file):
- Check off sub-tasks as you complete them
- Use Edit tool to update checkboxes in task file

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
- Provide: changed files, Type Schema from task file
- Check: bugs, edge cases, DRY violations, TYPE COMPLIANCE
- Verify: implementation matches Type Schema
- Fix: critical issues before proceeding
```

**CRITICAL**: reviewer must verify Type Schema compliance!

---

**5.2 Call qa Agent**

```
Automatically call qa agent:
- Provide: test changes, DoD from task file
- Check: test coverage, quality, business logic validation
- Verify: DoD criteria met, Test Plan executed
```

---

**5.3 Run Quality Checks**

```bash
# MANDATORY - always run
npm run lint
npx tsc --noEmit

# If logic changed
npm run test:unit

# If Cypher/schema changed (check Impact Assessment in task file)
npm run test:integration
```

**Fix ALL errors** before proceeding.

**Note**: Warnings from pre-existing code are acceptable, but NO NEW errors.

---

### Phase 6: Update Task File

**Add Implementation Notes** to `tasks/features/FEAT-XXX.md`:

```markdown
---

## Implementation Notes

**Date**: YYYY-MM-DD
**Implemented by**: Claude session [session-id]

**Changes**:
- [List specific changes made]
- [Files created/modified with brief description]
- [Tests added]

**Type Schema Compliance**:
- [Confirmation that implementation follows Type Schema]
- [Any deviations justified]

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

**Edit** `memory-bank/knowledge/features-registry.md`:
- Find row with FEAT-XXX
- Change status: READY_FOR_WORK → DONE

```markdown
| FEAT-XXX | 2025-11-15 | DONE | [Title] | [Priority] | [Component] | [tasks/features/FEAT-XXX.md](../../tasks/features/FEAT-XXX.md) | [session] |
```

**Optional**: Add commit hash column if committed.

---

### Phase 8: Report Results

```markdown
✅ Feature FEAT-XXX implemented and marked as DONE!

📝 **Changes**:
- [Summary of changes]
- [Files created/modified]
- [Tests added]

📐 **Type Schema Compliance**:
- Implementation follows Type Schema from planner ✓
- Public API matches design ✓

✅ **Quality checks**:
- reviewer agent: PASSED ✓ ([N issues fixed])
- qa agent: PASSED ✓
- npm run lint: PASSED ✓
- npx tsc --noEmit: PASSED ✓
- Integration tests: PASSED ✓ ([X/Y])

✅ **Updated**:
- tasks/features/FEAT-XXX.md (added Implementation Notes)
- memory-bank/knowledge/features-registry.md (READY_FOR_WORK → DONE)

**Test Coverage**:
[Summary from Test Plan execution]

**Next steps**:
- Optional: Create git commit
- Optional: Run /sync-memory to archive completed feature

---

Would you like to:
1. Create git commit? `git add . && git commit -m "feat: Feature FEAT-XXX - [title]"`
2. Run /sync-memory to update Memory Bank?
```

---

## Important Notes

1. **Status check MANDATORY**: MUST be READY_FOR_WORK to proceed
2. **planner NOT called**: Type Schema already in task file (from /plan-feature)
3. **Type Schema is contract**: Implement STRICTLY per schema, no deviations
4. **Follow Implementation Plan**: Step-by-step execution per plan
5. **Load context**: Read ALL files from Context to Study section
6. **Quality gates**: reviewer + qa are NOT optional
7. **Type compliance**: reviewer MUST verify implementation matches Type Schema
8. **Tests**: Run integration tests if schema/Cypher changed (check Impact Assessment)
9. **Update both files**: task file (Implementation Notes) + registry (status)

---

## Difference from Old /implement-feature

| Aspect | Old implement-feature.md | New implement-feature.md |
|--------|--------------------------|--------------------------|
| Planning | Calls planner agent | NO planner (Type Schema in task file) |
| Status check | None | MANDATORY (PENDING → error) |
| Context source | Manual gathering | Task file (Context to Study section) |
| Type Schema | Designed during implementation | Pre-designed in /plan-feature |
| Implementation | Design + code | Code only (design done) |

**Old**: Design + implement in one step (planner during /implement-feature)
**New**: Design (/plan-feature) → implement (/implement-feature) - separated phases

---

## Example Execution

```
User: /implement-feature

Phase 1: Interactive Selection
→ AskUserQuestion shows list of features
→ User selects: "#FEAT-001 | context-schema | P1 🟡"

Phase 2: Validate Status
→ Read registry, check status
→ Status = READY_FOR_WORK ✓

Phase 3: Load Context
→ Read tasks/features/FEAT-001.md
→ Parse sections: Context to Study, Type Schema, Impl Plan, Test Plan, Guidelines, DoD
→ Show summary:
  "📋 Feature FEAT-001: Add salary range to Context
   Type Schema: userContextSchema + salaryMin/salaryMax
   Impl Plan: 6 steps (Schema → Persistence → Map Projection → Tests)
   Context: 5 files to load..."
→ Load files: schemas.ts, persistence-query-builder.ts, search.ts, cypher-rules.md, test-data-manager.ts

Phase 4: Implement Feature
→ Step 1: Update userContextSchema (add salaryMin/salaryMax + Zod validation)
→ Step 2: Update buildPersistContextQuery (SET salary properties, null-safe)
→ Step 3: Update buildSearchQuery map projection (return salary fields)
→ Step 4: Create test data U17 (exact salary), U18 (range salary)
→ Step 5: Add integration tests AC10, AC11, AC12
→ Step 6: Run tests
→ Follow Guidelines (DO: map projection, null safety; DON'T: filtering logic, migration)

Phase 5: Quality Gates
→ Call reviewer agent
  - Verified: Type Schema compliance ✓
  - Found: minor naming inconsistency
  - Fixed: applied suggestion
→ Call qa agent
  - Verified: test quality good, DoD met, Test Plan executed
→ Run lint + tsc + integration tests
  - All passed ✓

Phase 6: Update Task File
→ Edit FEAT-001.md (add Implementation Notes section)

Phase 7: Update Registry
→ Edit features-registry.md (READY_FOR_WORK → DONE)

Phase 8: Report Results
→ "✅ Feature FEAT-001 implemented!
   Changes: schema extended, persistence/search updated, 3 tests added
   Type Schema: compliance verified by reviewer ✓
   Quality: all checks passed"
```

---

## Error Handling

**If status = PENDING**:
```
❌ Cannot implement FEAT-XXX: status is PENDING.

The feature needs planning first. Run:
  /plan-feature FEAT-XXX

This will:
- Design Type Schema (via planner agent)
- Define Architecture Decisions
- Create step-by-step Implementation Plan
- Prepare Test Plan and DoD

After planning completes (status → READY_FOR_WORK), run:
  /implement-feature FEAT-XXX
```

**If status = DONE**:
```
ℹ️ Feature FEAT-XXX is already implemented.

Check tasks/features/FEAT-XXX.md for implementation details.
```

**If task file missing Type Schema**:
```
⚠️ Warning: FEAT-XXX.md is missing Type Schema section.

This is CRITICAL - Type Schema is required for implementation.

The feature wasn't properly planned with /plan-feature.

Options:
1. Run /plan-feature FEAT-XXX to add Type Schema (RECOMMENDED)
2. Proceed without Type Schema (DANGEROUS - high risk of bugs)

What would you like to do?
```

**If Type Schema incomplete**:
```
⚠️ Warning: Type Schema in FEAT-XXX.md is incomplete.

Missing:
- [Public API signatures / Internal state / Component interfaces]

Run /plan-feature FEAT-XXX again to complete Type Schema design.
```

---

## Next Steps After Implementation

- Optional: Commit changes using standard git workflow
- Optional: Run /sync-memory at end of session to archive completed feature
