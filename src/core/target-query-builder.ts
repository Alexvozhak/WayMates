/**
 * Query builder for Mode 4: Target-Only (Reverse Search)
 * Matches candidates by target context and builds full trajectories
 */

import type { TargetOnlySearchParams } from "./schemas.js";
import { buildMatchedContextBase } from "./search-query-builder.js";

function hasStrictField(strictFields: string[], field: string): boolean {
  return strictFields.includes(field);
}

function addTargetFieldCondition(
  conditions: string[],
  values: string[] | undefined,
  strictFields: string[],
  fieldName: string,
  condition: string
): void {
  const hasValues = values && values.length > 0;
  if (hasValues && hasStrictField(strictFields, fieldName)) {
    conditions.push(condition);
  }
}

function buildTargetWhereConditions(
  userId: string,
  targetCountries: string[] | undefined,
  targetDomains: string[] | undefined,
  targetSkills: string[] | undefined,
  strictFields: string[],
  recencyThresholdMonths: number | undefined
): string[] {
  const conditions: string[] = [];

  conditions.push("u.user_id <> $userId");

  if (hasStrictField(strictFields, "position")) {
    conditions.push("p.name = $targetPosition");
  }

  addTargetFieldCondition(
    conditions,
    targetCountries,
    strictFields,
    "country_code",
    "co.name IN $targetCountries"
  );

  addTargetFieldCondition(
    conditions,
    targetDomains,
    strictFields,
    "domains",
    "ANY(d IN $targetDomains WHERE d IN domains)"
  );

  addTargetFieldCondition(
    conditions,
    targetSkills,
    strictFields,
    "skills",
    "ANY(s IN $targetSkills WHERE s IN skills)"
  );

  if (recencyThresholdMonths) {
    conditions.push(
      "duration.between(datetime(c.created_at), datetime()).months <= $recencyThresholdMonths"
    );
  }

  return conditions;
}

function buildTrajectoryClause(excludedCreationReasons: string[] | undefined): string {
  const hasExcludedReasons =
    excludedCreationReasons && excludedCreationReasons.length > 0;

  const trajectoryFilter = hasExcludedReasons
    ? `\n    WHERE NOT ANY(ctx IN trajectory WHERE\n      ANY(reason IN ctx.creation_reason WHERE reason IN $excludedCreationReasons))`
    : "";

  return `
    MATCH path = (c)<-[:PREVIOUS_CONTEXT*0..]-(start:Context)
    WHERE start.previous_context_id IS NULL

    WITH u, c, p, domains, skills, i, ci, co, time_since_matched_months,
         [node IN nodes(path) | node] AS pathNodes

    UNWIND pathNodes AS ctx
    OPTIONAL MATCH (ctx)-[:HAS_POSITION]->(pCtx:Position)
    OPTIONAL MATCH (ctx)-[:IN_WORK_DOMAIN]->(wdCtx:WorkDomain)
    OPTIONAL MATCH (ctx)-[:USES_SKILL]->(sCtx:Skill)
    OPTIONAL MATCH (ctx)-[:IN_INDUSTRY]->(iCtx:Industry)
    OPTIONAL MATCH (ctx)-[:IN_CITY]->(ciCtx:City)
    OPTIONAL MATCH (ctx)-[:IN_COUNTRY]->(coCtx:Country)

    WITH u, c, p, domains, skills, i, ci, co, time_since_matched_months, ctx, pCtx, wdCtx, sCtx, iCtx, ciCtx, coCtx,
         collect(DISTINCT wdCtx.name) AS ctxDomains,
         collect(DISTINCT sCtx.name) AS ctxSkills
    ORDER BY ctx.created_at ASC

    WITH u, c, p, domains, skills, i, ci, co, time_since_matched_months,
         collect({
           context_id: ctx.context_id,
           position: pCtx.name,
           domains: ctxDomains,
           skills: ctxSkills,
           industry: iCtx.name,
           company_size: ctx.company_size,
           country_code: coCtx.name,
           city_name: ciCtx.name,
           work_type: ctx.work_type,
           citizenships: ctx.citizenships,
           team_size: ctx.team_size,
           birth_year: ctx.birth_year,
           creation_reason: ctx.creation_reason,
           created_at: ctx.created_at,
           previous_context_id: ctx.previous_context_id,
           next_context_id: ctx.next_context_id
         }) AS trajectory
${trajectoryFilter}`.trim();
}

function buildTargetWithPathReturnClause(): string {
  return `
    ORDER BY time_since_matched_months ASC
    LIMIT $limit

    RETURN u.user_id AS user_id,
           c {
             .context_id,
             .creation_reason,
             .created_at,
             .birth_year,
             .citizenships,
             .company_size,
             .work_type,
             .team_size,
             .previous_context_id,
             .next_context_id,
             position: p.name,
             domains: domains,
             skills: skills,
             industry: i.name,
             country_code: co.name,
             city_name: ci.name
           } AS matched_context,
           time_since_matched_months,
           trajectory`;
}

export function buildTargetSearchWithPathsQuery(params: TargetOnlySearchParams): {
  query: string;
  queryParams: Record<string, unknown>;
} {
  const {
    userId,
    targetCountries,
    targetDomains,
    targetSkills,
    filters,
  } = params;
  const { strictFields, recencyThresholdMonths, excludedCreationReasons } = filters;

  const whereConditions = buildTargetWhereConditions(
    userId,
    targetCountries,
    targetDomains,
    targetSkills,
    strictFields,
    recencyThresholdMonths
  );

  const whereClause =
    whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

  const basePart = buildMatchedContextBase();

  const query = `
    ${basePart}

    ${whereClause}

    WITH u, c, p, domains, skills, i, ci, co,
         duration.between(datetime(c.created_at), datetime()).months AS time_since_matched_months

    ${buildTrajectoryClause(excludedCreationReasons)}

    ${buildTargetWithPathReturnClause()}
  `.trim();

  const queryParams = Object.assign(
    {
      userId,
      targetPosition: params.targetPosition,
      targetCountries,
      targetDomains,
      targetSkills,
    },
    filters
  );

  return { query, queryParams };
}


