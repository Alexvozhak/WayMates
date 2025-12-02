/**
 * Helpers for trajectory collection (PREVIOUS_CONTEXT relationship traversal)
 */

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
 * Build MATCH path for trajectory traversal
 *
 * Traverses from end context (current) to start context (first job/entry point)
 * using PREVIOUS_CONTEXT relationships
 *
 * Pattern:
 * - (end:Context)<-[:PREVIOUS_CONTEXT*0..]-(start:Context)
 * - WHERE start.previousContextId IS NULL
 *
 * Returns path nodes in variable: {prefix}PathNodes
 *
 * @param endContextVar - End context variable (e.g., 'matchedContext', 'searchingContext')
 * @returns MATCH path query with path nodes collection
 *
 * @example
 * buildMatchPath('matchedContext')
 * // Returns:
 * // MATCH path = (matchedContext)<-[:PREVIOUS_CONTEXT*0..]-(start:Context)
 * // WHERE start.previousContextId IS NULL
 * // WITH *, [node IN nodes(path) | node] AS matchedPathNodes
 *
 * @example
 * buildMatchPath('searchingContext')
 * // Returns:
 * // MATCH path = (searchingContext)<-[:PREVIOUS_CONTEXT*0..]-(start:Context)
 * // WHERE start.previousContextId IS NULL
 * // WITH *, [node IN nodes(path) | node] AS searchingPathNodes
 */
export function buildMatchPath(endContextVar: string): string {
  const prefix = extractPrefix(endContextVar);

  return `
MATCH path = (${endContextVar})<-[:PREVIOUS_CONTEXT*0..]-(start:Context)
WHERE start.previousContextId IS NULL
WITH *, [node IN nodes(path) | node] AS ${prefix}PathNodes
  `.trim();
}

/**
 * Build UNWIND for path nodes with ordering
 *
 * Unwinds path nodes array into individual context for enrichment
 * Typically used after buildMatchPath()
 *
 * @param pathNodesVar - Path nodes array variable (e.g., 'matchedPathNodes')
 * @param contextVar - Target context variable for UNWIND (e.g., 'matchedPathContext')
 * @returns UNWIND clause
 *
 * @example
 * buildUnwindPath('matchedPathNodes', 'matchedPathContext')
 * // Returns:
 * // UNWIND matchedPathNodes AS matchedPathContext
 */
export function buildUnwindPath(pathNodesVar: string, contextVar: string): string {
  return `UNWIND ${pathNodesVar} AS ${contextVar}`;
}
