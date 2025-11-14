# Test Quality Standards

**Назначение**: Правила и критерии качества тестов - как писать тесты, которые проверяют бизнес-логику, а не очевидные вещи

---

## Core Principle

**Tests validate BUSINESS LOGIC, not implementation details.**

Tests should fail when business requirements aren't met, regardless of code changes.

---

## Before Writing ANY Test Assertion

Ask yourself these 4 questions:

1. ❌ Is this guaranteed by Zod schema? → **Skip it**
2. ❌ Is this guaranteed by math/existence? → **Skip it**
3. ✅ Does this validate a **business rule**? → **Keep it**
4. ✅ Would this fail if business logic regresses? → **Keep it**

---

## 5 Checks (execute ALL when reviewing tests)

### 1. Coverage Theater Detection 🎭

**What to look for**:
- Tests checking obvious invariants (`count > 0` when result exists)
- Mathematical validation without business justification (`min < max`)
- Assertions that can't fail (`expect(true).toBe(true)`)
- Tests that only verify mocks return what you told them to

---

#### ❌ Red Flags

```typescript
// ❌ Coverage theater - obvious invariant
expect(results.length).toBeGreaterThan(0);
// If results exist, length > 0 is guaranteed!

// ❌ Math validation without business rule
expect(stats.min).toBeLessThan(stats.max);
// Math works, no need to test

// ❌ Zod duplicate - TypeScript/Zod validates this
expect(goal).toBeDefined();
expect(goal?.targetCriteria).toBeDefined();
expect(typeof score).toBe('number');

// ❌ Mock verification theater
mockService.findUsers.mockResolvedValue([user1]);
const result = await manager.find();
expect(result).toEqual([user1]);
// Just verifying mock returns what we set!
```

---

#### ✅ Valid Business Logic Tests

```typescript
// ✅ Business rule: median must be between p25-p75
expect(stats.median).toBeGreaterThanOrEqual(stats.p25);
expect(stats.median).toBeLessThanOrEqual(stats.p75);

// ✅ Business requirement: score calculation formula
const expectedScore = (matchedSkills / totalSkills) - (extraSkills * penaltyMultiplier);
expect(result.score).toBeCloseTo(expectedScore, 2);

// ✅ Business rule: criteria matches input
expect(goal?.targetCriteria.position).toEqual({
  mode: "desired",
  values: ["Senior"]
});

// ✅ Business constraint: same-user contexts excluded
const sameUserContext = results.find(r => r.user_id === searchUser.user_id);
expect(sameUserContext).toBeUndefined();
```

---

### 2. Test Manipulation Detection 🔧

**What to look for**:
- Hardcoded values matching expected results (test tuned to pass)
- Tests adjusted to match code instead of business requirements
- Suspiciously specific assertions (`expect(score).toBe(0.42857)` - why exactly this?)
- Comments like "adjusted to match new behavior"

---

#### ❌ Red Flags

```typescript
// ❌ Hardcoded to pass - why exactly 3.5?
expect(avgDuration).toBe(3.5);

// ❌ Suspiciously specific - was this calculated or observed?
expect(result.compatibilityScore).toBe(0.6428571428571429);

// ❌ Code comment reveals manipulation
// Changed from 5 to 7 to match new calculation
expect(results.length).toBe(7);

// ❌ Adjusted to pass without understanding
expect(results.length).toBe(3); // Why exactly 3?
expect(results[0].score).toBe(0.857142); // No business justification
```

---

#### ✅ Valid Tests

```typescript
// ✅ Business rule documented
// Rule: avg duration for 2 transitions (24mo, 36mo) = 30mo
expect(stats.avgDuration).toBe(30);

// ✅ Calculated from test data
const expectedScore = calculateExpectedScore(testData);
expect(result.score).toBeCloseTo(expectedScore, 2);

// ✅ Business rule: U1 (Junior) should find U5 (Senior pathfinder)
const u5Result = results.find(r => r.userId === u5.userId);
expect(u5Result?.candidateType).toBe("pathfinder");
expect(u5Result?.matchedContext.position).toBe("Senior");
```

---

### 3. Business Goal Alignment 🎯

**What to check**:
- Does test name describe WHAT business requirement it validates?
- Is there documentation explaining WHY this behavior is correct?
- Would this test fail if business logic regresses?

**Questions to ask**:
1. What business requirement does this test validate?
2. Why is this the correct/expected behavior?
3. What happens if this test starts failing - is it a real bug or outdated test?

---

#### ❌ Red Flags

```typescript
// ❌ Implementation-focused name
it('calls buildQuery with correct params', ...)

// ❌ No business context
it('returns array of results', ...)

// ❌ Testing implementation detail
it('uses MATCH clause in query', ...)
```

---

#### ✅ Valid Tests

```typescript
// ✅ Business requirement in name
it('should filter out candidates from same user', ...)

// ✅ Business rule documented
it('should apply penalty for extra skills in Jaccard mode', () => {
  // Business rule: Jaccard penalizes candidates with skills
  // outside requested set to avoid "jack of all trades"
  ...
});

// ✅ WHAT not HOW
it('should return contexts ordered by creation date DESC', ...)
```

---

### 4. Edge Case Coverage 🔍

**Required edge cases**:
- **Null/undefined**: Properties that can be missing
- **Empty arrays**: `skills: []`, `domains: []`
- **Boundary values**: `0`, `-1`, `Infinity`, `MAX_INT`
- **Invalid input**: Wrong types, malformed data
- **State transitions**: What happens between valid states

---

#### ❌ Red Flags - Missing Coverage

```typescript
// ❌ Only happy path tested
it('finds similar users', async () => {
  const result = await service.find('user_01');
  expect(result.length).toBeGreaterThan(0);
});

// Missing: What if user_01 doesn't exist?
// Missing: What if user_01 has no contexts?
// Missing: What if all contexts filtered out?
```

---

#### ✅ Valid Coverage

```typescript
// ✅ Edge case: empty array
it('should return empty array when no candidates match filters', async () => {
  const result = await search({ skills: ['NonExistentSkill'] });
  expect(result).toEqual([]);
});

// ✅ Edge case: null value
it('should handle contexts with null creation_reason', async () => {
  // Test data: U7 has context with creation_reason: null
  const result = await search({ userId: 'user_07' });
  expect(result).toBeDefined(); // Should not crash
});

// ✅ Boundary: zero results
it('should not fail when similarity cutoff excludes all results', async () => {
  const result = await search({ minSimilarity: 0.99 });
  expect(result).toEqual([]);
});
```

---

### 5. Schema/Cypher Changes Risk 🎭

**Critical for WayMates**:
- Schema changes won't be caught by mocked unit tests
- Cypher query changes require integration tests
- Database relationship changes invisible to mocks

**Check**:
- Are there integration tests for schema-dependent code?
- Do Cypher query changes have real DB tests?
- Are critical paths tested without mocks?

---

#### ❌ Red Flags

```typescript
// ❌ Mocking Neo4j driver - won't catch Cypher errors
const mockDriver = {
  session: () => ({ run: jest.fn() })
};

// Test passes but real query is broken!
```

---

#### ✅ Valid Approach

```typescript
// ✅ Integration test with real DB
beforeAll(async () => {
  await testDataManager.loadFixtures(['u1', 'u2']);
});

it('should execute Cypher query correctly', async () => {
  const results = await searchManager.search(params);
  // Real DB, real Cypher, real results
  expect(results.length).toBeGreaterThan(0);
});
```

---

## Direct Cypher Validation (MANDATORY for Cypher queries)

**Before writing integration tests** for Cypher-related code, validate queries directly using MCP.

### Why

- Project has history of WITH clause scope bugs
- Mocks hide null handling issues
- Direct testing catches query logic errors that integration tests miss

### Validation Workflow

1. **Inspect schema**: `mcp__neo4j-cypher__get_neo4j_schema()`

2. **Test query with edge cases**:
```typescript
mcp__neo4j-cypher__read_neo4j_cypher({
  query: `
    MATCH (u:User)-[:HAS_CONTEXT]->(c:Context)
    WHERE ANY(r IN coalesce(c.creation_reason, []) WHERE r IN $reasons)
    WITH u, c
    RETURN u, c LIMIT 5
  `,
  params: { reasons: ['position_changed'] }
})
```

3. **Test edge cases**:
   - null values: `params: { reasons: null }`
   - Empty arrays: `params: { reasons: [] }`
   - Missing properties: contexts without `creation_reason`
   - WITH clause scope: verify variable propagation
   - COALESCE logic: `coalesce(field, []) IS NOT NULL` vs `size(coalesce(field, [])) > 0`

4. **Compare raw Cypher results vs TypeScript output**

---

## Test Quality Standards

- **DRY in tests**: Reuse helper functions, avoid duplication
- **Readable tests**: Tests document business logic
- **Arrange-Act-Assert** pattern
- **One test, one assertion** (when possible)
- **Meaningful test names**: Describe what is tested and expected outcome

---

## Response Format (for qa agent)

When analyzing tests, provide structured analysis:

```markdown
## 🧪 Test Quality Review: {filename}

### ✅ Strengths
- [What tests do well]

### 🔴 Critical Issues (FAKE TESTS)
**Issue**: [Description]
**Location**: {file}:{line}
**Problem**: [Why this is fake/manipulated]
**Fix**: [How to make it validate real business logic]

### 🟡 Missing Coverage
**Edge case**: [What's not tested]
**Risk**: [What could break]
**Suggestion**: [Test to add]

### 🟢 Recommendations
- [Improvements for test quality]
```

---

## When Schema/Cypher Code Changes

⚠️ **ВНИМАНИЕ**: Изменения схемы БД/Cypher запросов/API не будут пойманы unit тестами с моками.

**ТРЕБУЮТСЯ интеграционные тесты с реальной БД.**

**Checklist**:
- [ ] Integration tests exist for changed schema
- [ ] Cypher queries validated via MCP (Direct Cypher Validation)
- [ ] Real DB tests run (not mocked)
- [ ] Edge cases tested (null, empty arrays, boundaries)

---

**See also**:
- [router.md](./router.md) - когда использовать эти standards
- [workflows.md](./workflows.md) - процессы работы с тестами
- [test-rules.md](./test-rules.md) - dev tips и типовые ошибки
