# Race condition in setup-read-only.ts with parallel tests

**Component**: Test infrastructure

**Priority**: 🟡 P1

---

## Reproduction

**Steps**:
1. Run `integration-search-goals` project (loads U1-U13 to shared test DB)
2. Run `integration-search-read-only` project in parallel (expects U1-U18)
3. `setup-read-only.ts` checks `userCount=13 > 0` → skips import
4. Tests fail: U14-U18 missing (AC8-AC11 fail)

**Expected**:
Each test project should load its data in isolation OR use global setup that imports data **once** for all parallel tests before they start.

**Actual**:
- Both projects use same DB (`bolt://localhost:7689`)
- Check `userCount > 0` doesn't verify **which exact** users are loaded
- Race condition: first project loads its data, second thinks "already loaded" and skips import
- Current "fix" `userCount !== 18` - magic number (brittle code)

---

## Breadcrumbs

Root cause in `tests/integration/search-manager/setup-read-only.ts:49-75`:
```typescript
if (userCount !== 18) {  // ❌ MAGIC NUMBER - breaks when U19 added
  // Clear and reload
}
```

Problems:
1. **Shared DB**: Both projects use one DB without isolation
2. **Weak check**: Checking count instead of specific user IDs
3. **Magic number**: Hardcoded `18` - adding U19 will break code
4. **No global setup**: No unified setup to load data before all tests
