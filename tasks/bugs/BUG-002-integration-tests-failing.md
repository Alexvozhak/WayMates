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

**Next steps** (/plan-bug):
1. Check `persistence.ts` - verify SPEAKS_FLUENT relationship creation
2. Check `search-query-builder.ts` - verify languages filter logic
3. Check globalSetup data import - verify all relationships created
4. Analyze AC1 failure (simplest adhoc search) to understand root cause
