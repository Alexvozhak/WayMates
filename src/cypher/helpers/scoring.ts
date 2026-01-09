/**
 * Skills scoring Cypher blocks
 */

import { SCORING_CONFIG } from "../../config/scoring.js";

/**
 * Build skills scoring block for context matching.
 *
 * Calculates contextMatchScore based on:
 * - Matched skills (intersection) → positive weight based on complexity
 * - Extra skills (candidate has, reference doesn't) → penalty based on complexity
 *
 * @param referenceContextVar - Variable name for reference context parameter (e.g., "$referenceContext")
 * @param matchedSkillsVar - Variable name for matched skills array (e.g., "matchedSkills")
 * @param carryVars - Variables to carry through WITH clause
 * @returns Cypher block that adds contextMatchScore variable
 *
 * @example
 * buildSkillsScoringBlock("$referenceContext", "matchedSkills", ["matchedUser", "matchedContext", ...])
 * // Returns Cypher that calculates contextMatchScore from skills intersection/difference
 */
export function buildSkillsScoringBlock(
  referenceContextVar: string,
  matchedSkillsVar: string,
  carryVars: string[],
): string {
  const carryWithClause = carryVars.join(", ");

  return `
// Skills scoring: intersection (positive) vs extra (penalty)
WITH ${carryWithClause},
     [skill IN ${referenceContextVar}.skills WHERE skill IN ${matchedSkillsVar}] AS matchedSkillsIntersection,
     [skill IN ${matchedSkillsVar} WHERE NOT skill IN ${referenceContextVar}.skills] AS extraSkills

// Calculate matched skills weights
CALL {
  WITH matchedSkillsIntersection
  UNWIND matchedSkillsIntersection AS matchedSkill
  OPTIONAL MATCH (s:Skill {canonicalName: matchedSkill, verified: true})
  RETURN collect({
    skill: matchedSkill,
    weight: coalesce(s.complexity * ${SCORING_CONFIG.weightMultiplier}, 5.0)
  }) AS matchedSkillsWithWeights
}

// Calculate extra skills penalties
CALL {
  WITH extraSkills
  UNWIND extraSkills AS extraSkill
  OPTIONAL MATCH (s:Skill {canonicalName: extraSkill, verified: true})
  RETURN collect({
    skill: extraSkill,
    penalty: coalesce(s.complexity * ${SCORING_CONFIG.penaltyMultiplier}, 1.0)
  }) AS extraSkillsWithPenalty
}

WITH ${carryWithClause},
     reduce(positiveScore = 0.0, matched IN matchedSkillsWithWeights |
       positiveScore + matched.weight
     ) AS skillsPositiveScore,
     reduce(penaltyScore = 0.0, extra IN extraSkillsWithPenalty |
       penaltyScore + extra.penalty
     ) AS skillsPenaltyScore

WITH ${carryWithClause},
     CASE
       WHEN (skillsPositiveScore - skillsPenaltyScore) < 0 THEN 0.0
       ELSE (skillsPositiveScore - skillsPenaltyScore)
     END AS contextMatchScore
  `.trim();
}
