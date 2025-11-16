/**
 * Cypher queries and helpers
 *
 * Architecture:
 * - constants/: Reusable constants (projections)
 * - helpers/: Query building blocks (relationships, aggregation, trajectory, scoring, filters)
 * - queries/: Complete query builders (search, goals, paths, persistence)
 */

// Queries
export { userCurrentContextQuery, userCurrentContextIdQuery } from "./queries/search.js";
export { setGoalQuery, getUserGoalQuery, deleteGoalQuery } from "./queries/goals.js";

// Helpers (for advanced usage)
export { buildOptionalMatchRelationships } from "./helpers/relationships.js";
export { buildWithCollect } from "./helpers/aggregation.js";
export { buildMatchPath, buildUnwindPath } from "./helpers/trajectory.js";
export {
  buildSkillsScoring,
  buildSimpleFieldScoring,
  buildArrayFieldScoring,
} from "./helpers/scoring.js";
export { buildStrictWhereClause, buildExcludedReasonsFilter } from "./helpers/filters.js";

// Constants
export { buildContextMapProjection } from "./constants/projections.js";
