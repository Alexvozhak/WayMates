export function buildCurrentContextQuery(
  whereClause: string,
  scoreClause: string
): string {
  return `/* ============================================
 * ПОИСК CURRENT КОНТЕКСТОВ
 * ============================================ */

WITH $currentContext AS requestedCurrentContext

MATCH
  (dbCurrentUser:User)-[:HAS_CONTEXT]->(dbCurrentContext:Context)
WITH *, dbCurrentUser, dbCurrentContext, requestedCurrentContext
WHERE
  requestedCurrentContext IS NOT NULL
  ${whereClause ? `AND ${whereClause}` : ''}

${scoreClause}

WITH *, dbCurrentUser, dbCurrentContext, compatibilityScore AS currentContextCompatibilityScore
WHERE dbCurrentUser IS NOT NULL
WITH *, dbCurrentUser, dbCurrentContext, currentContextCompatibilityScore`;
}

export function buildTargetTransitionQuery(
  whereClause: string,
  scoreClause: string
): string {
  return `/* ============================================
 * ПОИСК TARGET КОНТЕКСТОВ
 * ============================================ */

WITH *, $targetContext AS requestedTargetContext

MATCH
  (dbCurrentUser)-[:HAS_CONTEXT]->(dbTargetContext:Context)
WITH *, dbCurrentUser, requestedTargetContext, dbTargetContext
WHERE
  requestedTargetContext IS NOT NULL
  ${whereClause ? `AND ${whereClause}` : ''}

${scoreClause}

WITH *, dbCurrentUser, dbCurrentContext, currentContextCompatibilityScore, dbTargetContext, compatibilityScore AS targetContextCompatibilityScore
WHERE dbCurrentUser IS NOT NULL
WITH *, dbCurrentUser, dbCurrentContext, currentContextCompatibilityScore, dbTargetContext, targetContextCompatibilityScore`;
}
