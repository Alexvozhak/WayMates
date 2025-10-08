MATCH (user:User {user_id: $user_id})-[:HAS_CONTEXT]->(context:Context {context_id: $context_id})-[:HAS_POSITION]->(position:Position)
OPTIONAL MATCH (context)-[:IN_WORK_DOMAIN]->(domain:WorkDomain)
OPTIONAL MATCH (context)-[:USES_SKILL]->(skill:Skill)
OPTIONAL MATCH (context)-[:IN_INDUSTRY]->(industry:Industry)
OPTIONAL MATCH (context)-[:IN_CITY]->(city:City)-[:IN_COUNTRY]->(country:Country)

RETURN {
  // Системные поля
  context_id: context.context_id,
  
  // Обязательные поля
  created_at: context.created_at,
  creation_reason: context.creation_reason,
  position: position.name,
  domains: collect(DISTINCT domain.name),
  skills: collect(DISTINCT {name: skill.name, category: skill.category}),
  
  // Плоская структура
  industry: industry.name,
  company_size: context.company_size,
  country_code: country.name,  // ✅ Теперь country.name содержит код
  city_name: city.name,
  work_type: context.work_type,
  team_size: context.team_size
} as currentContext




