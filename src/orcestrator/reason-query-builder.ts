import type {
  ContextField,
  FlexibleField,
} from "../schemas-zod.js";
import {
  buildCurrentContextStrictConditions,
  buildCurrentContextFlexibleConditions,
} from "./snippets-extractor.js";

/**
 * Build reason-based query for current-only search
 *
 * This query:
 * 1. Finds similar users based on currentContext compatibility
 * 2. Looks ahead N months using -[:NEXT*]-> temporal navigation
 * 3. Filters by required/excluded reasons in creation_reason property
 * 4. Groups by exact reason combinations
 * 5. Calculates aggregate statistics for each combination
 * 6. Returns top combinations with sample users (graph-based)
 *
 * Note: This query uses hardcoded LIMIT 20 for reason combinations.
 * For filtering individual candidates, use regular current-only search instead.
 *
 * Neo4j parameters (passed at query execution):
 * - $currentContext: UserContext
 * - $currentUserId: string
 * - $lookaheadMonths: number
 * - $requiredReasons: string[]
 * - $excludedReasons: string[]
 */
export function buildReasonBasedQuery(
  orderedStrictFields: ContextField[],
  flexibleFields: FlexibleField[]
): string {
  // Build compatibility scoring using existing builders
  const whereClause = buildCurrentContextStrictConditions(orderedStrictFields);
  const scoreClause = buildCurrentContextFlexibleConditions(flexibleFields);

  // Reason filtering with null safety
  const reasonFilters = `WHERE coalesce(futureContext.creation_reason, []) IS NOT NULL
  AND all(req IN $requiredReasons WHERE req IN coalesce(futureContext.creation_reason, []))
  AND none(excl IN $excludedReasons WHERE excl IN coalesce(futureContext.creation_reason, []))`;

  const query = `
/* ============================================
 * REASON-BASED CURRENT-ONLY SEARCH
 * Neo4j parameters: $currentContext, $currentUserId, $lookaheadMonths, $requiredReasons, $excludedReasons
 * ============================================ */

// === STEP 1: Find similar candidates based on current context ===
MATCH (candidateUser:User)-[:HAS_CONTEXT]->(candidateContext:Context)
WHERE
  $currentContext IS NOT NULL
  AND candidateUser.user_id <> $currentUserId
  ${whereClause ? `AND ${whereClause}` : ""}

// === STEP 2: Calculate compatibility score ===
WITH *, ${scoreClause}

WITH *,
  candidateUser,
  candidateContext,
  contextCompatibilityScore AS currentContextCompatibilityScore
WHERE candidateUser IS NOT NULL

// === STEP 3: Lookahead N months via temporal navigation ===
// Use path to get relationships, then calculate duration
MATCH path = (candidateContext)-[:NEXT*1..10]->(futureContext:Context)
WITH *,
  relationships(path) AS rels,
  futureContext

// Calculate total duration from start to future context
WITH *,
  reduce(months = 0, rel IN rels |
    months + coalesce(rel.duration_months, 0)
  ) AS totalDurationMonths

// Filter by lookahead window (± 1 month tolerance)
WHERE totalDurationMonths >= $lookaheadMonths - 1
  AND totalDurationMonths <= $lookaheadMonths + 1

// === STEP 4: Filter by required/excluded reasons ===
${reasonFilters}

// === STEP 5: Group by exact reason combination ===
WITH futureContext.creation_reason AS reasonCombination,
  collect({
    user: candidateUser,
    start_context: candidateContext,
    future_context: futureContext,
    duration_months: totalDurationMonths,
    match_score: currentContextCompatibilityScore
  }) AS users_data

// === STEP 6: Calculate statistics for each combination ===
WITH reasonCombination,
  size(users_data) AS users_count,
  users_data
WHERE users_count > 0  // Skip empty groups

WITH reasonCombination,
  users_count,
  users_data,

  // Duration stats (safe division)
  CASE users_count
    WHEN 0 THEN 0.0
    ELSE reduce(sum = 0.0, u IN users_data | sum + u.duration_months) / users_count
  END AS avg_duration,
  percentileCont([u IN users_data | u.duration_months], 0.5) AS median_duration,

  // Position distribution
  [u IN users_data | u.future_context.position] AS all_positions,

  // Skills gained (flatten first, deduplicate with UNWIND + DISTINCT)
  reduce(allSkillsFlat = [], u IN users_data |
    allSkillsFlat + coalesce(u.future_context.skills, [])
  ) AS all_skills_with_dups

// Deduplicate skills efficiently
UNWIND all_skills_with_dups AS skill
WITH reasonCombination, users_count, users_data, avg_duration, median_duration, all_positions,
  collect(DISTINCT skill) AS all_skills

// Calculate position frequencies manually (no APOC)
UNWIND all_positions AS position
WITH reasonCombination, users_count, users_data, avg_duration, median_duration, all_skills,
  position, count(*) AS position_count
ORDER BY position_count DESC
WITH reasonCombination, users_count, users_data, avg_duration, median_duration, all_skills,
  collect({position: position, count: position_count}) AS target_positions_list

// === STEP 7: Build result structure ===
// Sort combinations by popularity (users_count DESC)
WITH reasonCombination,
  users_count,
  {
    avg_duration_months: avg_duration,
    median_duration: median_duration,
    target_positions: target_positions_list,
    common_skills_gained: all_skills[0..10]
  } AS stats,
  users_data
ORDER BY users_count DESC
LIMIT 20

// === STEP 8: Build sample users with graph structure ===
// For each combination, take top 3 users by match_score
UNWIND users_data[0..3] AS sample_user_data

WITH reasonCombination,
  users_count,
  stats,
  collect({
    user_id: sample_user_data.user.user_id,
    match_score: sample_user_data.match_score,
    user_graph: {
      user: {
        user_id: sample_user_data.user.user_id,
        birth_year: sample_user_data.user.birth_year
      },
      matched_context: sample_user_data.start_context {
        .context_id,
        .position,
        .domains,
        .skills,
        .industry,
        .company_size,
        .country_code,
        .city_name,
        .work_type,
        .citizenships,
        .team_size,
        .creation_reason
      },
      related_context: sample_user_data.future_context {
        .context_id,
        .position,
        .domains,
        .skills,
        .industry,
        .company_size,
        .country_code,
        .city_name,
        .work_type,
        .citizenships,
        .team_size,
        .creation_reason
      }
    }
  }) AS sample_users

// === STEP 9: Return reason combinations ===
RETURN {
  combination: reasonCombination,
  users_count: users_count,
  stats: stats,
  sample_users: sample_users
} AS reason_combination_result
`;

  return query;
}

/**
 * Build query to list all available reasons (for AI)
 */
export function buildListReasonsQuery(): string {
  return `
MATCH (r:Reason)
RETURN {
  reason_id: r.reason_id,
  description: r.description,
  patterns: r.patterns,
  common_combinations: r.common_combinations,
  examples: r.examples
} AS reason
ORDER BY r.reason_id
`;
}

/**
 * Build query to create a new reason (when AI encounters unknown reason)
 *
 * Parameters passed via Neo4j query parameters:
 * - $reasonId: string
 * - $description: string
 * - $patterns: string[]
 * - $examples: string[]
 * - $contextId: string
 */
export function buildCreateReasonQuery(): string {
  return `
MERGE (r:Reason {reason_id: $reasonId})
SET r.description = $description,
    r.patterns = $patterns,
    r.examples = $examples,
    r.common_combinations = [],
    r.created_at = datetime(),
    r.created_by = 'ai_agent',
    r.first_context_id = $contextId
RETURN r
`;
}
