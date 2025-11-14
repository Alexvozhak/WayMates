# Implement Test (from Bug/Feature Registry)

**Description**: Implements tests from bugs-registry.md or features-registry.md with focus on business value, no coverage theater, and project-specific quality standards.

**Usage**:
- `/implement-test` - interactive selection from registries
- `/implement-test #5` - implement Bug #5 tests
- `/implement-test Feature #14` - implement Feature #14 tests

---

## Core Principles

**Tests validate BUSINESS LOGIC, not implementation:**
- ✅ Tests fail when business requirements break (regardless of code changes)
- ✅ No coverage theater (obvious assertions, TypeScript/Zod guarantees)
- ✅ Acceptance Criteria drive test design (AC = expected behavior)
- ✅ Integration tests for Cypher/schema changes (unit test mocks miss regressions)

**Project expertise:**
- Know test data (U1-U16, Batch A/B/C organization)
- Know Vitest projects (parallel execution, data race prevention)
- Know test patterns (path validation, DTW formula checks, score breakdowns)

---

## Workflow

### Phase 1: Context & Planning

1. **Load Acceptance Criteria** (from registry):
   - Read `memory-bank/knowledge/bugs-registry.md` or `features-registry.md`
   - Extract AC list for selected bug/feature
   - Identify test type: integration (Cypher/schema) vs unit (logic)

2. **Load Project Context**:
   - [routers/test/router.md](../routers/test/router.md) - delegation rules, when to use qa agent
   - [routers/test/standards.md](../routers/test/standards.md) - 5 Checks (coverage theater, business value)
   - [routers/test/environment.md](../routers/test/environment.md) - Vitest config, projects, commands
   - [routers/test/workflows.md](../routers/test/workflows.md) - test processes, quality gates

3. **Ask Clarifying Questions** (if needed):
   - Use `AskUserQuestion` for ambiguous requirements
   - Business logic unclear? Ask before designing tests
   - Multiple approaches? Clarify which to test
   - Edge cases priority? Confirm P0 vs P1 vs P2

4. **Design Test List**:
   - Map each AC to 1+ test cases
   - Apply 5 Checks (standards.md) during design:
     1. ❌ Coverage Theater? (obvious assertions, Zod duplicates)
     2. ❌ Test Manipulation? (observed values without business justification)
     3. ✅ Business Goal Alignment? (AC → expected behavior)
     4. ✅ Edge Cases? (null, empty, boundaries, outliers)
     5. ✅ Schema/Cypher Risk? (integration test needed?)
   - For each test: name, AC mapping, expected behavior, edge cases

5. **Determine Vitest Project**:
   - Integration test? → Check setup file requirements:
     - `integration-search-read-only` (U1-U16, read-only, parallel-safe)
     - `integration-gds` (GDS Neo4j plugin, write operations)
     - Other projects (see `vitest.config.ts`)
   - Unit test? → Default project (fast, isolated)

6. **Review Test Data**:
   - Read `tests/helpers/test-data-manager.ts` (available users)
   - Check Batch organization (setup-read-only.ts comments):
     - Batch A (U1-U9): Adhoc/Target search tests
     - Batch B (U10-U13): DTW trajectory tests
     - Batch C (U14-U16): Special cases (education, outliers, etc.)
   - Decide: Reuse existing users (no regression) OR create new (U17+)
   - If creating new data: plan structure (contexts, trails, fields)

### Phase 2: Baseline Check

7. **Run Baseline Tests** (before any changes):
   ```bash
   npm run test:integration  # or specific project
   ```
   - Record current state (X passed, Y failed)
   - If failures exist: note them (don't break existing tests)

8. **Check Code Quality**:
   ```bash
   npm run lint
   npx tsc --noEmit
   ```
   - Record warnings/errors (pre-existing issues)
   - Don't introduce new lint/TS errors

### Phase 3: Implementation (One Test at a Time)

9. **Implement Test #1**:
   - Write test with business-focused assertions
   - Add comments: AC reference, business rule, expected behavior
   - Follow existing patterns (path validation, score breakdown, DTW formula)

10. **Run Test #1 Immediately**:
    ```bash
    npx vitest run path/to/test-file.ts -t "test name"
    ```
    - ✅ Pass → mark todo completed, move to next
    - ❌ Fail → debug, fix test OR fix production code (if bug found)

11. **Repeat for All Tests** (steps 9-10):
    - Implement one → run one → fix → next
    - Update TodoWrite after each completion

### Phase 4: Quality Review

12. **Propose Quality Review**:
    - Ask user: "Run `/test-review` on new tests to verify no coverage theater?"
    - If user agrees → run `/test-review path/to/test-file.ts`
    - Study feedback:
      - 🔴 Critical Issues → must fix
      - 🟡 Missing Coverage → discuss priority (P0 fix, P1 defer)
      - 🟢 Recommendations → apply if reasonable

13. **Apply Feedback** (if user agrees):
    - Fix critical issues (coverage theater, test manipulation)
    - Add missing edge cases (if P0)
    - Re-run tests after each fix

### Phase 5: Final Validation

14. **Run Full Test Suite**:
    ```bash
    npm run test:integration  # or affected project
    ```
    - Verify: all new tests pass, no regressions in old tests
    - If failures → fix before proceeding

15. **Check Code Quality**:
    ```bash
    npm run lint
    npx tsc --noEmit
    ```
    - Verify: no new errors (warnings from existing code OK)

16. **Report Results**:
    ```markdown
    ## ✅ Test Implementation Complete

    **Feature/Bug**: [#N from registry]
    **Tests Added**: [count] ([test names])
    **Test Type**: Integration | Unit
    **Vitest Project**: [project name]
    **Test Data**: Reused U1-UX | Created UY-UZ

    **Results**:
    - ✅ All tests pass (X/X)
    - ✅ No regressions (baseline: Y passed → current: Y passed)
    - ✅ Lint clean (Z warnings pre-existing)
    - ✅ TypeScript clean

    **Business Value**: [brief summary]
    ```

### Phase 6: Workflow Completion

17. **Propose Commit**:
    - Ask: "Ready to commit? I'll create a commit with test implementation details."
    - If yes → use standard git workflow (see CLAUDE.md)

18. **Propose Reflection**:
    - Ask: "Run `/reflect` to improve test documentation for future?"
    - Analyze: what went well, what to document

19. **Propose Memory Sync**:
    - Ask: "Run `/sync-memory` to update registry and memory bank?"
    - Updates: mark AC as completed, archive if done

---

## Context Loading Strategy

**Before implementation, load:**

1. **Test Standards** (MANDATORY):
   - [routers/test/standards.md](../routers/test/standards.md) - 5 Checks with examples
   - Apply during test design (prevent coverage theater)

2. **Test Environment** (if integration test):
   - [routers/test/environment.md](../routers/test/environment.md) - Vitest projects, setup files
   - Determine correct project (parallel safety, data race)

3. **Project Patterns** (read existing tests):
   - Similar test file in `tests/integration/search-manager/`
   - Copy patterns: structure, helpers, validation logic
   - Don't reinvent: reuse `validateAllPaths()`, DTW formula checks

4. **Test Data** (if needed):
   - `tests/helpers/test-data-manager.ts` - available users
   - `tests/integration/search-manager/setup-read-only.ts` - batch comments
   - `data/trails/users/uX.json` - structure examples

---

## Test Design Checklist

Before writing code, verify each test:

- [ ] **Maps to AC**: Which Acceptance Criterion does this validate?
- [ ] **Business rule clear**: What business logic failure would this catch?
- [ ] **Not coverage theater**: Avoid obvious assertions (length > 0, toBeDefined for Zod fields)
- [ ] **Not test manipulation**: Hardcoded values justified by business logic (not observed)
- [ ] **Edge cases**: Null, empty, boundaries, outliers (if AC mentions them)
- [ ] **Integration vs unit**: Schema/Cypher change → integration test (mocks miss regressions)
- [ ] **Parallel safe**: Read-only OR isolated data (no data race in parallel execution)
- [ ] **Comments present**: AC reference + business rule + failure scenario

---

## Quality Gates

**Before marking implementation complete:**

- ✅ All new tests pass individually
- ✅ Full test suite passes (no regressions)
- ✅ Lint clean (no new errors)
- ✅ TypeScript clean (no new errors)
- ✅ No coverage theater (verified via /test-review OR self-check with standards.md)
- ✅ Business value documented (comments explain what breaks if test fails)

**Optional (but recommended):**
- ✅ /test-review run (qa agent validation)
- ✅ Reviewer agent check (code quality)

---

## Delegation Rules

**Use `qa` sub-agent when:**
- Test file > 200 lines (complexity exceeds quick review)
- Need test failure root cause analysis
- Schema/Cypher changes require deep validation
- Fixture quality check (test data correctness)

---

## Philosophy

**You are a test implementation expert for this project.**

- **Know the domain**: Career transitions, DTW similarity, Neo4j Cypher
- **Know the standards**: 5 Checks (standards.md), no coverage theater
- **Know the data**: U1-U16 organization, Batch A/B/C semantics
- **Know the patterns**: Path validation, DTW formula, score breakdown

**When in doubt:**
- ✅ Ask clarifying questions (AskUserQuestion)
- ✅ Read existing tests (copy proven patterns)
- ✅ Propose /test-review (qa agent validates)
- ❌ Don't guess business logic (ask first)
- ❌ Don't create coverage theater (check standards.md)
