# Sessions Brief (Business Context)

## 2025-11-14 (Evening): Facade Scenarios 5-11 + Review Issues ✅

**Commit**: `0a32b89` - docs: complete Facade Scenarios 5-11 + implementation questions

**Проблема**: Завершить Scenarios 5-11 для add_experience workflow (LangGraph с 11 nodes, 4 interrupts, validation cycles). Reviewer нашел 12 issues в architecture doc - исправить P0.

**Решение**:
1. **Scenarios 5-11 Created**: Happy Path (5), Interrupted Session (6), Semantic Errors (7), Schema Errors (8), Normalization Warnings (9), Preview Corrections (10), Cancel Workflow (11). 7 детальных Mermaid sequence diagrams для всех edge cases LangGraph workflow.
2. **Interrupt Pattern Fixed**: Corrected resumeValue logic в Scenarios 5-10 - node **re-executes** после resume (не continues from interrupt point). Critical для LangGraph correctness.
3. **Interrupt Count Fixed**: 3 → 4 potential interrupts (clarify_semantic, clarify_schema, handle_normalization, confirm). Documentation inconsistency caught proactively.
4. **Implementation Questions Doc**: Создан implementation-questions.md (10 вопросов для pre-coding discussion) - отдельно от ADR для operational decisions (Redis pattern, thread ID generation, session TTL extension, max cycles limit).
5. **Feature #17 Planned**: Core-Facade API Contract добавлен в Features Registry как parent feature для #15-16 + DictionariesManager (3 NEW endpoints).
6. **Architecture Review**: review-features-5-7.md создан (12 issues: 4 P0 Critical, 5 P1 Major, 3 P2 Minor) - proactive quality check перед implementation.

**Результат**: Scenarios 5-11 завершены (total: 12 scenarios от 0 до 11). Phase 3 (User Scenarios) **COMPLETE**. Phase 4 (Core API Requirements) ready to start - inventory собран, но core-api-inventory.md и core-facade-api-contract.md **отложены** на отдельную сессию (user deleted drafts).

**Ключевой инсайт**: LangGraph interrupt pattern requires resumeValue check - node re-executes, doesn't continue (critical для state management). Architecture review нашел 4 P0 issues ДО implementation: interrupt pattern bug, interrupt count inconsistency, missing cancel scenario, implementation questions отсутствовали. Proactive quality gates work.

**Lessons learned**:
- Reviewer agent catches architecture bugs early - interrupt pattern correctness validated before implementation phase
- Implementation questions separate from ADR - operational decisions (Redis singleton? TTL extension?) не architectural
- Large scenario (old Scenario 7 was 400+ lines) better split into 4 focused scenarios (7-10) - easier to review/implement
- Cancel workflow needs explicit scenario even if "obvious" - documentation completeness matters

**См. Memory MCP**: `Facade Scenarios 5-11 Complete 2025-11-14`, `LangGraph Interrupt Pattern`, `Implementation Questions Pattern`

---

## 2025-11-14: Facade Architecture - Scenarios 0-4 ✅

**Commit**: `c4095d0` - docs: add Facade architecture (Features #5-7) - Scenarios 0-4

**Проблема**: Спроектировать детальные user scenarios для Features #5-7 (Facade NLP Gateway). Определить API между Facade и Core, выявить missing endpoints.

**Решение**:
1. **Session-based Auth Architecture**: Token только для register/authenticate, session_id в каждом запросе (TTL 1h, Redis). **Single Active Session pattern** - новая auth invalidates старую (защита от session hijacking). Session leak менее критичен чем token leak (max 1h vs permanent).
2. **Scenarios 0-4 Created**: Registration (0), Re-auth (0b), Simple Search (1), get_story (2), set_goal (3), update_context (4). Mermaid sequence diagrams с normalization cache layer (Redis → Neo4j → WebSearch).
3. **Core API Gaps Identified**: Feature #15 (security - client не должен контролировать contextId, нужен tempId → UUID mapping), Feature #16 (missing CRUD endpoints: update_current_context, add_context, add_trail, update_trail, get_trails).
4. **C4 Structure Decision**: Оставить all-in-one document (features-5-7-architecture.md) для Phase 3, decompose в scenarios/ после завершения всех сценариев. Update /plan-feature prompt в конце.

**Результат**: Scenarios 0-4 завершены с детальными Mermaid диаграммами. Phase 4 (Core API Requirements) **BLOCKED** Feature #15-16. Остались Scenarios 5-7 (add_experience - самый сложный LangGraph workflow, + 2 edge cases).

**Ключевой инсайт**: Session-based auth с Single Active Session pattern обеспечивает баланс security/UX - утекший session_id менее критичен чем token (max 1h impact vs permanent), новая auth автоматически kicks out attacker. Architecture planning выявил 2 критичных Core API gaps ДО implementation phase (proactive bug prevention).

**Lessons learned**:
- Business analyst approach works: context → problem → solution structure перед вопросами
- Mermaid sequence diagrams only - no redundant text summaries (избегаем "coverage theater" в docs)
- All-in-one approach для linear planning, decompose после полного context (avoid premature structure)
- Scenarios reveal API gaps early - Feature #15-16 созданы проактивно из architecture analysis, не из bug reports

**См. Memory MCP**: `Session-based Auth Architecture 2025-11-14`, `Single Active Session Pattern`, `Facade Scenarios 0-4`

---

## 2025-11-13 (Evening): LangGraph Q2-Q4 Decisions + Feature #10 ✅

**Commit**: (pending) docs: resolve Q2-Q4 (Redis checkpoints, tool naming, LibreChat integration)

**Проблема**: Критичные вопросы по LangGraph реализации:
- Q2: Где хранить checkpoints (SQLite vs Redis)? Как чистить старые?
- Q3: Финальные имена Facade MCP tools? Связь с Core terminology?
- Q4: Где хранить system prompt для LibreChat? Как передавать в Docker?

**Решение**:
1. **Q2 Resolved**: **Redis вместо SQLite** для checkpoints. TTL 7 дней через `EXPIRE` автоматически. Библиотека `@langchain/langgraph-checkpoint-redis`. Причины: встроенный TTL, быстрее (in-memory), единый Redis для справочников+checkpoints, готовность к distributed setup.
2. **Q3 Resolved**: Финальные имена tools: `search_careers`, `add_experience`, `set_goal`, `get_story(userId)`, `update_context`, `delete_context`. Критерии: понятность LLM, краткость (8-14 chars), согласованность с Core Manager методами, соответствие WayMates терминологии (GLOSSARY.md).
3. **Q4 Resolved**: **Гибридный подход** - LibreChat через `docker-compose.librechat.yml` (опциональный). System prompt в `librechat-config/system-prompt.txt` (версионируется в Git), передаётся через Docker volume mount. Запуск: `docker-compose -f docker-compose.yml -f docker-compose.librechat.yml up`.
4. **Feature #10 Created**: `get_story` расширение (просмотр + редактирование). 3 новых tools: `get_story(userId)` (read any user), `update_context(contextId)` (edit own), `delete_context(contextId)` (delete own with trail reconnection). Priority: P1 Important.

**Результат**: Q2-Q4 fully documented в `implementation.md` Section 2-3, `00_open_questions.md` updated. Feature #10 добавлена в features-registry.md. Открытых критичных вопросов: 0. Готовы к Q5-Q9.

**Ключевой инсайт**: Redis универсальное решение для кешей + checkpoints - единый контейнер, автоматический TTL, готовность к масштабированию. Privacy model "read any, write own" позволяет просматривать чужие stories без сложных tier levels. Opциональный docker-compose.librechat.yml даёт гибкость - Core+Facade работают без LibreChat, но prompt остаётся в нашем репо.

**См. Memory MCP**: `Redis Checkpoints Pattern`, `LibreChat Integration Pattern`, `Feature #10`

---

## 2025-11-13 (Early Morning): Facade Q1 Normalization + Documentation Migration ✅

**Commit**: (pending) docs: migrate Facade docs to architecture/workflows/facade, resolve Q1 normalization

**Проблема**: Q1 - где реализовывать Normalization Layer (user NLP → canonical names)? Нужна ли fuzzy matching библиотека? Плюс старая структура docs/after_mvp/langgraph требует миграции в docs/architecture/.

**Решение**:
1. **Q1 Resolved**: Normalization в Facade с LLM-based подходом (gpt-4o-mini). Без fuzzy matching библиотек - LLM исправляет опечатки, переводит языки ("питон" → "Python"), сопоставляет со справочниками из Neo4j. Strict validation - LLM НЕ ДОДУМЫВАЕТ новые термины.
2. **Redis cache**: Справочники кешируются с TTL 24h. Core MCP tool `get_dictionaries()` возвращает canonical names. Facade → Core MCP only (без прямого доступа к Neo4j).
3. **Documentation Migration**: docs/after_mvp/langgraph/ → docs/architecture/workflows/facade/. Создана структура с разделением business/architecture/implementation. Mermaid блок-схема для нормализации, Structurizr для компонентов.
4. **workspace.dsl updated**: Добавлены компоненты Normalizer, DictionariesCache, FacadeLLM с relationships.

**Результат**: Q1 fully documented (open-questions.md updated), normalization-workflow.md с детальной Mermaid диаграммой создан. Все ссылки обновлены. Готовы к Q2 (SQLite checkpoints).

**Ключевой инсайт**: Structurizr dynamic views не подходят для простых linear flows (нормализация). Используем Mermaid для блок-схем процессов (условия, циклы), Structurizr для компонентов и их взаимодействий. Не нужно дублировать - каждый формат для своей задачи.

**См. Memory MCP**: `Normalization Layer Architecture Pattern`, `Documentation Migration Pattern`

---

## 2025-11-12 (Night): LangGraph Architecture Design ✅

**Commit**: (pending) docs: add LangGraph integration architecture (Features #5, #6, #7)

**Проблема**: Спроектировать архитектуру интеграции LangGraph для data ingestion workflow. Вопрос: нужен ли Facade или клиенты идут в Core напрямую?

**Решение**:
1. **Hybrid Architecture**: Client LLM для простых tool calls (search, get_story, set_goal), LangGraph для complex stateful workflows (add_experience)
2. **Facade как NLP Gateway**: Нормализация ("Москва" → "Moscow"), auth validation (userId из token), LangGraph orchestration
3. **3 документа созданы**: 00_open_questions.md (9 вопросов), 01_business_requirements.md (business case), 02_architecture_design.md (полная архитектура)
4. **3 фичи добавлены**: #5 Facade NLP Gateway, #6 LangGraph Workflow, #7 LibreChat integration

**Результат**: Архитектура задокументирована с 9 open questions для следующей итерации. Features #5-#7 готовы к реализации после Q1-Q7 resolution.

**Ключевой инсайт**: Client LLM (LibreChat, Cursor) может простые операции (tool calling), но НЕ МОЖЕТ гарантировать правильность complex stateful workflows (нет state, нет guaranteed execution order, нет persistence). LangGraph решает это через interrupts + checkpoints + deterministic graph.

**См. Memory MCP**: `LangGraph Architecture Decision 2025-11-12`, `Facade NLP Gateway Pattern`

---

## 2025-11-12 (Evening Late): Cypher Builder Migration Completion ✅

**Commit**: (pending) chore: complete Raw Cypher migration - remove legacy query builders

**Проблема**: Завершить миграцию на Raw Cypher архитектуру - удалить все OLD query builders (17 файлов), убедиться что integration tests проходят.

**Решение**:
1. **Cleanup**: Удалены все legacy query builders (9 файлов), legacy entry points (6 файлов), src/orcestrator/ полностью
2. **Новая архитектура**: src/cypher/queries/{search, goals, paths, persistence}.ts (18/18 queries покрыто 100%)
3. **Миграция managers**: SearchManager, GoalsManager, PathCollector, StoryManager → используют NEW queries
4. **Fix imports**: Обновлены тесты (schemas-zod → shared/schemas, PersistenceManager → StoryManager)
5. **Создан field-snippets.ts**: Минимальная версия для SelectivityService (startPattern only)

**Результат**: 12/12 integration tests passing ✅. ESLint 0 errors. Удалено 3025 строк legacy кода. Миграция завершена на 100%.

**Ключевой инсайт**: Legacy файлы (src/app.ts, src/mcp-server.ts, src/persistence-manager.ts) НЕ использовались в core/facade - можно было удалить сразу. SelectivityService требовал только `startPattern` из FIELD_SNIPPETS (не full implementation).

**Lessons learned**:
- Grep imports ПЕРЕД удалением файлов (избегаем broken imports)
- Разделение legacy (src/) vs active (src/core, src/facade) важно для рефакторинга
- Integration tests как safety net - если проходят после cleanup, миграция успешна

**См. Memory MCP**: `Raw Cypher Migration Complete 2025-11-12`, `Legacy Code Cleanup Pattern`

**Удалено**:
- Query builders (9): search, target, path, persistence, goals (core + orcestrator)
- Legacy entry points (6): app.ts, mcp-server.ts, persistence-manager.ts, schemas-zod.ts, etc
- Directory: src/orcestrator/ (полностью)

**Создано**:
- src/cypher/queries/persistence.ts (CRUD operations)
- src/cypher/queries/paths.ts (trajectory collection)
- src/services/field-snippets.ts (для SelectivityService)

---

## 2025-11-12 (Evening): Bug #4 - searchAdhoc currentContextId Filter Fix ✅

**Commit**: (pending) fix: remove currentContextId filter from buildMatchedContextBase

**Проблема**: AC1-AC6 adhoc integration tests failing (0 results). Root cause discovered after 2h debugging: `buildMatchedContextBase()` filtered by `currentContextId` for ALL search modes → searchAdhoc/searchByTarget couldn't find historical contexts (e.g., U2 Junior when current is Middle).

**Решение**:
1. **Query fix**: Removed `{contextId: matchedUser.currentContextId}` filter from `buildMatchedContextBase()` (src/cypher/queries/search.ts:80)
2. **Setup fix**: Database state check instead of module-level flag (tests/integration/search-manager/setup-read-only.ts) - prevents race condition
3. **Vitest config**: Verified parallel mode works (singleThread: false) - no duplicates after setup fix
4. **Documentation**: Created 2 debugging guides to prevent similar bugs:
   - `docs/search_modes_business_logic.md` - WHAT each search mode does (when to filter by currentContextId)
   - `docs/cypher_debugging_guide.md` - HOW to debug Cypher queries (MCP tools, PROFILE analysis)

**Результат**: 12/12 integration tests passing (AC1-AC6 ✅, UN1-UN4 ✅, DT1-DT5 ✅). Parallel test execution works. ESLint warnings only (no errors). TypeScript errors pre-existing.

**Ключевой инсайт**: 90% of search bugs = wrong currentContextId filter. Must understand business logic FIRST:
- searchByUser → compares **current** states (apples-to-apples)
- searchAdhoc → searches **ALL** contexts (historical + current)
- searchByTarget → searches **ALL** contexts (target can be past position)

**Why debugging took 2h**: Insufficient business context → debugged wrong things (race conditions, Integer conversion, citizenships field) instead of asking "Should adhoc search use currentContextId filter?" first.

**Lessons learned**:
- Read business logic docs BEFORE looking at code (saved 115 minutes)
- Decision tree pattern works: "Should this query filter by currentContextId?" → 5-minute fix
- Documentation prevents repeated mistakes (search_modes_business_logic.md = "udochka" for future debugging)

**См. Memory MCP**: `Bug #4 currentContextId Filter Fix`, `Search Modes Business Logic Decision`

**См. knowledge**: `decisions.md#Search Modes: currentContextId Filter Strategy`, `cypher-mistakes.md#Wrong currentContextId filter`

---

## 2025-11-11 (Evening Session 4): Kaggle Cold Start Analysis ✅

**Commit**: (pending) Cold start: Kaggle dataset analysis and top 500 selection

**Проблема**: Need 300-500 real career trajectories for MVP cold start. Kaggle 54k Resume Dataset available but need quality filtering pipeline.

**Решение**: Built 7-stage analysis pipeline with multi-criteria scoring:
1. Dataset exploration (46k with 3+ jobs, 79% relocations) → sufficient ✅
2. Complete data filter (location + skills + dates + titles) → 26k candidates
3. Education analysis → rejected (63% work-first, poor quality)
4. Entry-level filter (exclude senior-first jobs) → 21k candidates (81% genuine starts)
5. Strict IT filter (≥50% IT roles) → 15k IT trajectories
6. Multi-criteria scoring: Recency(40%) + Progression(25%) + Diversity(35%) → **top 500**

**Результат**: Selected 500 high-quality IT trajectories (kaggle-top-500-mvp.json). Quality metrics: 90% from 2015+, avg 68 skills, clear Junior→Senior growth. Decision on started_working: first job = started_working (entry-level filter ensures semantic correctness, no stub context needed).

**Ключевой инсайт**: Multi-stage filtering crucial for data quality. Entry-level filter eliminated 24% senior-first trajectories but gained semantic correctness for started_working (no need for Core refactoring). Education data not suitable for starter context (chronology issues).

**Lessons learned**:
- Scoring weights matter: recency priority (40%) ensured fresh data (90% from 2015+)
- Strict IT filter (≥50%) balanced purity vs quantity (15k candidates remaining)
- Education as starter context seems logical but data quality breaks it (63% work-first chronology)

**Next**: Phase 2 - Schema Design (SyntheticContextInput) + LLM enrichment for missing fields

**См. Memory MCP**: `Kaggle Cold Start Dataset Strategy`, `started_working Context Handling`

**Output files**: 7 scripts in scripts/, kaggle-top-500-mvp.json (final), kaggle/README.md (pipeline documentation)

---

## 2025-11-12: Bug #2 - DTW Metrics Calculation Fix
**Commit**: `d91e01f` - fix: DTW metrics calculation - 4 issues (Bug #2)

**Проблема**: 4 критических ошибки в trajectory-similarity.service.ts обнаружены при реализации DT1-DT5 integration tests: (1) stabilityScore всегда низкий (0.56 вместо >0.9) из-за DTW warping effect, (2) shapeSimilarity игнорирует domains (Backend vs Frontend показывали 0.89), (3) durationCapMonths не влияет на tempoSimilarity (derivatives от raw durations), (4) U12 test data в неправильном порядке + нет company_changed reasons.

**Решение (4 fix + 3 улучшения)**:
1. stabilityScore формула: `userLength / pathLength` (user trajectory как baseline, не min/max)
2. trajectoryDistance: добавлены domains через новый helper `computeJaccardDistance()` (4 компонента: position + duration + domains + reasons)
3. computeTempoSimilarity: apply `durationCapMonths` **перед** derivatives (capped durations)
4. U12 test data: исправлен хронологический порядок + добавлены `company_changed` reasons
5. Улучшение: `computeJaccardDistance()` helper для переиспользования (domains + reasons)
6. Улучшение: `validatePathLength()` с min check (pathLength >= max(userLen, candidateLen))
7. Улучшение: chronological validation в `calculateDurationMonths()` (throw error if next < current)

**Результат**: DT1-DT5 integration tests passed (4 passed | 1 skipped). ESLint 0 errors. TypeScript clean. Metrics теперь корректно отражают бизнес-логику: stability учитывает user baseline, shape учитывает domain transitions, tempo чувствителен к durationCapMonths.

**Ключевой инсайт**: User trajectory всегда baseline для всех DTW метрик (не min/max обеих траекторий) - это фундаментальная асимметрия алгоритма.

**Lessons learned**:
- Node.js кеширует JSON imports → тесты требуют полный перезапуск после изменения test data (см. package.json scripts)
- Set.forEach() избегает TypeScript --downlevelIteration flag (unicorn правило требует eslint-disable-next-line)
- Helper functions pattern для переиспользования (Jaccard distance в 2+ местах)

**См. Memory MCP**: `Bug #2 DTW Metrics Fix`, `Test Data Import Cache Pattern`

---

## 2025-11-11 (Evening Session 3): Cypher Helpers Architecture
**Commit**: `3dc48d9` - feat(cypher): implement Helper Functions pattern

**Изменения**:
- Создана новая архитектура `src/cypher/` (13 файлов, 1669 строк)
- Структура: `{nodes, patterns, enrichment, helpers, queries}/`
- `enrichContext()` compositor - возвращает `{patterns, withClause, projection}`
- `Cypher.MapProjection` для `.field` syntax (было: `Cypher.Map` manual)
- `scripts/compare-cypher-implementations.ts` - валидация эквивалентности
- Исправлено: MapProjection, DETACH DELETE, два MERGE в setGoalQuery

**Результат**: Helper Functions pattern (Kysely/TypeORM style). Бизнес-код: 60+ строк → 9 строк. Семантически эквивалентно старым queries. **Не мигрировано** - старые builders остаются.

**См. Memory MCP**: `Cypher Helpers Architecture 2025-11-11`

---

## 2025-11-11 (Evening Session 2): AC2 Score Mismatch Bug Fix
**Commits**: (unstaged)

**Проблема**: AC2 test ожидал score=1.0 (perfect match 4/4 strict fields), получал 0.99. Root cause: **2 несовместимые реализации scoring** - TypeScript helper считал по формуле `(matching fields / total fields)`, Cypher query использовал `1.0 - (skill penalties / 100)` с весами из БД.

**Решение (4 изменения)**:
1. **Schema validation** (`src/shared/schemas.ts:206-211`): Запретили 'skills' в `excludedContextFields` через `.refine()` - без skills penalties нет способа ранжировать кандидатов
2. **WHERE clause** (`src/core/search-manager.ts:36-41`): Skills NEVER в WHERE - `computeStrictFields()` всегда фильтрует 'skills', scoring только через penalties
3. **calculateExpectedScore** (`tests/helpers/score-calculator.ts`): Теперь async - запрашивает `penaltyMultiplier` из БД, формула `1.0 - (sum(penalties) / 100)` идентична Cypher
4. **Tests** (AC2, AC6, UN1, UN4): Убрали 'skills' из excluded, добавили `await` для DB queries

**Результат**: 8/8 integration tests passing (AC1-AC6, UN1-UN4). ESLint 0 errors. Архитектурное решение задокументировано в Memory MCP.

**Ключевой инсайт**: Skills требуют penalty-based scoring (градация), не boolean filtering (да/нет) - другая логика от остальных полей.

**См. Memory MCP**: `Skills Scoring Architecture Decision 2025-11-11`, `AC2 Score Mismatch Investigation`

---

## 2025-11-11 (Late Evening): ESLint Type Enforcement
**Commits**: (unstaged)

**Проблема**: ESLint preset `tseslint.configs.stylistic` требовал `interface` вместо `type`, что противоречило code style проекта.

**Решение**: Добавили override `@typescript-eslint/consistent-type-definitions: ['error', 'type']` в eslint.config.mjs. Auto-fixed 7 cases в src/core, src/facade, src/cypher.

**Результат**: 0 errors, 16 warnings (без изменений). ESLint теперь enforces `type` для всех type definitions.

**Урок**: TypeScript preset defaults требуют explicit overrides для project-specific style.

**См. Memory MCP**: `Session 2025-11-11 ESLint Type Config`

---

## 2025-11-11 (Evening): Cypher Builder Migration (Phase 1)
**Status**: Completed Phase 1 - New architecture built
**Документация**: `docs/CYPHER_REFACTORING_PLAN.md`

**Проблема**: 874 строки manual string-based Cypher queries в 5 query builders - не type-safe, DRY нарушен (9 дублирующихся методов createNode), сложная читаемость.

**Решение**:
- Установили `@neo4j/cypher-builder` (type-safe query DSL)
- Создали `src/cypher/factory.ts` (217 строк): универсальный `createNode()` вместо 9 методов, builder pattern с `.withProperties()`, type-safe `ContextRelationshipNodes`
- Реализовали `src/cypher/queries/search.ts`: `userCurrentContextQuery()`, `userCurrentContextIdQuery()`
- Ключевые улучшения: `aggregateNames()` helper, `enrichContextWithRelationships()` с явной типизацией, убрали лишние обертки `datetime()`/`now()`

**Результат**:
- Cypher генерация работает ✅ (семантически идентична старым запросам)
- TypeScript: 0 errors ✅
- ESLint: 0 errors в src/cypher/ ✅
- Код сократился с ~300 строк до 217 (на 27%)
- Читаемость: DRY принцип, явные имена (`currentContext` вместо `mainPattern`)

**На чем остановились**: Phase 1 завершена. Старый код НЕ трогали (side-by-side approach). Следующее: Phase 2 (comparison + benchmark scripts).

**Ключевые решения**:
- Builder pattern для node creation: `createNode(['User']).withProperties({ userId: 'u1' })`
- `relationship` вместо `relType` (более явное)
- Убрали `as unknown` (dirty casts) через явное создание объекта с `getRequiredNode()`
- `prettier-ignore` для конфигурационных массивов

**См. Memory MCP**: `Cypher Builder Architecture`, `Factory Pattern for Query Building`

---

## 2025-11-11: Test Quality Refactoring (AC1-AC11, UN1-UN5)
**Commits**: (unstaged changes)

**Проблема**: 25-40% test assertions проверяли "coverage theater" (очевидные инварианты), нет валидации бизнес-логики (score calculations), missing edge cases.

**Решение**:
- Создали `tests/helpers/score-calculator.ts` для расчета expected score
- Удалили coverage theater (`toBeInstanceOf(Array)`, schema validations)
- Добавили AC7-AC11 edge cases (empty results, undefined handling, boundary values)
- Добавили UN2-UN5 edge cases (fallback logic, empty results)

**Результат**: 15/30 tests passing (50%), business logic validation через calculateExpectedScore.

**⚠️ Обнаружена проблема**: AC2 score mismatch - Cypher query даёт 0.99, helper возвращает 1.0 для идентичных strict fields. Workaround: tolerance=1 decimal (0.05).

**Ключевой урок**: Integration tests должны валидировать бизнес-правила (score calculations), не схему. Score mismatch указывает на potential discrepancy между TypeScript helper и Cypher scoring algorithm.

**См. Memory MCP**: `Test Quality Refactoring Session`, `AC2 Score Mismatch Investigation`

---

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
