import type { SearchConstraints } from "../schemas-zod.js";

/**
 * Neo4j 5+ логика поиска похожих контекстов - без алиасов, прямые параметры
 * Возвращает Cypher код до точки с переменными: dbUser, dbContext, contextCompatibilityScore
 */
export function buildSimilarContextsCore(
  searchScope: "all" | "filtered",
  whereClause: string,
  scoreClause: string,
  paramName: string = "$currentContext" // Явно передаем имя параметра
): {
  cypherCode: string;
  userVar: string;
  contextVar: string;
  compatibilityScoreVar: string;
  additionalFinalVars: string;
} {
  // Унифицированные имена переменных
  const userVar = "dbUser";
  const contextVar = "candidateContext"; // Семантическое имя для ясности
  const compatibilityScoreVar = "contextCompatibilityScore";

  // paramName передается как аргумент функции

  // Для filtered поиска нужны переменные из предыдущего шага
  const additionalVars =
    searchScope === "filtered"
      ? ", dbCurrentUser, dbCurrentContext, currentContextCompatibilityScore"
      : "";

  const additionalFinalVars =
    searchScope === "filtered"
      ? ", dbCurrentUser, dbCurrentContext, currentContextCompatibilityScore"
      : "";

  const cypherCode = `/* ============================================
 * ПОИСК КОНТЕКСТОВ ${searchScope === "all" ? "(СРЕДИ ВСЕХ)" : "(СРЕДИ ОТФИЛЬТРОВАННЫХ)"}
 * ============================================ */

MATCH
  (${userVar}:User)-[:HAS_CONTEXT]->(${contextVar}:Context)
WITH *, ${userVar}, ${contextVar}${additionalVars}
WHERE
  ${paramName} IS NOT NULL
  AND ${userVar}.user_id <> ${searchScope === "all" ? "$me" : "dbCurrentUser.user_id"}
  ${whereClause ? `AND ${whereClause}` : ""}

WITH *, ${scoreClause}

WITH *, ${userVar}, ${contextVar}, contextCompatibilityScore AS ${compatibilityScoreVar}${additionalFinalVars}
WHERE ${userVar} IS NOT NULL${searchScope === "filtered" ? " AND dbCurrentUser IS NOT NULL" : ""}
WITH *, ${userVar}, ${contextVar}, ${compatibilityScoreVar}${additionalFinalVars}`;

  return {
    cypherCode,
    userVar,
    contextVar,
    compatibilityScoreVar,
    additionalFinalVars,
  };
}

/**
 * Стандартное формирование результата для SearchResultSchema
 */
export function buildSearchResultReturn(
  searchScope: "all" | "filtered",
  userVar: string,
  contextVar: string,
  compatibilityScoreVar: string,
  additionalFinalVars: string,
  searchConstraints: SearchConstraints
): string {
  const limit = searchConstraints.results_limit;

  // Простые свойства Context - skills как строки для быстрого поиска

  return `// Note: searchConstraints available for future use
RETURN {
  userId: ${userVar}.user_id,
  currentContext: ${searchScope === "all" ? `properties(${contextVar})` : "null"},
  currentScore: ${searchScope === "all" ? compatibilityScoreVar : "null"},
  targetContext: ${searchScope === "filtered" ? `properties(${contextVar})` : "null"},
  targetScore: ${searchScope === "filtered" ? compatibilityScoreVar : "null"}
} AS result
LIMIT ${limit}`;
}

export function buildContextQuery(
  searchScope: "all" | "filtered",
  whereClause: string,
  scoreClause: string,
  searchConstraints: SearchConstraints,
  paramName: string = "$currentContext" // Добавляем параметр для Target Context
): string {
  const coreResult = buildSimilarContextsCore(
    searchScope,
    whereClause,
    scoreClause,
    paramName
  );
  const returnClause = buildSearchResultReturn(
    searchScope,
    coreResult.userVar,
    coreResult.contextVar,
    coreResult.compatibilityScoreVar,
    coreResult.additionalFinalVars,
    searchConstraints
  );

  return `${coreResult.cypherCode}
${returnClause}`;
}

export function buildPipelineQuery(
  whereCurrent: string,
  scoreCurrent: string,
  whereTarget: string,
  scoreTarget: string,
  searchConstraints: SearchConstraints
): string {
  const limit = searchConstraints.results_limit;

  return `
WITH $currentContext AS currentContext, $me AS me
CALL (currentContext, me) {
  MATCH (candidateCurrentUser:User)-[:HAS_CONTEXT]->(candidateCurrentContext:Context)
  WHERE currentContext IS NOT NULL
    AND candidateCurrentUser.user_id <> me
    ${whereCurrent ? `AND ${whereCurrent}` : ""}
  WITH *, ${scoreCurrent}
  WITH collect({ 
    user: candidateCurrentUser, 
    currentContext: properties(candidateCurrentContext), 
    currentScore: currentContextCompatibilityScore 
  }) AS candidates
  RETURN candidates
}
UNWIND candidates AS cand
WITH $targetContext AS targetContext, $me AS me, cand
CALL (targetContext, me, cand) {
  WITH cand.user AS candidateUser, cand.currentContext AS candidateCurrentContext, cand.currentScore AS candidateCurrentScore
  MATCH (candidateUser)-[:HAS_CONTEXT]->(candidateTargetContext:Context)
  WHERE targetContext IS NOT NULL
    AND candidateUser.user_id <> me
    ${whereTarget ? `AND ${whereTarget}` : ""}
  WITH *, ${scoreTarget}
  WITH collect({ 
    user: candidateUser, 
    currentContext: candidateCurrentContext, 
    currentScore: candidateCurrentScore, 
    targetContext: properties(candidateTargetContext), 
    targetScore: targetContextCompatibilityScore 
  }) AS results
  RETURN results
}
UNWIND results AS r
// Select best matching trajectory by total score (current + target)
ORDER BY r.user.user_id, (r.currentScore + r.targetScore) DESC
WITH r.user.user_id AS userId,
     head(collect(r.currentContext)) AS currentContext,
     head(collect(r.currentScore)) AS currentScore,
     head(collect(r.targetContext)) AS targetContext,
     head(collect(r.targetScore)) AS targetScore
RETURN userId, currentContext, currentScore, targetContext, targetScore
LIMIT ${limit}
`;
}
