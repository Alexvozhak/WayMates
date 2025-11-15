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
| FEAT-003 | 2025-11-12 | PENDING | Import Kaggle synthetic dataset (297 candidates) | 🔴 P0 | Admin CLI | [tasks/features/FEAT-003-kaggle-import.md](../../tasks/features/FEAT-003-kaggle-import.md) | session-2025-11-12 |
| FEAT-005 | 2025-11-12 | PENDING | Facade NLP Gateway (simple tools + infrastructure) | 🔴 P0 | Facade MCP | [tasks/features/FEAT-005-facade-gateway.md](../../tasks/features/FEAT-005-facade-gateway.md) | session-2025-11-12 |
| FEAT-006 | 2025-11-12 | PENDING | LangGraph Data Ingestion Workflow | 🔴 P0 | Facade workflows | [tasks/features/FEAT-006-langgraph-workflow.md](../../tasks/features/FEAT-006-langgraph-workflow.md) | session-2025-11-12 |
| FEAT-007 | 2025-11-12 | PENDING | LibreChat integration (system prompts, config) | 🔴 P0 | Client integration | [tasks/features/FEAT-007-librechat-integration.md](../../tasks/features/FEAT-007-librechat-integration.md) | session-2025-11-12 |
| FEAT-008 | 2025-11-12 | PENDING | Goals Integration tests quality improvements (QA report) | 🟡 P1 | Integration tests | [tasks/features/FEAT-008-goals-test-quality.md](../../tasks/features/FEAT-008-goals-test-quality.md) | session-2025-11-12 |
| FEAT-010 | 2025-11-13 | PENDING | get_story extension (view + edit career history) | 🟡 P1 | Facade MCP, Core | [tasks/features/FEAT-010-story-crud.md](../../tasks/features/FEAT-010-story-crud.md) | session-2025-11-13 |
| FEAT-011 | 2025-11-13 | PENDING | Admin Dictionary Moderation (three-tier verification) | 🟡 P1 | Admin CLI, Core | [tasks/features/FEAT-011-dict-moderation.md](../../tasks/features/FEAT-011-dict-moderation.md) | session-2025-11-13 |
| FEAT-012 | 2025-11-13 | PENDING | Telegram Bot Service (Node.js + Telegraf) | 🟢 P2 | Client integration | [tasks/features/FEAT-012-telegram-bot.md](../../tasks/features/FEAT-012-telegram-bot.md) | session-2025-11-13 |
| FEAT-013 | 2025-11-13 | PENDING | Resume Upload Entry Point (PDF parser + conversational flow) | 🟢 P2 | Facade workflows | [tasks/features/FEAT-013-resume-upload.md](../../tasks/features/FEAT-013-resume-upload.md) | session-2025-11-13 |
| FEAT-014 | 2025-11-13 | PENDING | Add test for extreme duration outliers (120+ months) | 🟡 P1 | Integration tests | [tasks/features/FEAT-014-duration-outliers-test.md](../../tasks/features/FEAT-014-duration-outliers-test.md) | session-2025-11-13 |
| FEAT-015 | 2025-11-14 | PENDING | Refactor import_story: tempId mapping + Neo4j UUID generation | 🔴 P0 | Core Manager, Schema | [tasks/features/FEAT-015-tempid-mapping.md](../../tasks/features/FEAT-015-tempid-mapping.md) | session-2025-11-14 |
| FEAT-016 | 2025-11-14 | PENDING | Add CRUD endpoints for Context/Trail management | 🔴 P0 | Core Manager, Core MCP | [tasks/features/FEAT-016-crud-endpoints.md](../../tasks/features/FEAT-016-crud-endpoints.md) | session-2025-11-14 |
| FEAT-017 | 2025-11-14 | PENDING | Core-Facade API Contract (DictionariesManager + FEAT-015,016) | 🔴 P0 | Core API, Facade MCP | [tasks/features/FEAT-017-api-contract.md](../../tasks/features/FEAT-017-api-contract.md) | session-2025-11-14 |
| FEAT-018 | 2025-11-15 | READY_FOR_WORK | Add languages B2+ support to Context | 🟡 P1 | Schema + Search + Persistence | [tasks/features/FEAT-018.md](../../tasks/features/FEAT-018.md) | session-2025-11-15 |

---

## Completed Features

| ID | Date | Status | Title | Priority | Component | Completed | Commit |
|----|------|--------|-------|----------|-----------|-----------|--------|
| FEAT-001 | 2025-11-12 | DONE | Add salary range (min/max) to Context | 🔴 P0 | Context schema | 2025-11-15 | f0976a5 | [FEAT-001-salary-fields.md](../../tasks/features/FEAT-001-salary-fields.md) |
| FEAT-002 | 2025-11-12 | DONE | Add education level enum to Context | 🔴 P0 | Context schema | 2025-11-15 | ec4073a | [FEAT-002-education-level.md](../../tasks/features/FEAT-002-education-level.md) |
| FEAT-004 | 2025-11-12 | DONE | Improve integration test quality (MEDIUM priority enhancements) | 🟡 P1 | Integration tests | 2025-11-12 | [commit] |
| FEAT-009 | 2025-11-13 | DONE | Document test expectations (QA report follow-up) | 🟡 P1 | Integration tests | 2025-11-13 | [commit] |

---

## Archive Notes

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
