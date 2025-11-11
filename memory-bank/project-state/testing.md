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
**Status**: 🚧 In Progress (8/30 passing)

#### Adhoc Search (AC1-AC6) - Helper: score-calculator.ts
- ✅ AC1: Baseline adhoc search (1/1) - exact skill match, perfect score
- ✅ AC2: excludedContextFields filter (1/1) - skill penalties from DB
- ✅ AC3: Exclude geo - international search (1/1)
- ✅ AC4: Only position strict (1/1)
- ✅ AC5: Excluded creation reasons (1/1)
- ✅ AC6: Recency filter (1/1)
- ⏸️ AC7-AC11: Edge cases (0/5) - not implemented yet

#### User Search Without DTW (UN1-UN4)
- ✅ UN1: No trajectory fallback (1/1)
- ✅ UN4: Exclude geo via userId (1/1)
- ⏸️ UN2-UN3, UN5: Edge cases (0/3) - not implemented yet

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

### ✅ RESOLVED: AC2 Score Mismatch (2025-11-11)
- **Problem**: AC2 expected score=1.0, got 0.99
- **Root cause**: 2 incompatible scoring implementations - TypeScript helper used `(matching/total)`, Cypher used `1.0 - (penalties/100)` with DB weights
- **Solution**:
  1. Skills NEVER in WHERE clause (`computeStrictFields()` filters 'skills')
  2. Schema validation forbids 'skills' in `excludedContextFields`
  3. `calculateExpectedScore()` now async - queries DB for `penaltyMultiplier`
- **Result**: 8/8 integration tests passing (AC1-AC6, UN1-UN4)
- **См. Memory MCP**: `Skills Scoring Architecture Decision 2025-11-11`, `AC2 Score Mismatch Investigation`

---

*Last updated: 2025-11-11*
*15/30 passing (50%) | Next: Investigate AC2 score mismatch, implement DT1-DT5*
