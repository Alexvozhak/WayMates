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
  AND ${userVar} <> ${searchScope === "all" ? "$me" : "dbCurrentUser"}
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

  const buildContextWithSkills = (contextVar: string) => `{
    context_id: ${contextVar}.context_id,
    created_at: ${contextVar}.created_at,
    creation_reason: ${contextVar}.creation_reason,
    position: ${contextVar}.position,
    domains: ${contextVar}.domains,
    skills: [(${contextVar})-[:USES_SKILL]->(s:Skill)-[:IN_CATEGORY]->(sc:SkillCategory) | {name: s.name, category: sc.name}],
    industry: ${contextVar}.industry,
    company_size: ${contextVar}.company_size,
    country_code: ${contextVar}.country_code,
    city_name: ${contextVar}.city_name,
    work_type: ${contextVar}.work_type,
    citizenships: ${contextVar}.citizenships,
    team_size: ${contextVar}.team_size,
    birth_year: ${contextVar}.birth_year
  }`;

  return `// Note: searchConstraints available for future use
RETURN {
  userId: ${userVar}.user_id,
  currentContext: ${searchScope === "all" ? buildContextWithSkills(contextVar) : "null"},
  currentScore: ${searchScope === "all" ? compatibilityScoreVar : "null"},
  targetContext: ${searchScope === "filtered" ? buildContextWithSkills(contextVar) : "null"},
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
    AND candidateCurrentUser <> me
    ${whereCurrent ? `AND ${whereCurrent}` : ""}
  WITH *, ${scoreCurrent}
  WITH collect({ 
    user: candidateCurrentUser, 
    currentContext: {
      context_id: candidateCurrentContext.context_id,
      created_at: candidateCurrentContext.created_at,
      creation_reason: candidateCurrentContext.creation_reason,
      position: candidateCurrentContext.position,
      domains: candidateCurrentContext.domains,
      skills: [(candidateCurrentContext)-[:USES_SKILL]->(s:Skill)-[:IN_CATEGORY]->(sc:SkillCategory) | {name: s.name, category: sc.name}],
      industry: candidateCurrentContext.industry,
      company_size: candidateCurrentContext.company_size,
      country_code: candidateCurrentContext.country_code,
      city_name: candidateCurrentContext.city_name,
      work_type: candidateCurrentContext.work_type,
      citizenships: candidateCurrentContext.citizenships,
      team_size: candidateCurrentContext.team_size,
      birth_year: candidateCurrentContext.birth_year
    }, 
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
    AND candidateUser <> me
    ${whereTarget ? `AND ${whereTarget}` : ""}
  WITH *, ${scoreTarget}
  WITH collect({ 
    user: candidateUser, 
    currentContext: candidateCurrentContext, 
    currentScore: candidateCurrentScore, 
    targetContext: {
      context_id: candidateTargetContext.context_id,
      created_at: candidateTargetContext.created_at,
      creation_reason: candidateTargetContext.creation_reason,
      position: candidateTargetContext.position,
      domains: candidateTargetContext.domains,
      skills: [(candidateTargetContext)-[:USES_SKILL]->(s:Skill)-[:IN_CATEGORY]->(sc:SkillCategory) | {name: s.name, category: sc.name}],
      industry: candidateTargetContext.industry,
      company_size: candidateTargetContext.company_size,
      country_code: candidateTargetContext.country_code,
      city_name: candidateTargetContext.city_name,
      work_type: candidateTargetContext.work_type,
      citizenships: candidateTargetContext.citizenships,
      team_size: candidateTargetContext.team_size,
      birth_year: candidateTargetContext.birth_year
    }, 
    targetScore: targetContextCompatibilityScore 
  }) AS results
  RETURN results
}
UNWIND results AS r
RETURN r.user.user_id AS userId,
       r.currentContext AS currentContext,
       r.currentScore AS currentScore,
       r.targetContext AS targetContext,
       r.targetScore AS targetScore
LIMIT ${limit}
`;
}
