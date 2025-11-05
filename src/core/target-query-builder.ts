/**
 * Query builder for Mode 4: Target-Only (Reverse Search)
 * Matches candidates by target context and builds full trajectories
 */

import type { TargetOnlySearchParams, ContextField } from "./schemas.js";
import { buildMatchedContextBase } from "./search-query-builder.js";
import { CONTEXT_FIELD_NAMES } from "./schemas.js";

function computeStrictFields(excludedFields: ContextField[]): ContextField[] {
  return CONTEXT_FIELD_NAMES.filter(
    (field): field is ContextField => !excludedFields.includes(field)
  );
}

function hasStrictField(strictFields: ContextField[], field: string): boolean {
  return strictFields.includes(field as ContextField);
}

function addPositionCondition(
  conditions: string[],
  position: string | undefined,
  strictFields: ContextField[]
): void {
  if (position && hasStrictField(strictFields, "position")) {
    conditions.push("p.name = $targetPosition");
  }
}

function addCountryConditions(
  conditions: string[],
  desired: string[] | undefined,
  undesired: string[] | undefined,
  strictFields: ContextField[]
): void {
  if (!hasStrictField(strictFields, "country_code")) return;

  if (desired && desired.length > 0) {
    conditions.push("co.name IN $desiredCountries");
  }
  if (undesired && undesired.length > 0) {
    conditions.push("NOT co.name IN $undesiredCountries");
  }
}

function addDomainConditions(
  conditions: string[],
  desired: string[] | undefined,
  undesired: string[] | undefined,
  strictFields: ContextField[]
): void {
  if (!hasStrictField(strictFields, "domains")) return;

  if (desired && desired.length > 0) {
    conditions.push("ANY(d IN $desiredDomains WHERE d IN domains)");
  }
  if (undesired && undesired.length > 0) {
    conditions.push("NOT ANY(d IN $undesiredDomains WHERE d IN domains)");
  }
}

function addSkillConditions(
  conditions: string[],
  desired: string[] | undefined,
  undesired: string[] | undefined,
  strictFields: ContextField[]
): void {
  if (!hasStrictField(strictFields, "skills")) return;

  if (desired && desired.length > 0) {
    conditions.push("ANY(s IN $desiredSkills WHERE s IN skills)");
  }
  if (undesired && undesired.length > 0) {
    conditions.push("NOT ANY(s IN $undesiredSkills WHERE s IN skills)");
  }
}

function buildTargetWhereConditions(
  userId: string,
  position: string | undefined,
  desiredCountries: string[] | undefined,
  undesiredCountries: string[] | undefined,
  desiredDomains: string[] | undefined,
  undesiredDomains: string[] | undefined,
  desiredSkills: string[] | undefined,
  undesiredSkills: string[] | undefined,
  strictFields: ContextField[],
  recencyThresholdMonths: number | undefined
): string[] {
  const conditions: string[] = [];

  conditions.push("u.user_id <> $userId");

  addPositionCondition(conditions, position, strictFields);
  addCountryConditions(conditions, desiredCountries, undesiredCountries, strictFields);
  addDomainConditions(conditions, desiredDomains, undesiredDomains, strictFields);
  addSkillConditions(conditions, desiredSkills, undesiredSkills, strictFields);

  if (recencyThresholdMonths) {
    conditions.push(
      "duration.between(datetime(c.created_at), datetime()).months <= $recencyThresholdMonths"
    );
  }

  return conditions;
}

function buildTrajectoryClause(excludedCreationReasons: string[]): string {
  const hasExcludedReasons = excludedCreationReasons.length > 0;

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

interface TargetCriteriaExtracted {
  position: string | undefined;
  desiredCountries: string[];
  undesiredCountries: string[];
  desiredDomains: string[];
  undesiredDomains: string[];
  desiredSkills: string[];
  undesiredSkills: string[];
}

// eslint-disable-next-line complexity
function extractTargetCriteria(
  criteria: import("./schemas.js").TargetCriteria | undefined
): TargetCriteriaExtracted {
  return {
    position: criteria?.position,
    desiredCountries: criteria?.desired?.countries ?? [],
    undesiredCountries: criteria?.undesired?.countries ?? [],
    desiredDomains: criteria?.desired?.domains ?? [],
    undesiredDomains: criteria?.undesired?.domains ?? [],
    desiredSkills: criteria?.desired?.skills ?? [],
    undesiredSkills: criteria?.undesired?.skills ?? [],
  };
}

function buildQueryParams(
  userId: string,
  extracted: TargetCriteriaExtracted,
  excludedCreationReasons: string[],
  recencyThresholdMonths: number | undefined,
  limit: number
): Record<string, unknown> {
  return {
    userId,
    targetPosition: extracted.position,
    desiredCountries: extracted.desiredCountries,
    undesiredCountries: extracted.undesiredCountries,
    desiredDomains: extracted.desiredDomains,
    undesiredDomains: extracted.undesiredDomains,
    desiredSkills: extracted.desiredSkills,
    undesiredSkills: extracted.undesiredSkills,
    excludedCreationReasons,
    recencyThresholdMonths,
    limit,
  };
}

export function buildTargetSearchWithPathsQuery(params: TargetOnlySearchParams): {
  query: string;
  queryParams: Record<string, unknown>;
} {
  const { userId, filters } = params;
  const { criteria, excludedContextFields, recencyThresholdMonths, excludedCreationReasons } = filters;

  const extracted = extractTargetCriteria(criteria);
  const strictFields = computeStrictFields(excludedContextFields);

  const whereConditions = buildTargetWhereConditions(
    userId,
    extracted.position,
    extracted.desiredCountries,
    extracted.undesiredCountries,
    extracted.desiredDomains,
    extracted.undesiredDomains,
    extracted.desiredSkills,
    extracted.undesiredSkills,
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

  const queryParams = buildQueryParams(
    userId,
    extracted,
    excludedCreationReasons,
    recencyThresholdMonths,
    filters.limit
  );

  return { query, queryParams };
}


