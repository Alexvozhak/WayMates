# Sessions Brief (Business Context)

## 2025-11-10 (Night): Story Manager Tests Migration
**Commit**: 7ac20d8

**Проблема**: Archived persistence tests не работают с новым StoryManager API (был PersistenceManager).

**Решение**: Мигрировали 13 тестов на новую архитектуру, создали vitest project с sequential execution.

**Результат**: 13/13 passing, infrastructure для integration tests, patterns для future tests.

**Почему sequential**: WRITE operations + Neo4j driver = data race без singleThread: true.

**См. Memory MCP**: `StoryManager Integration Tests`, `Sequential Test Execution Pattern`

---

## 2025-11-10 (Very Late Evening): Integration Test Post-Refactoring Fixes
**Commit**: 9a6179a

**Проблема**: AC1 тест сломался после Cypher refactoring (7 bugs introduced).

**Решение**: Исправили query pattern (search ALL contexts, не только current), LIMIT type casting, schema imports, variable conflicts.

**Результат**: AC1 passing (1/1), query возвращает правильные данные (U2, score=1.0).

**Ключевой урок**: disableLosslessIntegers НЕ работает для input parameters, нужен toInteger() в Cypher.

**См. Memory MCP**: `Neo4j 5 GQL Parameter Handling`, `Adhoc Search Query Pattern`

---

## 2025-11-10 (Late Evening): Query Builders Refactoring
**Commit**: b6e362a

**Проблема**: Дублирование OPTIONAL MATCH блоков (18 lines) + короткие непонятные имена переменных (c, p, wd).

**Решение**: Создали константу OPTIONAL_MATCH_CONTEXT_RELATIONSHIPS, переименовали переменные в canonical names.

**Результат**: -11 lines, улучшенная читаемость, но нашли limitation (target-query-builder не может использовать константу из-за InPath suffix).

**Архитектурное решение**: InPath suffix для trajectory variables когда sharing scope с matched context.

**См. Memory MCP**: `QueryBuilderRefactoring_Nov10`, `CypherNamingConflict_TargetQueryBuilder`

---

## 2025-11-10 (Evening): Integration Test Debugging
**Commit**: 7ac20d8 (related)

**Проблема**: AC1 тест не запускается (Zod validation errors, Neo4j parameter issues, schema import errors).

**Решение**: Исправили test data enums, Neo4j 5 GQL parameter scope, унифицировали schema imports в shared/schemas.ts.

**Результат**: Test data loading success (U1-U13), UPSERT queries work, но Cypher WHERE syntax error (fixed в следующей сессии).

**Ключевой урок**: Neo4j 5 GQL теряет parameter scope после WITH, нужно explicit aliasing + "context" is reserved keyword.

**См. Memory MCP**: `Neo4j 5 GQL Parameter Rules`, `camelCase Migration Completion`

---

## 2025-11-10 (Morning): ESLint Strict Configuration
**Commit**: 9a6179a (related)

**Проблема**: Inconsistent code style (PascalCase schemas, snake_case properties, no import organization).

**Решение**: Установили eslint-plugin-import-x + unicorn, enforced camelCase naming, type-first imports, sorted imports.

**Результат**: 0 errors, 16 warnings (только no-non-null-assertion), 146 violations auto-fixed.

**Архитектурное решение**: Preset-based config (importX.flatConfigs.recommended) вместо manual registration, scope в package.json.

**См. Memory MCP**: `ESLint Strict Configuration 2025-11-10`, `Mass Rename Strategy`

---

## 2025-11-08: Naming Convention Migration (camelCase)
**Commits**: 7ac20d8, f5eb17c

**Проблема**: Смешанный стиль именования (snake_case в DB, camelCase в TypeScript, inconsistency).

**Решение**: Полная миграция на camelCase во всех слоях (TypeScript + Neo4j properties + API).

**Результат**: 80+ schema properties renamed, 13 DB constraints + 13 indexes updated, 8 query builders refactored.

**Архитектурное решение**: camelCase везде для консистентности (JavaScript idiom + Neo4j recommendation).

**Исключение**: MCP tool names остались snake_case (стандарт MCP).

**См. Memory MCP**: `ESLint Strict Migration 2025-11-10`

---

## 2025-11-08 (Earlier): SearchManager Schema Consolidation
**Commit**: Related to 7ac20d8

**Проблема**: Duplicate schemas (AdhocSearchParams = SearchByContextParams), unclear ownership (core vs shared).

**Решение**: Removed duplicate, moved reusable schemas to shared layer, made userId required everywhere.

**Результат**: Single source of truth, proper architectural layering, easier future core/facade split.

**Архитектурное решение**: shared layer для типов, используемых facade + core.

**См. Memory MCP**: `SearchManager_Schema_Refactoring_2025_11_08`, `Schema_Layering_Pattern`

---

## 2025-11-07: TargetCriteria Refactoring
**Commit**: f5eb17c

**Проблема**: TargetCriteria API неудобен (desired/undesired объекты), не поддерживает гибкую фильтрацию.

**Решение**: Migrated to discriminated union pattern with FieldFilter (mode: include/exclude/any + values[]).

**Результат**: Cleaner API, поддержка singular vs collected fields, validation (no empty arrays).

**Архитектурное решение**: Discriminated unions для type-safe APIs, validation на уровне Zod.

**См. Memory MCP**: `Empty_Array_Validation_Decision`, `TargetCriteria refactoring`

---

## 2025-11-09: DTW Trajectory Similarity Implementation
**Commit**: b6e362a

**Проблема**: Нужны 3 метрики для trajectory matching (Shape, Tempo, Stability).

**Решение**: Implemented using dynamic-time-warping-ts library with StepWithDuration wrapper pattern.

**Результат**: 3 metrics working, 2x performance improvement (280→140 ops/candidate), breaking changes (camelCase, async→sync).

**Архитектурное решение**: Inline calculations для performance, durationCapMonths parametrization.

**См. Memory MCP**: `DTW Trajectory Similarity Implementation`, `StepWithDuration Pattern`, `Inline DTW Calculations Pattern`

---

*Добавляй новую сессию в начало файла (reverse chronological order)*
*Format: 5-10 строк на сессию (Problem → Solution → Result → Key Lesson)*
