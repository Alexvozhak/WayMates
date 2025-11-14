/**
 * Path collection queries
 */

import { buildOptionalMatchRelationships } from '../helpers/relationships.js';
import { buildWithCollect } from '../helpers/aggregation.js';
import { buildContextMapProjection } from '../constants/projections.js';

/**
 * Build path query for batch trajectory collection
 *
 * Collects full trajectories for multiple users in parallel
 * Traverses PREVIOUS_CONTEXT relationships backwards from current context to first context
 *
 * Parameters:
 * - $userIds: Array of user IDs (string[])
 *
 * Returns:
 * - userId: User ID
 * - path: Array of contexts (trajectory from first to current, chronologically ordered)
 *
 * @example
 * const query = buildPathQuery();
 * const result = await tx.run(query, { userIds: ['usr_1', 'usr_2'] });
 * result.records.forEach(record => {
 *   const userId = record.get('userId');
 *   const path = record.get('path');
 *   console.log(`User ${userId} has ${path.length} contexts in trajectory`);
 * });
 */
export function buildPathQuery(): string {
  return `
UNWIND $userIds AS userId
MATCH (searchingUser:User {userId: userId})
MATCH (end:Context {contextId: searchingUser.currentContextId})
MATCH path = (end)<-[:PREVIOUS_CONTEXT*0..]-(start:Context)
WHERE start.previousContextId IS NULL

WITH userId, [node IN nodes(path) | node] AS pathNodes
UNWIND pathNodes AS searchingPathContext

${buildOptionalMatchRelationships('searchingPathContext')}

${buildWithCollect('searchingPathContext', ['userId'])}

ORDER BY searchingPathContext.createdAt ASC

WITH userId, collect(${buildContextMapProjection('searchingPath')}) AS path
RETURN userId, path
  `.trim();
}
