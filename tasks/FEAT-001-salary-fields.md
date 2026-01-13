# Add salary range (min/max) to Context

**Component**: Context schema

**Priority**: 🔴 P0

---

## User Story

Как пользователь планирующий карьерный переход, я хочу видеть диапазоны зарплат для контекстов, чтобы фильтровать реалистичные возможности соответствующие моим финансовым ожиданиям и определять типичные паттерны роста компенсации.

---

## AS IS

Схема Context не имеет информации о зарплате. Пользователи не могут фильтровать по зарплате или видеть типичную прогрессию компенсации в карьерных путях.

---

## TO BE

Схема Context расширена полями `salaryExact`, `salaryMin`, `salaryMax` (опциональные, USD, взаимоисключающие). Persistence query устанавливает поля зарплаты (null-safe). Map projection возвращает поля зарплаты в результатах поиска. Тестовые данные U17-U18 демонстрируют использование.

---

## Implementation Notes

**Date**: 2025-11-15
**Status**: DONE ✅
**Commit**: f0976a5

**Changes**:
- Added `salaryExact`, `salaryMin`, `salaryMax` fields to UserContext schema with mutual exclusion validation
- Created `userContextSchemaBase` export for `.omit()`/`.partial()` operations (refined schema breaks these)
- Updated persistence query to SET salary fields (null-safe)
- Updated map projection to return salary fields in search results (null values for backward compatibility)
- Added test data U17 (exact salary), U18 (range salary) + AC10-AC12 tests
- Fixed setup-read-only.ts: clear DB if userCount !== 18 (race condition fix)

**Verification**:
- reviewer agent: PASSED ✓
- qa agent: PASSED ✓
- Lint: PASSED ✓
- TypeScript: PASSED ✓
- Integration tests: 46/47 passed (1 pre-existing TEMPORAL bug)

**Scope decision**: Salary fields are DISPLAY ONLY (no filtering/scoring) - LLM in Facade will analyze

**Note**: No migration script needed (test DB recreated from scratch, no production data yet)
