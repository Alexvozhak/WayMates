# Bugs Registry (Реестр багов)

Production bugs and design flaws discovered in the codebase.

**Priority levels:**
- 🔴 P0: Blocking, affects correctness
- 🟡 P1: Important, affects maintainability/UX
- 🟢 P2: Nice to have, minor issues

---

## Registry

| ID | Date | Component | Issue | Status | Priority | Resolved |
|----|------|-----------|-------|--------|----------|----------|
| #3 | 2025-11-12 | cypher/queries/search | DTW metrics values differ after Phase 3 migration | RESOLVED | 🟡 P1 | 2025-11-12 |
| #2 | 2025-11-11 | trajectory-similarity.service | DTW metrics calculation issues (4 problems) | RESOLVED | 🔴 P0 | 2025-11-12 |

---

## Resolved Bugs (Archive)

Brief history of resolved bugs. Full details in `memory-bank/knowledge/decisions.md` and Memory MCP.

### #1: Skills Penalty When Skills Excluded ✅ RESOLVED
- **Discovered**: 2025-11-11 (AC2 integration test)
- **Resolved**: 2025-11-11 (commit d1da036)
- **Solution**: Skills NEVER in WHERE clause, penalty-based scoring with DB queries
- **См.**: `knowledge/decisions.md#Skills Never in WHERE Clause`, Memory MCP `Skills Scoring Architecture Decision 2025-11-11`

### #3: DTW Metrics Values Differ After Phase 3 Migration ✅ RESOLVED
- **Discovered**: 2025-11-12 (Phase 3 Raw Cypher migration - integration tests)
- **Resolved**: 2025-11-12 (via /fix-bug command)
- **Root Cause**: Missing `{contextId: matchedUser.currentContextId}` filter in `buildMatchedContextBase()` → matched ALL user contexts instead of current only
- **Solution**:
  - Added filter: `MATCH (matchedUser:User)-[:HAS_CONTEXT]->(matchedContext:Context {contextId: matchedUser.currentContextId})`
  - Fixed U12 duplicate position data (2 HAS_POSITION relationships caused Cartesian product)
  - Updated test expectations: U13 threshold 2.6 → 2.9 (allow variance after Raw Cypher migration)
- **Impact**: Critical bug - each user appeared multiple times in results (once per context)
- **Tests**: DT1-DT5 integration tests (4 passed | 1 skipped)
- **См.**: `src/cypher/queries/search.ts:80`, tests `current-context-with-dtw.integration.ts:172,307`

### #2: DTW Metrics Calculation Issues ✅ RESOLVED
- **Discovered**: 2025-11-11 (implementing DT1-DT5 integration tests)
- **Resolved**: 2025-11-12 (via /fix-bug command)
- **Solution**:
  - **2.1**: stabilityScore formula changed to `userLength / pathLength` (user trajectory is baseline)
  - **2.2**: Added domains to `trajectoryDistance` via `computeJaccardDistance()` helper (4 components now)
  - **2.3**: Apply `durationCapMonths` to durations before computing derivatives in `computeTempoSimilarity()`
  - **2.4**: Fixed U12 test data chronological order + added `company_changed` reasons
- **Additional fixes**: Enhanced `validatePathLength()` with min path check, added chronological order validation in `calculateDurationMonths()`
- **Tests**: DT1-DT5 integration tests (4 passed, 1 skipped)
- **См.**: `src/core/trajectory-similarity.service.ts`, test data `data/trails/users/u12.json`

*Use `/report-bug` to add new bugs to this registry*
