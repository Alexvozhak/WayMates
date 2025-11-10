export const SET_GOAL_QUERY = `
MERGE (u:User {userId: $userId})
MERGE (u)-[:HAS_GOAL]->(g:Goal)
ON CREATE SET
  g.userId = $userId,
  g.createdAt = $createdAt,
  g.targetCriteria = $targetCriteria
ON MATCH SET
  g.targetCriteria = $targetCriteria
RETURN g.userId AS userId
`;

export const GET_USER_GOAL_QUERY = `
MATCH (u:User {userId: $userId})-[:HAS_GOAL]->(g:Goal)
RETURN g {
  .userId,
  .targetCriteria,
  .createdAt
} AS goal
`;

export const DELETE_GOAL_QUERY = `
MATCH (u:User {userId: $userId})-[rel:HAS_GOAL]->(g:Goal)
DETACH DELETE g
RETURN count(rel) > 0 AS success
`;
