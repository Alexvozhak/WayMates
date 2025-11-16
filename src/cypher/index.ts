/**
 * Cypher queries and helpers
 *
 * Architecture:
 * - constants/: Reusable constants (projections)
 * - helpers/: Query building blocks (relationships, aggregation, trajectory, scoring, filters)
 * - queries/: Complete query builders (search, goals, paths, persistence)
 */

// Queries
export { userCurrentContextIdQuery, userCurrentContextQuery } from "./queries/search.js";
export { deleteGoalQuery, getUserGoalQuery, setGoalQuery } from "./queries/goals.js";

// Helpers (for advanced usage)
export { buildOptionalMatchRelationships } from "./helpers/relationships.js";
export { buildWithCollect } from "./helpers/aggregation.js";
export { buildMatchPath, buildUnwindPath } from "./helpers/trajectory.js";
export {
  buildArrayFieldScoring,
  buildSimpleFieldScoring,
  buildSkillsScoring,
} from "./helpers/scoring.js";
export { buildExcludedReasonsFilter, buildStrictWhereClause } from "./helpers/filters.js";

// Constants
export { buildContextMapProjection } from "./constants/projections.js";
