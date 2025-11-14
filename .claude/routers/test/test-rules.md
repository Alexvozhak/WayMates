# Test Development Rules

**Назначение**: Dev tips для написания тестов + реестр типовых test-specific ошибок

---

## Development Rules

### 1. Understanding Test Data

**ALWAYS read test data BEFORE modifying test expectations.**

```bash
# Read test data files
cat data/trails/users/u1.json
cat data/trails/users/u2.json
# ... etc
```

**Benefits**:
- Understand which users have what trajectories
- Know expected behavior based on data structure
- Avoid hardcoding wrong expectations
- **Saves 15+ minutes** searching for data files

**Example**:
```typescript
// ❌ BAD: Hardcoded expectation without understanding data
expect(results.length).toBe(5); // Why 5? Where did this come from?

// ✅ GOOD: Document test data schema in file header
// Test data:
// - U1: Junior Developer → Mid Developer (2 contexts)
// - U5: Mid → Senior → Lead (3 contexts, pathfinder)
// Expected: U1 searching should find U5 as pathfinder
const u5Result = results.find(r => r.userId === u5.userId);
expect(u5Result?.candidateType).toBe("pathfinder");
```

---

### 2. Edit Tool - `replace_all` Warning

⚠️ **DON'T use `replace_all` for unique parameters**

**Problem**: `replace_all` replaces ALL occurrences, which breaks context-dependent values.

#### ❌ DON'T

```typescript
// Multiple unique test tags
describe('TG1: Basic search', () => { ... });
describe('TG2: Filtered search', () => { ... });
describe('TG3: DTW search', () => { ... });

// ❌ Using replace_all: 'TG' → 'TEST' will break uniqueness!
// Result: TEST1, TEST2, TEST3 all become same string
```

#### ✅ DO

**Use `replace_all` for**:
- Renaming variables across file
- Fixing typos
- Changing imports

**Use multiple Edit calls for**:
- Unique values (TG1, TG2, TG3)
- Context-dependent changes
- Different parameters in different tests

**Benefits**:
- Multiple Edit calls safer than one `replace_all`
- **Saves 10+ minutes** fixing broken tests

---

### 3. Integration vs Unit Tests

**When to use Integration Tests**:
- ✅ Schema/Cypher changes
- ✅ Database relationships
- ✅ Critical paths (search, goals, story)
- ✅ End-to-end scenarios

**When to use Unit Tests**:
- ✅ Pure functions (no DB)
- ✅ Business logic calculations
- ✅ Validation logic
- ✅ Utility functions

**Critical Rule**:
❌ **Mocks hide breaking changes** in schema/Cypher/DB structure
✅ **Integration tests** catch real issues

---

### 4. Pre-flight Checks (before running integration tests)

**ALWAYS check** if DB is running before running integration tests:

```bash
# Check neo4j-test is running
docker ps | grep neo4j-test
```

**If DB not running**:
- Skip integration tests
- Run only lint + tsc
- Inform user: "Integration tests skipped (DB not running)"

**Benefits**:
- **Saves 5+ minutes** waiting for failing tests
- Faster feedback loop

See [environment.md](./environment.md) for setup details.

---

## Test-Specific Mistakes Registry

**Format**: ❌ Как было → ✅ Как надо → Урок → Ссылки

---

### #0: Coverage Theater - Obvious Invariant

**Discovered**: Common pattern across tests

**❌ Как было**:
```typescript
const results = await search();
expect(results.length).toBeGreaterThan(0); // If results exist, length > 0 is obvious!
```

**✅ Как надо**:
```typescript
// Validate business rule: U1 (Junior) should find U5 (Senior pathfinder)
const u5Result = results.find(r => r.userId === u5.userId);
expect(u5Result?.candidateType).toBe("pathfinder");
```

**Урок**: Don't test obvious invariants. Test business logic.

**Ссылки**:
- [standards.md](./standards.md) → Coverage Theater Detection

---

### #1: Mock Verification Theater

**Discovered**: Common in unit tests

**❌ Как было**:
```typescript
mockService.findUsers.mockResolvedValue([user1]);
const result = await manager.find();
expect(result).toEqual([user1]); // Just verifying mock returns what we set!
```

**✅ Как надо**:
```typescript
// Integration test with real DB
const result = await manager.find('user_01');
expect(result[0].userId).toBe('user_01');
expect(result[0].position).toBe('Senior Developer');
```

**Урок**: Mocks hide real issues. Use integration tests for DB/Cypher code.

**Ссылки**:
- [standards.md](./standards.md) → Schema/Cypher Changes Risk

---

### #2: Hardcoded Expectations Without Justification

**Discovered**: Test manipulation to make tests pass

**❌ Как было**:
```typescript
expect(results.length).toBe(3); // Why exactly 3?
expect(results[0].score).toBe(0.857142); // Suspiciously specific!
```

**✅ Как надо**:
```typescript
// Calculate expected from test data
// Test data: U1 has skills [JavaScript, TypeScript], U5 has [JavaScript, TypeScript, React]
// Jaccard = intersection / union = 2 / 3 = 0.6666...
const expectedScore = calculateJaccardScore(u1.skills, u5.skills);
expect(results[0].score).toBeCloseTo(expectedScore, 2);
```

**Урок**: Calculate expectations from test data, don't hardcode observed values.

**Ссылки**:
- [standards.md](./standards.md) → Test Manipulation Detection

---

### #3: Missing Edge Cases (Null/Empty)

**Discovered**: Tests only cover happy path

**❌ Как было**:
```typescript
it('finds similar users', async () => {
  const result = await service.find('user_01');
  expect(result.length).toBeGreaterThan(0); // Only happy path!
});
// Missing: What if user doesn't exist?
// Missing: What if user has no contexts?
```

**✅ Как надо**:
```typescript
it('should return empty array when user has no contexts', async () => {
  // Test data: U99 exists but has no contexts
  const result = await service.find('user_99');
  expect(result).toEqual([]);
});

it('should handle null creation_reason gracefully', async () => {
  // Test data: U7 has context with creation_reason: null
  const result = await search({ userId: 'user_07' });
  expect(result).toBeDefined(); // Should not crash
});
```

**Урок**: Test edge cases: null, empty arrays, boundaries, invalid input.

**Ссылки**:
- [standards.md](./standards.md) → Edge Case Coverage

---

### #4: Zod Duplicates

**Discovered**: Testing what Zod already validates

**❌ Как было**:
```typescript
const goal = await goalsManager.getUserGoal(u3.userId);
expect(goal).toBeDefined();                    // ❌ Zod validates this
expect(goal?.targetCriteria).toBeDefined();    // ❌ Zod validates this
expect(goal?.createdAt).toMatch(/ISO regex/);  // ❌ Zod validates this
```

**✅ Как надо**:
```typescript
const goal = await goalsManager.getUserGoal(u3.userId);
// ✅ Validate business rule - criteria matches input
expect(goal?.targetCriteria.position).toEqual({
  mode: "desired",
  values: ["Senior"]
});
```

**Урок**: Don't duplicate Zod validation. Test business logic.

**Ссылки**:
- [standards.md](./standards.md) → 4 questions before assertions

---

### #5: Implementation-Focused Test Names

**Discovered**: Tests describe HOW, not WHAT

**❌ Как было**:
```typescript
it('calls buildQuery with correct params', ...)
it('uses MATCH clause in query', ...)
it('returns array of results', ...)
```

**✅ Как надо**:
```typescript
it('should filter out candidates from same user', ...)
it('should apply penalty for extra skills in Jaccard mode', ...)
it('should return contexts ordered by creation date DESC', ...)
```

**Урок**: Test names should describe WHAT business requirement is validated, not HOW implementation works.

**Ссылки**:
- [standards.md](./standards.md) → Business Goal Alignment

---

### #6: Missing Schema Change Integration Tests

**Discovered**: Schema changes broke queries, unit tests passed

**❌ Как было**:
```typescript
// Unit test with mocks
const mockDriver = { session: () => ({ run: jest.fn() }) };
// Test passes, but real query is broken!
```

**✅ Как надо**:
```typescript
// Integration test with real DB
beforeAll(async () => {
  await testDataManager.loadFixtures(['u1', 'u2']);
});

it('should execute Cypher query correctly after schema change', async () => {
  const results = await searchManager.search(params);
  expect(results.length).toBeGreaterThan(0);
  // Real DB catches schema issues!
});
```

**Урок**: Schema/Cypher changes REQUIRE integration tests. Mocks hide breaking changes.

**Ссылки**:
- [standards.md](./standards.md) → Schema/Cypher Changes Risk
- [workflows.md](./workflows.md) → When Schema/Cypher Code Changes

---

### #7: Math Validation Without Business Rule

**Discovered**: Testing mathematical properties without business justification

**❌ Как было**:
```typescript
expect(stats.min).toBeLessThan(stats.max); // Math works, no need to test!
```

**✅ Как надо**:
```typescript
// ✅ Business rule: median must be between p25-p75
expect(stats.median).toBeGreaterThanOrEqual(stats.p25);
expect(stats.median).toBeLessThanOrEqual(stats.p75);
```

**Урок**: Don't test math. Test business rules that use math.

**Ссылки**:
- [standards.md](./standards.md) → Coverage Theater Detection

---

## When to Add New Mistake

**Triggers**:
- После фикса тестового бага
- Code review обнаружил типовую ошибку
- QA agent нашел паттерн fake tests

**Format**:
```markdown
### #{N}: [Short Title]

**Discovered**: [Context]

**❌ Как было**:
```typescript
[bad example]
```

**✅ Как надо**:
```typescript
[good example]
```

**Урок**: [One-line lesson]

**Ссылки**:
- [standards.md](./standards.md) → [relevant check]
```

---

**See also**:
- [router.md](./router.md) - когда использовать test-rules
- [standards.md](./standards.md) - 5 checks
- [workflows.md](./workflows.md) - процессы, delegation
- [environment.md](./environment.md) - setup окружения
