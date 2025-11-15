# 22 integration tests failing after BUG-001 fix (search returns 0 results)

**Component**: search-query-builder

**Priority**: 🔴 P0

---

## Reproduction

**Steps**:
1. Run `npm run test:integration:run` after BUG-001 fix (globalSetup + FEAT-018 languages fix)
2. Observe test results

**Expected**:
All 55 integration tests pass (AC1-AC12, TG1-TG7, UN1/UN4, DT1-DT4, G1-G5, GM1-GM4, SM1-SM5)

**Actual**:
22 tests fail with consistent pattern:
- **integration-search-read-only** (13 failed):
  - AC1-AC8, AC12: 0 results from searchAdhoc
  - SC1, SC2, SC4, SC7: languages filter issues
  - UN1, UN4: searchByUserId issues
- **integration-search-goals** (4 failed):
  - G1-G4: 0 results with goals logic
- **integration-story-manager** (2 failed):
  - Temporal links: NEXT_CONTEXT relationships missing
  - Languages: SPEAKS_FLUENT relationships (name=null)

**Test Results** (3 consecutive runs, consistent):
```
Run 1: 4 failed | 2 passed (6 files)
Run 2: 4 failed | 2 passed (6 files)
Run 3: 4 failed | 2 passed (6 files)
Tests: 22 failed | 33 passed (55 total)
```

**Passing tests**:
- TG1-TG7 Target Search: 7/7 passed ✅
- GM1-GM4 Goals metadata CRUD: 5/5 passed ✅

---

## Breadcrumbs

**Primary suspect**: FEAT-018 languages implementation introduced regressions:
1. **Cypher queries** - languages handling in search queries may be broken
2. **Context persistence** - SPEAKS_FLUENT relationships created incorrectly (name=null)
3. **Map projection** - languages array return format issues

**Secondary suspects**:
- globalSetup data import may be incomplete (missing relationships?)
- Scoring/filtering logic changed inadvertently

**Evidence**:
- Story-manager test shows `languagesResult.records[0].get('name') = null` → languages not imported correctly
- Search tests return 0 results → filter/scoring too strict or data missing
- Target search WORKS (TG1-TG7 pass) → basic matching works, issue is in specific filters

---

## Context to Load

**Перед фиксом изучить:**
- `vitest.globalSetup.ts` (line 39) - cleanup logic (`MATCH (n) DETACH DELETE n`)
- `src/cypher/queries/persistence.ts` (lines 98-101) - Language MERGE pattern
- `database/import-languages.ts` (lines 18-22) - Reference data creation (Language nodes with `name`)
- `tests/integration/search-manager/adhoc-context-without-dtw.integration.ts` (AC1 test) - Simplest failing test
- `tests/integration/story-manager/story-manager.integration.ts` (SC6 test) - Language `name` assertion
- `data/trails/users/u1.json` - Test user data (languages field)
- `data/trails/users/u2.json` - Test user data (languages differ from U1)
- `package.json` (line 42) - `db:test:init` script (runs import-languages.ts before globalSetup)

---

## Analysis

**Root Cause**:
globalSetup clears ALL nodes including Language reference data created by `db:test:init`:

1. **Timeline**:
   - `npm run test:setup` runs `db:test:init` → imports Language nodes with `code` AND `name` properties (from `database/import-languages.ts`)
   - globalSetup runs → `MATCH (n) DETACH DELETE n` (line 39) → **deletes Language reference nodes**
   - globalSetup imports U1-U18 → `persistence.ts` creates Language nodes with ONLY `code` property (line 99: `MERGE (lang:Language {code: langCode})`)
   - Result: Language nodes exist but `name=null`

2. **Code**:
   ```typescript
   // vitest.globalSetup.ts:39 (BUG!)
   await clearSession.run('MATCH (n) DETACH DELETE n');  // ❌ Deletes reference data

   // persistence.ts:99 (incomplete pattern)
   MERGE (lang:Language {code: langCode})  // ❌ No `name` property

   // database/import-languages.ts:20 (correct pattern)
   CREATE (l:Language {code: $code, name: $name})  // ✓ Has `name` property
   ```

3. **Why Target Search works but Adhoc fails**:
   - Target search (TG1-TG7) doesn't rely on Language `name` property, only uses `code` for filtering
   - Adhoc search (AC1-AC8) + SC tests expect Language nodes to have `name` property
   - SC6 test explicitly asserts: `expect(record.get('name')).toBe('English')` → fails with `null`

**Impact**:
- **Component**: Test infrastructure (globalSetup) + Context persistence (Language nodes)
- **Severity**: P0 Critical - 22/55 tests fail (40% failure rate)
- **Scope**:
  - integration-search-read-only: 13 failed (AC1-AC8, SC1-SC7, UN1/UN4)
  - integration-search-goals: 4 failed (G1-G4)
  - integration-story-manager: 2 failed (temporal links, languages)
- **Risk**: Reference data (Language, Skill, Reason nodes) deleted on every test run
- **Edge Cases**:
  - Language nodes with `name=null` cause test assertions to fail
  - Contexts with languages field rely on reference data integrity
  - Tests expect Language.name for display/validation

---

## Fix Plan

**Approach**:

**Step 1**: Fix globalSetup cleanup logic (vitest.globalSetup.ts:39)
```typescript
// Before (BUG):
await clearSession.run('MATCH (n) DETACH DELETE n');

// After (FIX):
await clearSession.run(`
  MATCH (n)
  WHERE NOT n:Language AND NOT n:Skill AND NOT n:Reason
  DETACH DELETE n
`);
```

**Step 2**: Add verification that reference data exists
```typescript
// After cleanup, verify reference data preserved
const refDataResult = await clearSession.run(`
  MATCH (l:Language)
  RETURN count(l) AS langCount
`);
const langCount = Number(refDataResult.records[0]?.get('langCount')) || 0;
if (langCount === 0) {
  throw new Error('Reference data (Language nodes) not found. Run db:test:init first.');
}
console.log(`[Global Setup] Reference data verified: ${langCount} Language nodes`);
```

**Step 3**: Update globalSetup comments
```typescript
// Global setup loads base data (U1-U18) ONCE before all projects.
// Reference data (Language, Skill, Reason) is preserved from db:test:init.
// Only test data (User, Context, Trail, Goal) is cleaned and reloaded.
```

**Edge Cases to Test**:
- Empty DB before globalSetup → should fail with error (reference data missing)
- globalSetup after db:test:init → reference data preserved
- Multiple test runs → reference data survives across runs
- Language nodes have `name` property after globalSetup
- Skill/Reason nodes also preserved (not just Language)

---

## Test Plan

**Unit tests**: N/A (infrastructure change)

**Integration tests**:
1. Run `npm run test:integration` (full cycle with setup)
2. Verify ALL 55 tests pass:
   - integration-search-read-only: AC1-AC12, TG1-TG7, UN1/UN4, DT1-DT5 ✓
   - integration-search-goals: GM1-GM4, G1-G5 ✓
   - integration-story-manager: SM1-SM5 ✓
3. Verify Language nodes have `name` property:
   - SC6 test should pass: `expect(record.get('name')).toBe('English')`
4. Run tests 3 times to verify consistency (no intermittent failures)

**Manual checks**:
- After `npm run test:setup`, verify reference data:
  ```bash
  npm run db:test:status
  # Should show Language, Skill, Reason nodes
  ```
- After globalSetup, verify reference data still exists:
  ```cypher
  MATCH (l:Language) RETURN l.code, l.name LIMIT 5
  // Should return languages with name property
  ```

---

## General Instructions

**DO**:
- Preserve reference data (Language, Skill, Reason nodes) in globalSetup
- Add verification that reference data exists after cleanup
- Update globalSetup comments to document reference data preservation
- Run full integration test suite to verify fix

**DON'T**:
- Delete ALL nodes indiscriminately (`MATCH (n) DETACH DELETE n`)
- Skip verification step (fail fast if reference data missing)
- Modify persistence.ts Language MERGE pattern (it's correct for runtime, issue is in test setup)
- Change test expectations (they're correct, data setup was wrong)

---

## DoD (Definition of Done)

- [x] globalSetup cleanup logic fixed (preserves reference data)
- [x] Verification added (reference data exists after cleanup)
- [x] Comments updated (document reference data preservation)
- [x] All 55 integration tests pass
- [x] SC6 test passes (Language.name = 'English')
- [x] Tests run 3 times consecutively (no intermittent failures)
- [x] Lint + tsc clean
- [x] Code reviewed by reviewer agent
- [x] QA validation passed

---

## Regression Prevention

**Timeline Analysis**:
- Commit `de888a5`: plan FEAT-018
- Commit `7effe23`: feat: FEAT-018 languages implementation (added Language reference data)
- Commit `9eeafbf`: fix: BUG-001 (added globalSetup with `MATCH (n) DETACH DELETE n`) ← **BUG INTRODUCED HERE**
- Commit `c587f6f`: chore: report BUG-002

**What went wrong**:
BUG-001 fix introduced globalSetup without considering that `db:test:init` creates reference data BEFORE globalSetup runs. The cleanup logic was too broad, deleting reference data that tests depend on.

**Prevention strategy**:

1. **Documentation**: Add comment to globalSetup explaining reference data lifecycle:
   ```typescript
   // IMPORTANT: Reference data (Language, Skill, Reason) is created by db:test:init
   // and must be preserved across test runs. Only delete test data (User, Context, etc).
   ```

2. **Test**: Add verification step in globalSetup (already in Fix Plan Step 2)
   - Ensures reference data exists after cleanup
   - Fails fast if db:test:init wasn't run
   - Prevents silent data loss

3. **Architecture note** (memory-bank/decisions.md):
   ```markdown
   ## Test Data Lifecycle

   **Reference Data** (Language, Skill, Reason):
   - Created ONCE by `db:test:init` (before globalSetup)
   - Preserved across all test runs (never deleted)
   - Shared by all test projects

   **Test Data** (User, Context, Trail, Goal):
   - Created by globalSetup (U1-U18) or test setupFiles
   - Deleted and recreated as needed (project-specific)
   - Isolated between test projects
   ```

4. **Integration test** (implicit regression test):
   - SC6 test validates Language.name property exists
   - If globalSetup breaks reference data, SC6 will fail immediately
