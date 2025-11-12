/**
 * Helpers for building OPTIONAL MATCH relationships
 *
 * Convention: Auto-prefix extraction from contextVar
 * - contextVar MUST end with 'Context'
 * - Prefix extracted: 'matchedContext' → 'matched'
 */

/**
 * Extract prefix from context variable name
 *
 * @param contextVar - Context variable (e.g., 'matchedContext', 'searchingPathContext')
 * @returns Prefix without 'Context' (e.g., 'matched', 'searchingPath')
 *
 * @throws Error if contextVar doesn't end with 'Context'
 */
function extractPrefix(contextVar: string): string {
  if (!contextVar.endsWith('Context')) {
    throw new Error(
      `Invalid contextVar: "${contextVar}". Must end with 'Context' (e.g., 'matchedContext', 'searchingPathContext')`
    );
  }
  return contextVar.replace('Context', '');
}

/**
 * Build OPTIONAL MATCH for context relationships
 *
 * Generates 6 OPTIONAL MATCH clauses:
 * - Position (HAS_POSITION)
 * - WorkDomain (IN_WORK_DOMAIN)
 * - Skill (USES_SKILL)
 * - Industry (IN_INDUSTRY)
 * - City (IN_CITY)
 * - Country (IN_COUNTRY)
 *
 * Variables generated: {prefix}Position, {prefix}WorkDomain, {prefix}Skill, etc.
 *
 * @param contextVar - Context variable name (must end with 'Context')
 * @returns OPTIONAL MATCH block
 *
 * @example
 * buildOptionalMatchRelationships('matchedContext')
 * // Returns:
 * // OPTIONAL MATCH (matchedContext)-[:HAS_POSITION]->(matchedPosition:Position)
 * // OPTIONAL MATCH (matchedContext)-[:IN_WORK_DOMAIN]->(matchedWorkDomain:WorkDomain)
 * // ...
 *
 * @example
 * buildOptionalMatchRelationships('searchingPathContext')
 * // Returns:
 * // OPTIONAL MATCH (searchingPathContext)-[:HAS_POSITION]->(searchingPathPosition:Position)
 * // OPTIONAL MATCH (searchingPathContext)-[:IN_WORK_DOMAIN]->(searchingPathWorkDomain:WorkDomain)
 * // ...
 */
export function buildOptionalMatchRelationships(contextVar: string): string {
  const prefix = extractPrefix(contextVar);

  return `
OPTIONAL MATCH (${contextVar})-[:HAS_POSITION]->(${prefix}Position:Position)
OPTIONAL MATCH (${contextVar})-[:IN_WORK_DOMAIN]->(${prefix}WorkDomain:WorkDomain)
OPTIONAL MATCH (${contextVar})-[:USES_SKILL]->(${prefix}Skill:Skill)
OPTIONAL MATCH (${contextVar})-[:IN_INDUSTRY]->(${prefix}Industry:Industry)
OPTIONAL MATCH (${contextVar})-[:IN_CITY]->(${prefix}City:City)
OPTIONAL MATCH (${contextVar})-[:IN_COUNTRY]->(${prefix}Country:Country)
  `.trim();
}
