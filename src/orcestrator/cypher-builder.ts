import type { SearchConstraints } from "../schemas-zod.js";

/**
 * Build Cypher query for pipeline search (current → target)
 */
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
