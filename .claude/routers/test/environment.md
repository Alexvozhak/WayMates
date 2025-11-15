# Test Environment

**Назначение**: Vitest configuration, параллелизация, data race prevention, запуск тестов

---

## Vitest Projects

**Referencing**: `vitest.config.ts`

WayMates uses **Vitest Projects** to organize tests by type and isolation requirements.

> **💡 Shared Test Data Pattern**: If multiple projects need same base data (e.g., U1-U18), use `vitest.globalSetup.ts` to load once. See `tasks/bugs/BUG-001-race-condition-setup.md` for complete pattern implementation.

### Projects Configuration

| Project | Include | Parallel | Isolate | singleThread | Timeout | setupFiles |
|---------|---------|----------|---------|--------------|---------|------------|
| **unit** | tests/unit/**/*.spec.ts | ✅ Yes | ❌ No | ❌ No | 10s | - |
| **integration-search-read-only** | adhoc-context, target-search, current-context, current-context-dtw | ✅ Yes | ❌ No (shared state U1-U13) | ❌ No | 30s | setup-read-only.ts |
| **integration-search-goals** | goals-integration.integration.ts | ❌ No | ✅ Yes | ✅ Yes (write ops) | 30s | setup-goals.ts |
| **integration-story-manager** | story-manager.integration.ts | ❌ No | ✅ Yes | ✅ Yes (write ops) | 30s | setup.ts |

---

## Data Race Prevention Rules

### 1. Projects между собой → SEQUENTIAL
```typescript
// vitest.config.ts
sequence: {
  concurrent: false, // Projects use different datasets, must not run in parallel
}
```

**Why**: Projects may modify DB state, running in parallel causes race conditions.

---

### 2. Read-only tests → PARALLEL
```typescript
// integration-search-read-only project
poolOptions: {
  threads: {
    isolate: false,      // Shared state (U1-U13 loaded once)
    singleThread: false, // Parallel execution ✅
  }
}
```

**Why**: Read-only tests don't modify DB, safe to run in parallel.

---

### 3. Write tests → SEQUENTIAL
```typescript
// integration-search-goals, integration-story-manager projects
poolOptions: {
  threads: {
    isolate: true,       // Isolated state
    singleThread: true,  // Sequential execution ⚠️
  }
}
```

**Why**: Write operations cause race conditions if run in parallel.

---

## Test Commands

**Referencing**: `package.json` scripts

### Setup Environment

```bash
# Полный setup (поднять docker + init DB)
npm run test:setup
# = docker compose --env-file .env.test up neo4j-test -d --wait && npm run db:test:init
```

**What it does**:
1. Запускает neo4j-test контейнер (port 7689)
2. Ждет готовности
3. Инициализирует DB (schema, constraints, indexes)
4. Импортирует skills, reasons

---

### Running Tests

```bash
# Unit tests (fast, no DB needed)
npm run test:unit
# = vitest --run --project unit

# Integration tests (full cycle: setup + run + cleanup)
npm run test:integration
# = npm run test:integration:dev && npm run docker:test:down

# Integration tests (без cleanup, для debugging)
npm run test:integration:dev
# = npm run test:setup && npm run test:integration:run

# Integration tests (только run, без setup/cleanup)
npm run test:integration:run
# = vitest --run --project integration-search-read-only --project integration-search-goals

# Все тесты (unit + integration + functional)
npm run test:all
# = npm run build:cypher && npm run test:unit && npm run test:setup && npm run test:integration:run && npm run test:functional:run && npm run docker:test:down
```

---

### Cleanup

```bash
# Остановить и удалить neo4j-test контейнер
npm run docker:test:down
# = docker compose --env-file .env.test stop neo4j-test && docker compose --env-file .env.test rm -f neo4j-test

# Очистить DB (удалить все ноды)
npm run db:test:clean
# = scripts/db.sh test -d neo4j "MATCH (n) DETACH DELETE n"

# Проверить статус DB (количество нод)
npm run db:test:status
# = scripts/db.sh test -d neo4j "MATCH (n) RETURN count(n) as total_nodes"
```

---

## Pre-flight Checks

**ALWAYS check** environment before running integration tests:

### Check 1: Is neo4j-test running?

```bash
docker ps | grep neo4j-test
```

**If not running**:
```bash
npm run test:setup
```

**If running but tests fail with "Connection refused"**:
```bash
# Restart DB
npm run docker:test:down && npm run test:setup
```

---

### Check 2: Is DB initialized?

```bash
npm run db:test:status
# Should return total_nodes > 0
```

**If DB empty**:
```bash
npm run db:test:init
```

---

## Troubleshooting

### Problem: "Connection refused" error

**Причина**: neo4j-test контейнер не запущен

**Fix**:
```bash
# Check status
docker ps | grep neo4j-test

# If not running
npm run test:setup
```

---

### Problem: Tests pass locally, fail in CI

**Причина**: Race condition между projects

**Fix**:
- Проверь `sequence.concurrent: false` в vitest.config.ts
- Проверь `singleThread: true` для write tests

---

### Problem: Tests slow (> 5 min)

**Причина**: Sequential execution всех tests

**Fix**:
- Разделить на read-only (parallel) и write (sequential)
- Проверь `singleThread: false` для read-only tests

---

### Problem: DB not cleaned between tests

**Причина**: setupFiles не вызывает cleanup

**Fix**:
```bash
# Manual cleanup
npm run db:test:clean && npm run db:test:init
```

---

## Integration Tests Best Practices

### 1. Use Separate Projects for Read/Write

**Read-only** (parallel):
```typescript
// tests/integration/search-manager/adhoc-context-without-dtw.integration.ts
// Can run in parallel with other read-only tests
```

**Write** (sequential):
```typescript
// tests/integration/search-manager/goals-integration.integration.ts
// Must run sequentially
```

---

### 2. Share Setup for Read-Only Tests

```typescript
// tests/integration/search-manager/setup-read-only.ts
beforeAll(async () => {
  // Load fixtures once, shared across all tests
  await loadFixtures(['u1', 'u2', ..., 'u13']);
}, 60000);
```

**Benefits**:
- Faster execution (load once, not per test)
- Safe for parallel execution (read-only)

---

### 3. Isolate Setup for Write Tests

```typescript
// tests/integration/search-manager/setup-goals.ts
beforeEach(async () => {
  // Clean + setup before each test
  await cleanDB();
  await loadFixtures(['u3', 'u4']);
});
```

**Benefits**:
- No race conditions
- Isolated test state

---

## Configuration Reference

### vitest.config.ts Structure

```typescript
export default defineConfig(() => {
  return {
    test: {
      testTimeout: 30000,
      hookTimeout: 30000,
      environment: "node",

      // Projects run SEQUENTIALLY
      sequence: {
        concurrent: false,
      },

      projects: [
        {
          test: {
            name: "unit",
            include: ["tests/unit/**/*.spec.ts"],
            pool: "threads",
            poolOptions: {
              threads: { isolate: false }
            },
            testTimeout: 10000,
          }
        },
        // ... other projects
      ]
    }
  };
});
```

**Key parameters**:
- `sequence.concurrent: false` - projects run sequentially
- `poolOptions.threads.isolate` - isolate global state
- `poolOptions.threads.singleThread` - force sequential execution
- `testTimeout` - max time per test
- `hookTimeout` - max time for beforeAll/afterAll

---

## Quick Reference

| Need | Command |
|------|---------|
| Setup environment | `npm run test:setup` |
| Run unit tests | `npm run test:unit` |
| Run integration tests | `npm run test:integration` |
| Run integration (no cleanup) | `npm run test:integration:dev` |
| Run all tests | `npm run test:all` |
| Cleanup | `npm run docker:test:down` |
| Check DB status | `npm run db:test:status` |
| Check docker status | `docker ps \| grep neo4j-test` |
| Restart DB | `npm run docker:test:down && npm run test:setup` |

---

**See also**:
- [router.md](./router.md) - когда использовать environment
- [workflows.md](./workflows.md) - pre-flight checks, quality gates
- [test-rules.md](./test-rules.md) - pre-flight checks rule
- `package.json` - полный список команд
- `vitest.config.ts` - детальная конфигурация проектов
