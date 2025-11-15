# Add education level enum to Context

**Component**: Context schema

**Priority**: 🔴 P0

---

## User Story

Как пользователь ищущий карьерные пути, я хочу фильтровать по уровню образования, чтобы видеть переходы соответствующие моему академическому бэкграунду и понимать типичные требования к образованию для целевых позиций.

---

## AS IS

Схема Context не имеет информации об уровне образования. Пользователи не могут фильтровать по образованию или видеть типичные требования к образованию для позиций.

---

## TO BE

Схема Context расширена enum `educationLevel` (7 уровней: NONE → PROFESSIONAL). Поиск поддерживает фильтрацию по уровню образования (strict + excluded режимы). Map projections возвращают educationLevel в результатах. Поведение null wildcard: отсутствующий educationLevel совпадает со всеми уровнями.

---

## Implementation Notes

**Date**: 2025-11-15
**Status**: DONE ✅
**Commit**: ec4073a

**Changes**:
- Schema: Added `educationLevelSchema` enum (7 levels: NONE, HIGH_SCHOOL, ASSOCIATE, BACHELOR, MASTER, DOCTORATE, PROFESSIONAL)
- Null handling: `.nullable().optional()` - Neo4j returns null for missing properties in map projection
- Cypher filtering: CASE logic for null wildcard behavior (null in search OR candidate → always show)
- Test data: U1-U13 all got BACHELOR (same value, no existing test impact), new U14-U16 for education-specific tests
- Test coverage: AC7 (strict match), AC8 (excluded field), AC9 (null wildcard)
- Selectivity: Refactored `getContextFieldValue()` from if-chain to Record mapping (complexity fix)
- Map projections: Added educationLevel to both `buildContextMapProjection()` and `CONTEXT_MAP_PROJECTION_CANONICAL`
- Database index: Added for educationLevel filtering

**Verification**:
- reviewer agent: PASSED ✓
- qa agent: PASSED ✓
- Lint: PASSED ✓
- TypeScript: PASSED ✓
- Integration tests: PASSED ✓

**Business logic**: Missing education in candidate = wildcard (always included), strict matching when both present

**Lessons learned**: When adding Context field, must update: schema, Cypher filters, persistence, **map projection** (forgot initially), selectivity, index
