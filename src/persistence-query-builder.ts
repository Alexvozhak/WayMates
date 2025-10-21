export const UPSERT_CONTEXTS_QUERY: string = `MERGE (u:User {user_id: $user_id})
ON CREATE SET u.current_context_id = null

MERGE (c:Context {context_id: $context.context_id})
  ON CREATE SET c.created_at = $context.created_at
SET c.created_at = $context.created_at,
    c.position = $context.position,
    c.domains = $context.domains,
    c.skills = $context.skills,
    c.industry = $context.industry,
    c.company_size = $context.company_size,
    c.country_code = $context.country_code,
    c.city_name = $context.city_name,
    c.work_type = $context.work_type,
    c.citizenships = $context.citizenships,
    c.team_size = $context.team_size,
    c.birth_year = $context.birth_year,
    c.creation_reason = $context.creation_reason,
    c.previous_context_id = $context.previous_context_id,
    c.next_context_id = $context.next_context_id

MERGE (u)-[:HAS_CONTEXT]->(c)
SET u.current_context_id = c.context_id

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
MERGE (cty:Country {name: $context.country_code})
MERGE (ci:City {name: $context.city_name})
MERGE (ci)-[:IN_COUNTRY]->(cty)
MERGE (c)-[:IN_CITY]->(ci)
MERGE (c)-[:IN_COUNTRY]->(cty)

// Temporal context links
WITH c
OPTIONAL MATCH (prev:Context {context_id: c.previous_context_id})
FOREACH (_ IN CASE WHEN prev IS NOT NULL THEN [1] ELSE [] END |
  MERGE (prev)-[:NEXT]->(c)
  SET prev.next_context_id = c.context_id
)

// Citizenship relations
WITH c
FOREACH (code IN $context.citizenships |
  MERGE (ct:Country {name: code})
  MERGE (c)-[:CITIZEN_OF]->(ct)
)

RETURN c.context_id AS context_id;`;
export const UPSERT_TRAILS_QUERY: string = `MERGE (t:Trail {trail_id: $trail_id})
SET t.skill = $trail.skill,
    t.platform = $trail.platform,
    t.from_context_id = $trail.from_context_id,
    t.to_context_id = $trail.to_context_id,
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
MERGE (from_ctx:Context {context_id: $from_context_id})
MERGE (from_ctx)-[:STEPS_ON]->(t)

FOREACH (_ IN CASE WHEN $to_context_id IS NULL THEN [] ELSE [1] END |
  MERGE (to_ctx:Context {context_id: $to_context_id})
  MERGE (t)-[:STEPS_TO]->(to_ctx)
)

// Create direct User-Trail relationship for better query performance
MERGE (u:User {user_id: $user_id})
MERGE (u)-[:HAS_TRAIL]->(t)

RETURN t.trail_id AS trail_id;`;

export const GET_USER_STORY_QUERY: string = `CALL {
  MATCH (u:User {user_id: $user_id})
  OPTIONAL MATCH (u)-[:HAS_CONTEXT]->(currentCtx:Context {context_id: u.current_context_id})-[:CITIZEN_OF]->(cit:Country)
  RETURN { user: u, citizenships: collect(DISTINCT cit.name) } AS userData
}
CALL {
  MATCH (u:User {user_id: $user_id})-[:HAS_CONTEXT]->(c:Context)
  OPTIONAL MATCH (c)-[:HAS_POSITION]->(p:Position)
  OPTIONAL MATCH (c)-[:IN_WORK_DOMAIN]->(wd:WorkDomain)
  OPTIONAL MATCH (c)-[:USES_SKILL]->(s:Skill)-[:IN_CATEGORY]->(sc:SkillCategory)
  WITH c, p.name AS position, collect(DISTINCT wd.name) AS domains, collect(DISTINCT {name: s.name, category: sc.name}) AS rawSkills
  RETURN collect({ context: c, position: position, domains: domains, rawSkills: rawSkills }) AS contexts
}
CALL {
  MATCH (u:User {user_id: $user_id})-[:HAS_TRAIL]->(t:Trail)
  RETURN collect(t) AS trails
}
RETURN { user: userData, contexts: contexts, trails: trails } AS result;`;

export const DELETE_CONTEXT_QUERY: string = `MATCH (u:User {user_id: $user_id})-[rel:HAS_CONTEXT]->(c:Context {context_id: $context_id})
WITH count(rel) AS deletedCount
DETACH DELETE c
RETURN { success: deletedCount > 0 } AS result;`;

export const DELETE_TRAIL_QUERY: string = `MATCH (u:User {user_id: $user_id})-[rel:HAS_TRAIL]->(t:Trail {trail_id: $trail_id})
WITH count(rel) AS deletedCount
DETACH DELETE t
RETURN { success: deletedCount > 0 } AS result;`;
