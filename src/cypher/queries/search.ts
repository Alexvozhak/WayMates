/**
 * Search queries
 */

import { buildContextMapProjection } from "../constants/projections.js";
import { buildWithCollect } from "../helpers/aggregation.js";
import {
  type CategoricalTargetField,
  buildExcludedReasonsFilter,
  buildStrictWhereClause,
  buildTargetFilterCase,
} from "../helpers/filters.js";
import { buildOptionalMatchRelationships } from "../helpers/relationships.js";
import { buildSkillsScoringBlock } from "../helpers/scoring.js";
import { buildFullTrajectoryFromUser, buildUnwindPath } from "../helpers/trajectory.js";

import type { ContextField, PathfinderSearchParams, TargetSearchParams } from "../../shared/schemas.js";

/**
 * Get user's current context with enrichment
 *
 * Returns single context object with all relationships resolved
 *
 * Parameters:
 * - $userId: User ID (string)
 *
 * Returns:
 * - context: UserContext object
 *
 * @example
 * const query = userCurrentContextQuery();
 * const result = await tx.run(query, { userId: 'usr_123' });
 * const context = result.records[0].get('context');
 */
export function userCurrentContextQuery(): string {
  return `
MATCH (searchingUser:User {userId: $userId})-[:HAS_CONTEXT]->(searchingContext:Context {contextId: searchingUser.currentContextId})
${buildOptionalMatchRelationships("searchingContext")}

${buildWithCollect("searchingContext")}

RETURN ${buildContextMapProjection("searching")} AS context
  `.trim();
}

/**
 * Build matched context base query
 *
 * Base MATCH + OPTIONAL MATCH for all candidates
 * Used as foundation for both current search and target search
 *
 * Returns variables in scope:
 * - matchedUser, matchedContext
 * - matchedPosition, matchedRole, matchedIndustry, matchedCity, matchedCountry, matchedEducationLevel
 * - matchedDomains (array), matchedSkills (array)
 *
 * @param filterByCurrentContext - If true, filters by currentContextId (searchByUser). If false, searches all contexts (searchAdhoc, searchByTarget)
 * @returns Cypher fragment
 */
export function buildMatchedContextBase(filterByCurrentContext = false): string {
  const contextFilter = filterByCurrentContext ? "{contextId: matchedUser.currentContextId}" : "";

  return `
MATCH (matchedUser:User)-[:HAS_CONTEXT]->(matchedContext:Context${contextFilter})
${buildOptionalMatchRelationships("matchedContext")}

${buildWithCollect("matchedContext", ["matchedUser"])}
  `.trim();
}

/**
 * Build current context search query with scoring
 *
 * Finds candidates by matching current context with scoring:
 * - Strict fields filtering (position, domains, industry, geo)
 * - Skills penalty-based scoring (NOT in WHERE clause!)
 * - Excluded creation reasons filter (CALL subquery)
 * - Goal-based candidate classification (pathfinder/waymate)
 * - Recency threshold filter
 *
 * Parameters:
 * - $userId: Searching user ID (for exclusion + goal filtering)
 * - $referenceContext: Reference context object for matching
 * - $excludedCreationReasons: Reasons to exclude from trajectories
 * - $limit: Max results
 * - $recencyThresholdMonths: (optional) Max age of matched context in months
 * - $goalPositions: (optional) Array of desired position names from user's goal
 *
 * Returns:
 * - userId: Matched user ID
 * - matchedContext: Context object with enrichment
 * - timeSinceMatchedMonths: Age of matched context
 * - contextMatchScore: Score based on skills penalty
 * - isWaymate: boolean (true if candidate has same goal)
 *
 * @param goalPositions - Extracted position values from user's goal (null if no goal)
 * @param strictFields - Fields to match exactly
 * @param params - Query parameters (userId, recencyThresholdMonths, limit)
 * @param filterByCurrentContext - If true, filters by currentContextId (searchByUser). If false, searches all contexts (searchAdhoc)
 * @returns Complete Cypher query
 */
// eslint-disable-next-line complexity, max-lines-per-function -- Cypher query builder with conditional blocks
export function buildWaymatesSearchQuery(
  goalPositions: string[] | null,
  strictFields: ContextField[],
  params: {
    userId?: string;
    recencyThresholdMonths?: number;
    limit: number;
    excludedContextFields: ContextField[];
  },
  filterByCurrentContext = false,
): string {
  const hasGoal = Boolean(goalPositions && params.userId);
  const skipSkillsPenalty = params.excludedContextFields.includes("skills");

  // WHERE clause: strict fields + userId exclusion + recency
  const strictWhere = buildStrictWhereClause(strictFields, "matchedContext", "$referenceContext");

  const additionalConditions: string[] = [];
  if (params.userId) {
    additionalConditions.push("matchedUser.userId <> $userId");
  }
  if (params.recencyThresholdMonths) {
    additionalConditions.push(
      "duration.between(datetime(matchedContext.createdAt), datetime()).months <= $recencyThresholdMonths",
    );
  }

  let whereClause = "";
  if (strictWhere && additionalConditions.length > 0) {
    // strictWhere already has WHERE, add AND + additional conditions
    whereClause = `${strictWhere} AND\n  ${additionalConditions.join(" AND\n  ")}`;
  } else if (strictWhere) {
    // Only strictWhere (already has WHERE)
    whereClause = strictWhere;
  } else if (additionalConditions.length > 0) {
    // No strictWhere, add WHERE + additional conditions
    whereClause = `WHERE ${additionalConditions.join(" AND\n  ")}`;
  }

  // Goal filtering: isWaymate classification
  // isWaymate = true when candidate has same goal as user (waymate = fellow traveler)
  // Note: pathfinders (who reached goal) are found via searchPathfinders, not here
  const goalFilterClause = hasGoal
    ? `
OPTIONAL MATCH (matchedUser)-[:HAS_GOAL]->(candidateGoal:Goal)

WITH matchedUser, matchedContext, matchedPosition, matchedRole, matchedDomains, matchedSkills, matchedCitizenships, matchedLanguages, matchedIndustry, matchedCity, matchedCountry, matchedEducationLevel,
     timeSinceMatchedMonths, contextMatchScore,
     // isWaymate: candidate has same goal as user (same destination)
     CASE
       WHEN $goalPositions IS NOT NULL
            AND candidateGoal.targetContext IS NOT NULL
            AND ANY(goalPos IN $goalPositions
                    WHERE candidateGoal.targetContext CONTAINS ('"' + goalPos + '"'))
       THEN true
       ELSE false
     END AS isWaymate
    `
    : `
WITH matchedUser, matchedContext, matchedPosition, matchedRole, matchedDomains, matchedSkills, matchedCitizenships, matchedLanguages, matchedIndustry, matchedCity, matchedCountry, matchedEducationLevel,
     timeSinceMatchedMonths, contextMatchScore,
     false AS isWaymate
    `;

  return `
${buildMatchedContextBase(filterByCurrentContext)}

${whereClause}

WITH matchedUser, matchedContext, matchedPosition, matchedRole, matchedDomains, matchedSkills, matchedCitizenships, matchedLanguages, matchedIndustry, matchedCity, matchedCountry, matchedEducationLevel,
     duration.between(datetime(matchedContext.createdAt), datetime()).months AS timeSinceMatchedMonths

${buildExcludedReasonsFilter("matchedContext", [
  "matchedUser",
  "matchedContext",
  "matchedPosition",
  "matchedRole",
  "matchedDomains",
  "matchedSkills",
  "matchedCitizenships",
  "matchedLanguages",
  "matchedIndustry",
  "matchedCity",
  "matchedCountry",
  "matchedEducationLevel",
  "timeSinceMatchedMonths",
])}

${
  skipSkillsPenalty
    ? `WITH matchedUser, matchedContext, matchedPosition, matchedRole, matchedDomains, matchedSkills, matchedCitizenships, matchedLanguages, matchedIndustry, matchedCity, matchedCountry, matchedEducationLevel, timeSinceMatchedMonths,
     0.0 AS contextMatchScore`
    : buildSkillsScoringBlock("$referenceContext", "matchedSkills", [
        "matchedUser",
        "matchedContext",
        "matchedPosition",
        "matchedRole",
        "matchedDomains",
        "matchedSkills",
        "matchedCitizenships",
        "matchedLanguages",
        "matchedIndustry",
        "matchedCity",
        "matchedCountry",
        "matchedEducationLevel",
        "timeSinceMatchedMonths",
      ])
}

${goalFilterClause}

ORDER BY contextMatchScore DESC, matchedUser.userId ASC, timeSinceMatchedMonths ASC
LIMIT toInteger($limit)

RETURN matchedUser.userId AS userId,
       ${buildContextMapProjection("matched")} AS matchedContext,
       timeSinceMatchedMonths,
       contextMatchScore,
       isWaymate
  `.trim();
}

/**
 * Build target search query with trajectory collection
 *
 * Finds candidates by target criteria (desired/undesired modes) and collects FULL trajectory.
 * Used for Mode 4: Reverse Search (target-only)
 *
 * Key behavior:
 * - matchedContext = context that matches target criteria (for filtering by position/skills/etc.)
 * - path = FULL trajectory from first context to CURRENT context (not just up to matchedContext)
 * - trails = learning paths between contexts
 *
 * Target criteria use discriminated union pattern:
 * - FieldFilter { mode: 'desired' | 'undesired', values: string[] }
 * - Position: match if in desired list, exclude if in undesired list
 * - Domains/Skills: ANY match for desired, NONE match for undesired
 *
 * Trajectory collection:
 * - Phase 1: Find contexts matching target criteria
 * - Phase 2: For each match, get user's CURRENT context
 * - Phase 3: Traverse from current backwards to get FULL trajectory
 * - Phase 4: Collect trails for each user
 * - Filters out trajectories with excluded reasons
 *
 * Parameters:
 * - $userId: Searching user ID (for exclusion)
 * - $position: FieldFilter for position (optional)
 * - $countries: FieldFilter for countries (optional)
 * - $domains: FieldFilter for domains (optional)
 * - $skills: FieldFilter for skills (optional)
 * - $recencyThresholdMonths: (optional) Max age of matched context
 * - $excludedCreationReasons: Reasons to exclude from trajectories
 * - $limit: Max results
 *
 * Returns:
 * - userId: Matched user ID
 * - matchedContext: Context that matched target criteria
 * - timeSinceMatchedMonths: Age of matched context
 * - path: Array of contexts (FULL trajectory from first to current)
 * - trails: Array of trails (learning paths between contexts)
 *
 * @param params - Target search parameters
 * @returns Complete Cypher query
 */
// eslint-disable-next-line max-lines-per-function -- Cypher query builder with conditional blocks
export function buildReversePathfinderSearchQuery(params: TargetSearchParams): string {
  const { targetContext, recencyThresholdMonths, excludedCreationReasons } = params;

  // Build WHERE conditions for target filtering
  const conditions: string[] = ["matchedUser.userId <> $userId"];

  // Target context field filters (categorical only, salary handled separately)
  const targetFields: CategoricalTargetField[] = [
    "position",
    "countries",
    "domains",
    "skills",
    "languages",
    "industries",
    "cities",
    "citizenships",
    "educationLevels",
  ];

  for (const field of targetFields) {
    if (targetContext[field]) {
      conditions.push(buildTargetFilterCase(field, `$${field}`));
    }
  }

  // Salary filter: candidate salary >= goal.salaryMin
  if (targetContext.salaryMin != null) {
    conditions.push(`CASE
      WHEN matchedContext.salaryMin IS NOT NULL THEN matchedContext.salaryMin >= $salaryMin
      WHEN matchedContext.salaryExact IS NOT NULL THEN matchedContext.salaryExact >= $salaryMin
      ELSE true
    END`);
  }

  // Recency filter (if specified) - filters matchedContext (target-matching context)
  if (recencyThresholdMonths) {
    conditions.push(
      "duration.between(datetime(matchedContext.createdAt), datetime()).months <= $recencyThresholdMonths",
    );
  }

  const whereClause = `WHERE ${conditions.join(" AND\n  ")}`;

  // Excluded reasons filter for trajectory
  const excludedReasonsCheck =
    excludedCreationReasons.length > 0
      ? `WHERE NOT ANY(ctx IN trajectory WHERE ANY(reason IN ctx.creationReason WHERE reason IN $excludedCreationReasons))`
      : "";

  return `
// Phase 1: Find contexts matching target criteria
${buildMatchedContextBase(false)}

${whereClause}

WITH matchedUser, matchedContext, matchedPosition, matchedRole, matchedDomains, matchedSkills, matchedCitizenships, matchedLanguages, matchedIndustry, matchedCity, matchedCountry, matchedEducationLevel,
     duration.between(datetime(matchedContext.createdAt), datetime()).months AS timeSinceMatchedMonths

// Phase 2-3: Get FULL trajectory from user's current context
${buildFullTrajectoryFromUser("matchedUser", ["matchedContext", "matchedPosition", "matchedRole", "matchedDomains", "matchedSkills", "matchedCitizenships", "matchedLanguages", "matchedIndustry", "matchedCity", "matchedCountry", "matchedEducationLevel", "timeSinceMatchedMonths"])}

${buildUnwindPath("matchedPathNodes", "matchedPathContext")}

${buildOptionalMatchRelationships("matchedPathContext")}

${buildWithCollect("matchedPathContext", ["matchedUser", "matchedContext", "matchedPosition", "matchedRole", "matchedDomains", "matchedSkills", "matchedCitizenships", "matchedLanguages", "matchedIndustry", "matchedCity", "matchedCountry", "matchedEducationLevel", "timeSinceMatchedMonths"])}

ORDER BY matchedPathContext.createdAt ASC

WITH matchedUser, matchedContext, matchedPosition, matchedRole, matchedDomains, matchedSkills, matchedCitizenships, matchedLanguages, matchedIndustry, matchedCity, matchedCountry, matchedEducationLevel, timeSinceMatchedMonths,
     collect(${buildContextMapProjection("matchedPath")}) AS trajectory

// Phase 4: Collect trails for this user
CALL {
  WITH matchedUser
  OPTIONAL MATCH (matchedUser)-[:HAS_TRAIL]->(t:Trail)
  WITH t {
    .trailId,
    .skill,
    .platform,
    .fromContextId,
    .toContextId,
    .totalDurationWeeks,
    .costUsd,
    .ratingCourse,
    .ratingPlatform,
    .ratingSchedule,
    .courseName,
    .courseLink,
    .userFeedback,
    schedule: CASE
      WHEN t.sessionsPerWeek IS NOT NULL OR t.hoursPerSession IS NOT NULL
      THEN { sessionsPerWeek: t.sessionsPerWeek, hoursPerSession: t.hoursPerSession }
      ELSE null
    END
  } AS trail
  WHERE trail.trailId IS NOT NULL
  RETURN collect(trail) AS trails
}

WITH matchedUser, matchedContext, matchedPosition, matchedRole, matchedDomains, matchedSkills, matchedCitizenships, matchedLanguages, matchedIndustry, matchedCity, matchedCountry, matchedEducationLevel,
     timeSinceMatchedMonths, trajectory, trails
${excludedReasonsCheck}

ORDER BY timeSinceMatchedMonths ASC
LIMIT toInteger($limit)

RETURN matchedUser.userId AS userId,
       ${buildContextMapProjection("matched")} AS matchedContext,
       timeSinceMatchedMonths,
       trajectory AS path,
       trails
  `.trim();
}

/**
 * Pathfinder search query (path/trails collected separately via PathCollectorService).
 *
 * @param params - Pathfinder search parameters
 * @param strictFields - Fields to match exactly for reference context
 * @returns Cypher query returning PathfinderCandidateLight
 */
// eslint-disable-next-line max-lines-per-function -- Cypher query builder with conditional blocks
export function buildPathfinderSearchQuery(params: PathfinderSearchParams, strictFields: ContextField[]): string {
  const { targetContext, targetRecencyMonths, referenceRecencyMonths } = params;

  // === PHASE 1: Target matching conditions ===
  const targetConditions: string[] = ["matchedUser.userId <> $userId"];

  // Target context field filters (categorical only, salary handled separately)
  const targetFilterFields: CategoricalTargetField[] = [
    "position",
    "role",
    "countries",
    "domains",
    "skills",
    "languages",
    "industries",
    "cities",
    "citizenships",
    "educationLevels",
  ];

  for (const field of targetFilterFields) {
    if (targetContext[field]) {
      targetConditions.push(buildTargetFilterCase(field, `$${field}`));
    }
  }

  // Salary filter: candidate salary >= goal.salaryMin
  if (targetContext.salaryMin != null) {
    targetConditions.push(`CASE
      WHEN matchedContext.salaryMin IS NOT NULL THEN matchedContext.salaryMin >= $salaryMin
      WHEN matchedContext.salaryExact IS NOT NULL THEN matchedContext.salaryExact >= $salaryMin
      ELSE true
    END`);
  }

  if (targetRecencyMonths) {
    targetConditions.push(
      "duration.between(datetime(matchedContext.createdAt), datetime()).months <= $targetRecencyMonths",
    );
  }

  const targetWhereClause = `WHERE ${targetConditions.join(" AND\n  ")}`;

  // === Reference matching ===
  const referenceStrictWhere = buildStrictWhereClause(strictFields, "refContext", "$referenceContext");
  const referenceRecencyCondition = referenceRecencyMonths
    ? "AND duration.between(datetime(refContext.createdAt), datetime()).months <= $referenceRecencyMonths"
    : "";

  return `
// Phase 1: Find contexts matching TARGET criteria (our goal)
${buildMatchedContextBase(false)}

${targetWhereClause}

WITH matchedUser, matchedContext, matchedPosition, matchedRole, matchedDomains, matchedSkills, matchedCitizenships, matchedLanguages, matchedIndustry, matchedCity, matchedCountry, matchedEducationLevel,
     duration.between(datetime(matchedContext.createdAt), datetime()).months AS timeSinceTargetMonths

// Phase 2: Find REFERENCE context (where they were like us, before target)
MATCH (matchedUser)-[:HAS_CONTEXT]->(refContext:Context)
${buildOptionalMatchRelationships("refContext")}

${buildWithCollect("refContext", ["matchedUser", "matchedContext", "matchedPosition", "matchedRole", "matchedDomains", "matchedSkills", "matchedCitizenships", "matchedLanguages", "matchedIndustry", "matchedCity", "matchedCountry", "matchedEducationLevel", "timeSinceTargetMonths"])}

${referenceStrictWhere ? referenceStrictWhere + " AND" : "WHERE"}
  refContext.createdAt < matchedContext.createdAt
  ${referenceRecencyCondition}

WITH matchedUser, matchedContext, matchedPosition, matchedRole, matchedDomains, matchedSkills, matchedCitizenships, matchedLanguages, matchedIndustry, matchedCity, matchedCountry, matchedEducationLevel, timeSinceTargetMonths,
     refContext, refPosition, refRole, refDomains, refSkills, refCitizenships, refLanguages, refIndustry, refCity, refCountry, refEducationLevel,
     duration.between(datetime(refContext.createdAt), datetime()).months AS timeSinceMatchedMonths
ORDER BY matchedUser.userId, matchedContext.contextId, refContext.createdAt ASC

// Deduplicate: keep oldest refContext per (user, targetContext)
WITH matchedUser, matchedContext, matchedPosition, matchedRole, matchedDomains, matchedSkills, matchedCitizenships, matchedLanguages, matchedIndustry, matchedCity, matchedCountry, matchedEducationLevel, timeSinceTargetMonths,
     collect({
       refContext: refContext, refPosition: refPosition, refRole: refRole, refDomains: refDomains,
       refSkills: refSkills, refCitizenships: refCitizenships, refLanguages: refLanguages, refIndustry: refIndustry, refCity: refCity, refCountry: refCountry, refEducationLevel: refEducationLevel,
       timeSinceMatchedMonths: timeSinceMatchedMonths
     })[0] AS ref

// Unpack ref map
WITH matchedUser, matchedContext, matchedPosition, matchedRole, matchedDomains, matchedSkills, matchedCitizenships, matchedLanguages, matchedIndustry, matchedCity, matchedCountry, matchedEducationLevel, timeSinceTargetMonths,
     ref.refContext AS refContext, ref.refPosition AS refPosition, ref.refRole AS refRole, ref.refDomains AS refDomains,
     ref.refSkills AS refSkills, ref.refCitizenships AS refCitizenships, ref.refLanguages AS refLanguages, ref.refIndustry AS refIndustry, ref.refCity AS refCity, ref.refCountry AS refCountry, ref.refEducationLevel AS refEducationLevel,
     ref.timeSinceMatchedMonths AS timeSinceMatchedMonths

// Skills scoring on refContext (where they were like us)
${buildSkillsScoringBlock("$referenceContext", "refSkills", [
  "matchedUser",
  "matchedContext",
  "matchedPosition",
  "matchedRole",
  "matchedDomains",
  "matchedSkills",
  "matchedCitizenships",
  "matchedLanguages",
  "matchedIndustry",
  "matchedCity",
  "matchedCountry",
  "matchedEducationLevel",
  "timeSinceTargetMonths",
  "refContext",
  "refPosition",
  "refRole",
  "refDomains",
  "refSkills",
  "refCitizenships",
  "refLanguages",
  "refIndustry",
  "refCity",
  "refCountry",
  "refEducationLevel",
  "timeSinceMatchedMonths",
])}

ORDER BY contextMatchScore DESC, timeSinceTargetMonths ASC, timeSinceMatchedMonths DESC
LIMIT toInteger($limit)

// Return without path/trails (collected separately via PathCollectorService)
RETURN matchedUser.userId AS userId,
       ${buildContextMapProjection("ref")} AS matchedContext,
       timeSinceMatchedMonths,
       contextMatchScore,
       ${buildContextMapProjection("matched")} AS targetContext,
       timeSinceTargetMonths
  `.trim();
}
