# 📋 Tasks Registry

## 🔥 Active (In Progress)

### Integration Tests Implementation
- [x] **Story Manager Tests** - Migrated 13/13 from archived ✅
- [ ] Implement AC2-AC6 (adhoc search tests - excludedFields, reasons, recency)
- [ ] Implement UN1-UN4 (user search without DTW)
- [ ] Implement DT1-DT5 (user search with DTW metrics)
- [ ] Implement TG1-TG7 (target search with FieldFilter)
- [ ] Implement G1-G5 (goals integration, sequential)

### Database Deployment (Later)
- [ ] Apply init.cypher migration to production Neo4j
- [ ] Verify all constraints and indexes
- [ ] Run data integrity checks

### Documentation & API
- [ ] Update API documentation with camelCase property names
- [ ] Create migration guide for API consumers
- [ ] Update internal architecture docs

## ✅ Recently Completed

### Session 2025-11-10 (Night): Story Manager Tests Migration
- [x] Study archived persistence tests structure (14 test cases)
- [x] Create vitest project config for story-manager (sequential, write operations)
- [x] Create setup file (beforeAll/beforeEach with DB cleanup)
- [x] Migrate CREATE tests (8 cases) - all relationships
- [x] Migrate UPDATE tests (2 cases) - properties + skills
- [x] Migrate TEMPORAL test (1 case) - previousContextId/nextContextId
- [x] Migrate VALIDATION tests (2 cases) - edge cases
- [x] Configure ESLint for tests (relaxed rules)
- [x] Fix all bugs - 13/13 tests passing ✅

**Files Created**: 2 (setup.ts, story-manager.integration.ts)
**Files Modified**: 2 (vitest.config.ts, eslint.config.mjs)
**Duration**: ~2 hours

### Session 2025-11-10 (Very Late Evening): Integration Test Post-Refactoring Fixes
- [x] Fix query pattern: search ALL contexts (removed currentContextId filter)
- [x] Fix LIMIT type error: toInteger($limit) in Cypher
- [x] Fix schema imports: PascalCase→camelCase (scoredMatchedCandidateSchema from shared)
- [x] Fix WHERE clause: moved after CALL block (Cypher syntax)
- [x] Fix variable conflict: rollback persistence-query-builder to short names (p/i/wd/s)
- [x] Fix parameter scope: $context→$ctx consistency
- [x] Update test: hardcoded userId→dynamic (TestDataManager)
- [x] **AC1 test PASSING** ✅ (1/1 tests green)

**Files Modified**: 5 (search-query-builder, search-manager, persistence-query-builder, snippets-extractor, test)
**Result**: Query returns 1 record (U2), score=1.0 (perfect match)

### Session 2025-11-10 (Late Evening): Query Builders Refactoring
- [x] PHASE 1: Mass rename Cypher variables to canonical names (8 files)
- [x] PHASE 2: Create cypher-snippets.ts with OPTIONAL_MATCH_CONTEXT_RELATIONSHIPS constant
- [x] PHASE 3: Replace duplicated OPTIONAL MATCH blocks in query builders (2 files, 3 places)
- [x] Fix naming conflict in target-query-builder.ts (InPath suffix pattern)
- [x] Validation: ESLint 0 errors, TypeScript 0 new errors

**Files Modified**: 10 (1 created, 9 updated)
**Code savings**: ~18 lines removed, 1 constant added (7 lines), net -11 lines

**Canonical Cypher variable names**:
- c→context, u→user, p→position, wd→workDomain, s→skill, i→industry, ci→city, co→country

**Architectural pattern**:
- Trajectory variables use `InPath` suffix when sharing scope with matched context (contextInPath, positionInPath, etc)
- OPTIONAL_MATCH_CONTEXT_RELATIONSHIPS constant for DRY principle

### Session 2025-11-10 (Evening): Integration Test Debugging
- [x] Fix test data enum values (position, creationReason) in U3, U6-U13
- [x] Fix Neo4j 5 GQL parameter issues (WITH scope, context→ctx)
- [x] Migrate schema imports from schemas-zod.ts to shared/schemas.ts
- [x] Update all schema names to camelCase (PascalCase→camelCase)
- [x] Fix property access: user_id→userId, context_id→contextId
- [x] Fix UPSERT_TRAILS_QUERY: fromContextId parameter
- [x] Test data loading validation (U1-U13 SUCCESS)
- [ ] **IN PROGRESS**: Fix Cypher WHERE syntax error (line 33 search-query-builder)

**Files Modified**: 13 (test data, query builders, managers, mappers, tests)

**Blockers Resolved**:
1. ZodError - Invalid enum values ✅
2. Neo4jError - Parameter scope in WITH ✅
3. Schema import errors - Unified to shared/schemas.ts ✅
4. Property naming - Consistent camelCase ✅

**Current Blocker**: Cypher syntax error "Invalid input 'WHERE' after FOREACH"

### Session 2025-11-10: ESLint Strict Configuration
- [x] Install eslint-plugin-import-x and eslint-plugin-unicorn
- [x] Configure strict naming conventions (camelCase enforcement)
- [x] Configure import organization (import-x/order with type-first)
- [x] Mass rename 108 schema variables (PascalCase→camelCase)
- [x] Mass rename 20+ object properties (snake_case→camelCase)
- [x] Fix 146 violations (async removal, top-level await, immutable sort, return types)
- [x] Migrate to preset-based config (importX.flatConfigs.recommended)
- [x] Move scope to package.json (elegant approach)
- [x] Remove inline re-export restriction
- [x] Disable import naming check
- [x] Validate: 0 errors, 16 warnings (only no-non-null-assertion)

**Files Modified**: 12+ (schemas, managers, servers, config, package.json)

### Session 2025-11-08: Naming Convention Migration (BREAKING CHANGE)
- [x] PHASE 1: Rename 80+ schema properties to camelCase - commit TBD
- [x] PHASE 2: Rename 3 MCP goal tools to snake_case - commit TBD
- [x] PHASE 3: Update 13 DB constraints to camelCase
- [x] PHASE 3: Update 13 DB indexes to camelCase
- [x] PHASE 3: Update 8 query builders to camelCase
- [x] PHASE 4: Validate with ESLint (0 errors)
- [x] PHASE 4: Validate with TypeScript (0 new errors)

**Breaking Changes Introduced**:
1. All TypeScript properties now camelCase (was mixed snake_case/camelCase)
2. All database properties now camelCase (was snake_case)
3. MCP tool names now snake_case (was camelCase: setGoal→set_goal, etc.)
4. Removed legacy properties: work_type, team_size

**Files Modified**: 20+

### Session 2025-11-08 (Earlier): SearchManager Schema Refactoring
- [x] Remove duplicate AdhocSearchParams schema
- [x] Move search schemas to shared layer (ContextField, SearchFilters, SearchByContextParams)
- [x] Make userId required everywhere for consistency
- [x] Extract DTW enrichment logic to separate method
- [x] Remove stale src/search-manager.ts file
- [x] Update imports in core-mcp-server.ts and rest-server.ts

**Files Modified**: 5

### Session 2025-11-07: TargetCriteria Refactoring (BREAKING CHANGE)
- [x] Migrate TargetCriteria to discriminated union pattern
- [x] Add FieldFilter to shared/schemas.ts (domain primitive)
- [x] Update Goals system (GoalSchema, CreateGoalInput, queries, manager)
- [x] Create snippet functions with null safety (buildSingularFieldCase, buildCollectedFieldCase)
- [x] Refactor target-query-builder.ts to Pattern 1
- [x] Test Cypher queries via MCP neo4j-cypher (6 test cases)
- [x] Agent reviews: planner + reviewer (8 critical issues fixed)
- [x] Create comprehensive refactoring plan document

**Breaking Changes Introduced**:
1. TargetSearchFilters API: `{desired: {}, undesired: {}}` → `{mode, values}`
2. Goals API: `CreateGoalInput.targetContextId` → `CreateGoalInput.targetCriteria`
3. Goal node: `g.desired, g.undesired` → `g.target_criteria`

**Files Modified**: 7

### Session 2025-11-06: Query Builder Pattern Updates
- [x] Rename query functions (remove `build` prefix)
- [x] Simplify buildResolveContextQuery to Pattern 1 (return string only)
- [x] Extract inline queries to named functions

**Commits**: 5

## 📝 Backlog (Future Work)

### Tech Debt
- [ ] Migrate legacy schemas-zod.ts to new core schemas
- [ ] Update Structurizr diagrams after naming convention migration
- [ ] Create backward compatibility mapper (if needed)
- [ ] Refactor Goals into separate domain service (if scaling)

### Features
- [ ] Add Redis caching for search results
- [ ] Implement batch export to Excel/CSV
- [ ] Add webhook notifications support
- [ ] Performance benchmarks for DTW algorithms
- [ ] Facade refactoring (when core + facade split into separate repos)

### Code Quality
- [ ] Write comprehensive integration tests for all search modes
- [ ] Add property-based testing (fast-check) for edge cases
- [ ] Performance profiling and optimization
- [ ] Security audit for API endpoints

---

## 📊 Completed This Quarter

| Task | Status | Session | Date |
|------|--------|---------|------|
| ESLint strict configuration | ✅ | 2025-11-10 | TODAY |
| Naming convention migration (PHASE 1-4) | ✅ | 2025-11-08 | 2 DAYS AGO |
| SearchManager schema consolidation | ✅ | 2025-11-08 | 2 DAYS AGO |
| TargetCriteria refactoring (discriminated union) | ✅ | 2025-11-07 | 3 DAYS AGO |
| Query Builder Pattern refactoring | ✅ | 2025-11-06 | 4 DAYS AGO |

---

*Last sync: 2025-11-10*
*Next: Database deployment + integration tests*
