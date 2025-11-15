# Bugs Registry (Реестр багов)

Production bugs and design flaws discovered in the codebase.

**Priority levels:**
- 🔴 P0: Blocking, affects correctness
- 🟡 P1: Important, affects maintainability/UX
- 🟢 P2: Nice to have, minor issues

**Workflow**:
1. Use `/report-bug` to add new bug → status: PENDING
2. Use `/plan-bug` to analyze and prepare fix plan → status: READY_FOR_WORK
3. Use `/fix-bug` to implement fix → status: RESOLVED
4. Use `/sync-memory` to archive resolved bugs

---

## Active Bugs

| ID | Date | Status | Title | Priority | Component | File | Session |
|----|------|--------|-------|----------|-----------|------|---------|
| BUG-002 | 2025-11-15 | PENDING | 22 integration tests failing after BUG-001 fix (search returns 0 results) | 🔴 P0 | search-query-builder | [tasks/bugs/BUG-002-integration-tests-failing.md](../../tasks/bugs/BUG-002-integration-tests-failing.md) | session-2025-11-15 |

---

## Resolved Bugs (Archive)

Brief history of resolved bugs. Full details in task files and Memory MCP.

| ID | Date | Status | Title | Priority | Component | Resolved | Commit |
|----|------|--------|-------|----------|-----------|----------|--------|
| BUG-001 | 2025-11-15 | RESOLVED | Race condition in setup-read-only.ts with parallel tests | 🟡 P1 | Test infrastructure | 2025-11-15 | [pending] |
| #5 | 2025-11-13 | RESOLVED | durationCapMonths parameter has flawed business logic | 🟡 P1 | trajectory-similarity.service | 2025-11-13 | [commit] |
| #4 | 2025-11-12 | RESOLVED | searchAdhoc returns 0 results - currentContextId filter breaks historical search | 🔴 P0 | cypher/queries/search | 2025-11-12 | [commit] |
| #3 | 2025-11-12 | RESOLVED | DTW metrics values differ after Phase 3 migration | 🟡 P1 | cypher/queries/search | 2025-11-12 | [commit] |
| #2 | 2025-11-11 | RESOLVED | DTW metrics calculation issues (4 problems) | 🔴 P0 | trajectory-similarity.service | 2025-11-12 | [commit] |
| #1 | 2025-11-11 | RESOLVED | Skills penalty when skills excluded | 🔴 P0 | search-query-builder | 2025-11-11 | d1da036 |

---

## Archive Notes

### BUG-001: Race Condition in setup-read-only.ts
- **Root Cause**: Projects run sequentially, but each expected different datasets. `setup-read-only.ts` checked `userCount !== 18` → saw 13 users from previous project → skipped import → tests failed (U14-U18 missing)
- **Solution**: Vitest globalSetup pattern - loads U1-U18 ONCE before all projects, removed fragile "smart" check
- **Impact**: Read-only tests weren't running at all (32 tests skipped). After fix: 33/55 tests passing
- **Verification**: 3 consecutive test runs showed identical results (no intermittent failures) → race condition eliminated
- **Changes**: Created `vitest.globalSetup.ts`, updated `vitest.config.ts`, deleted `setup-read-only.ts`, fixed 4 read-only test imports
- **Bonus fix**: Fixed FEAT-018 regression (`persistence.ts` line 83 missing `languages` in WITH clause) which was blocking all tests

### #5: durationCapMonths Parameter Has Flawed Business Logic
- **Root Cause**: Parameter artificially inflated similarity scores by capping outliers (120 months → 36 months)
- **Solution**: Complete removal of `durationCapMonths` parameter
- **Impact**: Improved similarity accuracy, simpler code (-10 LOC), honest outlier handling
- **Tests**: DT1-DT4 integration tests (4/4 passed), DT5 deleted (tested flawed behavior)

### #4: searchAdhoc Returns 0 Results
- **Root Cause**: `buildMatchedContextBase()` incorrectly filtered by `currentContextId` for ALL search modes
- **Solution**: Removed `{contextId: matchedUser.currentContextId}` from base query
- **Impact**: CRITICAL - searchAdhoc/searchByTarget completely broken (0 results for any query)
- **Created Docs**: `search_modes_business_logic.md`, `cypher_debugging_guide.md`

### #3: DTW Metrics Values Differ After Phase 3 Migration
- **Root Cause**: Missing `{contextId: matchedUser.currentContextId}` filter → matched ALL user contexts
- **Solution**: Added filter + fixed U12 duplicate position data + updated test thresholds
- **Impact**: Critical bug - each user appeared multiple times in results

### #2: DTW Metrics Calculation Issues
- **Solution**: stabilityScore formula changed, domains added to trajectoryDistance, apply cap before derivatives, fixed U12 data
- **Tests**: DT1-DT4 integration tests (4 passed, 1 skipped)

### #1: Skills Penalty When Skills Excluded
- **Solution**: Skills NEVER in WHERE clause, penalty-based scoring with DB queries
- **See**: `knowledge/decisions.md#Skills Never in WHERE Clause`, Memory MCP

*Use `/report-bug` to add new bugs to this registry*
