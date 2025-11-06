export const SET_GOAL_QUERY: string = `
MERGE (u:User {user_id: $user_id})
MERGE (u)-[:HAS_GOAL]->(g:Goal {user_id: $user_id})
SET g.target_criteria = $target_criteria,
    g.created_at = COALESCE(g.created_at, $created_at)
RETURN g.user_id AS user_id
`;

export const GET_USER_GOAL_QUERY: string = `
MATCH (u:User {user_id: $user_id})-[:HAS_GOAL]->(g:Goal)
RETURN g {
  goal_id: g.user_id,
  .user_id,
  .target_criteria,
  .created_at
} AS goal
`;

export const DELETE_GOAL_QUERY: string = `
MATCH (u:User {user_id: $user_id})-[rel:HAS_GOAL]->(g:Goal)
DETACH DELETE g
RETURN count(rel) > 0 AS success
`;
