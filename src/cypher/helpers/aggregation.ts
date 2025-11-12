/**
 * Helpers for building WITH clauses with aggregation
 *
 * Convention: Auto-prefix extraction from contextVar
 */

/**
 * Extract prefix from context variable name
 */
function extractPrefix(contextVar: string): string {
  if (!contextVar.endsWith('Context')) {
    throw new Error(
      `Invalid contextVar: "${contextVar}". Must end with 'Context'`
    );
  }
  return contextVar.replace('Context', '');
}

/**
 * Build WITH clause with collect aggregation for domains/skills
 *
 * Aggregates:
 * - collect(DISTINCT {prefix}WorkDomain.name) AS {prefix}Domains
 * - collect(DISTINCT {prefix}Skill.name) AS {prefix}Skills
 *
 * Preserves:
 * - contextVar
 * - {prefix}Position
 * - {prefix}Industry
 * - {prefix}City
 * - {prefix}Country
 * - Additional vars from preserveVars parameter
 *
 * @param contextVar - Context variable name (must end with 'Context')
 * @param preserveVars - Additional variables to preserve in WITH (e.g., ['user', 'timeSinceMatched'])
 * @returns WITH clause with aggregation
 *
 * @example
 * buildWithCollect('matchedContext')
 * // Returns:
 * // WITH matchedContext, matchedPosition, matchedIndustry, matchedCity, matchedCountry,
 * //      collect(DISTINCT matchedWorkDomain.name) AS matchedDomains,
 * //      collect(DISTINCT matchedSkill.name) AS matchedSkills
 *
 * @example
 * buildWithCollect('matchedContext', ['matchedUser', 'timeSinceMatchedMonths'])
 * // Returns:
 * // WITH matchedUser, timeSinceMatchedMonths, matchedContext, matchedPosition, ...
 */
export function buildWithCollect(
  contextVar: string,
  preserveVars: string[] = []
): string {
  const prefix = extractPrefix(contextVar);

  const baseVars = [
    contextVar,
    `${prefix}Position`,
    `${prefix}Industry`,
    `${prefix}City`,
    `${prefix}Country`,
  ];

  const allVars = [...preserveVars, ...baseVars].join(', ');

  return `
WITH ${allVars},
     collect(DISTINCT ${prefix}WorkDomain.name) AS ${prefix}Domains,
     collect(DISTINCT ${prefix}Skill.name) AS ${prefix}Skills
  `.trim();
}
