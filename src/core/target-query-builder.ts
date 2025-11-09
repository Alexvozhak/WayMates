/**
 * Query builder for Mode 4: Target-Only (Reverse Search)
 * Matches candidates by target context and builds full trajectories
 */

import type { ContextField } from "./schemas.js";
import { buildMatchedContextBase } from "./search-query-builder.js";
import { CONTEXT_FIELD_NAMES } from "./schemas.js";

// ==========================================
// === SNIPPET FUNCTIONS (REUSABLE CYPHER) ===
// ==========================================

/**
 * Generates Cypher CASE statement for singular field filtering (position, country)
 * Handles null safety and mode-based filtering
 *
 * @param paramName - Parameter name (e.g., "$position", "$countries")
 * @param cypherVar - Cypher variable name (e.g., "p", "co")
 * @param property - Property to check (default: "name")
 * @returns Cypher CASE statement with null check and mode switching
 *
 * @example
 * // For position filter
 * buildSingularFieldCase("$position", "p", "name")
 * // Returns:
 * // CASE
 * //   WHEN $position IS NULL THEN true
 * //   WHEN $position.mode = 'desired' THEN p.name IN $position.values
 * //   WHEN $position.mode = 'undesired' THEN NOT p.name IN $position.values
 * //   ELSE true
 * // END
 */
function buildSingularFieldCase(
  paramName: string,
  cypherVar: string,
  property = "name"
): string {
  return `
    CASE
      WHEN ${paramName} IS NULL THEN true
      WHEN ${paramName}.mode = 'desired' THEN ${cypherVar}.${property} IN ${paramName}.values
      WHEN ${paramName}.mode = 'undesired' THEN NOT ${cypherVar}.${property} IN ${paramName}.values
      ELSE true
    END
  `.trim();
}

/**
 * Generates Cypher CASE statement for collected field filtering (domains, skills)
 * Handles null safety and mode-based filtering with ANY/NONE predicates
 *
 * @param paramName - Parameter name (e.g., "$domains", "$skills")
 * @param arrayVariable - Array variable name (e.g., "domains", "skills")
 * @returns Cypher CASE statement with null check and mode switching
 *
 * @example
 * // For domains filter
 * buildCollectedFieldCase("$domains", "domains")
 * // Returns:
 * // CASE
 * //   WHEN $domains IS NULL THEN true
 * //   WHEN $domains.mode = 'desired' THEN ANY(item IN domains WHERE item IN $domains.values)
 * //   WHEN $domains.mode = 'undesired' THEN NONE(item IN domains WHERE item IN $domains.values)
 * //   ELSE true
 * // END
 */
function buildCollectedFieldCase(
  paramName: string,
  arrayVariable: string
): string {
  return `
    CASE
      WHEN ${paramName} IS NULL THEN true
      WHEN ${paramName}.mode = 'desired' THEN ANY(item IN ${arrayVariable} WHERE item IN ${paramName}.values)
      WHEN ${paramName}.mode = 'undesired' THEN NONE(item IN ${arrayVariable} WHERE item IN ${paramName}.values)
      ELSE true
    END
  `.trim();
}

// ==========================================
// === HELPER FUNCTIONS ===
// ==========================================

function computeStrictFields(excludedFields: ContextField[]): ContextField[] {
  return CONTEXT_FIELD_NAMES.filter(
    (field): field is ContextField => !excludedFields.includes(field)
  );
}

function hasStrictField(strictFields: ContextField[], field: string): boolean {
  return strictFields.includes(field as ContextField);
}

/**
 * Builds WHERE clause using snippet pattern for target search
 * Uses CASE statements for mode-based filtering (desired/undesired)
 */
function buildTargetWhereClause(
  strictFields: ContextField[],
  recencyThresholdMonths: number | undefined
): string {
  const conditions: string[] = ["u.userId <> $userId"];

  // Add filter conditions using snippets (only if field is strict)
  if (hasStrictField(strictFields, "position")) {
    conditions.push(buildSingularFieldCase("$position", "p"));
  }

  if (hasStrictField(strictFields, "countryCode")) {
    conditions.push(buildSingularFieldCase("$countries", "co"));
  }

  if (hasStrictField(strictFields, "domains")) {
    conditions.push(buildCollectedFieldCase("$domains", "domains"));
  }

  if (hasStrictField(strictFields, "skills")) {
    conditions.push(buildCollectedFieldCase("$skills", "skills"));
  }

  if (recencyThresholdMonths) {
    conditions.push(
      "duration.between(datetime(c.createdAt), datetime()).months <= $recencyThresholdMonths"
    );
  }

  return `WHERE ${conditions.join(" AND ")}`;
}

/**
 * Builds trajectory collection fragment for embedding in target search query.
 * NOTE: This is fragment mode - preserved for Phase 1, will be refactored in Phase 2.
 *
 * @param excludedCreationReasons - Creation reasons to exclude from trajectories
 * @returns Cypher fragment that collects trajectory from matched context backwards
 */
function buildTrajectoryClause(excludedCreationReasons: string[]): string {
  const exclusionFilter = excludedCreationReasons.length > 0
    ? `
    WHERE NOT ANY(ctx IN trajectory WHERE
      ANY(reason IN ctx.creationReason WHERE reason IN $excludedCreationReasons))
    `
    : '';

  return `
    MATCH path = (c)<-[:PREVIOUS_CONTEXT*0..]-(start:Context)
    WHERE start.previousContextId IS NULL

    WITH u, c, p, domains, skills, i, ci, co, time_since_matched_months, [node IN nodes(path) | node] AS pathNodes
    UNWIND pathNodes AS ctx

    OPTIONAL MATCH (ctx)-[:HAS_POSITION]->(tp:Position)
    OPTIONAL MATCH (ctx)-[:IN_WORK_DOMAIN]->(twd:WorkDomain)
    OPTIONAL MATCH (ctx)-[:USES_SKILL]->(ts:Skill)
    OPTIONAL MATCH (ctx)-[:IN_INDUSTRY]->(ti:Industry)
    OPTIONAL MATCH (ctx)-[:IN_CITY]->(tci:City)
    OPTIONAL MATCH (ctx)-[:IN_COUNTRY]->(tco:Country)

    WITH u, c, p, domains, skills, i, ci, co, time_since_matched_months, ctx, tp, twd, ts, ti, tci, tco,
         collect(DISTINCT twd.name) AS ctx_domains,
         collect(DISTINCT ts.name) AS ctx_skills
    ORDER BY ctx.createdAt ASC

    WITH u, c, p, domains, skills, i, ci, co, time_since_matched_months, collect(ctx {
      .contextId,
      .previousContextId,
      .nextContextId,
      .createdAt,
      .creationReason,
      .birthYear,
      .citizenships,
      .companySize,
      position: tp.name,
      domains: [d IN ctx_domains WHERE d IS NOT NULL],
      skills: [sk IN ctx_skills WHERE sk IS NOT NULL],
      industry: ti.name,
      countryCode: tco.name,
      cityName: tci.name
    }) AS trajectory
    ${exclusionFilter}
  `.trim();
}

function buildTargetWithPathReturnClause(): string {
  return `
    ORDER BY time_since_matched_months ASC
    LIMIT $limit

    RETURN u.userId AS userId,
           c {
             .contextId,
             .creationReason,
             .createdAt,
             .birthYear,
             .citizenships,
             .companySize,
             .previousContextId,
             .nextContextId,
             position: p.name,
             domains: domains,
             skills: skills,
             industry: i.name,
             countryCode: co.name,
             cityName: ci.name
           } AS matchedContext,
           time_since_matched_months,
           trajectory AS path`;
}

/**
 * Builds target search query with paths (Mode 4: Reverse Search)
 * Now returns query string only - parameters are built separately in SearchManager
 *
 * Uses discriminated union pattern: TargetContext with FieldFilter {mode, values}
 * Replaces old nested {desired, undesired} structure
 */
export function buildTargetSearchWithPathsQuery(
  params: { filters: import('./schemas.js').TargetSearchFilters }
): string {
  const { filters } = params;
  const { excludedContextFields, recencyThresholdMonths, excludedCreationReasons } = filters;

  const strictFields = computeStrictFields(excludedContextFields);

  const basePart = buildMatchedContextBase();
  const whereClause = buildTargetWhereClause(strictFields, recencyThresholdMonths);

  return `
    ${basePart}

    ${whereClause}

    WITH u, c, p, domains, skills, i, ci, co,
         duration.between(datetime(c.createdAt), datetime()).months AS time_since_matched_months

    ${buildTrajectoryClause(excludedCreationReasons)}

    ${buildTargetWithPathReturnClause()}
  `.trim();
}


