/**
 * Path structure validator for integration tests
 *
 * Validates career trajectory paths returned by search queries:
 * - Chronological order (createdAt ascending)
 * - No gaps in PREVIOUS_CONTEXT relationships
 * - First context has no previous (career start)
 * - Path leads to expected matched context
 *
 * Used in Target Search tests (TG1-TG7) to verify trajectory collection.
 */

import { expect } from "vitest";
import type { UserContext } from "../../src/shared/schemas.js";

/**
 * Validate path structure and relationships
 *
 * Checks:
 * - First context has previousContextId = null (career start)
 * - Chronological order: createdAt ascending
 * - No gaps: each context's previousContextId points to previous context
 *
 * @param path - Career trajectory (chronologically ordered contexts)
 * @throws Vitest assertion error if validation fails
 *
 * @example
 * const result = await searchManager.searchByTarget({...});
 * validatePathStructure(result.path);
 */
export function validatePathStructure(path: UserContext[]): void {
  if (path.length === 0) {
    return; // Empty path is valid (single context, no trajectory)
  }

  // First context has no previous (career start)
  expect(path[0].previousContextId).toBeNull();

  // Single context - only first check needed
  if (path.length === 1) {
    return; // No chronology/gaps to check
  }

  // Chronological order (convert ISO strings to timestamps for comparison)
  for (let i = 0; i < path.length - 1; i++) {
    const current = path[i];
    const next = path[i + 1];
    const currentTime = new Date(current.createdAt).getTime();
    const nextTime = new Date(next.createdAt).getTime();

    // Validate timestamps are valid (not NaN from Invalid Date)
    expect(currentTime).not.toBeNaN();
    expect(nextTime).not.toBeNaN();

    expect(currentTime).toBeLessThanOrEqual(nextTime);
  }

  // No gaps in PREVIOUS_CONTEXT relationships
  for (let i = 1; i < path.length; i++) {
    const current = path[i];
    const previous = path[i - 1];
    expect(current.previousContextId).toBe(previous.contextId);
  }
}

/**
 * Validate that path leads to expected matched context
 *
 * Checks that last node in path equals matched context (path endpoint).
 *
 * @param path - Career trajectory
 * @param matchedContextId - Expected contextId at path end
 * @throws Vitest assertion error if path doesn't lead to matched context
 *
 * @example
 * const result = await searchManager.searchByTarget({...});
 * validatePathLeadsTo(result.path, result.matchedContext.contextId);
 */
export function validatePathLeadsTo(path: UserContext[], matchedContextId: string): void {
  if (path.length === 0) {
    return; // No path to validate
  }

  const lastPathContext = path.at(-1);
  expect(lastPathContext.contextId).toBe(matchedContextId);
}

/**
 * Validate all paths in search results with logging
 *
 * Convenience function to validate path structure and endpoints for all results.
 * Logs count of validated paths for debugging.
 *
 * @param results - Search results to validate
 * @param testTag - Tag for console logging (e.g., "TG1", "DT4")
 *
 * @example
 * const results = await searchManager.searchByTarget({...});
 * validateAllPaths(results, 'TG1');
 */
export function validateAllPaths(
  results: { path?: UserContext[]; matchedContext: { contextId: string } }[],
  testTag: string,
): void {
  results.forEach((r) => {
    if (r.path && r.path.length > 0) {
      validatePathStructure(r.path);
      validatePathLeadsTo(r.path, r.matchedContext.contextId);
    }
  });

  const validatedCount = results.filter((r) => r.path && r.path.length > 0).length;
  console.log(`[${testTag}] Path validation: ${validatedCount} paths validated`);
}
