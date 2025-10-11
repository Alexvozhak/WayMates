import type { FlexibleField } from "../schemas-zod.js";

export function buildScoreClause(
  requestedVar: string,
  candidateVar: string,
  flexibleFields: FlexibleField[],
  scoreVar: string
): string {
  const conditions = flexibleFields.map(
    ({ field, weight }) =>
      `CASE WHEN ${candidateVar}.${field} = ${requestedVar}.${field} THEN ${weight} ELSE 0 END`
  );
  return `
WITH *, (
  ${conditions.join(" +\n  ")}
) AS ${scoreVar}
WHERE ${scoreVar} > 0
`;
}

export function buildContextQuery(
  searchScope: "all" | "filtered",
  whereClause: string,
  scoreClause: string,
  limit: number
): string {
  // Унифицированные имена переменных
  const userVar = "dbUser";
  const contextVar = "dbContext";
  const compatibilityScoreVar = "contextCompatibilityScore";

  // Определяем параметр и переменные в зависимости от области поиска
  const paramName =
    searchScope === "all" ? "$currentContext" : "$targetContext";
  const requestedVar = "requestedContext";

  // Для filtered поиска нужны переменные из предыдущего шага
  const additionalVars =
    searchScope === "filtered"
      ? ", dbCurrentUser, dbCurrentContext, currentContextCompatibilityScore"
      : "";

  const additionalFinalVars =
    searchScope === "filtered"
      ? ", dbCurrentUser, dbCurrentContext, currentContextCompatibilityScore"
      : "";

  return `/* ============================================
 * ПОИСК КОНТЕКСТОВ ${searchScope === "all" ? "(СРЕДИ ВСЕХ)" : "(СРЕДИ ОТФИЛЬТРОВАННЫХ)"}
 * ============================================ */

WITH ${searchScope === "filtered" ? "*," : ""} ${paramName} AS ${requestedVar}

MATCH
  (${userVar}:User)-[:HAS_CONTEXT]->(${contextVar}:Context)
WITH *, ${userVar}, ${contextVar}, ${requestedVar}${additionalVars}
WHERE
  ${requestedVar} IS NOT NULL
  AND ${userVar} <> dbCurrentUser
  ${whereClause ? `AND ${whereClause}` : ""}

${scoreClause}

WITH *, ${userVar}, ${contextVar}, compatibilityScore AS ${compatibilityScoreVar}${additionalFinalVars}
WHERE ${userVar} IS NOT NULL${searchScope === "filtered" ? " AND dbCurrentUser IS NOT NULL" : ""}
WITH *, ${userVar}, ${contextVar}, ${compatibilityScoreVar}${additionalFinalVars}
RETURN {
  userId: ${userVar},
  currentContext: ${searchScope === "all" ? contextVar : "null"},
  currentScore: ${searchScope === "all" ? compatibilityScoreVar : "null"},
  targetContext: ${searchScope === "filtered" ? contextVar : "null"},
  targetScore: ${searchScope === "filtered" ? compatibilityScoreVar : "null"}
} AS result
LIMIT ${limit}
`;
}

// === Pipeline Query Builder ===
export function buildPipelineQuery(
  whereClauseCurrent: string,
  scoreClauseCurrent: string,
  whereClauseTarget: string,
  scoreClauseTarget: string,
  limit: number
): string {
  return `
CALL {
  WITH $currentContext AS requestedCurrentContext, $me AS me
  MATCH (dbCurrentUser:User)-[:HAS_CONTEXT]->(dbCurrentContext:Context)
  WITH dbCurrentUser, dbCurrentContext, requestedCurrentContext, me
  WHERE requestedCurrentContext IS NOT NULL
    AND dbCurrentUser <> me
    ${whereClauseCurrent ? `AND ${whereClauseCurrent}` : ""}
  ${scoreClauseCurrent}
  WITH collect({ user: dbCurrentUser, currentContext: dbCurrentContext, currentScore: currentContextCompatibilityScore }) AS candidates
  RETURN candidates
}
UNWIND candidates AS cand
CALL {
  WITH cand.user AS dbCurrentUser,
       cand.currentContext AS dbCurrentContext,
       cand.currentScore AS currentScore,
       $targetContext AS requestedTargetContext,
       $me AS me
  MATCH (dbCurrentUser)-[:HAS_CONTEXT]->(dbTargetContext:Context)
  WITH dbCurrentUser, dbCurrentContext, dbTargetContext, requestedTargetContext, currentScore, me
  WHERE requestedTargetContext IS NOT NULL
    AND dbCurrentUser <> me
    ${whereClauseTarget ? `AND ${whereClauseTarget}` : ""}
  ${scoreClauseTarget}
  WITH collect({ user: dbCurrentUser, currentContext: dbCurrentContext, currentScore: currentScore, targetContext: dbTargetContext, targetScore: targetContextCompatibilityScore }) AS results
  RETURN results
}
UNWIND results AS r
RETURN r.user AS userId,
       r.currentContext AS currentContext,
       r.currentScore AS currentScore,
       r.targetContext AS targetContext,
       r.targetScore AS targetScore
LIMIT ${limit}
`;
}
