/**
 * Search queries
 */

import { buildOptionalMatchRelationships } from '../helpers/relationships.js';
import { buildWithCollect } from '../helpers/aggregation.js';
import { buildContextMapProjection } from '../constants/projections.js';

/**
 * Get user's current context with enrichment
 *
 * Returns single context object with all relationships resolved
 *
 * Parameters:
 * - $userId: User ID (string)
 *
 * Returns:
 * - context: UserContext object
 *
 * @example
 * const query = userCurrentContextQuery();
 * const result = await tx.run(query, { userId: 'usr_123' });
 * const context = result.records[0].get('context');
 */
export function userCurrentContextQuery(): string {
  return `
MATCH (searchingUser:User {userId: $userId})-[:HAS_CONTEXT]->(searchingContext:Context {contextId: searchingUser.currentContextId})
${buildOptionalMatchRelationships('searchingContext')}

${buildWithCollect('searchingContext')}

RETURN ${buildContextMapProjection('searching')} AS context
  `.trim();
}

/**
 * Get user's current context ID (lightweight query)
 *
 * Returns only contextId without enrichment
 *
 * Parameters:
 * - $userId: User ID (string)
 *
 * Returns:
 * - currentContextId: string | null
 *
 * @example
 * const query = userCurrentContextIdQuery();
 * const result = await tx.run(query, { userId: 'usr_123' });
 * const contextId = result.records[0].get('currentContextId');
 */
export function userCurrentContextIdQuery(): string {
  return `
MATCH (searchingUser:User {userId: $userId})
WHERE searchingUser.currentContextId IS NOT NULL
RETURN searchingUser.currentContextId AS currentContextId
  `.trim();
}
