# Testing

## Commands

```bash
npm run test:unit                              # Unit tests
npm run test:integration                       # All integration tests
npm run test:integration:story-manager         # Story Manager tests (sequential)
npm run test:integration:search-manager        # Search Manager tests
```

---

## Testing Strategy

**Конфигурация**: См. [vitest.config.ts](../../vitest.config.ts)

**Наш подход**:
1. **Parallel execution** для READ operations (search, goals)
2. **Sequential execution** (`singleThread: true`) для WRITE operations (story-manager) - предотвращает data race
3. **Database isolation** - каждый тест очищает DB в beforeEach

**Паттерны тестов**:
- См. Memory MCP: `Sequential Test Execution Pattern`
- См. существующие тесты в `tests/integration/*/` для примеров

---

## Test Registry (Current State)

### Integration Tests: Search Manager
**Status**: 🚧 In Progress (7/30 passing)

#### Adhoc Search (AC1-AC6)
- ✅ AC1: Baseline adhoc search (1/1) - commit 9a6179a
- ✅ AC2: excludedContextFields filter (1/1)
- ✅ AC3: excludedCreationReasons filter (1/1)
- ✅ AC4: recency filter (1/1)
- ✅ AC5: combined filters (1/1)
- ✅ AC6: edge cases (1/1)

#### User Search Without DTW (UN1-UN4)
- ✅ UN1: Basic user search (1/1)
- ⏸️ UN2: Multiple candidates (0/1)
- ⏸️ UN3: No matches (0/1)
- ⏸️ UN4: Filters (0/1) - **BLOCKED** by date issue (U1 context[1] future date)

#### User Search With DTW (DT1-DT5)
- ⏸️ DT1: DTW metrics baseline (0/1)
- ⏸️ DT2: Shape similarity (0/1)
- ⏸️ DT3: Tempo similarity (0/1)
- ⏸️ DT4: Stability score (0/1)
- ⏸️ DT5: Combined scoring (0/1)

#### Target Search (TG1-TG7)
- ⏸️ TG1-TG7: FieldFilter modes (0/7)

#### Goals Integration (G1-G5)
- ⏸️ G1-G5: Goals CRUD (0/5)

---

### Integration Tests: Story Manager
**Status**: ✅ Complete (13/13 passing)

- ✅ CREATE (8/8) - Basic context persistence + all relationships
- ✅ UPDATE (2/2) - Context properties + skills updates
- ✅ TEMPORAL (1/1) - previousContextId/nextContextId links
- ✅ VALIDATION (2/2) - Empty arrays + idempotent upsert
- ⏸️ TRAIL (0/1 skipped) - Trail nodes (needs Trail implementation)

---

## Test State Changes

| Commit | Tests Broken | Tests Fixed | Note |
|--------|--------------|-------------|------|
| 9a6179a | 0 | AC1 | Post-refactoring fixes (7 bugs) |
| b6e362a | AC1 | 0 | Cypher refactoring broke search query |
| 7ac20d8 | 0 | AC1-AC6 | Story Manager tests + adhoc search tests migrated |

---

## Known Issues

### Test Data Date Issue (BLOCKER for UN4)
- **Problem**: U1 context[1] has createdAt: 2026-01-01 (future date)
- **Impact**: timeSinceMatchedMonths < 0 (fails Zod validation)
- **Fix**: Update second context dates for U1, U2 to past dates
- **Affected tests**: UN4 (User Search recency filter)

---

*Last updated: 2025-11-11*
*7/30 passing (23%) | Next: Fix date issue, implement DT1-DT5*
