# Test Workflows

**Назначение**: Процессы работы с тестами - как писать, review, debug, качественные ворота

---

## Standard Test Development Workflow

### 1. Planning (Main Claude + User)
- Discuss test plan (use AskUserQuestion for clarification)
- Identify test scenarios (happy path, edge cases)
- Decide test type (unit vs integration)
- Read test data (data/trails/*.json) if needed

### 2. Implementation (Main Claude)
- Write test code
- Follow [standards.md](./standards.md) (avoid coverage theater)
- Follow [test-rules.md](./test-rules.md) (dev tips)
- Check [environment.md](./environment.md) if setup needed

### 3. Code Review (Reviewer Agent - MANDATORY)
- Check syntax, ESLint, DRY
- Main Claude fixes critical issues

### 4. Quality Check (QA Agent - MANDATORY)
- Run 5 checks (see [standards.md](./standards.md))
- Main Claude fixes critical issues

### 5. Quality Gates (Main Claude)
- `npm run lint`
- `npx tsc --noEmit`
- `npm run test:integration` (if applicable)

---

## Neo4j Property Testing Pattern

**When testing optional Neo4j properties**, always cover both cases:

```typescript
// Test 1: Property present
await manager.update({ feedback: "Great experience" });
expect(result.feedback).toBe("Great experience");

// Test 2: Property absent (Neo4j returns null)
await manager.update({ position: "New" }); // no feedback field
expect(result.feedback).toBeNull(); // or .toBeUndefined() with .nullish()
```

**Why**: Neo4j returns `null` for absent properties, not `undefined`. Missing this case causes `ZodError: Expected string, received null`.

---

## Test Failure Analysis Process

When tests fail, follow these 5 steps:

### Step 1: Study the Test
- What does it verify?
- What's the business logic?
- What requirement does it validate?

### Step 2: Study the Code
- What does it do?
- Does it match the business logic?
- Recent changes?

### Step 3: Compare Expectations vs Reality
- Where's the mismatch?
- Expected vs Actual output
- Stack trace analysis

### Step 4: Determine Error Source
**Three possibilities**:
1. **Test is outdated** (business logic changed) → FIX: update test
2. **Code has a bug** (doesn't match business logic) → FIX: fix code
3. **Both are wrong** (neither matches requirements) → FIX: clarify requirements

### Step 5: ASK the User
**NEVER decide yourself** - always ask the user what to fix!

```
Какую проблему исправить?
- Test outdated?
- Code has bug?
- Both wrong?
```

---

## Delegation Rules (detailed)

### Main Claude Does It Himself

#### Planning & Implementation (ALWAYS)
- ✅ Обсуждение тест-плана с пользователем (interactive)
- ✅ Написание тестов (implementation)
- ✅ Чтение test data для понимания fixtures
- ✅ Простой review маленьких тестов (< 100 строк для `/test-review`)

#### Quick Fixes (SOMETIMES)
- ✅ Очевидный fix из FAQ (известная ошибка)
- ✅ Добавление одного assertion
- ✅ Простой unit test (< 50 строк)

---

### Reviewer Agent - After Writing (MANDATORY)

#### What It Checks
- Синтаксис TypeScript
- ESLint compliance (max-depth, complexity, etc.)
- DRY violations в тестах (дублирование setup/teardown)
- Unused imports/variables/parameters
- TypeScript forward references

#### When to Call
🔴 **ALWAYS after writing/modifying tests** (mandatory quality gate)
- Integration tests (могут быть сложные)
- Рефакторинг тестов (проверка DRY)

**Size doesn't matter** - even 10 lines changed → call reviewer.

#### When NOT to Call
- Только обсуждение тест-плана (еще не написан код)
- Только чтение тестов для понимания
- Тривиальные изменения (добавили один импорт)

---

### QA Agent - After Writing (MANDATORY)

#### What It Checks
- ✅ 5 checks (Coverage Theater, Test Manipulation, Business Goal, Edge Cases, Schema/Cypher Risk)
- ✅ Fake tests detection
- ✅ Business logic alignment
- ✅ Test failure root cause analysis
- ✅ Integration test strategy после schema changes

#### When to Call
🔴 **ALWAYS after writing/modifying tests** (mandatory quality gate)
- Test failures (root cause analysis)
- Large test suites (>200 lines) - обязательно через агента
- Schema/Cypher changes (integration test validation)
- `/test-review` command (если > 100 строк)

**Size doesn't matter** - even 10 lines changed → call qa.

#### When NOT to Call
- Только обсуждение тест-плана (еще не написан код)
- Только синтаксические правки (reviewer достаточно)
- Тривиальные изменения (добавили один импорт)

---

## When to Skip Agent Delegation

❌ **NEVER skip reviewer + qa after writing tests** (mandatory quality gates)

✅ **Can skip for**:
- Only discussing test plan (no code yet)
- Only reading tests for understanding
- Trivial changes (added one import)

---

## Mandatory Code Quality Checks

**CRITICAL**: After ANY test changes, ALWAYS run these checks before marking work as complete:

```bash
# 1. Linter (MANDATORY - use project script, NOT npx eslint directly)
npm run lint

# 2. TypeScript compilation check (MANDATORY)
npx tsc --noEmit

# 3. Tests (when applicable)
npm run test:unit                    # After logic changes
npm run test:integration             # After Cypher/schema changes
```

### Important Rules
- **Always use `npm run lint`** - project has custom ESLint config
- **Fix ALL errors before proceeding** - warnings acceptable in skipped tests
- **Run integration tests after schema/Cypher changes** - unit test mocks won't catch breaking changes

---

## Quality Gates (before completing feature)

Before completing any feature, verify:

1. ✅ **Type schema designed** (from planner agent)
2. ✅ **Code reviewed** (by reviewer - bugs, DRY, edge cases)
3. ✅ **Tests verified** (by qa - quality, coverage)
4. ✅ **Lint passed** (`npm run lint`)
5. ✅ **TypeScript compiled** (`npx tsc --noEmit`)
6. ✅ **Tests passed** (unit + integration if applicable)

---

## Pre-flight Checks for Quality Gates

**Before running integration tests**, check environment:

```bash
# Check if neo4j-test is running
docker ps | grep neo4j-test
```

**If DB not running**:
- Skip integration tests
- Run only lint + tsc
- Inform user: "Integration tests skipped (DB not running)"
- **Saves 5+ minutes** waiting for failing tests

**If DB running but tests fail with connection error**:
- Restart DB: `npm run docker:test:down && npm run test:setup`

See [environment.md](./environment.md) for details.

---

## Size Thresholds (когда делегировать)

| Размер | Main Claude | Reviewer Agent | QA Agent |
|--------|-------------|----------------|----------|
| < 50 строк | Пишу + простой review сам | ✅ Всегда вызываю | ✅ Всегда вызываю |
| 50-100 строк | Пишу сам | ✅ Всегда вызываю | ✅ Всегда вызываю |
| 100-200 строк | Пишу сам | ✅ Всегда вызываю | ✅ Всегда вызываю |
| > 200 строк | Пишу сам | ✅ Всегда вызываю | ✅ Обязательно через агента |

**Ключевой момент**: Reviewer и QA вызываются ВСЕГДА после написания, независимо от размера (это quality gates).

**Для `/test-review`**:
- < 100 строк → Main Claude анализирует сам
- \> 100 строк → делегировать qa agent

---

## Workflow Examples

### Example 1: Написание нового integration теста

```
User: Напиши integration test для target search
  ↓
Main Claude:
1. Обсуждает тест-план (AskUserQuestion если нужно)
2. Загружает standards.md (5 checks)
3. Загружает test-rules.md (understanding test data)
4. Загружает environment.md (проверка docker ps)
5. Пишет integration test
6. ✅ Вызывает reviewer agent (MANDATORY) → syntax, ESLint, DRY
7. ✅ Вызывает qa agent (MANDATORY) → 5 checks, fake tests
8. Исправляет критические проблемы
9. Запускает quality gates:
   - npm run lint
   - npx tsc --noEmit
   - npm run test:integration
10. Готово ✅
```

### Example 2: Test failure после schema change

```
User: Тесты падают после изменения схемы
  ↓
Main Claude:
1. Загружает workflows.md (Test Failure Analysis Process)
2. Выполняет 5 steps:
   - Study the test
   - Study the code
   - Compare expectations vs reality
   - Determine error source (test/code/both wrong?)
   - ASK user what to fix
3. Если неочевидно → делегирует qa agent
4. qa agent:
   - Загружает standards.md (Schema/Cypher Risk check)
   - Анализирует root cause
   - Выдает отчет
5. Main Claude исправляет проблему
6. ✅ Вызывает reviewer + qa (MANDATORY после изменений)
7. Запускает integration tests
8. Готово ✅
```

### Example 3: Рефакторинг тестов

```
User: Отрефактори test setup в search tests
  ↓
Main Claude:
1. Загружает test-rules.md (DRY patterns)
2. Рефакторит (extract helpers, remove duplication)
3. ✅ Вызывает reviewer agent (MANDATORY) → check DRY compliance
4. ✅ Вызывает qa agent (MANDATORY) → verify business logic не нарушена
5. Запускает quality gates
6. Готово ✅
```

---

## When Schema/Cypher Code Changes

⚠️ **WARNING**: Schema/Cypher/API changes won't be caught by unit tests with mocks.

**ТРЕБУЮТСЯ интеграционные тесты с реальной БД.**

### Workflow:
1. Code changed (schema/Cypher)
2. Write integration tests (Main Claude)
3. ✅ Validate Cypher via MCP (see [standards.md](./standards.md) → Direct Cypher Validation)
4. ✅ Call reviewer agent (syntax)
5. ✅ Call qa agent (MANDATORY - Schema/Cypher Risk check)
6. Run integration tests with real DB
7. Fix issues
8. Quality gates

---

**See also**:
- [router.md](./router.md) - delegation rules, когда использовать workflows
- [standards.md](./standards.md) - 5 checks для qa agent
- [test-rules.md](./test-rules.md) - dev tips, типовые ошибки
- [environment.md](./environment.md) - setup окружения, команды
