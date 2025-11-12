/**
 * Scoring helpers for context matching
 *
 * CRITICAL: Skills scoring preserves Bug #2 fix (penalty-based scoring)
 * Copy-pasted from snippets-extractor.ts:37-81 without modifications
 */

/**
 * Skills penalty-based scoring (Bug #2 fix - DO NOT MODIFY)
 *
 * Calculates score based on:
 * - Matched skills (intersection): positive weight from SkillCategory
 * - Extra skills (candidate has but we don't need): penalty from SkillCategory
 * - Final score: (sum of weights) - (sum of penalties)
 *
 * Uses CALL subqueries to fetch weights/penalties from database
 *
 * IMPORTANT: This is copy-pasted from OLD code (snippets-extractor.ts:37-81)
 * to preserve Bug #2 fix. Any changes risk regression!
 *
 * Prerequisites (must exist in scope):
 * - {candidateSkillsVar}: array of candidate's skill names
 * - {searchingSkillsVar}: array of searching user's skill names
 *
 * Output variables added to scope:
 * - matchedSkills: intersection of skills
 * - extraSkills: skills candidate has but searching user doesn't need
 * - matchedSkillsWithWeights: array of {skill, weight} from categories
 * - extraSkillsWithPenalty: array of {skill, penalty} from categories
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
export function buildSkillsScoring(
  candidateSkillsVar: string,
  searchingSkillsVar: string
): string {
  return `
// === SKILLS SCORING WITH CATEGORIES (Bug #2 fix) ===
// 1. Matched skills (intersection)
WITH *, [skill IN ${searchingSkillsVar} WHERE skill IN ${candidateSkillsVar}] AS matchedSkills

// 2. Extra skills (candidate has but we don't need)
WITH *, [skill IN ${candidateSkillsVar} WHERE NOT skill IN ${searchingSkillsVar}] AS extraSkills

// 3. Get weights from categories for matched skills
CALL {
  WITH matchedSkills
  UNWIND matchedSkills AS matchedSkill
  OPTIONAL MATCH (s:Skill {name: matchedSkill})-[:BELONGS_TO]->(sc:SkillCategory)
  RETURN collect({
    skill: matchedSkill,
    weight: coalesce(sc.weight, 5.0)
  }) AS matchedSkillsWithWeights
}

// 4. Get penalties from categories for extra skills
CALL {
  WITH extraSkills
  UNWIND extraSkills AS extraSkill
  OPTIONAL MATCH (s:Skill {name: extraSkill})-[:BELONGS_TO]->(sc:SkillCategory)
  RETURN collect({
    skill: extraSkill,
    penalty: coalesce(sc.penalty_multiplier, 1.0)
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
  weight: number
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
  weight: number
): string {
  return `
CASE WHEN size([d IN ${searchingArrayVar} WHERE d IN ${candidateArrayVar}]) > 0
THEN ${weight} * (toFloat(size([d IN ${searchingArrayVar} WHERE d IN ${candidateArrayVar}])) / size(${searchingArrayVar}))
ELSE 0 END
  `.trim();
}
