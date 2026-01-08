/**
 * Goals queries
 */

/**
 * Set or update user's goal (UPSERT)
 *
 * Creates user if doesn't exist, creates/updates goal
 *
 * Parameters:
 * - $userId: User ID (string)
 * - $createdAt: Goal creation timestamp (ISO string)
 * - $targetContext: Target criteria object (TargetCriteria)
 *
 * Returns:
 * - goal: Goal object { userId, targetContext, createdAt }
 *
 * @example
 * const query = setGoalQuery();
 * const result = await tx.run(query, {
 *   userId: 'usr_123',
 *   createdAt: new Date().toISOString(),
 *   targetContext: { ... }
 * });
 */
export function setGoalQuery(): string {
  return `
MERGE (searchingUser:User {userId: $userId})
WITH searchingUser
OPTIONAL MATCH (searchingUser)-[r:HAS_GOAL]->(oldGoal:Goal)
WITH searchingUser, oldGoal.createdAt AS originalCreatedAt, r, oldGoal
DELETE r, oldGoal
WITH searchingUser, originalCreatedAt
CREATE (searchingUser)-[:HAS_GOAL]->(g:Goal {
  userId: $userId,
  createdAt: coalesce(originalCreatedAt, $createdAt),
  targetContext: $targetContext
})
RETURN g {
  .userId,
  .targetContext,
  .createdAt
} AS goal
  `.trim();
}

/**
 * Get user's goal
 *
 * Parameters:
 * - $userId: User ID (string)
 *
 * Returns:
 * - goal: Goal object { userId, targetContext, createdAt } | null
 *
 * @example
 * const query = getUserGoalQuery();
 * const result = await tx.run(query, { userId: 'usr_123' });
 * const goal = result.records[0]?.get('goal');
 */
export function getUserGoalQuery(): string {
  return `
MATCH (searchingUser:User {userId: $userId})-[:HAS_GOAL]->(g:Goal)
RETURN g {
  .userId,
  .targetContext,
  .createdAt
} AS goal
  `.trim();
}

/**
 * Delete user's goal
 *
 * Parameters:
 * - $userId: User ID (string)
 *
 * Returns:
 * - success: boolean (true if goal existed and was deleted)
 *
 * @example
 * const query = deleteGoalQuery();
 * const result = await tx.run(query, { userId: 'usr_123' });
 * const success = result.records[0].get('success');
 */
export function deleteGoalQuery(): string {
  return `
MATCH (searchingUser:User {userId: $userId})-[rel:HAS_GOAL]->(g:Goal)
DETACH DELETE g
RETURN count(rel) > 0 AS success
  `.trim();
}
