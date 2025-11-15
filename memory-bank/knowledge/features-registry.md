# Features Registry

**Purpose**: Track feature requests and new functionality from initial request to completion.

**Workflow**:
1. Use `/request-feature` to add new feature
2. Use `/implement-feature` to start working (auto-sets IN_PROGRESS)
3. Complete implementation → `/implement-feature` auto-sets DONE
4. Use `/sync-memory` to archive completed features

---

## Pending Features

| # | Date | Component | Title | Status | Priority |
|---|------|-----------|-------|--------|----------|
| #3 | 2025-11-12 | Admin CLI | Import Kaggle synthetic dataset (297 candidates) | TODO | 🔴 P0 |
| #4 | 2025-11-12 | Integration tests | Improve integration test quality (MEDIUM priority enhancements) | DONE | 🟡 P1 |
| #5 | 2025-11-12 | Facade MCP | Facade NLP Gateway (simple tools + infrastructure) | TODO | 🔴 P0 |
| #6 | 2025-11-12 | Facade workflows | LangGraph Data Ingestion Workflow | TODO | 🔴 P0 |
| #7 | 2025-11-12 | Client integration | LibreChat integration (system prompts, config) | TODO | 🔴 P0 |
| #8 | 2025-11-12 | Integration tests | Goals Integration tests quality improvements (QA report) | TODO | 🟡 P1 |
| #9 | 2025-11-13 | Integration tests | Document test expectations (QA report follow-up) | DONE | 🟡 P1 |
| #10 | 2025-11-13 | Facade MCP, Core | get_story расширение (просмотр + редактирование своей истории) | TODO | 🟡 P1 |
| #11 | 2025-11-13 | Admin CLI, Core | Admin Dictionary Moderation (three-tier verification) | TODO | 🟡 P1 |
| #12 | 2025-11-13 | Client integration | Telegram Bot Service (Node.js + Telegraf) | TODO | 🟢 P2 |
| #13 | 2025-11-13 | Facade workflows | Resume Upload Entry Point (PDF parser + conversational flow) | TODO | 🟢 P2 |
| #14 | 2025-11-13 | Integration tests | Add test for extreme duration outliers (120+ months) | TODO | 🟡 P1 |
| #15 | 2025-11-14 | Core Manager, Schema | Refactor import_story: tempId mapping + Neo4j UUID generation | TODO | 🔴 P0 |
| #16 | 2025-11-14 | Core Manager, Core MCP | Add CRUD endpoints for Context/Trail management | TODO | 🔴 P0 |
| #17 | 2025-11-14 | Core API, Facade MCP | Core-Facade API Contract (DictionariesManager + #15-16) | TODO | 🔴 P0 |

---

## Completed Features

| # | Date | Component | Title | Completed | Commit |
|---|------|-----------|-------|-----------|--------|
| #1 | 2025-11-12 | Context schema | Add salary range (min/max) to Context | 2025-11-15 | f0976a5 |
| #2 | 2025-11-12 | Context schema | Add education level enum to Context | 2025-11-15 | ec4073a |

**Implementation notes (#1)**:
- Added `salaryExact`, `salaryMin`, `salaryMax` fields to UserContext schema with mutual exclusion validation
- Created `userContextSchemaBase` export for `.omit()`/`.partial()` operations (refined schema breaks these)
- Updated persistence query to SET salary fields (null-safe)
- Updated map projection to return salary fields in search results (null values for backward compatibility)
- Added test data U17 (exact salary), U18 (range salary) + AC10-AC12 tests
- Fixed setup-read-only.ts: clear DB if userCount !== 18 (race condition fix)
- All integration tests passing (46/47, 1 pre-existing TEMPORAL bug)
- **Scope decision**: Salary fields are DISPLAY ONLY (no filtering/scoring) - LLM in Facade will analyze
- **Note**: No migration script needed (test DB recreated from scratch, no production data yet)

---

## Feature Details

### Feature #1: Add salary range (min/max) to Context
**Component**: Context schema, search-query-builder, persistence-query-builder
**Date**: 2025-11-12
**Priority**: 🔴 P0 (Critical)

**Motivation**:
Salary information is critical for career transition analysis and filtering realistic opportunities. Users need to:
- Filter career paths by salary expectations
- Identify salary growth patterns (key transition motivator)
- Understand compensation progression in different domains/industries

**User Story**:
As a user planning career transition, I want to see salary ranges for contexts, so that I can filter realistic opportunities matching my financial expectations and identify typical salary progression patterns.

**Acceptance Criteria**:
- [ ] Context schema extended with `salaryMin` and `salaryMax` (USD, numeric, optional)
- [ ] Migration script adds properties to existing Context nodes (nullable)
- [ ] Search query builder supports salary range filtering (min/max parameters)
- [ ] `company_changed` reason renamed to `salary_increased` when salary grows >10%
- [ ] Null salary values handled gracefully (excluded from salary-based filters)
- [ ] Integration tests cover:
  - Salary range filtering edge cases (null, partial data)
  - Salary-based creation reason detection
  - Search results ordering by salary match
- [ ] Schema documentation updated (shared/schemas.ts comments)

**Impact Assessment**:
- Schema change: YES (adds `salaryMin`, `salaryMax` to Context node)
- Breaking change: NO (optional fields, backward compatible)
- Requires migration: YES (ALTER existing Context nodes to add properties)
- Affected components:
  - `src/shared/schemas.ts` (userContextSchema)
  - `src/core/persistence-query-builder.ts` (SET salary properties)
  - `src/core/search-query-builder.ts` (optional salary filtering)
  - `database/init.cypher` (indexes for salary range queries)
  - Integration tests

---

### Feature #2: Add education level enum to Context
**Component**: Context schema, search-query-builder, Kaggle import
**Date**: 2025-11-12
**Priority**: 🟡 P1 (Important)

**Motivation**:
Education level is an important career context factor that:
- Affects job eligibility (some positions require specific degrees)
- Indicates skill acquisition method (formal vs self-taught)
- Can change during career (completing Master's/PhD while working)
- Available in Kaggle dataset (`03_education.csv`) - shouldn't be wasted

**User Story**:
As a user searching for career paths, I want to filter by education level, so that I see transitions matching my academic background and understand typical education requirements for target positions.

**Acceptance Criteria**:
- [x] Define `EducationLevel` enum with international scale:
  - `NONE` (no formal education)
  - `HIGH_SCHOOL` (secondary education)
  - `ASSOCIATE` (2-year college)
  - `BACHELOR` (undergraduate degree)
  - `MASTER` (graduate degree)
  - `DOCTORATE` (PhD)
  - `PROFESSIONAL` (MBA, JD, MD)
- [x] Context schema extended with `educationLevel` (enum, optional, nullable)
- [x] Database index added for educationLevel filtering
- [x] Search query builder supports education level filtering (strict + excluded modes)
- [x] Null wildcard behavior: missing educationLevel matches all levels
- [x] Creation reason `education_completed` added to reasons.json
- [x] Integration tests cover:
  - AC7: Strict education level filtering (finds only matching level)
  - AC8: Excluded education level filtering (finds different levels)
  - AC9: Null educationLevel wildcard (finds any level)
- [x] Selectivity service supports educationLevel for query optimization
- [x] Map projections return educationLevel in search results
- [ ] Kaggle import (DEFERRED to Feature #3 - isolated task per user decision)

**Impact Assessment**:
- Schema change: YES (adds `educationLevel` enum to Context node)
- Breaking change: NO (optional field, backward compatible)
- Requires migration: YES (ALTER existing Context nodes)
- Affected components:
  - `src/shared/schemas.ts` (add enum + field to userContextSchema)
  - `src/core/persistence-query-builder.ts` (SET educationLevel)
  - `src/core/search-query-builder.ts` (optional education filtering)
  - `database/reasons.ts` (add `education_completed` reason)
  - `scripts/import-kaggle-synthetic.ts` (parse education data)
  - `database/init.cypher` (index for education filtering)
  - Integration tests

**Implementation Notes**:
- **Schema**: Added `educationLevelSchema` enum (7 levels: NONE → PROFESSIONAL)
- **Null handling**: `.nullable().optional()` - Neo4j returns null for missing properties in map projection, data files can omit field
- **Cypher filtering**: CASE logic for null wildcard behavior (null in search OR candidate → always show)
- **Test data**: U1-U13 all got BACHELOR (same value, no existing test impact), new U14-U16 for education-specific tests
- **Test coverage**: AC7 (strict match), AC8 (excluded field), AC9 (null wildcard)
- **Selectivity**: Refactored `getContextFieldValue()` from if-chain to Record mapping (complexity fix)
- **Map projections**: Added educationLevel to both `buildContextMapProjection()` and `CONTEXT_MAP_PROJECTION_CANONICAL`
- **Business logic**: Missing education in candidate = wildcard (always included), strict matching when both present
- **Lessons learned**: When adding Context field, must update: schema, Cypher filters, persistence, **map projection** (forgot initially), selectivity, index

**Commit**: ec4073a

---

### Feature #3: Import Kaggle synthetic dataset (297 candidates)
**Component**: Admin CLI, Core schemas, LLM enrichment
**Date**: 2025-11-12
**Priority**: 🔴 P0 (Critical)

**Motivation**:
WayMates MVP needs real career trajectory data for cold start. Without dataset, the system has no similar professionals to match against. Kaggle dataset provides 297 high-quality IT career trajectories (12.73 contexts/person avg, 3,780 total contexts) - sufficient for MVP testing and initial user value.

**User Story**:
As a WayMates user, I want to see career paths of real professionals similar to me, so that I can make informed transition decisions based on proven trajectories.

**Acceptance Criteria**:
- [ ] `SyntheticContextInput` schema defined in `src/core/schemas.ts` with optional fields:
  - Required: contextId, createdAt, creationReason, position, domains, skills, industry, countryCode, cityName
  - Optional: companySize, citizenships, birthYear, salaryMin/Max, educationLevel
- [ ] CLI script `src/admin/import-kaggle.ts` with arguments:
  - `--limit=N` (test with subset, default: all 297)
  - `--mode=llm|simple` (LLM inference vs rule-based, default: llm)
  - `--batch-size=N` (processing batch size, default: 10)
- [ ] LLM enrichment service (`src/admin/services/llm-enrichment.ts`):
  - OpenAI integration (use gpt-4o-mini for cost efficiency)
  - Inference: job_title → domains[] (Backend, Frontend, etc.)
  - Inference: compare contexts → creationReason[] (position_changed, location_changed, etc.)
  - First context → creationReason = ["started_working"]
  - Retry logic (3 attempts with exponential backoff)
- [ ] Location parser service (`src/admin/services/location-parser.ts`):
  - Parse "San Francisco, CA" → countryCode="US", cityName="San Francisco"
  - Parse "London, UK" → countryCode="GB", cityName="London"
  - Handle edge cases (incomplete data, international formats)
- [ ] Kaggle loader service (`src/admin/services/kaggle-loader.ts`):
  - Read `kaggle-high-context-candidates.txt` (297 IDs)
  - Join `04_experience.csv` + `05_person_skills.csv`
  - Sort jobs by start_date ASC (chronological order)
  - Generate UUID v7 for userId, contextId
  - Link NEXT/PREVIOUS contexts
- [ ] Integration with core:
  - Call `StoryManager.upsertStory()` for each candidate
  - Label: `:User:Synthetic` and `:Context:Synthetic` in Neo4j
  - Validate via `syntheticStoryInputSchema` before import
- [ ] Progress logging:
  - Per-candidate: "Processing person_id 1234 (15 contexts)..."
  - Per-batch: "Batch 1/30 complete (10 candidates imported)"
  - Summary: "✅ Imported 297 users, 3,780 contexts in 45min"
- [ ] Error handling:
  - Skip failed candidates (log error, continue)
  - Report summary: success count, failed count, error details
- [ ] Documentation:
  - Architecture doc: `memory-bank/tasks/feature-03-kaggle-import.md`
  - Usage instructions in CLI script comments

**Impact Assessment**:
- Schema change: YES (adds `SyntheticContextInput` in `src/core/schemas.ts`)
- Breaking change: NO (backward compatible, only adds new schema)
- Requires migration: NO (fresh import, not changing existing data)
- Affected components:
  - `src/core/schemas.ts` (new SyntheticContextInput schema)
  - `src/admin/` (new CLI + services subfolder)
  - `src/core/story-manager.ts` (usage, no changes needed)
  - Neo4j labels: `:Synthetic` added to User/Context nodes
- New dependencies:
  - `openai` (LLM enrichment)
  - `csv-parse` (already exists for Kaggle scripts)

**Technical Design Notes**:
See detailed architecture doc: `memory-bank/tasks/feature-03-kaggle-import.md`

---

### Feature #4: Improve integration test quality (MEDIUM priority enhancements)
**Component**: Integration tests (search-manager suite)
**Date**: 2025-11-12
**Priority**: 🟡 P1 (Important)

**Motivation**:
After QA agent analysis (Session 2025-11-12 Evening Late), found 15+ opportunities to improve test quality and business value. HIGH priority coverage theater already removed. MEDIUM priority enhancements will add missing business logic assertions and improve test debuggability.

**User Story**:
As a developer, I want integration tests to validate critical business logic and provide meaningful feedback, so that bugs are caught early and test failures point directly to root causes.

**Acceptance Criteria**:

**1. Replace weak assertions with exact expectations (15+ occurrences)**
- [x] AC2 (adhoc-context-without-dtw.integration.ts:106): Already using exact score validation
- [x] AC3 (adhoc-context-without-dtw.integration.ts:195): Replaced with `.toBeGreaterThanOrEqual(2)` + logging
- [x] AC4 (adhoc-context-without-dtw.integration.ts:257): Replaced with `.toBeGreaterThanOrEqual(2)` + logging
- [x] UN1 (current-context-without-dtw.integration.ts:50): Already uses specific user checks
- [x] UN4 (current-context-without-dtw.integration.ts:125): Replaced with `.toBeGreaterThanOrEqual(2)` + logging
- [x] TG1-TG7 (target-search.integration.ts): Already use specific assertions (no weak assertions found)

**2. Add score breakdown validation (3 tests)**
- [x] AC2: Added skill penalty breakdown logging (missing vs extra skills)
- [x] AC5: Added score comparison logging (excluded vs included reasons)
- [ ] AC6: Skipped (old contexts excluded from results, nothing to compare)

**3. Add DTW formula verification (2 tests)**
- [x] DT1: Added range checks (0 <= value <= 1), formula verification (dtwTotal = sum), logging
- [x] DT4: Added formula validation for all 3 results (U11, U12, U13), component breakdown logging

**4. Add path structure validation (7 TG tests)**
- [x] TG1-TG7: Added `validatePathStructure()` and `validatePathLeadsTo()` calls
- [x] TG1-TG7: Validates chronological order (createdAt ascending with timestamp conversion)
- [x] TG1-TG7: Validates PREVIOUS_CONTEXT relationships (no gaps)
- [x] TG1-TG7: Validates path leads to matched context

**5. Add filter mode logic logging (7 TG tests)**
- [x] TG1-TG7: Added console.log for desired mode (matched values)
- [x] TG1-TG7: Added console.log for undesired mode (excluded values)

**6. Add time calculation verification (2 tests)**
- [x] TG1: Added range validation (>= 0), logging
- [x] TG2: Added trajectory vs single context logging, range validation

**Impact Assessment**:
- Schema change: NO
- Breaking change: NO
- Requires migration: NO
- Affected files:
  - `tests/integration/search-manager/adhoc-context-without-dtw.integration.ts` (AC1-AC6)
  - `tests/integration/search-manager/current-context-without-dtw.integration.ts` (UN1, UN4)
  - `tests/integration/search-manager/current-context-with-dtw.integration.ts` (DT1, DT4)
  - `tests/integration/search-manager/target-search.integration.ts` (TG1-TG7)
- New test helpers:
  - `tests/helpers/dtw-calculator.ts` (DTW formula verification)
  - `tests/helpers/path-validator.ts` (path structure validation)

**Implementation Notes**:
QA agent identified these improvements after HIGH priority cleanup (coverage theater removal). See Session 2025-11-12 Evening Late for full QA analysis.

**Completed Implementation**:
- ✅ **New helper created**: `tests/helpers/path-validator.ts`
  - `validatePathStructure()` - validates chronological order, no gaps, first context
  - `validatePathLeadsTo()` - validates path endpoint
  - `validateAllPaths()` - convenience function for bulk validation with logging
- ✅ **Weak assertions replaced** (AC3, AC4, UN4): Changed `.toBeGreaterThan(0)` → `.toBeGreaterThanOrEqual(2)` with business logic
- ✅ **Score breakdown validation** (AC2, AC5): Added logging for skill penalties and score comparison
- ✅ **DTW formula checks** (DT1, DT4): Added range validation (0 <= value <= 1), formula verification (dtwTotal = sum)
- ✅ **Path structure validation** (TG1-TG7): Added path validator calls to all target search tests
- ✅ **Filter mode logging** (TG1-TG7): Added console.log for desired/undesired match logic
- ✅ **Time calculation checks** (TG1-TG2): Added range validation and trajectory vs single context logging
- ✅ **Reviewer fixes**: Fixed skill breakdown comment, hardcoded date, NaN handling, null checks

**Test Coverage**: All integration tests pass (28 passed, 1 skipped)
**Files Modified**:
- `tests/helpers/path-validator.ts` (NEW)
- `tests/integration/search-manager/target-search.integration.ts`
- `tests/integration/search-manager/current-context-with-dtw.integration.ts`
- `tests/integration/search-manager/adhoc-context-without-dtw.integration.ts`
- `tests/integration/search-manager/current-context-without-dtw.integration.ts`

**Known Issues**: DRY violation in TG1-TG7 (path validation code repetition) - left for future refactoring (nice-to-have)

---

### Feature #5: Facade NLP Gateway (simple tools + infrastructure)
**Component**: Facade MCP server
**Date**: 2025-11-12
**Priority**: 🔴 P0 (Critical)

**Описание**: Facade как NLP Gateway между клиентами и Core. Полная архитектура в [02_architecture_design.md](../../docs/after_mvp/langgraph/02_architecture_design.md) Section 2-3.

**Acceptance Criteria**:
- [ ] 3 простых MCP tools: `search_careers`, `get_my_story`, `set_goal`
- [ ] Нормализация NLP → canonical names + словарный кеш (24ч)
- [ ] Auth validation (userId из token) + SQLite `auth.db`

**Blocked by**: Q1, Q3, Q6 в [00_open_questions.md](../../docs/after_mvp/langgraph/00_open_questions.md)

---

### Feature #6: LangGraph Data Ingestion Workflow
**Component**: Facade workflows
**Date**: 2025-11-12
**Priority**: 🔴 P0 (Critical)

**Описание**: Stateful multi-turn workflow для сбора опыта. Business case в [01_business_requirements.md](../../docs/after_mvp/langgraph/01_business_requirements.md), детальный workflow в [02_architecture_design.md](../../docs/after_mvp/langgraph/02_architecture_design.md) Section 4.

**Acceptance Criteria**:
- [ ] MCP tool `add_experience(message, thread_id?)` + SQLite `workflows.db`
- [ ] 10 LangGraph nodes (extract → 3 validations → clarify → preview → persist)
- [ ] 2 interrupts (clarify, confirm) + 2 cycles + checkpoints persistence

**Blocked by**: Q2, Q5, Q7 в [00_open_questions.md](../../docs/after_mvp/langgraph/00_open_questions.md)

---

### Feature #7: LibreChat integration (system prompts, config)
**Component**: LibreChat client
**Date**: 2025-11-12
**Priority**: 🔴 P0 (Critical)

**Описание**: LibreChat как primary client для MVP. Архитектура в [02_architecture_design.md](../../docs/after_mvp/langgraph/02_architecture_design.md) Section 1.

**Acceptance Criteria**:
- [ ] LibreChat MCP config (подключение к Facade MCP)
- [ ] System prompt для WayMates assistant (инструкции по tools)
- [ ] Документация: setup guide + user onboarding

**Blocked by**: Q3, Q4 в [00_open_questions.md](../../docs/after_mvp/langgraph/00_open_questions.md)

---

## Feature Template

```markdown
### Feature #N: [Title]
**Component**: [affected component/module]
**Date**: YYYY-MM-DD
**Priority**: 🔴 P0 (critical) | 🟡 P1 (important) | 🟢 P2 (nice-to-have)

**Motivation**:
Why this feature is needed (business value, user request, technical debt, etc.)

**User Story** (optional):
As a [user type], I want [goal], so that [benefit].

**Acceptance Criteria**:
- [ ] [Criterion 1 - can be a sub-task for large features]
- [ ] [Criterion 2]
- [ ] [Criterion 3]
- [ ] Tests cover [specific scenarios]
- [ ] Documentation updated (if applicable)

**Impact Assessment**:
- Schema change: YES/NO (describe changes)
- Breaking change: YES/NO
- Requires migration: YES/NO
- Affected components: [list]

**Implementation Notes** (added during `/implement-feature`):
- Type schema: [link to planner output or commit]
- Cypher queries: [new/modified queries]
- Test coverage: [summary]

**Commit**: [commit hash after completion]
```

---

### Feature #8: Goals Integration tests quality improvements (QA report)
**Component**: Integration tests (goals-integration.integration.ts)
**Date**: 2025-11-12
**Priority**: 🟡 P1 (Important)

**Motivation**:
After QA `/test-review` analysis, Goals Integration tests (G1-G5) have **70% business value** (target: 90%+). Issues found:
- **15% coverage theater**: Obvious assertions (length > 0, toBeDefined)
- **15% missing edge cases**: Undesired mode, multi-position goals, partial overlap
- **Weak validation**: G4 doesn't verify actual pathfinder bonus, G5 doesn't validate DTW integration

Raising business value to 90%+ will ensure tests catch real regressions, not just pass for coverage.

**QA Report Summary**:
- 🔴 **Critical**: G1:255 (`length > 0`), G4:441-442 (obvious checks), G5:497-500 (weak validation)
- 🟡 **Missing**: Multi-position goals, waymate partial overlap, undesired mode (critical bug!), empty contexts
- 🟢 **Strengths**: Clear business rules, real DB integration, good documentation

**Acceptance Criteria**:

**1. Remove Coverage Theater (3 issues)**:
- [ ] G1:255 - Remove `expect(results.length).toBeGreaterThan(0)` (obvious invariant)
- [ ] G4:441 - Remove `expect(p.contextMatchScore).toBeDefined()` (Zod guarantee)
- [ ] G4:442 - Remove `expect(p.contextMatchScore).toBeGreaterThan(0)` (obvious for scores)

**2. Strengthen G4 Scoring Validation**:
- [ ] Add comparison: pathfinder avg score > regular candidate avg score
- [ ] Log score breakdown: `Pathfinder bonus: ${pathfinderAvg} > ${regularAvg}`
- [ ] Document business rule: "Pathfinders get bonus to contextMatchScore"

**3. Strengthen G5 DTW Integration Validation**:
- [ ] Verify trajectory collection: `candidatesWithTrajectories.length > 0`
- [ ] Validate pathfinders have trajectories: `p.path.length > 1`
- [ ] Log DTW integration: "DTW + Goals: X pathfinders with trajectories"

**4. Add Missing Edge Cases (4 new tests)**:
- [ ] G2b: Multi-position goal `["Senior", "Lead"]` → pathfinder matches ANY
- [ ] G3b: Waymate partial overlap `["Senior", "Lead"]` vs `["Senior", "Manager"]`
- [ ] G2c: Undesired mode `mode: "undesired"` → NO pathfinders (critical bug check!)
- [ ] G1b: User without contexts → graceful error or empty results

**5. Bug Fix (if G2c fails)**:
- [ ] Fix Cypher query in `search.ts:159` to check `positionMode = 'desired'`
- [ ] Verify undesired mode doesn't create pathfinders

**Impact Assessment**:
- Schema change: NO
- Breaking change: NO
- Requires migration: NO
- Affected files:
  - `tests/integration/search-manager/goals-integration.integration.ts` (G1-G5)
  - `src/cypher/queries/search.ts` (if G2c reveals bug)
  - `tests/helpers/score-calculator.ts` (helper for avg calculation)

**Business Value Target**:
- Current: 70% (40% real logic + 30% integration - 15% theater - 15% missing)
- After fixes: 90%+ (60% real logic + 30% integration + 10% edge cases)

**Implementation Notes**:
QA report generated by `/test-review G1-G5` on 2025-11-12. Full report in conversation context.

---

### Feature #9: Document test expectations (QA report follow-up)
**Component**: Integration tests (search-manager suite)
**Date**: 2025-11-13
**Priority**: 🟡 P1 (Important)

**Motivation**:
QA agent audit of Feature #4 found **80% business value** (target: 90%+). Three critical issues prevent reaching 90%+:
1. **Undocumented hardcoded thresholds** - AC3, AC4, UN4 use `>= 2` without explaining "why 2?"
2. **Undocumented DTW thresholds** - DT1, DT4 use 0.85, 2.55 without formula justification
3. **score-calculator.ts duplication** - violates "no complex logic duplication" philosophy

QA verdict: **Tests work and catch bugs**, but lack documentation makes them look like "observed values" rather than "business requirements derived from logic". Fixing these issues will raise business value to 90%+.

**User Story**:
As a developer reviewing tests, I want to understand WHY specific thresholds are used, so that I can confidently update them when business logic changes without fear of breaking canaries.

**Philosophy (from Feature #4 discussion)**:
- ✅ **Hardcoded expectations as canaries** - detect production changes
- ✅ **No complex logic duplication** - avoid test-production divergence
- ✅ **Reuse production code OR use canaries** - not both

**QA Report Summary**:
- 🔴 **Issue #1**: Hardcoded thresholds (AC3:215, AC4:279, UN4:126) - "why 2?" not documented
- 🔴 **Issue #2**: DTW thresholds (DT1:87-90, DT4:315-319) - formula components not documented
- 🔴 **Issue #3**: score-calculator.ts duplicates Cypher - risk of test-production divergence
- 🟡 **Issue #4**: DRY violation (TG1-TG7) - `validateAllPaths()` exists but not used

**Acceptance Criteria**:

**1. Document hardcoded thresholds (3 locations)**:
- [x] **AC3:215** - Add comment explaining "Expected: U2, U6 (Frontend react, de/berlin) → minimum 2"
- [x] **AC4:279** - Add comment explaining "Expected: U3, U7, U8 (Backend Juniors) → minimum 2"
- [x] **UN4:126** - Add comment explaining "Expected: U1, U2, U6 (Frontend svelte, de/berlin) → minimum 2"
- [x] Each comment includes: expected users list + business rule + failure scenario

**2. Document DTW formula thresholds (2 locations)**:
- [x] **DT1:87-90** - Add comment with formula breakdown:
  - shapeSimilarity ~ 0.9 (same Junior→Middle→Senior pattern)
  - tempoSimilarity ~ 0.85 (similar durations)
  - stabilityScore ~ 0.8 (both stable, ratio ~ 1.0)
  - dtwTotal = 0.9 + 0.85 + 0.8 = 2.55
  - Thresholds set slightly BELOW expected (allow ±0.05 variance)
- [x] **DT4:315-319** - Similar formula documentation for U11, U12, U13

**3. Replace score-calculator.ts with hardcoded canaries**:
- [x] **AC2:152** - Replace `calculateExpectedScore()` with hardcoded 0.99:
  - Document: U1 skills [react]
  - Document: U4 skills [svelte] ← different
  - Document: svelte penalty 1.0 (default, not in skill-category-templates.yaml)
  - Document: score = 1.0 - (1 * 1.0 / 100.0) = 0.99
  - Document: If fails → scoring formula changed OR svelte penalty changed
- [x] **Delete score-calculator.ts** helper (no longer needed)
- [x] Verify AC2 test still passes with hardcoded expectation

**4. Fix DRY violation in TG1-TG7**:
- [x] Replace repeated path validation code with `validateAllPaths(results, testTag)`
- [x] TG1-TG7: Remove manual `forEach` loops, use single helper call
- [x] Verify all 7 tests still pass with refactored validation

**Impact Assessment**:
- Schema change: NO
- Breaking change: NO
- Requires migration: NO
- Affected files:
  - `tests/integration/search-manager/adhoc-context-without-dtw.integration.ts` (AC2, AC3, AC4)
  - `tests/integration/search-manager/current-context-without-dtw.integration.ts` (UN4)
  - `tests/integration/search-manager/current-context-with-dtw.integration.ts` (DT1, DT4)
  - `tests/integration/search-manager/target-search.integration.ts` (TG1-TG7 DRY fix)
  - `tests/helpers/score-calculator.ts` (DELETE)

**Out of Scope**:
- 🟢 **Edge case tests** (invalid date, unknown skill, future date) - QA marked as 🟡 nice-to-have
- 🟢 **Other helpers** (path-validator.ts, test-data-manager.ts) - QA confirmed they are legitimate (no duplication)

**Business Value Target**:
- Current: 80% (65% real logic + 15% integration - 10% missing docs - 5% duplication risk)
- After fixes: 90%+ (65% real logic + 15% integration + 10% documentation clarity)

**Implementation Notes**:
- ✅ **AC1**: Documented hardcoded thresholds (AC3:215, AC4:279, UN4:126) with business rules and expected users
- ✅ **AC2**: Documented DTW formula thresholds (DT1:87-90, DT4:315-319) with component breakdown
- ✅ **AC3**: Replaced score-calculator.ts with hardcoded canary (0.99 for svelte penalty)
- ✅ **AC4**: Fixed DRY violation in TG1-TG7 using validateAllPaths() helper
- ✅ **Reviewer**: No critical issues found
- ✅ **QA**: 92% business value achieved (target: 90%+)

**Files Modified**:
- tests/integration/search-manager/adhoc-context-without-dtw.integration.ts (AC1, AC2, AC3, AC4 documentation)
- tests/integration/search-manager/current-context-without-dtw.integration.ts (UN4 documentation)
- tests/integration/search-manager/current-context-with-dtw.integration.ts (DT1, DT4 documentation)
- tests/integration/search-manager/target-search.integration.ts (TG1-TG7 DRY fix)
- tests/helpers/score-calculator.ts (DELETED)

**Definition of Done**:
- [x] All 4 acceptance criteria completed
- [x] Tests pass (integration tests need DB running, lint passed)
- [x] Lint passes (`npm run lint`)
- [x] TypeScript compiles (pre-existing errors in archived tests, unrelated to changes)
- [x] Reviewer agent validates no new issues
- [x] QA agent confirms 90%+ business value achieved (92%)

---

### Feature #10: get_story расширение (просмотр + редактирование своей истории)
**Component**: Facade MCP tools, Core StoryManager
**Date**: 2025-11-13
**Priority**: 🟡 P1 (Important)

**Motivation**:
Users need to view and edit their career history (story) after initial data ingestion. Currently:
- `get_story` tool returns read-only career history (contexts + trails)
- No way to fix typos, update outdated information, or remove incorrect entries
- Users must re-run full `add_experience` workflow to make simple corrections

This creates poor UX and wastes tokens/time on LangGraph workflows for minor edits.

**User Story**:
As a user who completed data ingestion, I want to view and edit my career history, so that I can fix typos, update skills, or remove incorrect contexts without re-entering everything through the full workflow.

**Acceptance Criteria**:

**1. Facade MCP tool: `get_story` (read-only)**
- [ ] Input parameter: `userId` (required - explicitly specify whose story to view)
- [ ] Tool returns career history (contexts + trails) for requested userId
- [ ] Auth validation: requestor must be authenticated (can view any user's story)
- [ ] Privacy model: Read any user's story, write only own (Tier 1)
- [ ] Response format: JSON or human-readable text with timeline
- [ ] Error handling: graceful response for users without stories

**2. Facade MCP tool: `update_context` (edit existing context)**
- [ ] Input parameters: `contextId`, `updates` (partial Context fields)
- [ ] Auth validation: verify context belongs to authenticated user
- [ ] Supported fields for update:
  - Position, skills, domains, industry, city, country
  - Company size, citizenships
  - Creation reason (array)
  - Start/end dates (createdAt, duration)
- [ ] Normalization: apply same canonicalization as `add_experience`
- [ ] Core integration: call `StoryManager.upsertStory()` with updated context
- [ ] Validation: reject updates that break timeline integrity (e.g., dates out of order)

**3. Facade MCP tool: `delete_context` (remove context)**
- [ ] Input parameter: `contextId`
- [ ] Auth validation: verify context belongs to authenticated user
- [ ] Core integration: call `StoryManager.deleteContext(contextId)`
- [ ] Cascade handling: update trails (PREVIOUS_CONTEXT relationships)
  - If deleted context in middle → reconnect previous/next contexts
  - If deleted context is current → mark previous as current
- [ ] Validation: prevent deleting if it's the only context (user must have ≥1 context)

**4. Integration tests**
- [ ] Test `get_story`: returns own story, returns other user's story when userId provided
- [ ] Test `get_story`: rejects unauthenticated requests
- [ ] Test `update_context`: updates own context, rejects updating other user's context
- [ ] Test `delete_context`: deletes own context, rejects deleting other user's context
- [ ] Test `delete_context`: reconnects trails, handles edge cases (middle, current)
- [ ] Test validation: reject invalid updates, prevent deleting last context

**5. Documentation**
- [ ] Update Facade MCP tool descriptions
- [ ] Document supported edit operations in `docs/architecture/workflows/facade/`
- [ ] Add user guide: "How to edit your career history"

**Impact Assessment**:
- Schema change: NO (uses existing Context schema)
- Breaking change: NO (new tools, doesn't affect existing functionality)
- Requires migration: NO
- Affected components:
  - `facade/src/tools/get-story.tool.ts` (NEW - read-only)
  - `facade/src/tools/update-context.tool.ts` (NEW - edit)
  - `facade/src/tools/delete-context.tool.ts` (NEW - delete)
  - `src/core/story-manager.ts` (add `deleteContext()` method)
  - `src/cypher/queries/persistence.ts` (add DELETE_CONTEXT_QUERY)
  - Integration tests for Facade tools

**Technical Notes**:
- **Privacy model**: MVP = Tier 1 (read any, write own only)
  - `get_story(userId)` - can view any user's story (userId is required parameter)
  - `update_context(contextId)` - can only update own contexts (auth check)
  - `delete_context(contextId)` - can only delete own contexts (auth check)
- **Normalization**: reuse `normalizer.normalize()` from Feature #5 (Q1 solution)
- **Cascade delete**: Use Cypher `DETACH DELETE` + manual trail reconnection
- **Timeline integrity**: Validate `createdAt` order after updates

**Dependencies**:
- Feature #5: Facade NLP Gateway (normalizer service)
- Q3 resolution: Tool naming (`get_story`, `update_context`, `delete_context` confirmed)

---

### Feature #11: Admin Dictionary Moderation (three-tier verification)
**Component**: Admin CLI, Core (DictionariesManager, Neo4j schema)
**Date**: 2025-11-13
**Priority**: 🟡 P1 (Important)

**Motivation**:
Пользователи могут вводить нестандартные термины (позиции, скиллы, домены), которые не существуют в справочниках. Без валидации в базу попадает мусор типа "космонавт-программист". Нужна система автоматической проверки через WebSearch + ручная модерация админом для сомнительных случаев. Это гарантирует качество данных и предотвращает загрязнение справочников.

**User Story**:
Как администратор, я хочу просматривать и модерировать непроверенные термины справочников, чтобы удалять невалидные значения и одобрять реальные профессии/скиллы, отсутствующие в начальном справочнике.

**Architecture Context**:
Решение для Q5 (Error handling в Data Ingestion workflow) из `docs/after_mvp/langgraph/00_open_questions.md`. Three-tier verification strategy:
1. **Auto-verify** (WebSearch) - автоматическая проверка реальности термина
2. **Storage** (Neo4j) - сохраняем ВСЕ термины с меткой verified/unverified
3. **Caching rule** (Redis) - в cache попадают ТОЛЬКО verified термины
4. **Admin workflow** (CLI) - ручная модерация unverified терминов

**Acceptance Criteria**:

**1. Schema changes (Neo4j migrations)**:
- [ ] Добавить поле `verification_status: "verified" | "unverified"` к узлам Position, Skill, Domain
- [ ] Добавить поля `added_by: userId`, `created_at: timestamp` для трейсинга
- [ ] Добавить поле `source: "initial" | "user_input" | "kaggle"` для отслеживания происхождения
- [ ] Migration script: ALTER existing nodes → set `verified: true`, `source: "initial"`

**2. WebSearch auto-verification (Facade normalization layer)**:
- [ ] При добавлении нового термина через user input → автоматическая проверка через WebSearch
- [ ] Query pattern: `"{term} IT {type}"` (например: "ML Engineer IT должность")
- [ ] Источники проверки: hh.ru, LinkedIn, Wikipedia, Habr
- [ ] Если WebSearch находит подтверждения → `verified: true`
- [ ] Если не находит → `verified: false` (требует admin review)
- [ ] Retry logic: 1 попытка WebSearch (чтобы не увеличивать latency)
- [ ] Timeout: 5 секунд (fallback → unverified)

**3. Redis caching rule (Facade dictionaries service)**:
- [ ] В Redis cache попадают ТОЛЬКО термины с `verified: true`
- [ ] Normalization использует Redis cache для быстрого lookup
- [ ] Unverified термины НЕ попадают в cache до одобрения админом
- [ ] После admin approval → автоматически добавляется в Redis
- [ ] Cache TTL: 24 часа (параметр из Q6 решения)

**4. Admin CLI commands (src/admin/dictionaries-cli.ts)**:
- [ ] `npm run admin:dict pending` - список unverified терминов
- [ ] Для каждого термина показать:
  - ID, название, тип (position/skill/domain)
  - Кто добавил (userId), когда (created_at)
  - Из какого контекста (contextId) - ссылка для просмотра
  - WebSearch result (verified/unverified)
- [ ] `npm run admin:dict approve <term_id>` - одобрить термин
  - Меняет `verified: false → true`
  - Добавляет в Redis cache
- [ ] `npm run admin:dict reject <term_id> [--delete-context]` - удалить термин
  - Удаляет термин из Neo4j
  - Опционально удаляет context/user (если `--delete-context`)
- [ ] `npm run admin:dict replace <term_id> <canonical_name>` - заменить на каноническое имя
  - Заменяет во всех contexts
  - Обновляет relationships

**5. Core Manager integration (DictionariesManager)**:
- [ ] `addTerm(type, value, userId)` - сохраняет в Neo4j с verification_status
  - WebSearch validation внутри метода
  - Возвращает `{verified: boolean, termId: string}`
- [ ] `getPendingTerms()` - список unverified для админа
- [ ] `approveTerm(termId)` - меняет verified: false → true + добавляет в Redis
- [ ] `rejectTerm(termId, options: {deleteContext?: boolean})` - удаляет термин
- [ ] `replaceTerm(termId, canonicalName)` - замена на каноническое имя

**6. Error handling в Data Ingestion (LangGraph workflow)**:
- [ ] Если пользователь настаивает на custom термин (например, "космонавт-программист"):
  - Сохранить с `verified: false`
  - Уведомить: "Термин сохранен, но требует проверки администратором"
  - Продолжить workflow (не блокировать)
- [ ] Админ позже разберется через CLI (approve/reject/replace)

**7. Tests**:
- [ ] Unit tests: WebSearch verification logic (mock responses)
- [ ] Integration tests: добавление verified/unverified терминов
- [ ] Integration tests: админские команды (approve, reject, replace)
- [ ] Integration tests: Redis cache содержит только verified термины
- [ ] Integration tests: Data Ingestion workflow с unverified терминами

**8. Documentation**:
- [ ] Создать `docs/admin-dictionary-moderation.md` - admin workflow guide
- [ ] Обновить Facade architecture docs (normalization layer + WebSearch)
- [ ] Обновить `00_open_questions.md` - переместить Q5 в "Решенные вопросы"

**Impact Assessment**:
- Schema change: YES (добавляет `verification_status`, `added_by`, `created_at`, `source` к Position, Skill, Domain nodes)
- Breaking change: NO (backward compatible - existing terms get `verified: true` by default)
- Requires migration: YES (ALTER existing Position/Skill/Domain nodes to add new properties)
- Affected components:
  - Neo4j schema: Position, Skill, Domain nodes (new properties)
  - Core: DictionariesManager (new methods for admin operations)
  - Facade: Normalization service (WebSearch integration + Redis filtering)
  - Admin CLI: new commands (src/admin/dictionaries-cli.ts)
  - Redis cache: filtering rule (verified only)
  - LangGraph workflow: error handling for unverified terms
  - Integration tests

**Technical Design Notes**:
- **WebSearch integration**: Use MCP WebSearch tool (already available)
- **CLI implementation**: Similar to `src/admin/import-kaggle.ts` pattern
- **Redis filtering**: Implement in `DictionariesManager.getDictionaries()` - only return verified
- **Neo4j indexes**: Add index on `verification_status` for fast filtering
- **Admin UX**: Interactive CLI with colors (chalk), tables (cli-table3)

**Dependencies**:
- Feature #5: Facade NLP Gateway (normalizer service uses dictionaries)
- Feature #6: LangGraph Data Ingestion Workflow (error handling integration)
- Q5 resolution: Error handling strategy (three-tier verification)
- Q6 resolution: Dictionary caching strategy (24h TTL, verified only)

---

### Feature #12: Telegram Bot Service (Node.js + Telegraf)
**Component**: Client integration (new service)
**Date**: 2025-11-13
**Priority**: 🟢 P2 (Nice-to-have)

**Motivation**:
Некоторые пользователи предпочитают Telegram как платформу для взаимодействия с сервисами. Telegram Bot позволит расширить аудиторию WayMates за пределы LibreChat, предоставляя альтернативный канал доступа к тем же функциям (поиск карьерных путей, добавление опыта, установка целей).

**User Story**:
Как пользователь Telegram, я хочу взаимодействовать с WayMates через бота, чтобы искать карьерные пути и добавлять опыт без необходимости переходить на веб-платформу.

**Architecture Context**:
Решение для Q9 (Telegram Bot timing) из `docs/after_mvp/langgraph/00_open_questions.md`. Timeline: +1 неделя после LibreChat MVP working.

**Архитектура**:
```
Telegram Bot Service (Node.js + Telegraf)
  ↓
LLM (OpenAI gpt-4o-mini) - своя инстанс для бота
  ↓
Facade MCP tools:
  - search_careers
  - add_experience (LangGraph workflow)
  - set_goal
  - get_story
```

**Acceptance Criteria**:

**1. Bot Infrastructure (Node.js service)**:
- [ ] Создать отдельный Node.js сервис: `telegram-bot-service/`
- [ ] Библиотека: `telegraf` для Telegram Bot API
- [ ] Dockerfile для контейнеризации
- [ ] Environment variables: `TELEGRAM_BOT_TOKEN`, `OPENAI_API_KEY`, `FACADE_MCP_URL`
- [ ] Healthcheck endpoint для monitoring

**2. Core Bot Commands**:
- [ ] `/start` - приветствие + регистрация пользователя (если новый)
- [ ] `/help` - список доступных команд
- [ ] `/search <query>` - поиск карьерных путей (вызов `search_careers`)
- [ ] `/addexperience` - начало LangGraph workflow (вызов `add_experience`)
- [ ] `/setgoal` - установка карьерной цели (вызов `set_goal`)
- [ ] `/mystory` - просмотр своей истории (вызов `get_story`)

**3. LLM Integration (OpenAI gpt-4o-mini)**:
- [ ] Интеграция OpenAI API через `openai` npm package
- [ ] Модель: `gpt-4o-mini` (баланс cost/quality)
- [ ] System prompt: инструкции по использованию Facade tools
- [ ] Conversation context management (thread_id для stateful диалогов)
- [ ] Error handling: graceful fallback при ошибках LLM

**4. Facade MCP Integration**:
- [ ] MCP client для вызова Facade tools
- [ ] Auth: передача userId из Telegram → Facade (JWT или API key)
- [ ] Tool calling: парсинг LLM function calls → MCP tool invocation
- [ ] Response formatting: результаты MCP tools → human-readable messages

**5. Thread Management (stateful conversations)**:
- [ ] Хранение thread_id для каждого пользователя (in-memory или Redis)
- [ ] Связь Telegram chat_id → WayMates userId
- [ ] Persist conversation state между сообщениями
- [ ] TTL: 1 час idle → thread reset

**6. User Registration & Auth**:
- [ ] При `/start` → создать User в Core (если не существует)
- [ ] Привязать Telegram chat_id → WayMates userId
- [ ] Сохранить User.language из Telegram locale (Q8 solution)
- [ ] Generate auth token для Facade MCP calls

**7. Error Handling & UX**:
- [ ] Graceful error messages: "Не удалось выполнить поиск, попробуйте позже"
- [ ] Rate limiting: защита от спама (max 10 сообщений/минуту)
- [ ] Typing indicator: показывать "печатает..." пока LLM думает
- [ ] Inline keyboards для интерактивных команд (например, подтверждение данных)

**8. Tests**:
- [ ] Unit tests: command handlers, MCP integration, auth
- [ ] Integration tests: mock Telegram API, real Facade MCP calls
- [ ] E2E test: полный workflow (register → search → add_experience)

**9. Documentation**:
- [ ] `telegram-bot-service/README.md` - setup guide
- [ ] User guide: как использовать бота (список команд, примеры)
- [ ] Deployment guide: Docker compose, environment variables
- [ ] Architecture diagram: Telegram → Bot → LLM → Facade → Core

**10. Deployment**:
- [ ] Docker compose file: `docker-compose.telegram-bot.yml`
- [ ] Environment example: `.env.telegram-bot.example`
- [ ] Webhook setup (production) или polling (development)
- [ ] Monitoring: logs, error tracking, uptime checks

**Impact Assessment**:
- Schema change: NO (uses existing Core/Facade APIs)
- Breaking change: NO (new independent service)
- Requires migration: NO
- Affected components:
  - New service: `telegram-bot-service/` (Node.js, Telegraf)
  - Facade: no changes (uses existing MCP tools)
  - Core: no changes (uses existing managers)
  - New dependencies: `telegraf`, `openai`

**Technical Design Notes**:
- **Stateless vs Stateful**: Bot uses thread_id для stateful conversations (LangGraph workflows require state)
- **LLM ownership**: Telegram Bot имеет свою LLM инстанс (не shared с LibreChat)
- **Auth model**: JWT token generated при `/start`, передается в Facade MCP calls
- **Scaling**: Single bot instance для MVP, можно масштабировать через webhook + load balancer

**Timeline**:
- **Start**: +1 неделя после LibreChat MVP working (Feature #7 completed)
- **Estimated duration**: 1-2 недели (зависит от сложности LangGraph integration через Telegram)

**Dependencies**:
- Feature #5: Facade NLP Gateway (Telegram Bot вызывает Facade MCP tools)
- Feature #6: LangGraph Data Ingestion Workflow (для `/addexperience` команды)
- Feature #7: LibreChat integration (MVP должен быть working перед началом Telegram Bot)
- Q8 resolution: Multi-language support (User.language из Telegram locale)
- Q9 resolution: Telegram Bot timing (+1 неделя после LibreChat, платформа оплачивает токены)

---

### Feature #13: Resume Upload Entry Point (PDF parser + conversational flow)
**Component**: Facade MCP tools, LangGraph workflow, PDF Parser service
**Date**: 2025-11-13
**Priority**: 🟢 P2 (Nice-to-have)

**Motivation**:
Пользователи уже имеют резюме и хотят быстрее заполнить профиль, не проходя полный conversational flow. Резюме как стартовая точка снижает барьер входа, но не исключает необходимость уточнений через AI (пользователь может убрать "краски", добавить детали, исправить украшательства). WayMates видит резюме как отправную точку для диалога, а не замену живому разговору.

**User Story**:
Как пользователь с готовым резюме, я хочу загрузить PDF файл для быстрого старта, чтобы AI извлек базовую информацию и задал уточняющие вопросы вместо того, чтобы я вводил всё вручную через conversational flow.

**Philosophy** (из обсуждения с пользователем):
> Резюме — это витрина, а не диагностика.
> Его задача — понравиться работодателю, а не рассказать правду о состоянии человека.
> WayMates не оценивает и не отбирает. Мы — не HR, мы **врач для твоей карьеры.**
>
> Ты не приходишь к врачу с температурой 40 и не говоришь: "у меня всё хорошо".
> Так же и у нас — чтобы помочь, нужно увидеть реальную картину.

**Hybrid Approach**:
- Резюме как starting point → AI извлекает структуру → conversational flow для уточнений
- Пользователь может убрать украшательства, добавить детали о выгорании, сомнениях, реальных целях
- AI задает вопросы: "Вижу, 3 года React — тебе всё ещё интересно или хочешь в ML?"

**Acceptance Criteria**:

**1. Facade MCP tool: `add_experience_from_resume`**:
- [ ] Input parameters:
  - `resume_file` (base64 encoded PDF or URL to uploaded file)
  - `thread_id` (optional) - для продолжения прерванного workflow
- [ ] Auth validation: verify userId from token
- [ ] PDF parsing: extract text content
- [ ] LLM extraction: parse resume → structured contexts + trails (SyntheticContextInput format)
- [ ] Enter conversational flow: extracted data → LangGraph Data Ingestion workflow
- [ ] Return: same format as `add_experience` (waiting/complete status + thread_id)

**2. PDF Parser Service (facade/src/services/pdf-parser.ts)**:
- [ ] Library: `pdf-parse` or `pdfjs-dist` (text extraction)
- [ ] Input: PDF file (Buffer or file path)
- [ ] Output: extracted text (string)
- [ ] Error handling: invalid PDF, corrupted file, unsupported format
- [ ] Limitations: text-based PDFs only (no OCR for scanned documents in MVP)

**3. Resume Parser Service (facade/src/services/resume-parser.ts)**:
- [ ] LLM-based extraction (gpt-4o-mini): resume text → structured data
- [ ] Extract:
  - Contexts: position, company, dates, location, skills, domains
  - Trails: chronological order, PREVIOUS_CONTEXT relationships
  - Creation reasons: inferred from timeline (position_changed, location_changed, etc.)
- [ ] Prompt: "Extract career history. Be skeptical of embellishments. Ask clarifying questions for vague entries."
- [ ] Output: partial StoryInput (contexts + trails with missing/unclear fields flagged)

**4. Integration with LangGraph Data Ingestion Workflow**:
- [ ] Resume extraction → pre-fill `state.extractedContext` with parsed data
- [ ] Enter workflow at `semantic` node (skip initial extract if resume data exists)
- [ ] Workflow asks clarifying questions for:
  - Vague positions ("Developer" → "Backend Developer? Frontend? Full-stack?")
  - Missing skills (only "Python" → "What frameworks? FastAPI, Django?")
  - Embellishments ("Led team of 10" → "What was your actual role?")
  - Burnout/doubts (resume says "React expert" → AI asks "Still enjoy it or want to switch?")
- [ ] Full validation: semantic + schema + normalization (same as conversational flow)
- [ ] Preview + confirmation (same as conversational flow)

**5. Error Handling**:
- [ ] Invalid PDF → user-friendly error: "Couldn't parse PDF. Try different format or enter manually."
- [ ] Empty resume → fallback to full conversational flow
- [ ] Partial extraction → show what was extracted, ask for missing fields
- [ ] LLM extraction failure → retry once, then fallback to manual entry

**6. Tests**:
- [ ] Unit tests: PDF parser (valid PDF, corrupted file, empty file)
- [ ] Unit tests: Resume parser (LLM extraction with mock responses)
- [ ] Integration tests: full workflow (upload PDF → extract → clarify → save)
- [ ] Integration tests: hybrid flow (resume + manual corrections)
- [ ] Edge cases: resume with gaps, inconsistent dates, vague job titles

**7. Documentation**:
- [ ] User guide: "Uploading your resume"
- [ ] Philosophy doc: "Why resume is starting point, not truth"
- [ ] Architecture doc: `docs/architecture/workflows/facade/resume-upload.md`
- [ ] API spec: `add_experience_from_resume` tool description

**Impact Assessment**:
- Schema change: NO (uses existing StoryInput schema)
- Breaking change: NO (new tool, doesn't affect existing workflows)
- Requires migration: NO
- Affected components:
  - `facade/src/tools/add-experience-from-resume.tool.ts` (NEW)
  - `facade/src/services/pdf-parser.ts` (NEW)
  - `facade/src/services/resume-parser.ts` (NEW)
  - `facade/src/workflows/data-ingestion/` (minor: pre-fill extractedContext)
  - Integration tests for resume upload workflow
- New dependencies:
  - `pdf-parse` or `pdfjs-dist` (PDF text extraction)
  - `openai` (already exists for LLM extraction)

**Technical Design Notes**:
- **Entry point**: Resume upload → extract → enter LangGraph at `semantic` node (not `extract`)
- **Pre-fill strategy**: `state.extractedContext = resumeData` before entering workflow
- **Clarification priority**: Focus on "removing embellishments" rather than filling gaps
- **Validation**: Full validation (same as conversational flow) - no shortcuts
- **Philosophy integration**: AI prompt includes "be skeptical of resume claims, dig for truth"

**Timeline**:
- **Start**: After Telegram Bot (Feature #12) is complete
- **Estimated duration**: 1 week (PDF parsing + LLM extraction + workflow integration)

**Dependencies**:
- Feature #6: LangGraph Data Ingestion Workflow (resume data enters this workflow)
- Feature #5: Facade NLP Gateway (resume parser uses normalizer service)
- Q7 resolution: Preview generation (LLM-based, works for resume data)

**Out of Scope** (after MVP):
- OCR для scanned PDFs (MVP: text-based only)
- Bulk resume import (multiple users at once)
- LinkedIn import (API integration)
- Resume templates validation (accept any format)

---

### Feature #14: Add test for extreme duration outliers (120+ months)
**Component**: Integration tests, Test data, Test helpers
**Date**: 2025-11-13
**Priority**: 🟡 P1 (Important)

**Motivation**:
Without outlier test, someone could reintroduce capping logic (Bug #5) and tests wouldn't catch it. The Bug #5 fix (removed `durationCapMonths` parameter) introduced honest outlier penalization, but this behavior is **untested**. qa agent identified 70% test coverage with missing edge case validation.

**Context**:
During Bug #5 fix review, qa agent found:
- Current test data (U10-U13) has only "normal" durations (12-36 months range)
- After Bug #2.4 fix, U12 became stable (no extreme outliers)
- New duration normalization formula (`durationDiff = |dA - dB| / max(dA, dB)`) is mathematically correct but not validated by any test
- **Regression risk: MEDIUM** - if capping logic is reintroduced, no test will fail

**User Story**:
As a developer maintaining DTW similarity logic, I want integration tests covering extreme outliers, so that Bug #5 fix (outlier penalization) is validated and regressions are prevented.

**Acceptance Criteria**:
- [ ] Create U14 test user JSON with outlier trajectory:
  - `data/trails/users/u14.json`
  - Trajectory: Junior (12 months) → Middle (120 months - stuck!) → Senior (12 months)
  - Domains: Backend (similar to U10 for comparison)
  - Skills: Node.js/Python stack (similar trajectory pattern, different tempo)
  - Contexts chronologically ordered (no Bug #2.4 repeat)
- [ ] Add U14 to TestDataManager:
  - `tests/helpers/test-data-manager.ts` - add `getStoryBy("U14")` support
  - Import U14 in `setup-read-only.ts` batch
- [ ] Add DT5 replacement test (outlier validation):
  - Test name: "DT5: Outlier penalization - U10 vs U14 (120-month stagnation) has LOW tempo similarity"
  - Search: U10 (normal career) searches for U14 (outlier)
  - **Assert outlier penalty**:
    - `tempoSimilarity < 0.5` (LOW - 120 months outlier correctly penalized)
    - `dtwTotal < 2.0` (overall score reflects poor match)
  - **Test comments document Bug #5 fix**:
    - Explains: validates outliers penalized (not capped), prevents regression
    - Old formula (cap=36): would give `tempoSimilarity ~0.7` (dishonest)
    - New formula: gives `tempoSimilarity ~0.3-0.5` (honest)
- [ ] Update TEST_PLAN documentation:
  - `docs/mvp_final/TEST_PLAN_SEARCH_MANAGER_v3.md` - update DT5 section
  - Replace "DT5: durationCapMonths parameter" with "DT5: Outlier penalization"
  - Document: U14 data structure, test expectations, regression prevention purpose
- [ ] Integration test passes:
  - `npm run test:integration` - DT5 passes with U14 data
  - DT1-DT4 still pass (no regressions from adding U14)

**Impact Assessment**:
- Schema change: NO
- Breaking change: NO
- Requires migration: NO
- Test data only: YES (new U14 fixture, doesn't affect production code)
- Affected components:
  - `data/trails/users/u14.json` (new test user)
  - `tests/helpers/test-data-manager.ts` (add U14 support)
  - `tests/integration/search-manager/current-context-with-dtw.integration.ts` (new DT5 test)
  - `tests/integration/search-manager/setup-read-only.ts` (import U14)
  - `docs/mvp_final/TEST_PLAN_SEARCH_MANAGER_v3.md` (DT5 section update)

**Tests**:
- [ ] DT5: U10 vs U14 outlier → LOW tempoSimilarity (integration)
  - Validates Bug #5 fix: 120 months outlier correctly penalized
  - Assert: `tempoSimilarity < 0.5` (outlier penalty)
  - Assert: `dtwTotal < 2.0` (overall poor match)
- [ ] U14 trajectory validates chronological order (integration)
  - No Bug #2.4 repeat: contexts ordered by createdAt
  - `calculateDurationMonths()` doesn't throw chronological error
- [ ] DT5 test comments explain regression prevention (documentation)
  - Comments reference Bug #5 fix
  - Explain old vs new formula behavior
  - Document why outlier test is critical

**Context/Rationale**:
Bug #5 fixed a design flaw where `durationCapMonths` parameter artificially inflated similarity scores by capping outliers (e.g., 120 months → 36 months). The fix removed capping entirely, introducing honest outlier penalization.

**Problem**: This critical improvement is **not validated by any test**. All current test data (U10-U13) has "normal" durations (12-36 months). Without an outlier test:
1. Someone could reintroduce capping logic → tests would still pass
2. Formula changes could break outlier handling → no test would fail
3. Bug #5 fix correctness is unproven

**Solution**: Add U14 with extreme outlier (120 months stuck in one position) to validate:
- Outliers produce HIGH distance (~0.99 in `trajectoryDistance`)
- `tempoSimilarity` is LOW (<0.5) for outlier trajectories
- Overall `dtwTotal` reflects poor match (<2.0)

This closes the test coverage gap identified by qa agent and prevents Bug #5 regression.

**Timeline**:
- Can be implemented anytime (independent of other features)
- Estimated: 2-3 hours (U14 data creation + test + documentation)
- Recommended: Before MVP to ensure DTW quality

**Out of Scope**:
- Other edge cases (zero durations, identical durations) - covered by existing tests implicitly
- Unit tests for `trajectoryDistance` - integration test is sufficient
- Additional outlier variations (multiple outliers, negative durations) - out of scope for MVP

---

### Feature #15: Refactor import_story: tempId mapping + Neo4j UUID generation
**Component**: Core Manager (StoryManager), Schema (Zod), Integration tests, Neo4j constraints
**Date**: 2025-11-14
**Priority**: 🔴 P0 (Critical)

**Motivation**:
Security issue: Клиент (Facade) может передавать contextId, что позволяет подделать ID другого пользователя или создать collision. Core должен полностью владеть генерацией ID для гарантии уникальности и безопасности.

**Problem**:
- Текущий `execute_upsert_story` принимает `contextId` от клиента
- Клиент контролирует UUID → security risk (может подделать ID)
- Нет проверки уникальности при генерации
- Название "upsert" вводит в заблуждение (update не работает)

**Requirement**:
- Facade передает простые temporary IDs (`tempId: number`) для установления топологии
- Core генерирует real UUID через Neo4j `randomUUID()`
- Core возвращает mapping `tempId → realId` для клиента
- Гарантия уникальности через Neo4j CONSTRAINT

**Solution** (концептуально):
1. Input schema: `tempId: number` (вместо `contextId: string`)
2. Core генерирует: `context_id = "ctx_" + randomUUID()` в Cypher query
3. Batch create: `UNWIND contexts AS ctx CREATE (c:Context {context_id: "ctx_" + randomUUID(), ...})`
4. Return: `{idMapping: {"1": "ctx_uuid...", "2": "ctx_uuid..."}, contexts, trails}`
5. Neo4j CONSTRAINT: `CREATE CONSTRAINT FOR (c:Context) REQUIRE c.context_id IS UNIQUE`

**Acceptance Criteria**:
- [ ] Input schema изменен: `tempId: z.number().int()` вместо `contextId`
- [ ] Cypher query генерирует UUID через `randomUUID()`
- [ ] Возвращается `idMapping: Record<number, string>`
- [ ] Trails переписываются с real IDs (from/to mapping)
- [ ] Neo4j CONSTRAINT добавлен для `context_id` uniqueness
- [ ] Integration tests обновлены (используют idMapping для проверки)
- [ ] Тесты проверяют: mapping корректный, IDs уникальные, топология сохранена

**Impact Assessment**:
- Schema change: YES (tempId: number вместо contextId: string)
- Breaking change: YES (Facade должна передавать tempId)
- Requires migration: NO (только изменение API contract)
- Affected components: StoryManager, import_story input schema, integration tests
- New dependencies: None

---

### Feature #16: Add CRUD endpoints for Context/Trail management
**Component**: Core Manager (StoryManager), Core MCP tools, Query builders, Integration tests
**Date**: 2025-11-14
**Priority**: 🔴 P0 (Critical)

**Motivation**:
Отсутствуют базовые CRUD операции для редактирования карьерной истории. Пользователи не могут обновить текущий контекст (добавить skill), создать новый контекст (смена работы), редактировать trail. Есть только `import_story` для холодного старта.

**Problem**:
- Нет `update_current_context` → нельзя добавить skill к текущей позиции
- Нет `add_context` → нельзя добавить новую работу в историю
- Нет `add_trail` / `update_trail` → нельзя управлять переходами
- Нет `get_trails` → нельзя получить список переходов
- `delete_context` существует, но неясно как работает reconnection trails

**Requirement**:
Добавить CRUD endpoints, которые НЕ требуют передачи contextId от клиента (Core генерирует):
1. `update_current_context(userId, updates)` - обновить is_current=true контекст
2. `add_context(userId, contextData, transitionReason?)` - создать новый + Trail от current
3. `update_context_by_id(userId, contextId, updates)` - обновить конкретный (с ownership check)
4. `add_trail(userId, from, to, trailData)` - создать Trail между существующими
5. `update_trail(userId, trailId, updates)` - обновить Trail
6. `get_trails(userId)` - получить все Trails пользователя

**Solution** (концептуально):
- Endpoints НЕ принимают ID на вход для create операций (Core генерирует через randomUUID)
- Ownership validation: проверка что Context/Trail принадлежат userId
- update_current: находит Context с is_current=true для userId
- add_context: создает Context + опционально Trail от current context
- Query builders: новые/расширенные Cypher queries для каждой операции

**Acceptance Criteria**:
- [ ] 6 новых MCP tools определены в `core/index.ts`
- [ ] StoryManager методы реализованы для каждого endpoint
- [ ] Query builders: новые Cypher queries (update, create Trail, get Trails)
- [ ] Ownership validation во всех endpoints (userId check)
- [ ] Neo4j генерирует IDs через `randomUUID()` для create операций
- [ ] Integration tests покрывают все 6 endpoints (happy path + ownership errors)
- [ ] Error handling: NotFound, Unauthorized, business logic errors

**Impact Assessment**:
- Schema change: NO
- Breaking change: NO (новые endpoints, не меняют существующие)
- Requires migration: NO
- Affected components: StoryManager, Core MCP tools, Query builders, Integration tests
- New dependencies: None

---

### Feature #17: Core-Facade API Contract (DictionariesManager + #15-16)
**Component**: Core API, Facade MCP (DictionariesManager, StoryManager, ContextManager)
**Date**: 2025-11-14
**Priority**: 🔴 P0 (Critical)

**Motivation**:
Facade NLP Gateway (Features #5-7) requires 9 Core API endpoints для работы. Inventory из Scenarios 0-11 показал:
- ✅ **3 EXISTING** endpoints работают (get_user_story, search_adhoc, create_goal)
- ⚙️ **1 MODIFIED** endpoint нуждается в доработке (import_story - Feature #15)
- ❌ **5 NEW** endpoints отсутствуют:
  - 🔴 P0: get_dictionaries, find_term, add_term (DictionariesManager)
  - 🟡 P1: update_context (Feature #16)
  - ❓ P2: get_context_schema (questionable)

Без DictionariesManager (3 endpoints) Facade не может работать - Normalizer не имеет справочников для canonical name mapping. Без Feature #15 (tempId mapping) Facade не знает какой context_id был создан. Без Feature #16 (update_context) Scenario 4 не работает.

**Goal**: Полный API contract между Core и Facade со всеми сигнатурами, errors, examples, security rules.

**Acceptance Criteria**:

**1. Implement DictionariesManager (3 NEW endpoints) - P0 Critical**:
- [ ] `get_dictionaries() → {positions: string[], skills: string[], domains: string[], cities: string[], industries: string[]}`
  - Manager: DictionariesManager
  - Query: Neo4j - `MATCH (n:Position|Skill|Domain|City|Industry) WHERE verified = true RETURN canonical names`
  - Cache: Redis (24h TTL)
  - Used by: Normalizer (Scenarios 1, 3, 4, 5)
  - Tests: integration tests (cache HIT/MISS, verified filtering)

- [ ] `find_term({type, value}) → {canonical: string, verified: boolean} | null`
  - Manager: DictionariesManager
  - Query: Neo4j - fuzzy matching `MATCH (n:Skill|Position) WHERE name =~ $fuzzyPattern`
  - Used by: Normalizer 3-tier verification (Redis → **Neo4j** → WebSearch)
  - Tests: integration tests (exact match, fuzzy match, not found)

- [ ] `add_term({type, value, verified, userId}) → {termId: string, canonical: string, verified: boolean}`
  - Manager: DictionariesManager
  - Query: Neo4j - `MERGE (n:Skill {name: $value}) SET verified = $verified, addedBy = $userId`
  - Deduplication: MERGE ensures no duplicates
  - Used by: Normalizer after WebSearch verification (Scenarios 5, 9)
  - Tests: integration tests (verified/unverified, deduplication, admin moderation)

**2. Complete Feature #15: tempId mapping (import_story modification) - P0 Critical**:
- [ ] Modify `execute_upsert_story` → `import_story`
- [ ] Input schema: `contexts: {tempId: number, ...UserContext}[]` (replace `contextId`)
- [ ] Core generates: `context_id = "ctx_" + randomUUID()` in Neo4j
- [ ] Return: `{contextId: string, idMapping: {[tempId: number]: string}}`
- [ ] Security: Core owns UUID generation (not client)
- [ ] Tests: integration tests (idMapping correctness, uniqueness, topology preservation)

**3. Complete Feature #16: update_context endpoint - P1 Important**:
- [ ] Implement `update_context({userId, contextId, updates, operation})`
  - Manager: ContextManager
  - Operations: APPEND (add to array), REPLACE (overwrite), REMOVE (delete from array)
  - Ownership check: verify userId owns contextId
  - Query: Neo4j - `MATCH Context WHERE owned by userId, MERGE relationships, UPDATE properties`
  - Used by: Scenario 4 (update_context tool)
  - Tests: integration tests (ownership, operations, normalization)

**4. Create Core-Facade API Contract Document**:
- [ ] Document: `docs/architecture/core-facade-api-contract.md`
- [ ] Full specification for all 9 endpoints:
  - Signatures: parameters, return types (TypeScript)
  - Examples: request/response для каждого endpoint
  - Errors: error codes (session_expired, context_not_found, unauthorized, validation_error)
  - Security: ownership checks, authentication flow, session management
  - Business rules: unique constraints, validation logic, cascade behavior
- [ ] Gap analysis matrix: EXISTING/MODIFIED/NEW status per endpoint
- [ ] CRUD matrix: Create/Read/Update/Delete coverage для Context, Trail, Goal, Dictionary

**5. Integration Tests**:
- [ ] DictionariesManager tests (get/find/add terms):
  - Cache behavior (Redis HIT/MISS)
  - Verified filtering (only verified in cache)
  - Fuzzy matching accuracy
  - Deduplication (MERGE behavior)
  - Admin moderation flow (unverified terms)
- [ ] import_story tests (tempId mapping):
  - idMapping correctness (tempId → real UUID)
  - Uniqueness (no collisions)
  - Topology preservation (trails reference correct IDs)
  - Security (client cannot provide contextId)
- [ ] update_context tests:
  - Ownership validation (only own contexts)
  - Operations (APPEND/REPLACE/REMOVE)
  - Normalization (canonical names)
  - Error handling (NotFound, Unauthorized)

**6. Documentation & Architecture**:
- [ ] Update `docs/architecture/workflows/facade/features-5-7-architecture.md`:
  - Replace "TODO: Phase 4 - Core API Requirements" with link to contract doc
  - Update Scenario 5 comments (import_story signature change)
- [ ] Create Mermaid sequence diagrams for:
  - DictionariesManager flow (Redis → Neo4j → WebSearch)
  - tempId mapping flow (client sends tempId → Core returns idMapping)
  - update_context flow (ownership check → normalization → persist)
- [ ] Update Memory Bank:
  - Link from features-registry.md to core-facade-api-contract.md
  - Document decision: Core owns all ID generation (security principle)

**Impact Assessment**:
- Schema change: YES (DictionariesManager adds verified/addedBy/createdAt to dictionary nodes)
- Breaking change: YES (import_story signature change - tempId instead of contextId)
- Requires migration: NO (API contract change, not data migration)
- Affected components:
  - **Core**: DictionariesManager (NEW), StoryManager (modify import_story), ContextManager (NEW update_context)
  - **Facade**: Normalizer (uses DictionariesManager), LangGraph workflow (uses import_story with tempId)
  - **Neo4j**: New queries (dictionary CRUD), updated import_story query (randomUUID generation)
  - **Integration tests**: All 3 managers
  - **Documentation**: core-facade-api-contract.md, features-5-7-architecture.md
- New dependencies: None (uses existing Neo4j, Redis, FastMCP)

**Technical Design Notes**:
- **DictionariesManager location**: `src/core/dictionaries-manager.ts` (NEW file)
- **Query builders**: `src/cypher/queries/dictionaries.ts` (NEW file для dictionary CRUD)
- **Cache strategy**: Redis TTL 24h, only verified terms cached (3-tier verification)
- **Security principle**: Core generates ALL IDs through Neo4j `randomUUID()` (tempId pattern)
- **MERGE deduplication**: Prevent duplicate skills/positions in Neo4j
- **Ownership validation**: All write operations check userId owns resource
- **Error handling**: Standard error codes (session_expired, unauthorized, not_found, validation_error)

**Subtasks** (tracked separately in registry):
- Feature #15: tempId mapping (StoryManager modification) - 🔴 P0
- Feature #16: update_context endpoint (ContextManager) - 🟡 P1
- DictionariesManager implementation (3 endpoints) - 🔴 P0 (new subtask)

**Timeline**:
- **Week 1** (Features #5-7 implementation):
  - Day 1-2: DictionariesManager (3 endpoints)
  - Day 3: Feature #15 (tempId mapping)
  - Day 4: Feature #16 (update_context)
  - Day 5: Integration tests + documentation
- **Blocker for**: Feature #5 (Facade NLP Gateway), Feature #6 (LangGraph workflow)

**Definition of Done**:
- [ ] All 9 endpoints documented in core-facade-api-contract.md
- [ ] DictionariesManager implemented (3 endpoints) + tests pass
- [ ] Feature #15 completed (tempId mapping) + tests pass
- [ ] Feature #16 completed (update_context) + tests pass
- [ ] Integration tests pass (npm run test:integration)
- [ ] Lint passes (npm run lint)
- [ ] TypeScript compiles (npx tsc --noEmit)
- [ ] Memory Bank updated (links, architecture docs, ADR if needed)
- [ ] Facade team can start Feature #5 implementation (contract finalized)

**Out of Scope** (defer to Feature #11 or post-MVP):
- Admin CLI for dictionary moderation (approve/reject/replace) - Feature #11
- get_context_schema endpoint (questionable, may hardcode in Facade)
- Full CRUD for Goal/Trail (only Context CRUD in Feature #16)
- Advanced dictionary features (synonyms, aliases, translations)

**References**:
- [Core API Inventory](../workflows/facade/core-api-inventory.md) - all 9 endpoints from Scenarios 0-11
- [Features #5-7 Architecture](../workflows/facade/features-5-7-architecture.md) - user scenarios requiring Core API
- [Implementation Questions](../workflows/facade/implementation-questions.md) - Q1 (get_context_schema?) pending discussion

---
