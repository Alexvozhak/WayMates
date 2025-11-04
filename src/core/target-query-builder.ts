/**
 * Query builder for Mode 4: Target-Only (Reverse Search)
 * Matches candidates by target context and builds full trajectories
 */

interface TargetQueryOptions {
  userId: string;
  targetPosition: string;
  targetCountries: string[] | undefined;
  targetDomains: string[] | undefined;
  targetSkills: string[] | undefined;
  strictFields: string[];
  recencyThresholdMonths: number | undefined;
  limit: number;
}

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

function buildTargetReturnClause(): string {
  return `
    ORDER BY time_since_matched_months ASC
    LIMIT $limit

    RETURN u.user_id AS user_id,
           {
             context_id: c.context_id,
             position: p.name,
             domains: domains,
             skills: skills,
             industry: i.name,
             company_size: c.company_size,
             country_code: co.name,
             city_name: ci.name,
             work_type: c.work_type,
             citizenships: c.citizenships,
             team_size: c.team_size,
             birth_year: c.birth_year,
             creation_reason: c.creation_reason,
             created_at: c.created_at,
             previous_context_id: c.previous_context_id,
             next_context_id: c.next_context_id
           } AS matched_context,
           time_since_matched_months`;
}

export function buildTargetSearchQuery(options: TargetQueryOptions): string {
  const {
    userId,
    targetCountries,
    targetDomains,
    targetSkills,
    strictFields,
    recencyThresholdMonths,
  } = options;

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

  return `
    MATCH (u:User)-[:HAS_CONTEXT]->(c:Context {context_id: u.current_context_id})
    OPTIONAL MATCH (c)-[:HAS_POSITION]->(p:Position)
    OPTIONAL MATCH (c)-[:IN_WORK_DOMAIN]->(wd:WorkDomain)
    OPTIONAL MATCH (c)-[:USES_SKILL]->(s:Skill)
    OPTIONAL MATCH (c)-[:IN_INDUSTRY]->(i:Industry)
    OPTIONAL MATCH (c)-[:IN_CITY]->(ci:City)
    OPTIONAL MATCH (c)-[:IN_COUNTRY]->(co:Country)

    WITH u, c, p, wd, s, i, ci, co,
         collect(DISTINCT wd.name) AS domains,
         collect(DISTINCT s.name) AS skills

    ${whereClause}

    WITH u, c, p, domains, skills, i, ci, co,
         duration.between(datetime(c.created_at), datetime()).months AS time_since_matched_months

    ${buildTargetReturnClause()}
  `.trim();
}

