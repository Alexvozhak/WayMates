/**
 * Helpers for trajectory collection (PREVIOUS_CONTEXT relationship traversal)
 */

/**
 * Build FULL trajectory from user's current context
 *
 * Gets user's current context via currentContextId property and traverses
 * backwards to collect the FULL career trajectory.
 *
 * Use when you need full trajectory regardless of which context matched criteria.
 * For target search: matched context may be in the middle of trajectory.
 *
 * @param userVar - User variable name (e.g., 'matchedUser')
 * @param carryVars - Variables to carry through WITH clause
 * @returns Cypher for getting current context and collecting full trajectory
 *
 * @example
 * buildFullTrajectoryFromUser('matchedUser', ['matchedContext', 'timeSinceMatchedMonths'])
 * // Returns:
 * // MATCH (matchedUser)-[:HAS_CONTEXT]->(currentCtx:Context {contextId: matchedUser.currentContextId})
 * // MATCH fullPath = (currentCtx)<-[:PREVIOUS_CONTEXT*0..]-(startCtx:Context)
 * // WHERE startCtx.previousContextId IS NULL
 * // WITH matchedUser, matchedContext, timeSinceMatchedMonths, [node IN nodes(fullPath) | node] AS matchedPathNodes
 */
export function buildFullTrajectoryFromUser(userVar: string, carryVars: string[]): string {
  const prefix = userVar.replace("User", "");

  return `
// Get user's CURRENT context for FULL trajectory collection
MATCH (${userVar})-[:HAS_CONTEXT]->(currentCtx:Context {contextId: ${userVar}.currentContextId})

// Collect FULL trajectory from current context backwards
MATCH fullPath = (currentCtx)<-[:PREVIOUS_CONTEXT*0..]-(startCtx:Context)
WHERE startCtx.previousContextId IS NULL
WITH ${userVar}, ${carryVars.join(", ")}, [node IN nodes(fullPath) | node] AS ${prefix}PathNodes
  `.trim();
}

/**
 * Build UNWIND for path nodes with ordering
 *
 * Unwinds path nodes array into individual context for enrichment
 * Typically used after buildMatchPath() or buildFullTrajectoryFromUser()
 *
 * @param pathNodesVar - Path nodes array variable (e.g., 'matchedPathNodes')
 * @param contextVar - Target context variable for UNWIND (e.g., 'matchedPathContext')
 * @returns UNWIND clause
 *
 * @example
 * buildUnwindPath('matchedPathNodes', 'matchedPathContext')
 * // Returns:
 * // UNWIND matchedPathNodes AS matchedPathContext
 */
export function buildUnwindPath(pathNodesVar: string, contextVar: string): string {
  return `UNWIND ${pathNodesVar} AS ${contextVar}`;
}
