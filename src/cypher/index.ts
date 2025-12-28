/**
 * Cypher Query Builders - Public Interface
 *
 * This module exposes ONLY query builder functions for Core layer.
 * Internal helpers and constants are deliberately hidden to protect business logic.
 *
 * Architecture principle: Minimal Public API
 * - ✅ Export: Query builder functions (complete Cypher queries)
 * - ❌ Hide: helpers/ (filters, aggregation, trajectory, relationships)
 * - ❌ Hide: constants/ (projections, scoring)
 *
 * When extracting to private Git submodule, this file will be the only
 * publicly visible interface while implementation details remain private.
 */

// Search queries
export {
  buildPathfinderSearchQuery,
  buildReversePathfinderSearchQuery,
  buildWaymatesSearchQuery,
  userCurrentContextIdQuery,
  userCurrentContextQuery,
} from "./queries/search.js";

// Goals queries
export { deleteGoalQuery, getUserGoalQuery, setGoalQuery } from "./queries/goals.js";

// Path collection queries
export { buildTrajectoryQuery } from "./queries/paths.js";

// Dictionaries queries
export { addSimpleTermQuery, addSkillQuery, getVerifiedDictionariesQuery } from "./queries/dictionaries.js";

// Persistence queries
export {
  CREATE_REASON_QUERY,
  DELETE_CONTEXT_QUERY,
  DELETE_STORY_QUERY,
  DELETE_TRAIL_QUERY,
  GET_USER_STORY_QUERY,
  LIST_REASONS_QUERY,
  UPSERT_CONTEXTS_QUERY,
  UPSERT_TRAILS_QUERY,
} from "./queries/persistence.js";
