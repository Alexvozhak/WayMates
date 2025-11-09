export const UPSERT_CONTEXTS_QUERY: string = `MERGE (u:User {userId: $userId})
ON CREATE SET u.currentContextId = null

MERGE (c:Context {contextId: $context.contextId})
  ON CREATE SET c.createdAt = $context.createdAt
SET c.createdAt = $context.createdAt,
    c.position = $context.position,
    c.domains = $context.domains,
    c.skills = $context.skills,
    c.industry = $context.industry,
    c.companySize = $context.companySize,
    c.countryCode = $context.countryCode,
    c.cityName = $context.cityName,
    c.citizenships = $context.citizenships,
    c.birthYear = $context.birthYear,
    c.creationReason = $context.creationReason,
    c.previousContextId = $context.previousContextId,
    c.nextContextId = $context.nextContextId
    //TODO очень странные дела, почему мы тут следующему контексту ставим id текущего контекста?

MERGE (u)-[:HAS_CONTEXT]->(c)
SET u.currentContextId = c.contextId

// Position
MERGE (p:Position {name: $context.position})
MERGE (c)-[:HAS_POSITION]->(p)

// Industry (direct link from Context for MVP)
MERGE (i:Industry {name: $context.industry})
MERGE (c)-[:IN_INDUSTRY]->(i)

// Work domains
WITH c, $context.domains AS work_domains
UNWIND work_domains AS wdName
  MERGE (wd:WorkDomain {name: wdName})
  MERGE (c)-[:IN_WORK_DOMAIN]->(wd)

// Skills - create basic Skill nodes without categories for search compatibility
WITH c, $context.skills AS skills
UNWIND skills AS skillName
  MERGE (s:Skill {name: skillName})
  MERGE (c)-[:USES_SKILL]->(s)

// Location nodes
WITH c
MERGE (cty:Country {name: $context.countryCode})
MERGE (ci:City {name: $context.cityName})
MERGE (ci)-[:IN_COUNTRY]->(cty)
MERGE (c)-[:IN_CITY]->(ci)
MERGE (c)-[:IN_COUNTRY]->(cty)

// Temporal context links
WITH c
OPTIONAL MATCH (prev:Context {contextId: c.previousContextId})
FOREACH (_ IN CASE WHEN prev IS NOT NULL THEN [1] ELSE [] END |
  MERGE (prev)-[:NEXT]->(c)
  SET prev.nextContextId = c.contextId
)

// Citizenship relations
WITH c
FOREACH (code IN $context.citizenships |
  MERGE (ct:Country {name: code})
  MERGE (c)-[:CITIZEN_OF]->(ct)
)

RETURN c.contextId AS contextId;`;
export const UPSERT_TRAILS_QUERY: string = `MERGE (t:Trail {trailId: $trailId})
SET t.skill = $trail.skill,
    t.platform = $trail.platform,
    t.fromContextId = $trail.fromContextId,
    t.toContextId = $trail.toContextId,
    t.total_duration_weeks = $trail.total_duration_weeks,
    t.sessions_per_week = $trail.schedule.sessions_per_week,
    t.hours_per_session = $trail.schedule.hours_per_session,
    t.cost_usd = $trail.cost_usd,
    t.rating_course = $trail.rating_course,
    t.rating_platform = $trail.rating_platform,
    t.rating_schedule = $trail.rating_schedule,
    t.course_name = $trail.course_name,
    t.course_link = $trail.course_link,
    t.user_feedback = $trail.user_feedback

MERGE (p:Platform {name: $trail.platform})
MERGE (spn:SkillPlatformNode {skill: $trail.skill, platform: $trail.platform})
MERGE (spn)-[:ON_PLATFORM]->(p)
MERGE (t)-[:DEVELOPS]->(spn)

WITH t
MERGE (from_ctx:Context {contextId: $fromContextId})
MERGE (from_ctx)-[:STEPS_ON]->(t)

FOREACH (_ IN CASE WHEN $toContextId IS NULL THEN [] ELSE [1] END |
  MERGE (to_ctx:Context {contextId: $toContextId})
  MERGE (t)-[:STEPS_TO]->(to_ctx)
)

// Create direct User-Trail relationship for better query performance
MERGE (u:User {userId: $userId})
MERGE (u)-[:HAS_TRAIL]->(t)

RETURN t.trailId AS trailId;`;

export const GET_USER_STORY_QUERY: string = `CALL {
  MATCH (u:User {userId: $userId})
  OPTIONAL MATCH (u)-[:HAS_CONTEXT]->(currentCtx:Context {contextId: u.currentContextId})-[:CITIZEN_OF]->(cit:Country)
  RETURN { user: u, citizenships: collect(DISTINCT cit.name) } AS userData
}
CALL {
  MATCH (u:User {userId: $userId})-[:HAS_CONTEXT]->(c:Context)
  OPTIONAL MATCH (c)-[:HAS_POSITION]->(p:Position)
  OPTIONAL MATCH (c)-[:IN_WORK_DOMAIN]->(wd:WorkDomain)
  OPTIONAL MATCH (c)-[:USES_SKILL]->(s:Skill)-[:IN_CATEGORY]->(sc:SkillCategory)
  WITH c, p.name AS position, collect(DISTINCT wd.name) AS domains, collect(DISTINCT {name: s.name, category: sc.name}) AS rawSkills
  RETURN collect({ context: c, position: position, domains: domains, rawSkills: rawSkills }) AS contexts
}
CALL {
  MATCH (u:User {userId: $userId})-[:HAS_TRAIL]->(t:Trail)
  RETURN collect(t) AS trails
}
RETURN { user: userData, contexts: contexts, trails: trails } AS result;`;

export const DELETE_CONTEXT_QUERY: string = `MATCH (u:User {userId: $userId})-[rel:HAS_CONTEXT]->(c:Context {contextId: $contextId})
WITH count(rel) AS deletedCount
DETACH DELETE c
RETURN { success: deletedCount > 0 } AS result;`;

export const DELETE_TRAIL_QUERY: string = `MATCH (u:User {userId: $userId})-[rel:HAS_TRAIL]->(t:Trail {trailId: $trailId})
WITH count(rel) AS deletedCount
DETACH DELETE t
RETURN { success: deletedCount > 0 } AS result;`;
