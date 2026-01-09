/**
 * Map projection constants for context objects
 *
 * Note: These projections are prefix-agnostic - use them after WITH
 * where variables are already properly prefixed
 */

/**
 * Context map projection (canonical fields)
 *
 * Returns context object with:
 * - Scalar properties (contextId, createdAt, birthYear, etc.)
 * - Relationship properties (position, domains, skills, industry, geo)
 *
 * Prerequisites (variables must exist in scope):
 * - context (or prefixed: matchedContext, searchingPathContext)
 * - position (or prefixed: matchedPosition, searchingPathPosition)
 * - domains (or prefixed: matchedDomains, searchingPathDomains)
 * - skills (or prefixed: matchedSkills, searchingPathSkills)
 * - industry (or prefixed: matchedIndustry, searchingPathIndustry)
 * - city (or prefixed: matchedCity, searchingPathCity)
 * - country (or prefixed: matchedCountry, searchingPathCountry)
 *
 * @example
 * // Usage with matchedContext:
 * WITH matchedContext, matchedPosition, matchedDomains, matchedSkills, ...
 * RETURN matchedContext {
 *   .contextId,
 *   position: matchedPosition.canonicalName,
 *   domains: matchedDomains,
 *   skills: matchedSkills,
 *   ...
 * } AS context
 *
 * @example
 * // Usage with searchingPathContext:
 * WITH searchingPathContext, searchingPathPosition, searchingPathDomains, ...
 * RETURN collect(searchingPathContext {
 *   .contextId,
 *   position: searchingPathPosition.canonicalName,
 *   domains: searchingPathDomains,
 *   ...
 * }) AS trajectory
 */
export function buildContextMapProjection(prefix: string): string {
  return `
${prefix}Context {
  .contextId,
  .previousContextId,
  .nextContextId,
  .createdAt,
  .creationReason,
  .birthYear,
  .companySize,
  .salaryExact,
  .salaryMin,
  .salaryMax,
  position: ${prefix}Position.canonicalName,
  role: ${prefix}Role.canonicalName,
  domains: ${prefix}Domains,
  skills: ${prefix}Skills,
  citizenships: ${prefix}Citizenships,
  industry: ${prefix}Industry.canonicalName,
  countryCode: ${prefix}Country.name,
  cityName: ${prefix}City.canonicalName,
  languages: ${prefix}Languages,
  educationLevel: ${prefix}EducationLevel.canonicalName
}
  `.trim();
}
