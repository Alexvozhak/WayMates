import type { FlexibleField, SearchConstraints } from "../schemas-zod.js";

export function buildContextQuery(
  searchScope: "all" | "filtered",
  whereClause: string,
  scoreClause: string,
  searchConstraints: SearchConstraints
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

  // Determine limit from constraints
  const limit = searchConstraints.results_limit;

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
// Note: searchConstraints available for future use
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
  whereCurrent: string,
  scoreCurrent: string,
  whereTarget: string,
  scoreTarget: string,
  searchConstraints: SearchConstraints
): string {
  const limit = searchConstraints.results_limit;
  return `
CALL {
  WITH $currentContext AS requestedCurrentContext, $me AS me
  MATCH (dbCurrentUser:User)-[:HAS_CONTEXT]->(dbCurrentContext:Context)
  WITH dbCurrentUser, dbCurrentContext, requestedCurrentContext, me
  WHERE requestedCurrentContext IS NOT NULL
    AND dbCurrentUser <> me
    ${whereCurrent ? `AND ${whereCurrent}` : ""}
  ${scoreCurrent}
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
    ${whereTarget ? `AND ${whereTarget}` : ""}
  ${scoreTarget}
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
