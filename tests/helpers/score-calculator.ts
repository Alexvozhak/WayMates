/**
 * Helper functions for calculating expected scores in integration tests
 *
 * Mirrors SearchQueryBuilder Cypher scoring logic:
 * score = 1.0 - (skillsPenaltyScore / 100.0)
 */

import type { Driver } from 'neo4j-driver';
import type { UserContext, ContextField } from '../../src/schemas-zod.js';

/**
 * Calculate expected context match score with skill penalties from DB
 *
 * Logic EXACTLY mirrors SearchQueryBuilder Cypher scoring:
 * 1. Compute extraSkills = candidate.skills - reference.skills
 * 2. Query DB for penaltyMultiplier for each extraSkill (via SkillCategory)
 * 3. score = 1.0 - (sum(penalties) / 100.0)
 *
 * @param driver - Neo4j driver for querying skill penalties
 * @param reference - Reference context (what we're searching for)
 * @param candidate - Candidate context (potential match)
 * @param excludedFields - Fields to exclude from strict matching (NOT USED in current implementation - skills always scored via penalties)
 * @returns Expected score between 0 and 1
 *
 * @example
 * // U1 (react) and U2 (react) have identical skills
 * const score = await calculateExpectedScore(driver, u1Context, u2Context, []);
 * // score === 1.0 (no extra skills, no penalties)
 *
 * @example
 * // U1 (react) and candidate (react, node) → candidate has extra skill 'node'
 * // If node.penaltyMultiplier = 2.0 in DB:
 * const score = await calculateExpectedScore(driver, u1Context, candidate, []);
 * // score === 0.98 (1.0 - 2.0/100)
 */
export async function calculateExpectedScore(
  driver: Driver,
  reference: UserContext,
  candidate: UserContext,
  excludedFields: ContextField[]
): Promise<number> {
  // Compute extra skills (candidate has but reference doesn't need)
  const referenceSkills = new Set(reference.skills);
  const extraSkills = candidate.skills.filter(skill => !referenceSkills.has(skill));

  if (extraSkills.length === 0) {
    return 1.0; // Perfect match, no penalties
  }

  // Query DB for penalty multipliers
  const query = `
    UNWIND $extraSkills AS extraSkill
    OPTIONAL MATCH (skill:Skill {name: extraSkill})-[:BELONGS_TO]->(skillCategory:SkillCategory)
    RETURN collect({
      skill: extraSkill,
      penalty: coalesce(skillCategory.penaltyMultiplier, 1.0)
    }) AS extraSkillsWithPenalty
  `.trim();

  const session = driver.session();
  try {
    const result = await session.run(query, { extraSkills });
    const record = result.records[0];
    if (!record) {
      // No DB connection or empty result → fallback to default penalty
      return 1.0 - (extraSkills.length * 1.0 / 100.0);
    }

    const extraSkillsWithPenalty = record.get('extraSkillsWithPenalty') as Array<{skill: string, penalty: number}>;
    const totalPenalty = extraSkillsWithPenalty.reduce((sum, item) => sum + item.penalty, 0);

    return 1.0 - (totalPenalty / 100.0);
  } finally {
    await session.close();
  }
}
