import type { Goal } from "../shared/schemas.js";
import type { ContextField } from "../schemas-zod.js";
import { buildContextStrictConditions } from "../orcestrator/snippets-extractor.js";

export function userCurrentContextQuery(): string {
  return `
    MATCH (u:User {userId: $userId})-[:HAS_CONTEXT]->(c:Context {contextId: u.currentContextId})
    OPTIONAL MATCH (c)-[:HAS_POSITION]->(p:Position)
    OPTIONAL MATCH (c)-[:IN_WORK_DOMAIN]->(wd:WorkDomain)
    OPTIONAL MATCH (c)-[:USES_SKILL]->(s:Skill)
    OPTIONAL MATCH (c)-[:IN_INDUSTRY]->(i:Industry)
    OPTIONAL MATCH (c)-[:IN_CITY]->(ci:City)
    OPTIONAL MATCH (c)-[:IN_COUNTRY]->(co:Country)

    WITH c, p, wd, s, i, ci, co

    RETURN c {
      .contextId,
      .previousContextId,
      .nextContextId,
      .createdAt,
      .creationReason,
      .birthYear,
      .citizenships,
      position: p.name,
      domains: collect(DISTINCT wd.name),
      skills: collect(DISTINCT s.name),
      industry: i.name,
      .companySize,
      countryCode: co.name,
      cityName: ci.name
    } AS context
  `.trim();
}

export function userCurrentContextIdQuery(): string {
  return `
    MATCH (u:User {userId: $userId})
    WHERE u.currentContextId IS NOT NULL
    RETURN u.currentContextId AS currentContextId
  `.trim();
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
    MATCH (u:User)-[:HAS_CONTEXT]->(c:Context {contextId: u.currentContextId})
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
    searchConditions.push(`u.userId <> $userId`);
  }

  if (recencyThresholdMonths) {
    searchConditions.push(
      `duration.between(datetime(c.createdAt), datetime()).months <= $recencyThresholdMonths`
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
      WHERE start.previousContextId IS NULL
      WITH [node IN nodes(path) | node.creationReason] AS allReasons
      RETURN NOT ANY(reason IN allReasons
        WHERE ANY(r IN reason WHERE r IN $excludedCreationReasons)) AS passesFilter
    }
    WHERE passesFilter = true OR size($excludedCreationReasons) = 0

    WITH u, c, p, domains, skills, i, ci, co, timeSinceMatchedMonths`;
}

function buildGoalFilterClause(hasGoal: boolean): string {
  if (hasGoal) {
    return `
    OPTIONAL MATCH (searchingUser:User {userId: $userId})-[:HAS_GOAL]->(searchingUserGoal:Goal)
    OPTIONAL MATCH (u)-[:HAS_GOAL]->(candidateGoal:Goal)
    WITH u, c, p, domains, skills, i, ci, co, timeSinceMatchedMonths, contextMatchScore,
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
         END AS candidateType`;
  }

  return `
    WITH u, c, p, domains, skills, i, ci, co, timeSinceMatchedMonths, contextMatchScore,
         null AS candidateType`;
}

function buildSearchReturnClauseFull(): string {
  return `
    ORDER BY contextMatchScore DESC, timeSinceMatchedMonths ASC
    LIMIT $limit

    RETURN u.userId AS userId,
           c {
             .*,
             position: p.name,
             domains: domains,
             skills: skills,
             industry: i.name,
             countryCode: co.name,
             cityName: ci.name
           } AS matchedContext,
           timeSinceMatchedMonths,
           contextMatchScore,
           candidateType`;
}

export function buildCurrentSearchQuery(
  goal: Goal | null | undefined,
  strictFields: string[],
  params: {
    userId: string | undefined;
    recencyThresholdMonths: number | undefined;
    limit: number;
  }
): string {
  const whereClause = buildWhereClause(
    strictFields,
    params.userId,
    params.recencyThresholdMonths
  );

  const hasGoal = Boolean(goal && params.userId);
  const goalFilterClause = buildGoalFilterClause(hasGoal);

  const returnClause = buildSearchReturnClauseFull();

  const basePart = buildMatchedContextBase();
  const excludedReasonsFilter = buildExcludedCreationReasonsFilter();

  return `
    ${basePart}

    ${whereClause}

    WITH u, c, p, domains, skills, i, ci, co,
         duration.between(datetime(c.createdAt), datetime()).months AS timeSinceMatchedMonths

    ${excludedReasonsFilter}

    WITH u, c, p, domains, skills, i, ci, co, timeSinceMatchedMonths,
         [skill IN skills WHERE NOT skill IN $referenceContext.skills] AS extraSkills

    CALL (extraSkills) {
      UNWIND extraSkills AS extraSkill
      OPTIONAL MATCH (s:Skill {name: extraSkill})-[:BELONGS_TO]->(sc:SkillCategory)
      RETURN collect({
        skill: extraSkill,
        penalty: coalesce(sc.penaltyMultiplier, 1.0)
      }) AS extraSkillsWithPenalty
    }

    WITH u, c, p, domains, skills, i, ci, co, timeSinceMatchedMonths,
         reduce(penaltyScore = 0.0, extra IN extraSkillsWithPenalty |
           penaltyScore + extra.penalty
         ) AS skillsPenaltyScore

    WITH u, c, p, domains, skills, i, ci, co, timeSinceMatchedMonths,
         (1.0 - (skillsPenaltyScore / 100.0)) AS contextMatchScore

    ${goalFilterClause}

    ${returnClause}
  `.trim();
}
