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
  ${whereClause ? `AND ${whereClause}` : ""}

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
  (dbTargetUser:User)-[:HAS_CONTEXT]->(dbTargetContext:Context)
WITH *, dbCurrentUser, dbCurrentContext, currentContextCompatibilityScore, dbTargetUser, requestedTargetContext, dbTargetContext
WHERE
  requestedTargetContext IS NOT NULL
  AND dbTargetUser <> dbCurrentUser
  ${whereClause ? `AND ${whereClause}` : ""}

${scoreClause}

WITH *, dbCurrentUser, dbCurrentContext, currentContextCompatibilityScore, dbTargetUser, dbTargetContext, compatibilityScore AS targetContextCompatibilityScore
WHERE dbCurrentUser IS NOT NULL AND dbTargetUser IS NOT NULL
WITH *, dbCurrentUser, dbCurrentContext, currentContextCompatibilityScore, dbTargetUser, dbTargetContext, targetContextCompatibilityScore`;
}
