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
  ON CREATE SET context.createdAt = $ctx.createdAt,
                context.updatedAt = timestamp()
SET context.createdAt = $ctx.createdAt,
    context.updatedAt = timestamp(),
    context.position = $ctx.position,
    context.role = $ctx.role,
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
    context.nextContextId = $ctx.nextContextId,
    context.feedback = $ctx.feedback

MERGE (user)-[:HAS_CONTEXT]->(context)

FOREACH (_ IN CASE WHEN context.nextContextId IS NULL THEN [1] ELSE [] END |
  SET user.currentContextId = context.contextId
)

// Delete old relationships before creating new ones to prevent duplicates
WITH context, user
CALL {
  WITH context
  OPTIONAL MATCH (context)-[r:HAS_POSITION]->() DELETE r
  RETURN count(*) AS _del_pos
}
CALL {
  WITH context
  OPTIONAL MATCH (context)-[r:HAS_ROLE]->() DELETE r
  RETURN count(*) AS _del_role
}
CALL {
  WITH context
  OPTIONAL MATCH (context)-[r:IN_INDUSTRY]->() DELETE r
  RETURN count(*) AS _del_ind
}
CALL {
  WITH context
  OPTIONAL MATCH (context)-[r:IN_WORK_DOMAIN]->() DELETE r
  RETURN count(*) AS _del_wd
}
CALL {
  WITH context
  OPTIONAL MATCH (context)-[r:USES_SKILL]->() DELETE r
  RETURN count(*) AS _del_sk
}
CALL {
  WITH context
  OPTIONAL MATCH (context)-[r:IN_CITY]->() DELETE r
  RETURN count(*) AS _del_ci
}
CALL {
  WITH context
  OPTIONAL MATCH (context)-[r:IN_COUNTRY]->() DELETE r
  RETURN count(*) AS _del_co
}
CALL {
  WITH context
  OPTIONAL MATCH (context)-[r:CITIZEN_OF]->() DELETE r
  RETURN count(*) AS _del_ct
}
CALL {
  WITH context
  OPTIONAL MATCH (context)-[r:SPEAKS_FLUENT]->() DELETE r
  RETURN count(*) AS _del_lg
}
CALL {
  WITH context
  OPTIONAL MATCH (context)-[r:HAS_EDUCATION_LEVEL]->() DELETE r
  RETURN count(*) AS _del_el
}

WITH context, user,
     $ctx.position AS position,
     $ctx.role AS role,
     $ctx.industry AS industry,
     $ctx.domains AS work_domains,
     $ctx.skills AS skills,
     $ctx.countryCode AS countryCode,
     $ctx.cityName AS cityName,
     $ctx.citizenships AS citizenships,
     $ctx.languages AS languages,
     $ctx.educationLevel AS educationLevel

MERGE (p:Position {canonicalName: position})
ON CREATE SET p.verified = false, p.createdAt = timestamp(), p.createdBy = "user"
MERGE (context)-[:HAS_POSITION]->(p)

MERGE (r:Role {canonicalName: role})
ON CREATE SET r.verified = false, r.createdAt = timestamp(), r.createdBy = "user"
MERGE (context)-[:HAS_ROLE]->(r)

MERGE (i:Industry {canonicalName: industry})
ON CREATE SET i.verified = false, i.createdAt = timestamp(), i.createdBy = "user"
MERGE (context)-[:IN_INDUSTRY]->(i)

FOREACH (_ IN CASE WHEN educationLevel IS NOT NULL THEN [1] ELSE [] END |
  MERGE (el:EducationLevel {canonicalName: educationLevel})
  ON CREATE SET el.verified = true, el.createdAt = timestamp(), el.createdBy = "system"
  MERGE (context)-[:HAS_EDUCATION_LEVEL]->(el)
)

WITH context, work_domains, skills, countryCode, cityName, citizenships, languages
UNWIND work_domains AS wdName
  MERGE (wd:WorkDomain {canonicalName: wdName})
  ON CREATE SET wd.verified = false, wd.createdAt = timestamp(), wd.createdBy = "user"
  MERGE (context)-[:IN_WORK_DOMAIN]->(wd)

WITH context, skills, countryCode, cityName, citizenships, languages
UNWIND skills AS skillName
  MERGE (s:Skill {canonicalName: skillName})
  ON CREATE SET s.verified = false, s.createdAt = timestamp(), s.createdBy = "user", s.complexity = null
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

// Auto-complete ongoing trails: when new context links to previous,
// update trails from previous context that have toContextId = null
// Uses collect() to safely handle case when previousContextId is null (MATCH returns nothing)
WITH context, citizenships, languages
OPTIONAL MATCH (prevCtx:Context {contextId: context.previousContextId})-[:STEPS_ON]->(ongoingTrail:Trail)
WHERE ongoingTrail.toContextId IS NULL
WITH context, citizenships, languages, collect(ongoingTrail) AS ongoingTrails
FOREACH (t IN ongoingTrails |
  SET t.toContextId = context.contextId
)
WITH context, citizenships, languages, ongoingTrails
FOREACH (t IN ongoingTrails |
  MERGE (t)-[:STEPS_TO]->(context)
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
    t.totalDurationWeeks = coalesce($trail.totalDurationWeeks, null),
    t.sessionsPerWeek = coalesce($trail.schedule.sessionsPerWeek, null),
    t.hoursPerSession = coalesce($trail.schedule.hoursPerSession, null),
    t.costUsd = coalesce($trail.costUsd, null),
    t.ratingCourse = coalesce($trail.ratingCourse, null),
    t.ratingPlatform = coalesce($trail.ratingPlatform, null),
    t.ratingSchedule = coalesce($trail.ratingSchedule, null),
    t.courseName = coalesce($trail.courseName, null),
    t.courseLink = coalesce($trail.courseLink, null),
    t.userFeedback = coalesce($trail.userFeedback, null)

MERGE (pl:Platform {canonicalName: $trail.platform})
ON CREATE SET pl.verified = false, pl.createdAt = timestamp(), pl.createdBy = "user"
MERGE (spn:SkillPlatformNode {skill: $trail.skill, platform: $trail.platform})
MERGE (spn)-[:ON_PLATFORM]->(pl)
MERGE (t)-[:DEVELOPS]->(spn)

WITH t
FOREACH (_ IN CASE WHEN $trail.fromContextId IS NOT NULL THEN [1] ELSE [] END |
  MERGE (from_ctx:Context {contextId: $trail.fromContextId})
  MERGE (from_ctx)-[:STEPS_ON]->(t)
)

WITH t
FOREACH (_ IN CASE WHEN $trail.toContextId IS NOT NULL THEN [1] ELSE [] END |
  MERGE (to_ctx:Context {contextId: $trail.toContextId})
  MERGE (t)-[:STEPS_TO]->(to_ctx)
)

// Create direct User-Trail relationship for better query performance
WITH t
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
  RETURN user
}
CALL {
  MATCH (user:User {userId: $userId})-[:HAS_CONTEXT]->(context:Context)
  OPTIONAL MATCH (context)-[:HAS_POSITION]->(p:Position)
  OPTIONAL MATCH (context)-[:HAS_ROLE]->(r:Role)
  OPTIONAL MATCH (context)-[:IN_WORK_DOMAIN]->(wd:WorkDomain)
  OPTIONAL MATCH (context)-[:USES_SKILL]->(s:Skill)
  OPTIONAL MATCH (context)-[:CITIZEN_OF]->(cit:Country)
  OPTIONAL MATCH (context)-[:SPEAKS_FLUENT]->(lang:Language)
  WITH context, p.canonicalName AS position, r.canonicalName AS role, collect(DISTINCT wd.canonicalName) AS domains, collect(DISTINCT s.canonicalName) AS skills, collect(DISTINCT cit.name) AS citizenships, collect(DISTINCT lang.code) AS languages
  WITH context {
    .contextId,
    .previousContextId,
    .nextContextId,
    .createdAt,
    .creationReason,
    .birthYear,
    .industry,
    .companySize,
    .countryCode,
    .cityName,
    .educationLevel,
    .salaryExact,
    .salaryMin,
    .salaryMax,
    .feedback,
    position: position,
    role: role,
    domains: domains,
    skills: skills,
    citizenships: citizenships,
    languages: CASE WHEN size(languages) > 0 THEN languages ELSE null END
  } AS ctx
  ORDER BY ctx.createdAt ASC
  RETURN collect(ctx) AS contexts
}
CALL {
  MATCH (user:User {userId: $userId})-[:HAS_TRAIL]->(t:Trail)
  WITH t {
    .trailId,
    .skill,
    .platform,
    .fromContextId,
    .toContextId,
    .totalDurationWeeks,
    .costUsd,
    .ratingCourse,
    .ratingPlatform,
    .ratingSchedule,
    .courseName,
    .courseLink,
    .userFeedback,
    schedule: CASE
      WHEN t.sessionsPerWeek IS NOT NULL OR t.hoursPerSession IS NOT NULL
      THEN { sessionsPerWeek: t.sessionsPerWeek, hoursPerSession: t.hoursPerSession }
      ELSE null
    END
  } AS trail
  RETURN collect(trail) AS trails
}
RETURN { userId: user.userId, contexts: contexts, trails: trails } AS result;`;

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
WITH context, count(rel) AS deletedCount
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
export const DELETE_TRAIL_QUERY = `MATCH (user:User {userId: $userId})-[:HAS_TRAIL]->(t:Trail {trailId: $trailId})
DETACH DELETE t
RETURN { success: true } AS result;`;

/**
 * List all reasons
 *
 * Returns:
 * - reason: Reason object (canonicalName, description, patterns, examples, commonCombinations)
 */
export const LIST_REASONS_QUERY = `
MATCH (r:Reason)
RETURN {
  canonicalName: r.canonicalName,
  description: r.description,
  patterns: r.patterns,
  commonCombinations: r.commonCombinations,
  examples: r.examples
} AS reason
ORDER BY r.canonicalName
`;

/**
 * Create new reason
 *
 * Parameters:
 * - $canonicalName: Reason canonical name (string)
 * - $description: Description (string)
 * - $patterns: Patterns (array)
 * - $examples: Examples (array)
 * - $contextId: First context ID using this reason (string)
 *
 * Returns:
 * - r: Created Reason node
 */
export const CREATE_REASON_QUERY = `
MERGE (r:Reason {canonicalName: $canonicalName})
SET r.description = $description,
    r.patterns = $patterns,
    r.examples = $examples,
    r.commonCombinations = [],
    r.createdAt = datetime(),
    r.createdBy = 'ai_agent',
    r.firstContextId = $contextId
RETURN r
`;

/**
 * Delete entire user story (all contexts + trails + user node)
 *
 * Use case: Test cleanup, complete user deletion from Neo4j
 *
 * Parameters:
 * - $userId: User ID (string)
 *
 * Returns:
 * - result: { success: boolean, deletedContexts: number, deletedTrails: number }
 *
 * Idempotent: returns success=false if user not found (no error thrown)
 */
export const DELETE_STORY_QUERY = `OPTIONAL MATCH (u:User {userId: $userId})-[:HAS_CONTEXT]->(c:Context)
WITH u, collect(c) AS contexts
OPTIONAL MATCH (u)-[:HAS_TRAIL]->(t:Trail)
WITH u, contexts, collect(t) AS trails
WITH u,
     size(contexts) AS deletedContexts,
     size(trails) AS deletedTrails,
     contexts,
     trails
FOREACH (ctx IN contexts | DETACH DELETE ctx)
FOREACH (tr IN trails | DETACH DELETE tr)
WITH u, deletedContexts, deletedTrails
WHERE u IS NOT NULL
DELETE u
RETURN {
  success: true,
  deletedContexts: deletedContexts,
  deletedTrails: deletedTrails
} AS result;`;
