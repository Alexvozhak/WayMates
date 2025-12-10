# Features Registry

**Purpose**: Track feature requests and new functionality from initial request to completion.

**Workflow**:
1. Use `/request-feature` to add new feature → status: PENDING
2. Use `/plan-feature` to design Type Schema and plan → status: READY_FOR_WORK
3. Use `/implement-feature` to implement → status: DONE
4. Use `/sync-memory` to archive completed features

---

## Active Features

| ID | Date | Status | Title | Priority | Component | File | Session |
|----|------|--------|-------|----------|-----------|------|---------|
| FEAT-000 | 2025-11-15 | DONE | Подготовка структуры тестов для Facade | 🔴 P0 | Test infrastructure | [tasks/features/FEAT-000-test-structure.md](../../tasks/features/FEAT-000-test-structure.md) | session-2025-12-09 |
| FEAT-003 | 2025-11-12 | PENDING | Import Kaggle synthetic dataset (297 candidates) | 🔴 P0 | Admin CLI | [tasks/features/FEAT-003-kaggle-import.md](../../tasks/features/FEAT-003-kaggle-import.md) | session-2025-11-12 |
| FEAT-005 | 2025-11-12 | DONE | Facade NLP Gateway (simple tools + infrastructure) | 🔴 P0 | Facade MCP | [tasks/features/FEAT-005-facade-gateway.md](../../tasks/features/FEAT-005-facade-gateway.md) | session-2025-12-09 |
| FEAT-006 | 2025-11-12 | DONE | LangGraph Data Ingestion Workflow | 🔴 P0 | Facade workflows | [tasks/features/FEAT-006-langgraph-workflow.md](../../tasks/features/FEAT-006-langgraph-workflow.md) | session-2025-12-09 |
| FEAT-007 | 2025-11-12 | PENDING | LibreChat integration (system prompts, config) | 🔴 P0 | Client integration | [tasks/features/FEAT-007-librechat-integration.md](../../tasks/features/FEAT-007-librechat-integration.md) | session-2025-11-12 |
| FEAT-008 | 2025-11-12 | PENDING | Goals Integration tests quality improvements (QA report) | 🟡 P1 | Integration tests | [tasks/features/FEAT-008-goals-test-quality.md](../../tasks/features/FEAT-008-goals-test-quality.md) | session-2025-11-12 |
| FEAT-010 | 2025-11-13 | PENDING | get_story extension (view + edit career history) | 🟡 P1 | Facade MCP, Core | [tasks/features/FEAT-010-story-crud.md](../../tasks/features/FEAT-010-story-crud.md) | session-2025-11-13 |
| FEAT-011 | 2025-11-13 | PENDING | Admin Dictionary Moderation (three-tier verification) | 🟡 P1 | Admin CLI, Core | [tasks/features/FEAT-011-dict-moderation.md](../../tasks/features/FEAT-011-dict-moderation.md) | session-2025-11-13 |
| FEAT-012 | 2025-11-13 | PENDING | Telegram Bot Service (Node.js + Telegraf) | 🟢 P2 | Client integration | [tasks/features/FEAT-012-telegram-bot.md](../../tasks/features/FEAT-012-telegram-bot.md) | session-2025-11-13 |
| FEAT-013 | 2025-11-13 | PENDING | Resume Upload Entry Point (PDF parser + conversational flow) | 🟢 P2 | Facade workflows | [tasks/features/FEAT-013-resume-upload.md](../../tasks/features/FEAT-013-resume-upload.md) | session-2025-11-13 |
| FEAT-014 | 2025-11-13 | PENDING | Add test for extreme duration outliers (120+ months) | 🟡 P1 | Integration tests | [tasks/features/FEAT-014-duration-outliers-test.md](../../tasks/features/FEAT-014-duration-outliers-test.md) | session-2025-11-13 |
| FEAT-015 | 2025-11-14 | CANCELLED | Refactor import_story: tempId mapping + Neo4j UUID generation | 🔴 P0 | Core Manager, Schema | [tasks/features/FEAT-015-tempid-mapping.md](../../tasks/features/FEAT-015-tempid-mapping.md) | session-2025-12-09 |
| FEAT-016 | 2025-11-14 | DONE | Add CRUD endpoints for Context/Trail management | 🔴 P0 | Core Manager, Core MCP | [tasks/features/FEAT-016-crud-endpoints.md](../../tasks/features/FEAT-016-crud-endpoints.md) | session-2025-12-09 |
| FEAT-017 | 2025-11-14 | PENDING | Core-Facade API Contract (DictionariesManager + FEAT-015,016) | 🔴 P0 | Core API, Facade MCP | [tasks/features/FEAT-017-api-contract.md](../../tasks/features/FEAT-017-api-contract.md) | session-2025-11-14 |
| FEAT-019 | 2025-11-15 | DONE | Facade Architecture Refactoring (orchestrator → separate tools) | 🔴 P0 | Facade MCP | [tasks/features/FEAT-019-facade-refactoring.md](../../tasks/features/FEAT-019-facade-refactoring.md) | session-2025-12-09 |
| FEAT-020 | 2025-11-15 | DONE | Session Management (Auth + Redis) | 🔴 P0 | Facade Auth | [tasks/features/FEAT-020-session-management.md](../../tasks/features/FEAT-020-session-management.md) | session-2025-12-02 |
| FEAT-021 | 2025-11-15 | DONE | MCP Tool: get_story | 🔴 P0 | Facade MCP | [tasks/features/FEAT-021-get-story-tool.md](../../tasks/features/FEAT-021-get-story-tool.md) | session-2025-12-09 |
| FEAT-022 | 2025-11-15 | DONE | MCP Tool: search_careers | 🔴 P0 | Facade MCP | [tasks/features/FEAT-022-search-careers-tool.md](../../tasks/features/FEAT-022-search-careers-tool.md) | session-2025-12-09 |
| FEAT-023 | 2025-11-15 | DONE | MCP Tool: set_goal | 🔴 P0 | Facade MCP | [tasks/features/FEAT-023-set-goal-tool.md](../../tasks/features/FEAT-023-set-goal-tool.md) | session-2025-12-09 |
| FEAT-024 | 2025-11-15 | DONE | MCP Tool: update_context | 🟡 P1 | Facade MCP | [tasks/features/FEAT-024-update-context-tool.md](../../tasks/features/FEAT-024-update-context-tool.md) | session-2025-12-09 |
| FEAT-025 | 2025-11-15 | PENDING | DictionariesManager Core (get/add/find) | 🔴 P0 | Core Manager | [tasks/features/FEAT-025-dictionaries-core.md](../../tasks/features/FEAT-025-dictionaries-core.md) | session-2025-11-15 |
| FEAT-026 | 2025-11-15 | PENDING | DictionariesManager Moderation (admin endpoints) | 🟡 P1 | Core Manager | [tasks/features/FEAT-026-dictionaries-moderation.md](../../tasks/features/FEAT-026-dictionaries-moderation.md) | session-2025-11-15 |

---

## Completed Features

| ID | Date | Status | Title | Priority | Component | Completed | Commit |
|----|------|--------|-------|----------|-----------|-----------|--------|
| FEAT-001 | 2025-11-12 | DONE | Add salary range (min/max) to Context | 🔴 P0 | Context schema | 2025-11-15 | f0976a5 | [FEAT-001-salary-fields.md](../../tasks/features/FEAT-001-salary-fields.md) |
| FEAT-002 | 2025-11-12 | DONE | Add education level enum to Context | 🔴 P0 | Context schema | 2025-11-15 | ec4073a | [FEAT-002-education-level.md](../../tasks/features/FEAT-002-education-level.md) |
| FEAT-004 | 2025-11-12 | DONE | Improve integration test quality (MEDIUM priority enhancements) | 🟡 P1 | Integration tests | 2025-11-12 | [commit] |
| FEAT-009 | 2025-11-13 | DONE | Document test expectations (QA report follow-up) | 🟡 P1 | Integration tests | 2025-11-13 | [commit] |
| FEAT-000 | 2025-11-15 | DONE | Подготовка структуры тестов для Facade | 🔴 P0 | Test infrastructure | 2025-12-09 | - | [FEAT-000-test-structure.md](../../tasks/features/FEAT-000-test-structure.md) |
| FEAT-005 | 2025-11-12 | DONE | Facade NLP Gateway (simple tools + infrastructure) | 🔴 P0 | Facade MCP | 2025-12-09 | f03e997 | [FEAT-005-facade-gateway.md](../../tasks/features/FEAT-005-facade-gateway.md) |
| FEAT-006 | 2025-11-12 | DONE | LangGraph Data Ingestion Workflow | 🔴 P0 | Facade workflows | 2025-12-09 | f03e997 | [FEAT-006-langgraph-workflow.md](../../tasks/features/FEAT-006-langgraph-workflow.md) |
| FEAT-016 | 2025-11-14 | DONE | Add CRUD endpoints for Context/Trail management | 🔴 P0 | Core Manager, Core MCP | 2025-12-09 | f03e997 | [FEAT-016-crud-endpoints.md](../../tasks/features/FEAT-016-crud-endpoints.md) |
| FEAT-018 | 2025-11-15 | DONE | Add languages B2+ support to Context | 🟡 P1 | Schema + Search + Persistence | 2025-11-15 | 7effe23 | [FEAT-018.md](../../tasks/features/FEAT-018.md) |
| FEAT-019 | 2025-11-15 | DONE | Facade Architecture Refactoring (orchestrator → separate tools) | 🔴 P0 | Facade MCP | 2025-12-09 | f03e997 | [FEAT-019-facade-refactoring.md](../../tasks/features/FEAT-019-facade-refactoring.md) |
| FEAT-021 | 2025-11-15 | DONE | MCP Tool: get_story | 🔴 P0 | Facade MCP | 2025-12-09 | f03e997 | [FEAT-021-get-story-tool.md](../../tasks/features/FEAT-021-get-story-tool.md) |
| FEAT-022 | 2025-11-15 | DONE | MCP Tool: search_careers | 🔴 P0 | Facade MCP | 2025-12-09 | f03e997 | [FEAT-022-search-careers-tool.md](../../tasks/features/FEAT-022-search-careers-tool.md) |
| FEAT-023 | 2025-11-15 | DONE | MCP Tool: set_goal | 🔴 P0 | Facade MCP | 2025-12-09 | f03e997 | [FEAT-023-set-goal-tool.md](../../tasks/features/FEAT-023-set-goal-tool.md) |
| FEAT-024 | 2025-11-15 | DONE | MCP Tool: update_context | 🟡 P1 | Facade MCP | 2025-12-09 | f03e997 | [FEAT-024-update-context-tool.md](../../tasks/features/FEAT-024-update-context-tool.md) |

---

## Archive Notes

### FEAT-018: Add languages B2+ support to Context
- Added `languages` field (ISO 639-1 codes, nullable/optional array)
- Created Language dictionary (17 languages), SPEAKS_FLUENT relationships
- Adhoc/current search: strict/excluded/null modes (AND logic)
- Target search: desired (OR logic) / undesired (NONE logic)
- 7 integration tests (SC1-7, TG-LANG-1/2)
- **Critical bug fixed**: WITH clause variable propagation in persistence.ts
- **Lesson**: Always propagate variables through WITH chains explicitly

### FEAT-001: Add salary range to Context
- Added `salaryExact`, `salaryMin`, `salaryMax` with mutual exclusion validation
- Created `userContextSchemaBase` export for schema operations
- Updated persistence (SET salary), map projection (return salary fields)
- Test data: U17 (exact), U18 (range), AC10-AC12 tests
- **Scope**: DISPLAY ONLY (no filtering/scoring) - LLM in Facade analyzes

### FEAT-002: Add education level enum to Context
- Added 7-level enum: NONE → PROFESSIONAL
- Null wildcard behavior: missing education matches all levels
- Test coverage: AC7 (strict), AC8 (excluded), AC9 (null wildcard)
- Refactored `getContextFieldValue()` to Record mapping (complexity fix)
- **Lesson**: Don't forget map projection when adding Context fields!

### FEAT-004: Improve integration test quality
- Replaced weak assertions (`.toBeGreaterThan(0)` → `.toBeGreaterThanOrEqual(2)`)
- Added score breakdown validation (skill penalties, DTW formulas)
- Added path structure validation helper (`validatePathStructure()`)
- All 28 integration tests pass (1 skipped)

### FEAT-009: Document test expectations
- Documented hardcoded thresholds (AC3, AC4, UN4) with business rules
- Documented DTW formula thresholds (DT1, DT4) with component breakdown
- Replaced score-calculator.ts with hardcoded canary (0.99 for svelte penalty)
- Fixed DRY violation in TG1-TG7 (using `validateAllPaths()` helper)
- **QA Verdict**: 92% business value (target: 90%+)

*Use `/request-feature` to add new features to this registry*
