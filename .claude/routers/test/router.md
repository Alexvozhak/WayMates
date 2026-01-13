# Test Router

**Когда загружать**: Пишешь/ревьюишь тесты, failing tests, coverage analysis

---

## 4 вопроса перед assertion

1. ❌ Zod гарантирует? → **Skip**
2. ❌ Математика гарантирует? → **Skip**
3. ✅ Бизнес-правило? → **Keep**
4. ✅ Упадёт при регрессии логики? → **Keep**

---

## 5 Checks

### 1. Coverage Theater 🎭

```typescript
// ❌ Очевидный invariant
expect(results.length).toBeGreaterThan(0);

// ✅ Бизнес-правило
expect(results.find(r => r.userId === u5.userId)?.candidateType).toBe("pathfinder");
```

---

### 2. Test Manipulation 🔧

```typescript
// ❌ Магическое число без обоснования
expect(score).toBe(0.857142);

// ✅ Расчёт из test data
expect(score).toBeCloseTo(matchedSkills / totalSkills, 2);
```

---

### 3. Business Goal 🎯

```typescript
// ❌ HOW (implementation)
it('calls buildQuery with params', ...)

// ✅ WHAT (business requirement)
it('filters out same-user candidates', ...)
```

---

### 4. Edge Cases 🔍

**Проверять**: `null`, `[]`, границы, invalid input

```typescript
it('handles context with null creation_reason', async () => {
  const result = await search({ userId: 'user_07' });
  expect(result).toBeDefined();
});
```

---

### 5. Schema/Cypher Risk ⚠️

Mocks скрывают breaking changes → **integration tests обязательны**.

→ Cypher validation workflow: [cypher/debugging-workflow.md](../cypher/debugging-workflow.md)

---

## Neo4j Property Pattern

Neo4j возвращает `null` (не `undefined`) для отсутствующих properties:

```typescript
// Zod schema
feedback: z.string().nullish()  // ✅ принимает null И undefined
```

Тестировать ОБА случая: property present + property absent.

---

## Vitest Projects

| Project | Parallel | Почему |
|---------|----------|--------|
| unit | ✅ | No DB |
| integration-read-only | ✅ | Read-only |
| integration-goals | ❌ | Writes (`singleThread: true`) |
| integration-story | ❌ | Writes (`singleThread: true`) |

**Правило**: Read-only → parallel, Write → sequential

---

## Environment & Commands

→ См. [infrastructure/router.md](../infrastructure/router.md)

---

## QA Agent Response Format

```markdown
## 🧪 Test Review: {file}

### 🔴 Critical (fake tests)
**Issue**: ...
**Fix**: ...

### 🟡 Missing Coverage
**Edge case**: ...

### 🟢 Recommendations
```

---

## Test Failure Analysis

1. **Study test** - что проверяет, какое бизнес-правило
2. **Study code** - что делает, совпадает ли с логикой
3. **Compare** - expected vs actual
4. **Determine source**:
   - Test outdated → update test
   - Code bug → fix code
   - Both wrong → clarify requirements
5. **ASK user** - не решай сам что фиксить
