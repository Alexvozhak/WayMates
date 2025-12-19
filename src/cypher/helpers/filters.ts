/**
 * Filters for WHERE clauses and excluded reasons
 */

import type { ContextField } from "../../shared/schemas.js";

/**
 * Extract prefix from context variable name
 */
function extractPrefix(contextVar: string): string {
  if (!contextVar.endsWith("Context")) {
    throw new Error(`Invalid contextVar: "${contextVar}". Must end with 'Context'`);
  }
  return contextVar.replace("Context", "");
}

/**
 * Condition generators for each field type
 *
 * IMPORTANT:
 * - Skills are NEVER in strict conditions (penalty-based scoring instead)
 * - Uses canonical variables after aggregation (matchedPosition, matchedDomains, etc.)
 */
const STRICT_CONDITION_GENERATORS: Record<ContextField, (prefix: string, searchingVar: string) => string> = {
  position: (prefix, searchingVar) => `CASE
    WHEN ${searchingVar}.position IS NULL THEN true
    ELSE ${prefix}Position.canonicalName = ${searchingVar}.position
  END`,

  domains: (prefix, searchingVar) => `CASE
    WHEN ${searchingVar}.domains IS NULL THEN true
    ELSE all(d IN ${searchingVar}.domains WHERE d IN ${prefix}Domains)
  END`,

  skills: () => {
    throw new Error("Skills cannot be in strict conditions. Use penalty-based scoring instead.");
  },

  industry: (prefix, searchingVar) => `CASE
    WHEN ${searchingVar}.industry IS NULL THEN true
    ELSE ${prefix}Industry.canonicalName = ${searchingVar}.industry
  END`,

  countryCode: (prefix, searchingVar) => `CASE
    WHEN ${searchingVar}.countryCode IS NULL THEN true
    ELSE ${prefix}Country.name = ${searchingVar}.countryCode
  END`,

  cityName: (prefix, searchingVar) => `CASE
    WHEN ${searchingVar}.cityName IS NULL THEN true
    ELSE ${prefix}City.canonicalName = ${searchingVar}.cityName
  END`,

  companySize: (prefix, searchingVar) => `CASE
    WHEN ${searchingVar}.companySize IS NULL THEN true
    ELSE ${prefix}Context.companySize = ${searchingVar}.companySize
  END`,

  birthYear: (prefix, searchingVar) => `CASE
    WHEN ${searchingVar}.birthYear IS NULL THEN true
    ELSE ${prefix}Context.birthYear = ${searchingVar}.birthYear
  END`,

  educationLevel: (prefix, searchingVar) => `CASE
    WHEN ${searchingVar}.educationLevel IS NULL THEN true
    WHEN ${prefix}Context.educationLevel IS NULL THEN true
    ELSE ${prefix}Context.educationLevel = ${searchingVar}.educationLevel
  END`,

  languages: (prefix, searchingVar) => `CASE
    WHEN ${searchingVar}.languages IS NULL THEN true
    ELSE all(lang IN ${searchingVar}.languages WHERE lang IN ${prefix}Languages)
  END`,
};

/**
 * Generate strict condition for a single field
 *
 * @param field - Context field to match
 * @param prefix - Canonical variable prefix (e.g., 'matched' from 'matchedContext')
 * @param searchingVar - Searching variable (e.g., '$referenceContext')
 * @returns Condition string
 */
function generateStrictCondition(field: ContextField, prefix: string, searchingVar: string): string {
  const generator = STRICT_CONDITION_GENERATORS[field];
  if (!generator) {
    throw new Error(`Unknown field: ${field}`);
  }
  return generator(prefix, searchingVar);
}

/**
 * Build WHERE clause for strict field matching
 *
 * IMPORTANT:
 * - Skills are automatically filtered out (never strict)
 * - Uses canonical variables after aggregation (matchedPosition, matchedDomains, etc.)
 *
 * @param strictFields - Fields to match exactly
 * @param candidateVar - Candidate context variable (e.g., 'matchedContext') - used to extract prefix
 * @param searchingVar - Searching context parameter (e.g., '$referenceContext')
 * @returns WHERE clause (or empty string if no conditions)
 *
 * @example
 * buildStrictWhereClause(['position', 'domains'], 'matchedContext', '$referenceContext')
 * // Returns:
 * // WHERE matchedPosition.canonicalName = $referenceContext.position AND
 * //       all(d IN $referenceContext.domains WHERE d IN matchedDomains)
 *
 * @example
 * buildStrictWhereClause(['position', 'skills'], 'matchedContext', '$referenceContext')
 * // Returns:
 * // WHERE matchedPosition.canonicalName = $referenceContext.position
 * // (skills filtered out automatically)
 */
export function buildStrictWhereClause(
  strictFields: ContextField[],
  candidateVar: string,
  searchingVar: string,
): string {
  // Extract prefix from candidateVar (e.g., 'matched' from 'matchedContext')
  const prefix = extractPrefix(candidateVar);

  // Filter out skills (never strict)
  const validFields = strictFields.filter((field) => field !== "skills");

  if (validFields.length === 0) {
    return "";
  }

  const conditions = validFields.map((field) => generateStrictCondition(field, prefix, searchingVar)).filter(Boolean);

  return conditions.length > 0 ? `WHERE ${conditions.join(" AND\n  ")}` : "";
}

/**
 * Build filter for excluded creation reasons (CALL subquery)
 *
 * Traverses candidate's trajectory and checks if ANY context has excluded reason
 * If found, excludes the candidate from results
 *
 * Uses CALL subquery to:
 * 1. Traverse trajectory: (context)<-[:PREVIOUS_CONTEXT*0..]-(start)
 * 2. Collect all creationReason arrays from contexts
 * 3. Check if ANY reason matches excluded list
 * 4. Return passesFilter boolean
 *
 * @param contextVar - Context variable to start traversal (e.g., 'matchedContext')
 * @param preserveVars - Variables to preserve in WITH after filter (e.g., ['matchedUser', 'matchedContext', 'matchedDomains'])
 * @returns CALL subquery + WITH filter
 *
 * @example
 * buildExcludedReasonsFilter('matchedContext', ['matchedUser', 'matchedContext', 'matchedDomains'])
 * // Returns:
 * // CALL (matchedContext) {
 * //   MATCH path = (matchedContext)<-[:PREVIOUS_CONTEXT*0..]-(start:Context)
 * //   WHERE start.previousContextId IS NULL
 * //   WITH [node IN nodes(path) | node.creationReason] AS allReasons
 * //   RETURN NOT ANY(reason IN allReasons
 * //     WHERE ANY(r IN reason WHERE r IN $excludedCreationReasons)) AS passesFilter
 * // }
 * // WITH matchedUser, matchedContext, matchedDomains, passesFilter
 * // WHERE passesFilter = true OR size($excludedCreationReasons) = 0
 */
export function buildExcludedReasonsFilter(contextVar: string, preserveVars: string[]): string {
  const varsToPreserve = preserveVars.join(", ");

  return `
CALL (${contextVar}) {
  MATCH path = (${contextVar})<-[:PREVIOUS_CONTEXT*0..]-(start:Context)
  WHERE start.previousContextId IS NULL
  WITH [node IN nodes(path) | node.creationReason] AS allReasons
  RETURN NOT ANY(reason IN allReasons
    WHERE ANY(r IN reason WHERE r IN $excludedCreationReasons)) AS passesFilter
}

WITH ${varsToPreserve}, passesFilter
WHERE passesFilter = true OR size($excludedCreationReasons) = 0
  `.trim();
}
