/**
 * Persistence queries for Story/Context/Trail CRUD operations
 */

/**
 * Upsert single context with all relationships
 *
 * Creates or updates:
 * - Context node with all properties
 * - User-Context relationship (HAS_CONTEXT)
 * - Position, Industry, WorkDomain, Skill, City, Country nodes + relationships
 * - PREVIOUS_CONTEXT/NEXT_CONTEXT relationships for trajectory chain
 * - Citizenship relationships (CITIZEN_OF)
 * - Updates user.currentContextId
 *
 * Parameters:
 * - $userId: User ID (string)
 * - $ctx: Context object (UserContext without relationships)
 *
 * Returns:
 * - contextId: Created/updated context ID
 */
export const UPSERT_CONTEXTS_QUERY = `MERGE (user:User {userId: $userId})
ON CREATE SET user.currentContextId = null

MERGE (context:Context {contextId: $ctx.contextId})
  ON CREATE SET context.createdAt = $ctx.createdAt
SET context.createdAt = $ctx.createdAt,
    context.position = $ctx.position,
    context.domains = $ctx.domains,
    context.skills = $ctx.skills,
    context.industry = $ctx.industry,
    context.companySize = $ctx.companySize,
    context.countryCode = $ctx.countryCode,
    context.cityName = $ctx.cityName,
    context.citizenships = $ctx.citizenships,
    context.birthYear = $ctx.birthYear,
    context.educationLevel = $ctx.educationLevel,
    context.salaryExact = $ctx.salaryExact,
    context.salaryMin = $ctx.salaryMin,
    context.salaryMax = $ctx.salaryMax,
    context.languages = $ctx.languages,
    context.creationReason = $ctx.creationReason,
    context.previousContextId = $ctx.previousContextId,
    context.nextContextId = $ctx.nextContextId

MERGE (user)-[:HAS_CONTEXT]->(context)
SET user.currentContextId = context.contextId

WITH context, user,
     $ctx.position AS position,
     $ctx.industry AS industry,
     $ctx.domains AS work_domains,
     $ctx.skills AS skills,
     $ctx.countryCode AS countryCode,
     $ctx.cityName AS cityName,
     $ctx.citizenships AS citizenships,
     $ctx.languages AS languages

MERGE (p:Position {canonicalName: position})
ON CREATE SET p.verified = false, p.createdAt = timestamp(), p.createdBy = "user"
MERGE (context)-[:HAS_POSITION]->(p)

MERGE (i:Industry {canonicalName: industry})
ON CREATE SET i.verified = false, i.createdAt = timestamp(), i.createdBy = "user"
MERGE (context)-[:IN_INDUSTRY]->(i)

WITH context, work_domains, skills, countryCode, cityName, citizenships, languages
UNWIND work_domains AS wdName
  MERGE (wd:WorkDomain {canonicalName: wdName})
  ON CREATE SET wd.verified = false, wd.createdAt = timestamp(), wd.createdBy = "user"
  MERGE (context)-[:IN_WORK_DOMAIN]->(wd)

WITH context, skills, countryCode, cityName, citizenships, languages
UNWIND skills AS skillName
  MERGE (s:Skill {canonicalName: skillName})
  ON CREATE SET s.verified = false, s.createdAt = timestamp(), s.createdBy = "user"
  MERGE (context)-[:USES_SKILL]->(s)

WITH context, countryCode, cityName, citizenships, languages
MERGE (co:Country {name: countryCode})
MERGE (ci:City {canonicalName: cityName})
ON CREATE SET ci.verified = false, ci.createdAt = timestamp(), ci.createdBy = "user"
MERGE (ci)-[:IN_COUNTRY]->(co)
MERGE (context)-[:IN_CITY]->(ci)
MERGE (context)-[:IN_COUNTRY]->(co)

WITH context, citizenships, languages
OPTIONAL MATCH (prev:Context {contextId: context.previousContextId})
FOREACH (_ IN CASE WHEN prev IS NOT NULL THEN [1] ELSE [] END |
  MERGE (prev)-[:NEXT_CONTEXT]->(context)
  MERGE (prev)-[:PREVIOUS_CONTEXT]->(context)
  SET prev.nextContextId = context.contextId
)

WITH context, citizenships, languages
FOREACH (code IN citizenships |
  MERGE (ct:Country {name: code})
  MERGE (context)-[:CITIZEN_OF]->(ct)
)

WITH context, languages
FOREACH (langCode IN coalesce(languages, []) |
  MERGE (lang:Language {code: langCode})
  MERGE (context)-[:SPEAKS_FLUENT]->(lang)
)

RETURN context.contextId AS contextId;`;

/**
 * Upsert trail (learning path between contexts)
 *
 * Creates or updates:
 * - Trail node with all properties
 * - Platform node + ON_PLATFORM relationship
 * - SkillPlatformNode + DEVELOPS relationship
 * - Context-Trail relationships (STEPS_ON, STEPS_TO)
 * - User-Trail relationship (HAS_TRAIL)
 *
 * Parameters:
 * - $userId: User ID (string)
 * - $trailId: Trail ID (string)
 * - $trail: Trail object
 *
 * Returns:
 * - trailId: Created/updated trail ID
 */
export const UPSERT_TRAILS_QUERY = `MERGE (t:Trail {trailId: $trailId})
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

MERGE (pl:Platform {canonicalName: $trail.platform})
ON CREATE SET pl.verified = false, pl.createdAt = timestamp(), pl.createdBy = "user"
MERGE (spn:SkillPlatformNode {skill: $trail.skill, platform: $trail.platform})
MERGE (spn)-[:ON_PLATFORM]->(pl)
MERGE (t)-[:DEVELOPS]->(spn)

WITH t
MERGE (from_ctx:Context {contextId: $trail.fromContextId})
MERGE (from_ctx)-[:STEPS_ON]->(t)

FOREACH (_ IN CASE WHEN $trail.toContextId IS NULL THEN [] ELSE [1] END |
  MERGE (to_ctx:Context {contextId: $trail.toContextId})
  MERGE (t)-[:STEPS_TO]->(to_ctx)
)

// Create direct User-Trail relationship for better query performance
MERGE (user:User {userId: $userId})
MERGE (user)-[:HAS_TRAIL]->(t)

RETURN t.trailId AS trailId;`;

/**
 * Get user's full story (contexts + trails)
 *
 * Returns:
 * - result: { user: userData, contexts: contexts[], trails: trails[] }
 *
 * Parameters:
 * - $userId: User ID (string)
 */
export const GET_USER_STORY_QUERY = `CALL {
  MATCH (user:User {userId: $userId})
  OPTIONAL MATCH (user)-[:HAS_CONTEXT]->(currentCtx:Context {contextId: user.currentContextId})-[:CITIZEN_OF]->(cit:Country)
  RETURN { user: user, citizenships: collect(DISTINCT cit.name) } AS userData
}
CALL {
  MATCH (user:User {userId: $userId})-[:HAS_CONTEXT]->(context:Context)
  OPTIONAL MATCH (context)-[:HAS_POSITION]->(p:Position)
  OPTIONAL MATCH (context)-[:IN_WORK_DOMAIN]->(wd:WorkDomain)
  OPTIONAL MATCH (context)-[:USES_SKILL]->(s:Skill)-[:BELONGS_TO]->(sc:SkillCategory)
  WITH context, p.canonicalName AS position, collect(DISTINCT wd.canonicalName) AS domains, collect(DISTINCT {name: s.canonicalName, category: sc.categoryName}) AS rawSkills
  RETURN collect({ context: context, position: position, domains: domains, rawSkills: rawSkills }) AS contexts
}
CALL {
  MATCH (user:User {userId: $userId})-[:HAS_TRAIL]->(t:Trail)
  RETURN collect(t) AS trails
}
RETURN { user: userData, contexts: contexts, trails: trails } AS result;`;

/**
 * Delete context by ID
 *
 * Parameters:
 * - $userId: User ID (string)
 * - $contextId: Context ID (string)
 *
 * Returns:
 * - result: { success: boolean }
 */
export const DELETE_CONTEXT_QUERY = `MATCH (user:User {userId: $userId})-[rel:HAS_CONTEXT]->(context:Context {contextId: $contextId})
WITH count(rel) AS deletedCount
DETACH DELETE context
RETURN { success: deletedCount > 0 } AS result;`;

/**
 * Delete trail by ID
 *
 * Parameters:
 * - $userId: User ID (string)
 * - $trailId: Trail ID (string)
 *
 * Returns:
 * - result: { success: boolean }
 */
export const DELETE_TRAIL_QUERY = `MATCH (user:User {userId: $userId})-[rel:HAS_TRAIL]->(t:Trail {trailId: $trailId})
WITH count(rel) AS deletedCount
DETACH DELETE t
RETURN { success: deletedCount > 0 } AS result;`;

/**
 * List all reasons
 *
 * Returns:
 * - reason: Reason object (reasonId, description, patterns, examples, commonCombinations)
 */
export const LIST_REASONS_QUERY = `
MATCH (r:Reason)
RETURN {
  reasonId: r.reasonId,
  description: r.description,
  patterns: r.patterns,
  commonCombinations: r.commonCombinations,
  examples: r.examples
} AS reason
ORDER BY r.reasonId
`;

/**
 * Create new reason
 *
 * Parameters:
 * - $reasonId: Reason ID (string)
 * - $description: Description (string)
 * - $patterns: Patterns (array)
 * - $examples: Examples (array)
 * - $contextId: First context ID using this reason (string)
 *
 * Returns:
 * - r: Created Reason node
 */
export const CREATE_REASON_QUERY = `
MERGE (r:Reason {reasonId: $reasonId})
SET r.description = $description,
    r.patterns = $patterns,
    r.examples = $examples,
    r.commonCombinations = [],
    r.createdAt = datetime(),
    r.createdBy = 'ai_agent',
    r.firstContextId = $contextId
RETURN r
`;
