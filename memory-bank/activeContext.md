# 🎯 Active Context

## Current Focus
**Module**: Schema + Cypher + TypeScript layer
**Feature**: Naming Convention Migration to camelCase (COMPLETED ✅)
**Status**: Full codebase migrated and validated
**Session**: 2025-11-08
**Last activity**: PHASE 4 validation completed, all changes committed

## Completed: Full Naming Convention Migration (camelCase)

### What Changed
Системная миграция от смешанного стиля (snake_case в DB, camelCase в API) к единому camelCase стилю по всему коду:

**Architecture**:
- TypeScript/API code: **camelCase** (idiomatic for JavaScript)
- Database properties: **camelCase** (Neo4j official recommendation)
- MCP tool names: **snake_case** (MCP community convention)

**Implementation**:
- PHASE 1: 80+ schema properties renamed
- PHASE 2: 3 MCP goal tools renamed to snake_case
- PHASE 3: 13 DB constraints + 13 indexes + 8 query builders updated
- PHASE 4: Full validation (ESLint 0 errors, TypeScript OK)

### Key Changes by Phase

#### PHASE 1: Schema Properties
Files modified: 10+
- `src/shared/schemas.ts` - Domain entities (UserContext, Trail, Schedule, Goals)
- `src/core/schemas.ts` - API response schemas (SearchResult, SkillsAnalysis, Reasons)
- `src/config.ts` - Configuration constants
- 7 more files with property access updates

#### PHASE 2: MCP Tool Names
File modified: 1 (src/core/core-mcp-server.ts)
- `setGoal` → `set_goal`
- `getUserGoal` → `get_user_goal`
- `deleteGoal` → `delete_goal`

#### PHASE 3: Database & Cypher
- `database/init.cypher` - 13 constraints + 13 indexes updated to camelCase
- 8 query builders updated:
  - src/core/search-query-builder.ts
  - src/core/target-query-builder.ts
  - src/core/goals-query-builder.ts
  - src/core/path-query-builder.ts
  - src/core/persistence-query-builder.ts
  - src/orcestrator/search-query-builder.ts
  - src/orcestrator/reason-query-builder.ts
  - src/persistence-query-builder.ts (legacy)

#### PHASE 4: Validation
- ✅ ESLint: 0 errors on all updated source files
- ✅ TypeScript: No new compilation errors in source code
- ✅ Property mappings: 22+ replacement rules applied
- ✅ Legacy properties removed: work_type, team_size cleaned up

### Files Modified Summary
- **Total files**: 20+
- **Schema properties renamed**: 80+
- **Database constraints updated**: 13
- **Database indexes updated**: 13
- **Query builders refactored**: 8
- **MCP tools renamed**: 3
- **Property mapping rules**: 22+

### Key Decisions Made
1. **camelCase for TypeScript code** - idiomatic and follows JS conventions
2. **camelCase for database properties** - Neo4j official recommendation
3. **snake_case for MCP tool names** - MCP community standard
4. **Unified across layers** - No inconsistency between domain and API
5. **Removed legacy properties** - work_type, team_size no longer referenced

### Validation Results
- ✅ ESLint: 0 errors (after fixing unused import)
- ✅ TypeScript: All schema changes compile correctly
- ✅ Cypher: All property references updated in 8 query builders
- ✅ Constraints: 13 constraints migrated to camelCase
- ✅ Indexes: 13 indexes migrated to camelCase

## Previous Context (2025-11-08)

### SearchManager Schema Refactoring (Завершено)
- Removed duplicate AdhocSearchParams schema
- Moved search schemas to shared layer (ContextField, SearchFilters, SearchByContextParams)
- Made userId required everywhere for consistency
- Extracted DTW enrichment to separate method
- Removed stale src/search-manager.ts file

**Files**: 5 modified | **Agent Reviews**: 0 | **Tests**: ESLint ✅, TypeScript ✅

### TargetCriteria Refactoring (2025-11-07)
Полная миграция от nested `{desired, undesired}` к discriminated union `{mode, values}`:
- FieldFilter as domain primitive in shared
- Empty arrays forbidden (.min(1) validation)
- Null safety in Cypher (WHEN $param IS NULL check)
- Query Builder Pattern 1 adopted
- Goals system updated with new API

**Files**: 7 modified | **Agent Reviews**: planner + reviewer | **Commits**: 2 | **Cypher tests**: 6/6 ✅

## Next Steps

### Immediate (High Priority)
1. Database Migration Script - Apply init.cypher to production (needs camelCase properties)
2. Data Migration - Update existing Neo4j nodes with camelCase properties
3. Integration Tests - Write tests for new naming convention
4. API Documentation - Update with camelCase property names

### Follow-up (Medium Priority)
5. Facade mapper updates (if needed)
6. Performance testing with new indices
7. Backward compatibility layer (if supporting old clients)

## Tech Stack Reminder
- **Database**: Neo4j with camelCase properties (official recommendation)
- **Query Language**: Cypher with map projection syntax
- **Runtime**: Node.js 20+ with ESM modules
- **Validation**: Zod schemas (camelCase throughout)
- **Testing**: Vitest + MCP neo4j-cypher for Cypher validation
- **Architecture**: Facade (MCP) + Core (logic)

## Open Questions
1. ~~Which naming convention to use?~~ → **Resolved**: camelCase for TypeScript/DB, snake_case for MCP tools
2. ~~How to handle database constraints?~~ → **Resolved**: Updated in init.cypher
3. Do we need backward compatibility layer? → TBD based on requirements
4. When to apply database migration? → Coordinate with DB team

---
*Last sync: 2025-11-08*
*Naming convention migration fully completed ✅*
*Ready for database deployment*
