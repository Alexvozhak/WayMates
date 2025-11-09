# 📋 Tasks Registry

## 🔥 Active (In Progress)

### Database Deployment
- [ ] Apply init.cypher migration to production Neo4j
- [ ] Verify all constraints and indexes were created
- [ ] Migrate existing node properties to camelCase
- [ ] Run data integrity checks after migration

### Integration & Quality Assurance
- [ ] Run integration tests against migrated database
- [ ] Update test fixtures to use camelCase properties
- [ ] Performance testing with new indexes
- [ ] Load testing for query performance

### Documentation & API
- [ ] Update API documentation with camelCase property names
- [ ] Create migration guide for API consumers
- [ ] Update internal architecture docs

## ✅ Recently Completed

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
| Naming convention migration (PHASE 1-4) | ✅ | 2025-11-08 | TODAY |
| SearchManager schema consolidation | ✅ | 2025-11-08 | TODAY |
| TargetCriteria refactoring (discriminated union) | ✅ | 2025-11-07 | YESTERDAY |
| Query Builder Pattern refactoring | ✅ | 2025-11-06 | 2 DAYS AGO |

---

*Last sync: 2025-11-08*
*Next: Database deployment + integration tests*
