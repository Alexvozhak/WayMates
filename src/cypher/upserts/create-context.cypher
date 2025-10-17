MERGE (u:User {user_id: $user_id})
ON CREATE SET u.current_context_id = null

// User demographics from context
SET u.birth_year = coalesce($context.birth_year, u.birth_year)

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

// Location nodes - УНИФИЦИРОВАННАЯ СХЕМА (name для всех)
WITH c
MERGE (cty:Country {name: $context.country_code})  // ✅ country_code КАК name
MERGE (ci:City {name: $context.city_name})         // ✅ убрали country_code из City
MERGE (ci)-[:IN_COUNTRY]->(cty)
MERGE (c)-[:IN_CITY]->(ci)
MERGE (c)-[:IN_COUNTRY]->(cty)  // ✅ ПРЯМАЯ СВЯЗЬ!

// Temporal context links - создаем связи между контекстами
WITH c
OPTIONAL MATCH (prev:Context {context_id: c.previous_context_id})
FOREACH (_ IN CASE WHEN prev IS NOT NULL THEN [1] ELSE [] END |
  MERGE (prev)-[:NEXT_CONTEXT]->(c)
  SET prev.next_context_id = c.context_id
)

// Citizenship relations from context - УНИФИЦИРОВАННАЯ СХЕМА
WITH c
FOREACH (code IN $context.citizenships |
  MERGE (ct:Country {name: code})  // ✅ code КАК name
  MERGE (c)-[:CITIZEN_OF]->(ct)   // ✅ СВЯЗЬ ОТ CONTEXT, НЕ ОТ USER
)

RETURN c.context_id AS context_id;

