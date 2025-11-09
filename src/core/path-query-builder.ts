/**
 * Unified path collection query builder (simplified).
 *
 * REFACTORED: Removed complex PathQueryConfig, always uses batch mode.
 * - Always batch (UNWIND)
 * - Always backward traversal (PREVIOUS_CONTEXT)
 * - Always contextIds as input
 * - Universal alias 'id' in RETURN
 */

/**
 * Builds a batch path collection query for multiple users.
 *
 * **Always:**
 * - Batch mode with UNWIND
 * - Backward traversal via PREVIOUS_CONTEXT from user's current context
 * - Takes userIds array as input
 * - Returns userId and full trajectory
 * - NO filtering by creation_reason (pure data loading)
 *
 * @returns Cypher query string
 *
 * @example Basic usage
 * ```typescript
 * const query = buildPathQuery();
 * // Uses: UNWIND $userIds AS userId
 * ```
 */
export function buildPathQuery(): string {
  return `
    UNWIND $userIds AS userId
    MATCH (u:User {userId: userId})
    MATCH (end:Context {contextId: u.currentContextId})
    MATCH path = (end)<-[:PREVIOUS_CONTEXT*0..]-(start:Context)
    WHERE start.previousContextId IS NULL

    WITH userId, [node IN nodes(path) | node] AS pathNodes
    UNWIND pathNodes AS ctx

    OPTIONAL MATCH (ctx)-[:HAS_POSITION]->(p:Position)
    OPTIONAL MATCH (ctx)-[:IN_WORK_DOMAIN]->(wd:WorkDomain)
    OPTIONAL MATCH (ctx)-[:USES_SKILL]->(s:Skill)
    OPTIONAL MATCH (ctx)-[:IN_INDUSTRY]->(i:Industry)
    OPTIONAL MATCH (ctx)-[:IN_CITY]->(ci:City)
    OPTIONAL MATCH (ctx)-[:IN_COUNTRY]->(co:Country)

    WITH userId, ctx, p, wd, s, i, ci, co,
         collect(DISTINCT wd.name) AS domains,
         collect(DISTINCT s.name) AS skills
    ORDER BY ctx.createdAt ASC

    WITH userId, collect(ctx {
      .contextId,
      .previousContextId,
      .nextContextId,
      .createdAt,
      .creationReason,
      .birthYear,
      .citizenships,
      .companySize,
      position: p.name,
      domains: [d IN domains WHERE d IS NOT NULL],
      skills: [sk IN skills WHERE sk IS NOT NULL],
      industry: i.name,
      countryCode: co.name,
      cityName: ci.name
    }) AS path
    RETURN userId, path
  `.trim();
}
