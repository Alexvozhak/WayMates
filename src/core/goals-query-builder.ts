export const CREATE_GOAL_QUERY: string = `
MERGE (u:User {user_id: $user_id})
CREATE (g:Goal {
  goal_id: $goal_id,
  user_id: $user_id,
  target_context_id: $target_context_id,
  created_at: $created_at
})
MERGE (u)-[:HAS_GOAL]->(g)
RETURN g.goal_id AS goal_id
`;

export const GET_USER_GOAL_IDS_QUERY: string = `
MATCH (u:User {user_id: $user_id})-[:HAS_GOAL]->(g:Goal)
RETURN g {
  .goal_id,
  .user_id,
  .target_context_id,
  .created_at
} AS goal
ORDER BY g.created_at DESC
`;

export const GET_USER_GOAL_CONTEXTS_QUERY: string = `
MATCH (u:User {user_id: $user_id})-[:HAS_GOAL]->(g:Goal)
MATCH (target:Context {context_id: g.target_context_id})
OPTIONAL MATCH (target)-[:HAS_POSITION]->(p:Position)
OPTIONAL MATCH (target)-[:IN_WORK_DOMAIN]->(wd:WorkDomain)
OPTIONAL MATCH (target)-[:USES_SKILL]->(s:Skill)
OPTIONAL MATCH (target)-[:IN_INDUSTRY]->(i:Industry)
OPTIONAL MATCH (target)-[:IN_CITY]->(ci:City)
OPTIONAL MATCH (target)-[:IN_COUNTRY]->(co:Country)
WITH g, target, p.name AS position,
     collect(DISTINCT wd.name) AS domains,
     collect(DISTINCT s.name) AS skills,
     i.name AS industry,
     ci.name AS city_name,
     co.name AS country_code
RETURN {
  user_id: g.user_id,
  target_context_id: g.target_context_id,
  created_at: g.created_at,
  target_context: {
    context_id: target.context_id,
    position: position,
    domains: domains,
    skills: skills,
    industry: industry,
    company_size: target.company_size,
    country_code: country_code,
    city_name: city_name,
    work_type: target.work_type,
    citizenships: target.citizenships,
    team_size: target.team_size,
    birth_year: target.birth_year,
    creation_reason: target.creation_reason,
    created_at: target.created_at,
    previous_context_id: target.previous_context_id,
    next_context_id: target.next_context_id
  }
} AS goalWithContext
ORDER BY g.created_at DESC
`;

export const DELETE_GOAL_QUERY: string = `
MATCH (u:User {user_id: $user_id})-[rel:HAS_GOAL]->(g:Goal {goal_id: $goal_id})
WITH count(rel) AS deletedCount
DETACH DELETE g
RETURN deletedCount > 0 AS success
`;
