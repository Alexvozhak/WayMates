/**
 * Search queries
 */

import { buildContextMapProjection } from "../constants/projections.js";
import { buildWithCollect } from "../helpers/aggregation.js";
import { buildExcludedReasonsFilter, buildStrictWhereClause } from "../helpers/filters.js";
import { buildOptionalMatchRelationships } from "../helpers/relationships.js";
import { buildMatchPath, buildUnwindPath } from "../helpers/trajectory.js";

import type { ContextField, TargetSearchParams } from "../../shared/schemas.js";

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
 * Get user's current context ID (lightweight query)
 *
 * Returns only contextId without enrichment
 *
 * Parameters:
 * - $userId: User ID (string)
 *
 * Returns:
 * - currentContextId: string | null
 *
 * @example
 * const query = userCurrentContextIdQuery();
 * const result = await tx.run(query, { userId: 'usr_123' });
 * const contextId = result.records[0].get('currentContextId');
 */
export function userCurrentContextIdQuery(): string {
  return `
MATCH (searchingUser:User {userId: $userId})
WHERE searchingUser.currentContextId IS NOT NULL
RETURN searchingUser.currentContextId AS currentContextId
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
 * - matchedPosition, matchedIndustry, matchedCity, matchedCountry
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
 * - candidateType: 'pathfinder' | 'waymate' | null
 *
 * @param goalPositions - Extracted position values from user's goal (null if no goal)
 * @param strictFields - Fields to match exactly
 * @param params - Query parameters (userId, recencyThresholdMonths, limit)
 * @param filterByCurrentContext - If true, filters by currentContextId (searchByUser). If false, searches all contexts (searchAdhoc)
 * @returns Complete Cypher query
 */
// eslint-disable-next-line complexity, max-lines-per-function -- Cypher query builder with conditional blocks
export function buildCurrentSearchQuery(
  goalPositions: string[] | null,
  strictFields: ContextField[],
  params: {
    userId?: string;
    recencyThresholdMonths?: number;
    limit: number;
  },
  filterByCurrentContext = false,
): string {
  const hasGoal = Boolean(goalPositions && params.userId);

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

  // Goal filtering CASE statement
  const goalFilterClause = hasGoal
    ? `
OPTIONAL MATCH (matchedUser)-[:HAS_GOAL]->(candidateGoal:Goal)

WITH matchedUser, matchedContext, matchedPosition, matchedDomains, matchedSkills, matchedLanguages, matchedIndustry, matchedCity, matchedCountry,
     timeSinceMatchedMonths, contextMatchScore,
     CASE
       // Pathfinder: candidate achieved user's desired position
       WHEN $goalPositions IS NOT NULL
            AND matchedPosition.canonicalName IN $goalPositions
       THEN 'pathfinder'
       // Waymate: candidate's goal contains at least one of user's desired positions (string matching)
       WHEN $goalPositions IS NOT NULL
            AND candidateGoal.targetCriteria IS NOT NULL
            AND ANY(goalPos IN $goalPositions
                    WHERE candidateGoal.targetCriteria CONTAINS ('"' + goalPos + '"'))
       THEN 'waymate'
       ELSE null
     END AS candidateType
    `
    : `
WITH matchedUser, matchedContext, matchedPosition, matchedDomains, matchedSkills, matchedLanguages, matchedIndustry, matchedCity, matchedCountry,
     timeSinceMatchedMonths, contextMatchScore,
     null AS candidateType
    `;

  return `
${buildMatchedContextBase(filterByCurrentContext)}

${whereClause}

WITH matchedUser, matchedContext, matchedPosition, matchedDomains, matchedSkills, matchedLanguages, matchedIndustry, matchedCity, matchedCountry,
     duration.between(datetime(matchedContext.createdAt), datetime()).months AS timeSinceMatchedMonths

${buildExcludedReasonsFilter("matchedContext", [
  "matchedUser",
  "matchedContext",
  "matchedPosition",
  "matchedDomains",
  "matchedSkills",
  "matchedLanguages",
  "matchedIndustry",
  "matchedCity",
  "matchedCountry",
  "timeSinceMatchedMonths",
])}

WITH matchedUser, matchedContext, matchedPosition, matchedDomains, matchedSkills, matchedLanguages, matchedIndustry, matchedCity, matchedCountry, timeSinceMatchedMonths,
     [skill IN matchedSkills WHERE NOT skill IN $referenceContext.skills] AS extraSkills

CALL (extraSkills) {
  UNWIND extraSkills AS extraSkill
  OPTIONAL MATCH (skill:Skill {canonicalName: extraSkill})-[:BELONGS_TO]->(sc:SkillCategory)
  RETURN collect({
    skill: extraSkill,
    penalty: coalesce(sc.penaltyMultiplier, 1.0)
  }) AS extraSkillsWithPenalty
}

WITH matchedUser, matchedContext, matchedPosition, matchedDomains, matchedSkills, matchedLanguages, matchedIndustry, matchedCity, matchedCountry, timeSinceMatchedMonths,
     reduce(penaltyScore = 0.0, extra IN extraSkillsWithPenalty |
       penaltyScore + extra.penalty
     ) AS skillsPenaltyScore

WITH matchedUser, matchedContext, matchedPosition, matchedDomains, matchedSkills, matchedLanguages, matchedIndustry, matchedCity, matchedCountry, timeSinceMatchedMonths,
     (1.0 - (skillsPenaltyScore / 100.0)) AS contextMatchScore

${goalFilterClause}

ORDER BY contextMatchScore DESC, timeSinceMatchedMonths ASC
LIMIT toInteger($limit)

RETURN matchedUser.userId AS userId,
       ${buildContextMapProjection("matched")} AS matchedContext,
       timeSinceMatchedMonths,
       contextMatchScore,
       candidateType
  `.trim();
}

/**
 * Build target search query with trajectory collection
 *
 * Finds candidates by target criteria (desired/undesired modes) and collects full trajectory
 * Used for Mode 4: Reverse Search (target-only)
 *
 * Target criteria use discriminated union pattern:
 * - FieldFilter { mode: 'desired' | 'undesired', values: string[] }
 * - Position: match if in desired list, exclude if in undesired list
 * - Domains/Skills: ANY match for desired, NONE match for undesired
 *
 * Trajectory collection:
 * - Traverses PREVIOUS_CONTEXT relationships backwards to first context
 * - Enriches each context in path with relationships
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
 * - matchedContext: Matched context object
 * - timeSinceMatchedMonths: Age of matched context
 * - path: Array of contexts (trajectory from first to matched)
 *
 * @param params - Target search parameters
 * @returns Complete Cypher query
 */
// eslint-disable-next-line max-lines-per-function -- Cypher query builder with conditional blocks
export function buildTargetSearchWithPathsQuery(params: TargetSearchParams): string {
  const { criteria, recencyThresholdMonths, excludedCreationReasons } = params;

  // Build WHERE conditions for target filtering
  const conditions: string[] = ["matchedUser.userId <> $userId"];

  // Position filter (if strict)
  if ("position" in criteria) {
    conditions.push(
      `
    CASE
      WHEN $position IS NULL THEN true
      WHEN $position.mode = 'desired' THEN matchedPosition.canonicalName IN $position.values
      WHEN $position.mode = 'undesired' THEN NOT matchedPosition.canonicalName IN $position.values
      ELSE true
    END`.trim(),
    );
  }

  // Country filter (if strict)
  if ("countryCode" in criteria) {
    conditions.push(
      `
    CASE
      WHEN $countries IS NULL THEN true
      WHEN $countries.mode = 'desired' THEN matchedCountry.name IN $countries.values
      WHEN $countries.mode = 'undesired' THEN NOT matchedCountry.name IN $countries.values
      ELSE true
    END`.trim(),
    );
  }

  // Domains filter (if strict)
  if ("domains" in criteria) {
    conditions.push(
      `
    CASE
      WHEN $domains IS NULL THEN true
      WHEN $domains.mode = 'desired' THEN ANY(item IN matchedDomains WHERE item IN $domains.values)
      WHEN $domains.mode = 'undesired' THEN NONE(item IN matchedDomains WHERE item IN $domains.values)
      ELSE true
    END`.trim(),
    );
  }

  // Skills filter (if strict)
  if ("skills" in criteria) {
    conditions.push(
      `
    CASE
      WHEN $skills IS NULL THEN true
      WHEN $skills.mode = 'desired' THEN ANY(item IN matchedSkills WHERE item IN $skills.values)
      WHEN $skills.mode = 'undesired' THEN NONE(item IN matchedSkills WHERE item IN $skills.values)
      ELSE true
    END`.trim(),
    );
  }

  // Languages filter (if strict)
  if ("languages" in criteria) {
    conditions.push(
      `
    CASE
      WHEN $languages IS NULL THEN true
      WHEN $languages.mode = 'desired' THEN ANY(item IN matchedLanguages WHERE item IN $languages.values)
      WHEN $languages.mode = 'undesired' THEN NONE(item IN matchedLanguages WHERE item IN $languages.values)
      ELSE true
    END`.trim(),
    );
  }

  // Recency filter (if specified)
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
${buildMatchedContextBase(false)}

${whereClause}

WITH matchedUser, matchedContext, matchedPosition, matchedDomains, matchedSkills, matchedLanguages, matchedIndustry, matchedCity, matchedCountry,
     duration.between(datetime(matchedContext.createdAt), datetime()).months AS timeSinceMatchedMonths

${buildMatchPath("matchedContext")}

${buildUnwindPath("matchedPathNodes", "matchedPathContext")}

${buildOptionalMatchRelationships("matchedPathContext")}

${buildWithCollect("matchedPathContext", ["matchedUser", "matchedContext", "matchedPosition", "matchedDomains", "matchedSkills", "matchedLanguages", "matchedIndustry", "matchedCity", "matchedCountry", "timeSinceMatchedMonths"])}

ORDER BY matchedPathContext.createdAt ASC

WITH matchedUser, matchedContext, matchedPosition, matchedDomains, matchedSkills, matchedLanguages, matchedIndustry, matchedCity, matchedCountry, timeSinceMatchedMonths,
     collect(${buildContextMapProjection("matchedPath")}) AS trajectory
${excludedReasonsCheck}

ORDER BY timeSinceMatchedMonths ASC
LIMIT toInteger($limit)

RETURN matchedUser.userId AS userId,
       ${buildContextMapProjection("matched")} AS matchedContext,
       timeSinceMatchedMonths,
       trajectory AS path
  `.trim();
}
