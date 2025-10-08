/* ============================================
 * БЛОК: SHARED COHORT SEARCH
 * ============================================
 * 
 * 🎯 НАЗНАЧЕНИЕ:
 * Поиск пользователей с похожими характеристиками (cohort search)
 * 
 * 📥 ПАРАМЕТРЫ:
 * - $position - целевая позиция
 * - $userDomains - домены пользователя
 * - $userSkills - навыки пользователя
 * - $userRoleExp - опыт в роли (годы)
 * - $minCoverage - минимальный процент совпадения навыков
 * - $expTolerance - допустимое отклонение по опыту (годы)
 * - $requireDomain - требовать совпадение доменов
 * - $desiredCountry - желаемая страна
 * - $desiredCity - желаемый город
 * - $requireCountry - требовать совпадение страны
 * - $requireCity - требовать совпадение города
 * 
 * 📤 ВОЗВРАЩАЕТ:
 * - ctx - найденные контексты
 * - matchedSkills - количество совпавших навыков
 * - coverage - процент совпадения навыков
 * - domainMatch - совпадение доменов (0/1)
 * - expDelta - разница в опыте
 * - domainOverlap - количество совпавших доменов
 * - countryMatch - совпадение страны (0/1)
 * - cityMatch - совпадение города (0/1)
 */

WITH $position AS position,
     $userDomains AS userDomains,
     $userSkills AS userSkills,
     $userRoleExp AS userRoleExp,
     $minCoverage AS minCoverage,
     $expTolerance AS expTolerance,
     $requireDomain AS requireDomain,
     $desiredCountry AS desiredCountry,
     $desiredCity AS desiredCity,
     $requireCountry AS requireCountry,
     $requireCity AS requireCity
CALL {
  WITH position, userDomains, userSkills, userRoleExp, desiredCountry, desiredCity
  MATCH (c:Context)-[:HAS_POSITION]->(:Position {name: position})
  WITH c, userSkills, userDomains, userRoleExp, desiredCountry, desiredCity,
       size([ s IN [ (c)-[:USES_SKILL]->(sx) | sx.name ] WHERE s IN userSkills ]) AS matchedSkills,
       size(userSkills) AS userSkillsCount,
       size([ d IN [ (c)-[:IN_WORK_DOMAIN]->(wd) | wd.name ] WHERE d IN userDomains ]) AS domainOverlap,
       toFloat(duration.inMonths(
         date({year: toInteger(split(c.position_started_at,'-')[0]), month: toInteger(split(c.position_started_at,'-')[1])}),
         date()
       ).months) / 12.0 AS candidateExpYears
  OPTIONAL MATCH (c)-[:IN_CITY]->(ci:City)-[:IN_COUNTRY]->(ct:Country)
  WITH c AS ctx, matchedSkills, userSkillsCount, domainOverlap, ci, ct, desiredCountry, desiredCity,
       CASE WHEN userSkillsCount = 0 THEN 0.0 ELSE toFloat(matchedSkills)/userSkillsCount END AS coverage,
       CASE WHEN domainOverlap > 0 THEN 1 ELSE 0 END AS domainMatch,
       abs(candidateExpYears - userRoleExp) AS expDelta
  WITH ctx, matchedSkills, coverage, domainMatch, expDelta, domainOverlap,
       CASE WHEN desiredCountry IS NULL OR ct.name IS NULL THEN 0
            WHEN ct.name = desiredCountry THEN 1 ELSE 0 END AS countryMatch,
       CASE WHEN desiredCity IS NULL OR ci.name IS NULL THEN 0
            WHEN ci.name = desiredCity AND (desiredCountry IS NULL OR ct.name = desiredCountry) THEN 1 ELSE 0 END AS cityMatch
  RETURN ctx, matchedSkills, coverage, domainMatch, expDelta, domainOverlap, countryMatch, cityMatch
}
WITH ctx, matchedSkills, coverage, domainMatch, expDelta, domainOverlap, countryMatch, cityMatch,
     minCoverage, expTolerance, requireDomain, requireCountry, requireCity
WHERE coverage >= minCoverage
  AND expDelta <= expTolerance
  AND (requireDomain = false OR domainOverlap >= 1)
  AND (requireCountry = false OR countryMatch = 1)
  AND (requireCity = false OR cityMatch = 1)
