MERGE (t:Trail {trail_id: $trail.trail_id})
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
MERGE (from_ctx:Context {context_id: $trail.from_context_id})
MERGE (from_ctx)-[:STEPS_ON]->(t)

// Create direct User-Trail relationship for better query performance
MERGE (u:User {user_id: $user_id})
MERGE (u)-[:HAS_TRAIL]->(t)

// Handle optional to_context_id (null for ongoing trails)
FOREACH (_ IN CASE WHEN $trail.to_context_id IS NULL THEN [] ELSE [1] END |
  MERGE (to_ctx:Context {context_id: $trail.to_context_id})
  MERGE (t)-[:STEPS_TO]->(to_ctx)
)
RETURN t.trail_id AS trail_id;
