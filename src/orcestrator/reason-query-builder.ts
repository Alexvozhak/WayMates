import type { ContextField, FlexibleField } from "../schemas-zod.js";
import {
  buildContextStrictConditions,
  buildContextFlexibleConditions,
} from "./snippets-extractor.js";

/**
 * Build reason-based query for current-only or target-only search
 *
 * This query:
 * 1. Finds similar users based on context compatibility
 * 2. Navigates temporally (forward or backward) N months
 * 3. Filters by required/excluded reasons in creation_reason property
 * 4. Groups by exact reason combinations
 * 5. Calculates aggregate statistics for each combination
 * 6. Returns top combinations with sample users (graph-based)
 *
 * Direction semantics:
 * - forward (current-only): Match current → look ahead to future contexts
 * - backward (target-only): Match target → look back to previous contexts
 *
 * Note: This query uses hardcoded LIMIT 20 for reason combinations.
 * For filtering individual candidates, use regular search instead.
 *
 * Neo4j parameters (passed at query execution):
 * - $searchContext: UserContext (current for forward, target for backward)
 * - $currentUserId: string
 * - $periodMonths: number (lookahead for forward, lookback for backward)
 * - $requiredReasons: string[]
 * - $excludedReasons: string[]
 */
export function buildReasonBasedQuery(
  orderedStrictFields: ContextField[],
  flexibleFields: FlexibleField[],
  direction: "forward" | "backward" = "forward"
): string {
  // Determine variable naming and path based on direction
  const isForward = direction === "forward";
  const searchParam = "$searchContext";
  const matchedVar = "matchedContext";
  const relatedVar = "relatedContext";
  const scoreAlias = "matchScore";

  // Build compatibility scoring using universal builders
  const whereClause = buildContextStrictConditions(
    orderedStrictFields,
    matchedVar,
    searchParam
  );
  const scoreClause = buildContextFlexibleConditions(
    flexibleFields,
    matchedVar,
    searchParam,
    scoreAlias
  );

  // Path pattern and grouping depend on direction
  const pathPattern = isForward
    ? `(${matchedVar})-[:NEXT*1..10]->(${relatedVar}:Context)`
    : `(${relatedVar}:Context)-[:NEXT*1..10]->(${matchedVar})`;

  // For forward: group by relatedContext.creation_reason (future events)
  // For backward: group by matchedContext.creation_reason (target's own creation reasons)
  const reasonGroupingVar = isForward ? relatedVar : matchedVar;

  // Reason filtering with null safety and empty array handling
  const reasonFilters = `AND size(coalesce(${reasonGroupingVar}.creation_reason, [])) > 0
  AND (size($requiredReasons) = 0 OR all(req IN $requiredReasons WHERE req IN coalesce(${reasonGroupingVar}.creation_reason, [])))
  AND (size($excludedReasons) = 0 OR none(excl IN $excludedReasons WHERE excl IN coalesce(${reasonGroupingVar}.creation_reason, [])))`;

  const directionLabel = isForward
    ? "CURRENT-ONLY (FORWARD)"
    : "TARGET-ONLY (BACKWARD)";
  const stepLabel = isForward ? "lookahead" : "lookback";

  const query = `
/* ============================================
 * REASON-BASED ${directionLabel} SEARCH
 * Neo4j parameters: $searchContext, $currentUserId, $periodMonths, $requiredReasons, $excludedReasons
 * ============================================ */

// === STEP 1: Find similar candidates based on context compatibility ===
MATCH (user:User)-[:HAS_CONTEXT]->(${matchedVar}:Context)
WHERE
  $searchContext IS NOT NULL
  AND user.user_id <> $currentUserId
  ${whereClause ? `AND ${whereClause}` : ""}

// === STEP 2: Calculate compatibility score ===
WITH *, ${scoreClause}

WITH *,
  user,
  ${matchedVar},
  ${scoreAlias}
WHERE user IS NOT NULL

// === STEP 3: Temporal navigation (${stepLabel} N months) ===
// Use SHORTEST path to avoid duplicates (Neo4j 5+)
MATCH SHORTEST 1 ${pathPattern}
WITH *,
  ${relatedVar},
  // For forward: duration from matched (earlier) to related (later)
  // For backward: duration from related (earlier) to matched (later)
  duration.inMonths(
    datetime(${isForward ? matchedVar : relatedVar}.created_at),
    datetime(${isForward ? relatedVar : matchedVar}.created_at)
  ).months AS durationMonths

// Filter by period window (± 1 month tolerance)
WHERE durationMonths >= $periodMonths - 1
  AND durationMonths <= $periodMonths + 1

// === STEP 4: Filter by required/excluded reasons ===
${reasonFilters}

// === STEP 5: Group by exact reason combination ===
WITH ${reasonGroupingVar}.creation_reason AS reasonCombination,
  collect({
    user: user,
    matched_context: ${matchedVar},
    related_context: ${relatedVar},
    duration_months: durationMonths,
    match_score: ${scoreAlias}
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
    ELSE reduce(sum = 0.0, u IN users_data | sum + toFloat(u.duration_months)) / users_count
  END AS avg_duration,

  // Position distribution (from related context - future for forward, previous for backward)
  [u IN users_data | u.related_context.position] AS all_positions,

  // Skills gained (flatten first, deduplicate with UNWIND + DISTINCT)
  reduce(allSkillsFlat = [], u IN users_data |
    allSkillsFlat + coalesce(u.related_context.skills, [])
  ) AS all_skills_with_dups,

  // Extract durations for median calculation
  [u IN users_data | u.duration_months] AS all_durations

// Calculate median manually by sorting durations
UNWIND all_durations AS duration_val
WITH reasonCombination, users_count, users_data, avg_duration, all_positions, all_skills_with_dups,
  duration_val
ORDER BY duration_val
WITH reasonCombination, users_count, users_data, avg_duration, all_positions, all_skills_with_dups,
  collect(toFloat(duration_val)) AS sorted_durations
WITH reasonCombination, users_count, users_data, avg_duration, all_positions, all_skills_with_dups,
  CASE
    WHEN size(sorted_durations) = 0 THEN 0.0
    WHEN size(sorted_durations) % 2 = 1
      THEN sorted_durations[size(sorted_durations) / 2]
    ELSE (sorted_durations[size(sorted_durations) / 2 - 1] + sorted_durations[size(sorted_durations) / 2]) / 2.0
  END AS median_duration_months

// Deduplicate skills efficiently
UNWIND all_skills_with_dups AS skill
WITH reasonCombination, users_count, users_data, avg_duration, median_duration_months, all_positions,
  collect(DISTINCT skill) AS all_skills

// Calculate position frequencies manually (no APOC)
UNWIND all_positions AS position
WITH reasonCombination, users_count, users_data, avg_duration, median_duration_months, all_skills,
  position, count(*) AS position_count
ORDER BY position_count DESC
WITH reasonCombination, users_count, users_data, avg_duration, median_duration_months, all_skills,
  collect({position: position, count: position_count}) AS target_positions_list

// === STEP 7: Build result structure ===
// Sort combinations by popularity (users_count DESC)
WITH reasonCombination,
  users_count,
  {
    avg_duration_months: avg_duration,
    median_duration_months: median_duration_months,
    target_positions: target_positions_list,
    common_skills_gained: all_skills[0..10]
  } AS stats,
  users_data
ORDER BY users_count DESC
LIMIT 20

// === STEP 8: Build sample users with graph structure ===
// For each combination, take top 3 users by match_score
WITH reasonCombination, users_count, stats, users_data
UNWIND users_data AS u
WITH reasonCombination, users_count, stats, u
ORDER BY u.match_score DESC
WITH reasonCombination, users_count, stats, collect(u)[0..3] AS top_users
UNWIND top_users AS sample_user_data

// Prepare context maps with explicit fields (Neo4j doesn't support excluding keys from maps)
WITH reasonCombination, users_count, stats,
  collect({
    user_id: sample_user_data.user.user_id,
    match_score: sample_user_data.match_score,
    user_graph: {
      user: {
        user_id: sample_user_data.user.user_id,
        birth_year: sample_user_data.matched_context.birth_year
      },
      matched_context: {
        context_id: sample_user_data.matched_context.context_id,
        previous_context_id: sample_user_data.matched_context.previous_context_id,
        next_context_id: sample_user_data.matched_context.next_context_id,
        created_at: toString(sample_user_data.matched_context.created_at),
        creation_reason: sample_user_data.matched_context.creation_reason,
        position: sample_user_data.matched_context.position,
        domains: sample_user_data.matched_context.domains,
        skills: sample_user_data.matched_context.skills,
        industry: sample_user_data.matched_context.industry,
        company_size: sample_user_data.matched_context.company_size,
        country_code: sample_user_data.matched_context.country_code,
        city_name: sample_user_data.matched_context.city_name,
        work_type: sample_user_data.matched_context.work_type,
        citizenships: sample_user_data.matched_context.citizenships,
        team_size: sample_user_data.matched_context.team_size,
        birth_year: sample_user_data.matched_context.birth_year
      },
      related_context: {
        context_id: sample_user_data.related_context.context_id,
        previous_context_id: sample_user_data.related_context.previous_context_id,
        next_context_id: sample_user_data.related_context.next_context_id,
        created_at: toString(sample_user_data.related_context.created_at),
        creation_reason: sample_user_data.related_context.creation_reason,
        position: sample_user_data.related_context.position,
        domains: sample_user_data.related_context.domains,
        skills: sample_user_data.related_context.skills,
        industry: sample_user_data.related_context.industry,
        company_size: sample_user_data.related_context.company_size,
        country_code: sample_user_data.related_context.country_code,
        city_name: sample_user_data.related_context.city_name,
        work_type: sample_user_data.related_context.work_type,
        citizenships: sample_user_data.related_context.citizenships,
        team_size: sample_user_data.related_context.team_size,
        birth_year: sample_user_data.related_context.birth_year
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
