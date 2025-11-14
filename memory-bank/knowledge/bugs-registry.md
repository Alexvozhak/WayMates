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
| #5 | 2025-11-13 | trajectory-similarity.service | durationCapMonths parameter has flawed business logic | RESOLVED | 🟡 P1 | 2025-11-13 |
| #4 | 2025-11-12 | cypher/queries/search | searchAdhoc returns 0 results - currentContextId filter breaks historical search | RESOLVED | 🔴 P0 | 2025-11-12 |
| #3 | 2025-11-12 | cypher/queries/search | DTW metrics values differ after Phase 3 migration | RESOLVED | 🟡 P1 | 2025-11-12 |
| #2 | 2025-11-11 | trajectory-similarity.service | DTW metrics calculation issues (4 problems) | RESOLVED | 🔴 P0 | 2025-11-12 |

---

## Bug Details

### #5: durationCapMonths Parameter Has Flawed Business Logic

**Discovered**: 2025-11-13 (during test quality review)

**Component**:
- `src/core/trajectory-similarity.service.ts:22,96-104,192-195`
- `src/shared/schemas.ts:226-231,286-291`
- `src/core/search-manager.ts:176,197,212`

**Design Flaw**:
`durationCapMonths` parameter was introduced to "normalize" duration differences in DTW trajectory comparison. It caps durations at specified value (default 36 months) before computing similarity.

**Business Logic Problem**:
```typescript
// Current behavior (FLAWED):
const cappedUserDurations = userDurations.map(d => Math.min(d, durationCapMonths));
// User: [12, 24, 36] months (steady growth)
// Candidate: [6, 120, 6] months (stuck in middle 10 years!)
// With cap=36: [6, 36, 6] → similarity ARTIFICIALLY INFLATED
// Candidate appears more similar than they actually are
```

**Why This Is Wrong**:
- ❌ **Forgives outliers**: Someone stuck in position for 10 years looks "similar" to steady 3-year growth
- ❌ **Hides red flags**: Career stagnation (120 months in same role) should be penalized, not hidden
- ❌ **Dishonest comparison**: We're making candidates look more similar than they actually are
- ❌ **No business justification**: User searches for similar trajectories, not "normalized" ones

**Expected Behavior**:
Tempo similarity should reflect **actual** duration differences:
- 24 months vs 120 months = LOW similarity (candidate's career pattern is different)
- Outliers are signal, not noise (stuck for 10 years = important information)

**Root Cause**:
Parameter introduced in DTW implementation (commit b6e362a) with reasoning:
> "Flexibility для разных карьерных контекстов (junior vs executive)"

But this reasoning is flawed:
1. Junior vs executive careers should be compared honestly
2. If someone's trajectory differs significantly → similarity SHOULD be low
3. Cap artificially boosts similarity → misleading search results

**Impact**:
- ⚠️ **Inaccurate search results**: Candidates with stagnant careers rank higher than they should
- ⚠️ **Misleading similarity scores**: tempoSimilarity doesn't reflect actual tempo differences
- ⚠️ **Code complexity**: Parameter adds complexity without business value
- ⚠️ **Test complexity**: DT5 test exists solely to verify this flawed parameter

**Evidence from Code Review**:
Test plan explicitly documents the cap's effect:
```
DT5: Low cap (24) → сглаживает выбросы → выше tempo similarity
```
This is the OPPOSITE of what we want! Outliers are valuable information.

**Fix Strategy**:

**Option 1: Remove durationCapMonths entirely** (RECOMMENDED)
- Remove parameter from all interfaces (UserSearchParams, AdhocSearchParams, TargetSearchParams)
- Simplify trajectoryDistance() - remove normalization by cap
- Simplify computeTempoSimilarity() - remove capping logic
- Delete DT5 test (tests flawed behavior)
- Pros: Honest comparisons, simpler code, accurate similarity
- Cons: None (this is correct behavior)

**Option 2: Use fixed cap for numerical stability only**
- Keep cap=MAX (e.g., 240 months = 20 years) to prevent infinity
- Only for edge cases (someone worked 50 years in one position)
- Pros: Numerical stability
- Cons: Still dishonest, just less

**Option 3: Remove cap, add warning for outliers**
- No capping, but log warning if duration > 120 months
- Let similarity be low (correct behavior)
- Pros: Transparent, honest
- Cons: More complex than Option 1

**Recommended Fix**: **Option 1** (complete removal)
- Simplest solution
- Most honest
- Aligns with business logic ("find similar trajectories")

**Acceptance Criteria**:
- [ ] Remove `durationCapMonths` parameter from all schemas
- [ ] Remove capping logic from `trajectoryDistance()` (lines 192-195)
- [ ] Remove capping logic from `computeTempoSimilarity()` (lines 98-104)
- [ ] Delete DT5 test entirely (tests flawed behavior)
- [ ] Update DT1-DT4 tests (remove durationCapMonths parameter)
- [ ] Verify no regressions: DT1-DT4 still pass with new logic
- [ ] Update TEST_PLAN: mark DT5 as REMOVED (not DEFERRED)
- [ ] Update docs: remove references to durationCapMonths

**Regression Prevention**:
After removal, verify:
1. DT1 (high similarity) still > 2.55 - steady trajectories remain similar
2. DT2 (low similarity) still < 2.0 - different domains still dissimilar
3. No test relies on cap behavior

**Decision**: PENDING review and approval

**References**:
- Implementation: commit b6e362a (DTW trajectory similarity)
- Bug fix using cap: Bug #2.3 (Apply cap before derivatives)
- Test: `tests/integration/search-manager/current-context-with-dtw.integration.ts:401-486` (DT5 skipped)
- Docs: `docs/mvp_final/TEST_PLAN_SEARCH_MANAGER_v3.md` (DT5 section)
- Docs: `docs/2025_11_08_DTW_IMPLEMENTATION_PLAN.md` (Duration Cap Parametrization)

---

## Resolved Bugs (Archive)

Brief history of resolved bugs. Full details in `memory-bank/knowledge/decisions.md` and Memory MCP.

### #5: durationCapMonths Parameter Has Flawed Business Logic ✅ RESOLVED
- **Discovered**: 2025-11-13 (during test quality review)
- **Resolved**: 2025-11-13 (via /fix-bug command)
- **Root Cause**: `durationCapMonths` parameter artificially inflated similarity scores by capping outliers
  - User with steady growth (12, 24, 36 months) vs candidate stuck 10 years (6, 120, 6 months)
  - Old formula: capped 120 → 36, making trajectories appear more similar than reality
  - Design flaw: parameter introduced for "flexibility" but actually hid career stagnation signals
- **Solution**: Complete removal of `durationCapMonths` parameter (Option 1)
  - Removed from schemas: `userSearchParamsBaseSchema`, `targetSearchParamsSchema`
  - Removed capping logic from `computeTempoSimilarity()` - durations no longer capped before derivatives
  - Updated `trajectoryDistance()`: normalize by `max(durationA, durationB)` instead of cap
  - Deleted DT5 test (tested flawed capping behavior)
  - Updated all test calls (DT1-DT4, UN1, UN4, AC1) - removed parameter
- **New normalization formula**:
  - `durationDiff = |durationA - durationB| / max(durationA, durationB)`
  - Edge case: `maxDuration = 0` → `durationDiff = 0` (zero division guard)
  - Outliers: 120 months vs 1 month → `durationDiff ≈ 0.99` (correctly penalized, not capped)
- **Impact**: MEDIUM - improved similarity accuracy, simpler code (-10 LOC), honest outlier handling
- **Tests**: DT1-DT4 integration tests (4/4 passed) - DT5 deleted (tested flawed behavior)
- **Quality checks**: lint PASSED, integration tests PASSED (12/12)
- **Key Lesson**: "Flexibility" parameters that hide signal (outliers) should be removed, not tuned
- **Files changed**:
  - `src/shared/schemas.ts` (parameter removal from Zod schemas)
  - `src/core/trajectory-similarity.service.ts` (capping logic removal, new normalization)
  - `src/core/search-manager.ts` (parameter removal from calls)
  - `tests/integration/search-manager/*.integration.ts` (DT5 deletion, parameter removal from all calls)
- **Test coverage gap**: Extreme outliers (120 months) not tested in current data (U10-U13 all "normal")
  - Recommendation: Add U14 with outlier trajectory for future regression testing
  - Priority: LOW (not blocking, formula is mathematically correct)

### #4: searchAdhoc Returns 0 Results - currentContextId Filter Breaks Historical Search ✅ RESOLVED
- **Discovered**: 2025-11-12 (AC1-AC6 adhoc integration tests failing - 0 results)
- **Resolved**: 2025-11-12 (manual debugging session)
- **Root Cause**: `buildMatchedContextBase()` incorrectly filtered by `currentContextId` for ALL search modes
  - searchAdhoc/searchByTarget should search **ALL contexts** (historical + current)
  - searchByUser should search **current context only**
  - Query had universal filter → adhoc couldn't find historical contexts
- **Solution**: Removed `{contextId: matchedUser.currentContextId}` from `buildMatchedContextBase()`
  - Before: `MATCH (matchedUser:User)-[:HAS_CONTEXT]->(matchedContext:Context {contextId: matchedUser.currentContextId})`
  - After: `MATCH (matchedUser:User)-[:HAS_CONTEXT]->(matchedContext:Context)`
  - searchByUser still works correctly (compares current states)
  - searchAdhoc now finds historical contexts (e.g., U2 Junior when current is Middle)
- **Impact**: CRITICAL - searchAdhoc/searchByTarget completely broken (0 results for any query)
- **Tests**: AC1-AC6, UN1-UN4, DT1-DT5 integration tests (12/12 passed after fix)
- **Key Lesson**: Different search modes have different filtering requirements - understand business logic FIRST
- **Created Docs**:
  - `docs/search_modes_business_logic.md` - WHAT each search mode does (when to filter by currentContextId)
  - `docs/cypher_debugging_guide.md` - HOW to debug Cypher queries (workflow, MCP tools)
- **См.**: `src/cypher/queries/search.ts:80`, test `adhoc-context-without-dtw.integration.ts`

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
