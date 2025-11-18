import { SCORING_CONFIG } from "../../config/scoring.js";

/**
 * Scoring helpers for context matching
 *
 * ADR-009: Skills Complexity-Based Scoring
 *
 * Migration from categories (weight/penalty) to complexity (0-100):
 *   weight = complexity × SCORING_CONFIG.complexityToWeight
 *   penalty = complexity × SCORING_CONFIG.complexityToWeight × SCORING_CONFIG.weightToPenalty
 */

/**
 * Skills complexity-based scoring (ADR-009)
 *
 * Calculates score based on:
 * - Matched skills (intersection): positive weight from Skill.complexity
 * - Extra skills (candidate has but we don't need): penalty from Skill.complexity
 * - Final score: (sum of weights) - (sum of penalties)
 *
 * Uses CALL subqueries to fetch complexity from database
 *
 * Formula (config/scoring.ts):
 *   weight = complexity × weightMultiplier (default 0.2)
 *   penalty = complexity × penaltyMultiplier (default 0.05)
 *
 * Examples:
 *   "c++" (complexity=95): weight=19, penalty=4.75
 *   "python" (complexity=60): weight=12, penalty=3
 *
 * Prerequisites (must exist in scope):
 * - {candidateSkillsVar}: array of candidate's skill names
 * - {searchingSkillsVar}: array of searching user's skill names
 *
 * Output variables added to scope:
 * - matchedSkills: intersection of skills
 * - extraSkills: skills candidate has but searching user doesn't need
 * - matchedSkillsWithWeights: array of {skill, weight} from complexity
 * - extraSkillsWithPenalty: array of {skill, penalty} from complexity
 * - skillsPositiveScore: sum of matched skill weights
 * - skillsPenaltyScore: sum of extra skill penalties
 * - skillsScore: final score (positive - penalty)
 *
 * @param candidateSkillsVar - Variable with candidate's skills (e.g., 'matchedSkills')
 * @param searchingSkillsVar - Variable with searching user's skills (e.g., 'searchingSkills' or '$referenceContext.skills')
 * @returns Cypher block with scoring logic
 *
 * @example
 * buildSkillsScoring('matchedSkills', '$referenceContext.skills')
 * // Adds skillsScore variable to scope
 */
export function buildSkillsScoring(candidateSkillsVar: string, searchingSkillsVar: string): string {
  const weightMultiplier = SCORING_CONFIG.weightMultiplier;
  const penaltyMultiplier = SCORING_CONFIG.penaltyMultiplier;

  return `
// === SKILLS SCORING WITH COMPLEXITY (ADR-009) ===
// 1. Matched skills (intersection)
WITH *, [skill IN ${searchingSkillsVar} WHERE skill IN ${candidateSkillsVar}] AS matchedSkills

// 2. Extra skills (candidate has but we don't need)
WITH *, [skill IN ${candidateSkillsVar} WHERE NOT skill IN ${searchingSkillsVar}] AS extraSkills

// 3. Get weights from complexity for matched skills
CALL {
  WITH matchedSkills
  UNWIND matchedSkills AS matchedSkill
  OPTIONAL MATCH (s:Skill {canonicalName: matchedSkill})
  RETURN collect({
    skill: matchedSkill,
    weight: coalesce(s.complexity * ${weightMultiplier}, 5.0)
  }) AS matchedSkillsWithWeights
}

// 4. Get penalties from complexity for extra skills
CALL {
  WITH extraSkills
  UNWIND extraSkills AS extraSkill
  OPTIONAL MATCH (s:Skill {canonicalName: extraSkill})
  RETURN collect({
    skill: extraSkill,
    penalty: coalesce(s.complexity * ${penaltyMultiplier}, 1.0)
  }) AS extraSkillsWithPenalty
}

// 5. Calculate final score (positive - penalty)
WITH *,
  reduce(positiveScore = 0.0, matched IN matchedSkillsWithWeights |
    positiveScore + matched.weight
  ) AS skillsPositiveScore,
  reduce(penaltyScore = 0.0, extra IN extraSkillsWithPenalty |
    penaltyScore + extra.penalty
  ) AS skillsPenaltyScore

WITH *, (skillsPositiveScore - skillsPenaltyScore) AS skillsScore
  `.trim();
}

/**
 * Simple field scoring (position, industry, etc.)
 *
 * Formula: CASE WHEN matched THEN weight ELSE 0 END
 *
 * @param candidateField - Candidate's field (e.g., 'matchedContext.position')
 * @param searchingField - Searching user's field (e.g., '$referenceContext.position')
 * @param weight - Score weight if matched
 * @returns CASE expression
 *
 * @example
 * buildSimpleFieldScoring('matchedContext.position', '$referenceContext.position', 10)
 * // Returns: CASE WHEN matchedContext.position = $referenceContext.position THEN 10 ELSE 0 END
 */
export function buildSimpleFieldScoring(
  candidateField: string,
  searchingField: string,
  weight: number,
): string {
  return `CASE WHEN ${candidateField} = ${searchingField} THEN ${weight} ELSE 0 END`;
}

/**
 * Array field scoring with partial matching (domains)
 *
 * Formula: weight * (intersection size / searching array size)
 *
 * @param candidateArrayVar - Candidate's array (e.g., 'matchedDomains')
 * @param searchingArrayVar - Searching user's array (e.g., '$referenceContext.domains')
 * @param weight - Maximum score weight
 * @returns CASE expression with proportional scoring
 *
 * @example
 * buildArrayFieldScoring('matchedDomains', '$referenceContext.domains', 15)
 * // Returns:
 * // CASE WHEN size([d IN $referenceContext.domains WHERE d IN matchedDomains]) > 0
 * // THEN 15 * (toFloat(size([...])) / size($referenceContext.domains))
 * // ELSE 0 END
 */
export function buildArrayFieldScoring(
  candidateArrayVar: string,
  searchingArrayVar: string,
  weight: number,
): string {
  return `
CASE WHEN size([d IN ${searchingArrayVar} WHERE d IN ${candidateArrayVar}]) > 0
THEN ${weight} * (toFloat(size([d IN ${searchingArrayVar} WHERE d IN ${candidateArrayVar}])) / size(${searchingArrayVar}))
ELSE 0 END
  `.trim();
}
