# Testing

## Commands

```bash
npm run test:unit                              # Unit tests
npm run test:integration                       # All integration tests
npm run test:integration:story-manager         # Story Manager tests (sequential)
npm run test:integration:search-manager        # Search Manager tests
```

---

## Testing Strategy

**Конфигурация**: См. [vitest.config.ts](../../vitest.config.ts)

**Наш подход**:
1. **Parallel execution** для READ operations (search, goals)
2. **Sequential execution** (`singleThread: true`) для WRITE operations (story-manager) - предотвращает data race
3. **Database isolation** - каждый тест очищает DB в beforeEach

**Паттерны тестов**:
- См. Memory MCP: `Sequential Test Execution Pattern`
- См. существующие тесты в `tests/integration/*/` для примеров

---

## Test Registry (Current State)

### Integration Tests: Search Manager
**Status**: ✅ Complete (19 passing + 1 skipped)

#### Adhoc Search (AC1-AC6) - Helper: score-calculator.ts
**Test Plan**: `docs/mvp_final/TEST_PLAN_SEARCH_MANAGER_v3.md` (lines 200-220)
**Test Data**: Batch A (U1-U9)

- ✅ AC1: Baseline adhoc search (1/1) - exact skill match, perfect score
- ✅ AC2: excludedContextFields filter (1/1) - skill penalties from DB
- ✅ AC3: Exclude geo - international search (1/1)
- ✅ AC4: Only position strict (1/1)
- ✅ AC5: Excluded creation reasons (1/1)
- ✅ AC6: Recency filter (1/1)
- ⏸️ AC7-AC11: Edge cases (0/5) - not implemented yet

#### User Search Without DTW (UN1-UN4)
**Test Plan**: `docs/mvp_final/TEST_PLAN_SEARCH_MANAGER_v3.md` (lines 250-270)
**Test Data**: Batch A+B (U1-U13)

- ✅ UN1: No trajectory fallback (1/1)
- ✅ UN4: Exclude geo via userId (1/1)
- ⏸️ UN2-UN3, UN5: Edge cases (0/3) - not implemented yet

#### User Search With DTW (DT1-DT5)
**Test Plan**: `docs/mvp_final/TEST_PLAN_SEARCH_MANAGER_v3.md` (lines 333-380)
**Test Data**: Batch B (U10-U13, 3+ contexts each)

- ✅ DT1: DTW metrics baseline (1/1) - high similarity detection
- ✅ DT2: Medium similarity (1/1) - different domains (Bug fixed 2025-11-12)
- ✅ DT3: Excluded creation reasons (1/1) - filters trajectories
- ✅ DT4: Multiple candidates ranking (1/1) - orders by dtwTotal
- ⏭️ DT5: durationCapMonths parameter (0/1 skipped) - requires U14 with outliers

#### Target Search (TG1-TG7)
**Test Plan**: `docs/mvp_final/TEST_PLAN_SEARCH_MANAGER_v3.md` (lines 280-310)
**Test Data**: Batch A (U1-U9)

- ✅ TG1: Desired position (1/1) - include specific position
- ✅ TG2: Undesired position (1/1) - exclude specific position
- ✅ TG3: Desired domains (1/1) - ANY match for desired values
- ✅ TG4: Undesired domains (1/1) - NONE match for undesired values
- ✅ TG5: Desired skills (1/1) - ANY match for desired skills
- ✅ TG6: Undesired skills (1/1) - NONE match for undesired skills
- ✅ TG7: Combined filters (1/1) - position + domains + skills

#### Goals Integration (GM1-GM4 + G1-G5)
**Test Plan**: `docs/mvp_final/TEST_PLAN_SEARCH_MANAGER_v3.md` (lines 319-328)
**Test Data**: Batch C (U1, U2, U5)

- ✅ GM1-GM4: GoalsManager CRUD (4/4) - Create, Read, Update, Delete goals with targetCriteria
- ✅ G1-G5: Goals & candidateType detection (5/5)
  - G1: No Goal baseline (candidateType=null)
  - G2: Pathfinder detection (achieved user's goal position)
  - G3: Waymate detection (same goal as user)
  - G4: Goal affects scoring (pathfinder bonus)
  - G5: Goal + DTW integration (Goals work with trajectory search)

---

### Integration Tests: Story Manager
**Status**: ✅ Complete (13/13 passing)

- ✅ CREATE (8/8) - Basic context persistence + all relationships
- ✅ UPDATE (2/2) - Context properties + skills updates
- ✅ TEMPORAL (1/1) - previousContextId/nextContextId links
- ✅ VALIDATION (2/2) - Empty arrays + idempotent upsert
- ⏸️ TRAIL (0/1 skipped) - Trail nodes (needs Trail implementation)

---

## Test State Changes

| Commit | Tests Broken | Tests Fixed | Note |
|--------|--------------|-------------|------|
| 9a6179a | 0 | AC1 | Post-refactoring fixes (7 bugs) |
| b6e362a | AC1 | 0 | Cypher refactoring broke search query |
| 7ac20d8 | 0 | AC1-AC6 | Story Manager tests + adhoc search tests migrated |

---

## Known Issues

### ✅ RESOLVED: AC2 Score Mismatch (2025-11-11)
- **Problem**: AC2 expected score=1.0, got 0.99
- **Root cause**: 2 incompatible scoring implementations - TypeScript helper used `(matching/total)`, Cypher used `1.0 - (penalties/100)` with DB weights
- **Solution**:
  1. Skills NEVER in WHERE clause (`computeStrictFields()` filters 'skills')
  2. Schema validation forbids 'skills' in `excludedContextFields`
  3. `calculateExpectedScore()` now async - queries DB for `penaltyMultiplier`
- **Result**: 8/8 integration tests passing (AC1-AC6, UN1-UN4)
- **См. Memory MCP**: `Skills Scoring Architecture Decision 2025-11-11`, `AC2 Score Mismatch Investigation`

### ✅ RESOLVED: DT2 Bug (2025-11-12)
- **Problem**: DT2 test skipped due to `u13Result.dtwMetrics.dtwTotal` accessing undefined property
- **Root cause**: `dtwTotal` is on result level, not inside `dtwMetrics` object
- **Solution**: Changed to `u13Result.dtwTotal` (line 160 in current-context-with-dtw.integration.ts)
- **Result**: DT2 now passing, all 12 integration tests passing

---

*Last updated: 2025-11-12*
*19/19 passing + 1 skipped (DT5) | All implemented tests pass. Target Search (TG1-TG7) completed.*
