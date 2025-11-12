# Test Quality Review

**Description**: Analyzes test files to verify they genuinely validate business logic, not just pass for coverage. Detects fake tests, test manipulation, missing edge cases, and misalignment with business requirements.

**Usage**: `/test-review [path/to/test/file.ts]`

---

## Core Principle

**Tests validate BUSINESS LOGIC, not implementation details.**

Tests should fail when business requirements aren't met, regardless of code changes.

---

## Review Checklist

When reviewing test files, execute these checks:

### 1. **Coverage Theater Detection** 🎭

**Look for:**
- Tests checking obvious invariants (`count > 0` when result exists)
- Mathematical validation without business justification (`min < max`)
- Assertions that can't fail (`expect(true).toBe(true)`)
- Tests that only verify mocks return what you told them to

**Red flags:**
```typescript
// ❌ Coverage theater - obvious invariant
expect(results.length).toBeGreaterThan(0); // If results exist, length > 0 is guaranteed

// ❌ Math validation without business rule
expect(stats.min).toBeLessThan(stats.max); // Math works, no need to test

// ❌ Mock verification theater
mockService.findUsers.mockResolvedValue([user1]);
const result = await manager.find();
expect(result).toEqual([user1]); // Just verifying mock returns what we set
```

**Valid business logic tests:**
```typescript
// ✅ Business rule: median must be between p25-p75
expect(stats.median).toBeGreaterThanOrEqual(stats.p25);
expect(stats.median).toBeLessThanOrEqual(stats.p75);

// ✅ Business requirement: score calculation formula
const expectedScore = (matchedSkills / totalSkills) - (extraSkills * penaltyMultiplier);
expect(result.score).toBeCloseTo(expectedScore, 2);
```

---

### 2. **Test Manipulation Detection** 🔧

**Look for:**
- Hardcoded values matching expected results (test tuned to pass)
- Tests adjusted to match code instead of business requirements
- Suspiciously specific assertions (`expect(score).toBe(0.42857)` - why exactly this?)
- Comments like "adjusted to match new behavior"

**Red flags:**
```typescript
// ❌ Hardcoded to pass - why exactly 3.5?
expect(avgDuration).toBe(3.5);

// ❌ Suspiciously specific - was this calculated or observed?
expect(result.compatibilityScore).toBe(0.6428571428571429);

// ❌ Code comment reveals manipulation
// Changed from 5 to 7 to match new calculation
expect(results.length).toBe(7);
```

**Valid tests:**
```typescript
// ✅ Business rule documented
// Rule: avg duration for 2 transitions (24mo, 36mo) = 30mo
expect(stats.avgDuration).toBe(30);

// ✅ Calculated from test data
const expectedScore = calculateExpectedScore(testData);
expect(result.score).toBeCloseTo(expectedScore, 2);
```

---

### 3. **Business Goal Alignment** 🎯

**Check:**
- Does test name describe WHAT business requirement it validates?
- Is there documentation explaining WHY this behavior is correct?
- Would this test fail if business logic regresses?

**Questions to ask:**
1. What business requirement does this test validate?
2. Why is this the correct/expected behavior?
3. What happens if this test starts failing - is it a real bug or outdated test?

**Red flags:**
```typescript
// ❌ Implementation-focused name
it('calls buildQuery with correct params', ...)

// ❌ No business context
it('returns array of results', ...)
```

**Valid tests:**
```typescript
// ✅ Business requirement in name
it('should filter out candidates from same user', ...)

// ✅ Business rule documented
it('should apply penalty for extra skills in Jaccard mode', () => {
  // Business rule: Jaccard penalizes candidates with skills
  // outside requested set to avoid "jack of all trades"
  ...
});
```

---

### 4. **Edge Case Coverage** 🔍

**Required edge cases:**
- **Null/undefined**: Properties that can be missing
- **Empty arrays**: `skills: []`, `domains: []`
- **Boundary values**: `0`, `-1`, `Infinity`, `MAX_INT`
- **Invalid input**: Wrong types, malformed data
- **State transitions**: What happens between valid states

**Red flags - missing coverage:**
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

**Valid coverage:**
```typescript
// ✅ Edge case: empty array
it('should return empty array when no candidates match filters', ...)

// ✅ Edge case: null value
it('should handle contexts with null creation_reason', ...)

// ✅ Boundary: zero results
it('should not fail when similarity cutoff excludes all results', ...)
```

---

### 5. **Mock vs Reality** 🎭

**Critical for WayMates:**
- Schema changes won't be caught by mocked unit tests
- Cypher query changes require integration tests
- Database relationship changes invisible to mocks

**Check:**
- Are there integration tests for schema-dependent code?
- Do Cypher query changes have real DB tests?
- Are critical paths tested without mocks?

**Red flags:**
```typescript
// ❌ Mocking Neo4j driver - won't catch Cypher errors
const mockDriver = {
  session: () => ({ run: jest.fn() })
};

// Test passes but real query is broken!
```

**Valid approach:**
```typescript
// ✅ Integration test with real DB
beforeAll(async () => {
  await testDataManager.loadFixtures(['u1', 'u2']);
});

it('should execute Cypher query correctly', async () => {
  const results = await searchManager.search(params);
  // Real DB, real Cypher, real results
});
```

---

## Review Output Format

Provide structured analysis:

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

## Execution Strategy

1. **Read test file** (use Read tool)
2. **Read corresponding source code** (understand business logic)
3. **Apply checklist** (all 5 checks)
4. **For complex analysis**: Delegate to `qa` sub-agent
5. **Output structured report**

---

## When to Use Sub-Agent

**Use `qa` sub-agent when:**
- Test suite is large (>200 lines)
- Need to analyze test failures
- Require fixture/schema validation
- Need integration test strategy

**Example delegation:**
```
Task(qa, "Analyze tests/integration/gds-similarity.test.ts for:
1. Coverage theater (obvious assertions)
2. Test manipulation (hardcoded values)
3. Missing edge cases (null, empty, boundaries)
4. Mock risks (should use real DB)")
```

---

## Examples

### Example 1: Coverage Theater Detected

**File**: `tests/unit/score-calculator.spec.ts`

```typescript
it('calculates score', () => {
  const score = calculator.calculate(5, 10);
  expect(score).toBeGreaterThan(0); // ❌ Obvious - score is always > 0
  expect(typeof score).toBe('number'); // ❌ TypeScript guarantees this
});
```

**Report:**
```markdown
🔴 Coverage Theater
- Line 42: `expect(score).toBeGreaterThan(0)` - tests obvious invariant
- Line 43: `expect(typeof score).toBe('number')` - TypeScript checks this

Fix: Test business rule instead:
`expect(score).toBe((5/10) * 100); // Expected: 50% match score`
```

---

### Example 2: Test Manipulation Detected

**File**: `tests/integration/search.test.ts`

```typescript
it('returns similarity results', async () => {
  const results = await search('user_01');
  expect(results.length).toBe(3); // ❌ Why exactly 3?
  expect(results[0].score).toBe(0.857142); // ❌ Suspiciously specific
});
```

**Report:**
```markdown
🔴 Test Manipulation Suspected
- Line 15: Hardcoded `3` - was this calculated or observed?
- Line 16: Score `0.857142` - no business justification

Fix: Calculate expected values:
```typescript
const expectedCount = countUsersWithSkillsIn(['JavaScript', 'TypeScript']);
expect(results.length).toBe(expectedCount);

const expectedScore = calculateJaccardScore(user01Skills, targetSkills);
expect(results[0].score).toBeCloseTo(expectedScore, 2);
```
```

---

## Quality Gate

**Before approving tests, verify:**
- ✅ All tests validate business requirements (not implementation)
- ✅ No coverage theater (obvious assertions removed)
- ✅ Edge cases covered (null, empty, boundaries)
- ✅ Schema/Cypher changes have integration tests
- ✅ No suspiciously specific hardcoded values without justification
