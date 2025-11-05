import type { UserContext, Goal } from "../shared/schemas.js";
import type { ContextField } from "../schemas-zod.js";
import { buildContextStrictConditions } from "../orcestrator/snippets-extractor.js";

export function buildResolveContextQuery(): string {
  return `
    MATCH (u:User {user_id: $userId})-[:HAS_CONTEXT]->(c:Context {context_id: u.current_context_id})
    OPTIONAL MATCH (c)-[:HAS_POSITION]->(p:Position)
    OPTIONAL MATCH (c)-[:IN_WORK_DOMAIN]->(wd:WorkDomain)
    OPTIONAL MATCH (c)-[:USES_SKILL]->(s:Skill)
    OPTIONAL MATCH (c)-[:IN_INDUSTRY]->(i:Industry)
    OPTIONAL MATCH (c)-[:IN_CITY]->(ci:City)
    OPTIONAL MATCH (c)-[:IN_COUNTRY]->(co:Country)

    WITH c, p, wd, s, i, ci, co

    RETURN {
      context_id: c.context_id,
      previous_context_id: c.previous_context_id,
      next_context_id: c.next_context_id,
      created_at: c.created_at,
      creation_reason: c.creation_reason,
      birth_year: c.birth_year,
      citizenships: c.citizenships,
      position: p.name,
      domains: collect(DISTINCT wd.name),
      skills: collect(DISTINCT s.name),
      industry: i.name,
      company_size: c.company_size,
      country_code: co.name,
      city_name: ci.name,
      work_type: c.work_type,
      team_size: c.team_size
    } AS context
  `.trim();
}

interface SearchQueryOptions {
  referenceContext: UserContext;
  userId: string | undefined;
  goal: Goal | null | undefined;
  strictFields: string[];
  recencyThresholdMonths: number | undefined;
  limit: number;
}


/**
 * Базовая выборка matched context с collect domains и skills.
 * Используется в buildCurrentSearchQuery и buildTargetSearchWithPathsQuery.
 *
 * ВАЖНО (Cypher scope): После этого блока переменные wd и s ИСЧЕЗАЮТ из scope.
 * Доступны ТОЛЬКО: u, c, p, i, ci, co, domains (массив), skills (массив)
 */
export function buildMatchedContextBase(): string {
  return `
    MATCH (u:User)-[:HAS_CONTEXT]->(c:Context {context_id: u.current_context_id})
    OPTIONAL MATCH (c)-[:HAS_POSITION]->(p:Position)
    OPTIONAL MATCH (c)-[:IN_WORK_DOMAIN]->(wd:WorkDomain)
    OPTIONAL MATCH (c)-[:USES_SKILL]->(s:Skill)
    OPTIONAL MATCH (c)-[:IN_INDUSTRY]->(i:Industry)
    OPTIONAL MATCH (c)-[:IN_CITY]->(ci:City)
    OPTIONAL MATCH (c)-[:IN_COUNTRY]->(co:Country)

    WITH u, c, p, i, ci, co,
         collect(DISTINCT wd.name) AS domains,
         collect(DISTINCT s.name) AS skills
  `.trim();
}

function buildWhereClause(
  strictFields: string[],
  userId: string | undefined,
  recencyThresholdMonths: number | undefined
): string {
  const contextConditions = strictFields.length > 0
    ? buildContextStrictConditions(strictFields as ContextField[], "c", "$referenceContext")
    : "";

  const searchConditions: string[] = [];

  if (userId) {
    searchConditions.push(`u.user_id <> $userId`);
  }

  if (recencyThresholdMonths) {
    searchConditions.push(
      `duration.between(datetime(c.created_at), datetime()).months <= $recencyThresholdMonths`
    );
  }

  const allConditions = [
    contextConditions,
    ...searchConditions
  ].filter(Boolean);

  return allConditions.length > 0
    ? `WHERE ${allConditions.join(" AND ")}`
    : "";
}

function buildExcludedCreationReasonsFilter(): string {
  return `
    CALL (c) {
      MATCH path = (c)<-[:PREVIOUS_CONTEXT*0..]-(start:Context)
      WHERE start.previous_context_id IS NULL
      WITH [node IN nodes(path) | node.creation_reason] AS allReasons
      RETURN NOT ANY(reason IN allReasons
        WHERE ANY(r IN reason WHERE r IN $excludedCreationReasons)) AS passesFilter
    }
    WHERE passesFilter = true OR size($excludedCreationReasons) = 0

    WITH u, c, p, domains, skills, i, ci, co, time_since_matched_months`;
}

function buildGoalFilterClause(hasGoal: boolean): string {
  if (hasGoal) {
    return `
    OPTIONAL MATCH (searchingUser:User {user_id: $userId})-[:HAS_GOAL]->(searchingUserGoal:Goal)
    OPTIONAL MATCH (u)-[:HAS_GOAL]->(candidateGoal:Goal)
    WITH u, c, p, domains, skills, i, ci, co, time_since_matched_months, context_match_score,
         CASE
           WHEN searchingUserGoal.desired.positions IS NOT NULL
                AND p.name IN searchingUserGoal.desired.positions
                AND (searchingUserGoal.undesired.positions IS NULL
                     OR NOT p.name IN searchingUserGoal.undesired.positions)
           THEN 'pathfinder'
           WHEN candidateGoal.desired.positions IS NOT NULL
                AND searchingUserGoal.desired.positions IS NOT NULL
                AND size([x IN candidateGoal.desired.positions
                          WHERE x IN searchingUserGoal.desired.positions]) > 0
           THEN 'waymate'
           ELSE null
         END AS candidate_type`;
  }

  return `
    WITH u, c, p, domains, skills, i, ci, co, time_since_matched_months, context_match_score,
         null AS candidate_type`;
}

function buildSearchReturnClauseFull(): string {
  return `
    ORDER BY context_match_score DESC, time_since_matched_months ASC
    LIMIT $limit

    RETURN u.user_id AS user_id,
           c {
             .*,
             position: p.name,
             domains: domains,
             skills: skills,
             industry: i.name,
             country_code: co.name,
             city_name: ci.name
           } AS matched_context,
           time_since_matched_months,
           context_match_score,
           candidate_type`;
}

export function buildCurrentSearchQuery(options: SearchQueryOptions): string {
  const {
    userId,
    goal,
    strictFields,
    recencyThresholdMonths,
  } = options;

  const whereClause = buildWhereClause(
    strictFields,
    userId,
    recencyThresholdMonths
  );

  const hasGoal = Boolean(goal && userId);
  const goalFilterClause = buildGoalFilterClause(hasGoal);

  const returnClause = buildSearchReturnClauseFull();

  const basePart = buildMatchedContextBase();
  const excludedReasonsFilter = buildExcludedCreationReasonsFilter();

  return `
    ${basePart}

    ${whereClause}

    WITH u, c, p, domains, skills, i, ci, co,
         duration.between(datetime(c.created_at), datetime()).months AS time_since_matched_months

    ${excludedReasonsFilter}

    WITH u, c, p, domains, skills, i, ci, co, time_since_matched_months,
         [skill IN skills WHERE NOT skill IN $referenceContext.skills] AS extraSkills

    CALL (extraSkills) {
      UNWIND extraSkills AS extraSkill
      OPTIONAL MATCH (s:Skill {name: extraSkill})-[:BELONGS_TO]->(sc:SkillCategory)
      RETURN collect({
        skill: extraSkill,
        penalty: coalesce(sc.penalty_multiplier, 1.0)
      }) AS extraSkillsWithPenalty
    }

    WITH u, c, p, domains, skills, i, ci, co, time_since_matched_months,
         reduce(penaltyScore = 0.0, extra IN extraSkillsWithPenalty |
           penaltyScore + extra.penalty
         ) AS skillsPenaltyScore

    WITH u, c, p, domains, skills, i, ci, co, time_since_matched_months,
         (1.0 - (skillsPenaltyScore / 100.0)) AS context_match_score

    ${goalFilterClause}

    ${returnClause}
  `.trim();
}
