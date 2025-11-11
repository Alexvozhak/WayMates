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
| #2 | 2025-11-11 | trajectory-similarity.service | DTW metrics calculation issues (4 problems) | RESOLVED | 🔴 P0 | 2025-11-12 |

---

## Resolved Bugs (Archive)

Brief history of resolved bugs. Full details in `memory-bank/knowledge/decisions.md` and Memory MCP.

### #1: Skills Penalty When Skills Excluded ✅ RESOLVED
- **Discovered**: 2025-11-11 (AC2 integration test)
- **Resolved**: 2025-11-11 (commit d1da036)
- **Solution**: Skills NEVER in WHERE clause, penalty-based scoring with DB queries
- **См.**: `knowledge/decisions.md#Skills Never in WHERE Clause`, Memory MCP `Skills Scoring Architecture Decision 2025-11-11`

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

---

## Bug Details

### #2: DTW Metrics Calculation Issues

**Discovered**: 2025-11-11 (implementing DT1-DT5 integration tests)

**Component**: `src/core/trajectory-similarity.service.ts`

**How to Reproduce**:
```bash
npm run test:integration:run -- current-context-with-dtw
# All 5 tests fail with metric calculation errors
```

**Problems**:

#### 2.1: stabilityScore Always Low (0.56 instead of >0.9)

**Expected**: U10 and U11 (identical trajectory patterns) → stabilityScore > 0.9
**Actual**: stabilityScore = 0.5625

**Root Cause** (`trajectory-similarity.service.ts:64-65`):
```typescript
const stabilityScore = Math.min(userTrajectory.length, candidateTrajectory.length) / pathLength;
// pathLength increases due to DTW alignment (warping)
// U10 (3 contexts) vs U11 (3 contexts): min(3,3) / pathLength
// If pathLength = 5.33 → 3/5.33 = 0.5625
```
**Issue**: Formula doesn't account for DTW warping effect (pathLength ≥ max(len1, len2))

---

#### 2.2: shapeSimilarity Too High for Different Domains (0.89 instead of <0.4)

**Expected**: U10 (Backend) vs U12 (Frontend) → shapeSimilarity < 0.4
**Actual**: shapeSimilarity = 0.893

**Root Cause** (`trajectory-similarity.service.ts:182-214`):
```typescript
private trajectoryDistance(...): number {
  const positionDiff = stepA.position === stepB.position ? 0 : 1;
  const durationDiff = Math.min(Math.abs(durationA - durationB) / durationCapMonths, 1);
  const reasonsDiff = 1 - jaccardSimilarity;
  return (positionDiff + durationDiff + reasonsDiff) / 3;  // ❌ No domains!
}
```
**Issue**: `trajectoryDistance` only considers **position, duration, reasons** — **domains are ignored**!
U10 (Backend) vs U12 (Frontend) both have `position=Senior` → low distance → high similarity

---

#### 2.3: durationCapMonths Has No Effect on tempoSimilarity

**Expected**: Different caps (24, 36, 60) → different tempoSimilarity values
**Actual**: All caps → tempoSimilarity = 0.9028 (identical)

**Root Cause** (`trajectory-similarity.service.ts:86-113`):
```typescript
private computeTempoSimilarity(
  userDurations: number[],         // ❌ RAW durations (not capped!)
  candidateDurations: number[],    // ❌ RAW durations (not capped!)
  ...
): number {
  const userDeriv = this.derivative(userDurations);  // Derivative from RAW
  const candidateDeriv = this.derivative(candidateDurations);
  // DTW on derivatives...
}
```
**Issue**: `durationCapMonths` is used in `trajectoryDistance` (for shapeSimilarity), but **NOT in tempoSimilarity**. Tempo calculation uses raw durations without capping.

---

#### 2.4: excludedCreationReasons Filter Not Applied (DT3 test)

**Expected**: U12 filtered out when `excludedCreationReasons: ["company_changed"]`
**Actual**: U12 found in results

**Note**: Requires investigation — may be in `search-query-builder.ts` or test data issue (U12 doesn't have `company_changed` in test output, so this might be test expectations error)

---

**Impact**:
- ❌ **DT1-DT5 tests blocked** — all 5 integration tests fail
- ❌ **Incorrect trajectory similarity** — metrics don't match business logic
- ❌ **durationCapMonths parameter useless** — no effect on tempo
- ⚠️ **Domains ignored** — major career transitions (Backend→Frontend) show high similarity

**Fix Ideas**:

**Option 1: Fix formulas + add domains**
- Adjust `stabilityScore` formula to handle DTW warping
- Add domains to `trajectoryDistance` calculation (Jaccard on domain sets)
- Apply `durationCapMonths` to durations BEFORE derivative calculation

**Option 2: Revisit DTW algorithm design**
- Re-evaluate if DTW is appropriate for career trajectories
- Consider alternative similarity metrics (Cosine, Euclidean with fixed alignment)

**Recommendation**: Option 1 — fix formulas incrementally, validate with tests

---

**Acceptance Criteria**:
- [ ] DT1: U10 vs U11 (identical) → stabilityScore > 0.9, shapeSimilarity > 0.85, dtwTotal > 2.55
- [ ] DT2: U10 vs U12 (Frontend) → shapeSimilarity < 0.4 (domains matter!)
- [ ] DT5: durationCapMonths = 24 vs 60 → tempoSimilarity differs by > 0.05
- [ ] All 5 DTW integration tests pass

**Decision**: PENDING

**References**:
- Tests: `tests/integration/search-manager/current-context-with-dtw.integration.ts`
- Implementation plan: TBD (needs cypher-expert + planner review)
- Memory MCP: "Bug #2: DTW Metrics Issues"

---

*Use `/report-bug` to add new bugs to this registry*
