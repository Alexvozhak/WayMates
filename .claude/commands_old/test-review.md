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

**Load context**:
1. [routers/test/router.md](../routers/test/router.md) - delegation rules, size thresholds
2. [routers/test/standards.md](../routers/test/standards.md) - 5 Checks with examples

**5 Checks** (execute all):
1. Coverage Theater Detection
2. Test Manipulation Detection
3. Business Goal Alignment
4. Edge Case Coverage
5. Mock vs Reality (Schema/Cypher Changes Risk)

For detailed examples → [standards.md](../routers/test/standards.md)

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

1. **Load router.md** ([routers/test/router.md](../routers/test/router.md)) - delegation rules, size thresholds
2. **Read test file** (use Read tool)
3. **Check size**:
   - < 100 lines → analyze yourself (load [standards.md](../routers/test/standards.md))
   - \> 100 lines → delegate to `qa` sub-agent
4. **Apply 5 checks** (from [standards.md](../routers/test/standards.md))
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
