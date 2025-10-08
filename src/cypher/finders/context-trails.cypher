MATCH (from_ctx:Context {context_id: $from_context_id})
-[:STEPS_ON]->(trail:Trail)-[:STEPS_TO]->(to_ctx:Context {context_id: $to_context_id})
OPTIONAL MATCH (trail)-[:DEVELOPS]->(spn:SkillPlatformNode)-[:ON_PLATFORM]->(platform:Platform)
RETURN trail, collect(spn.skill) AS skills_developed, collect(platform.name) AS platforms_used;




