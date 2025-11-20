/**
 * Path structure validator for integration tests
 *
 * Validates career trajectory paths in Target Search results:
 * - Chronological order (createdAt ascending)
 * - No gaps in PREVIOUS_CONTEXT relationships
 * - Path leads to matched context
 */

import { expect } from "vitest";
import type { UserContext } from "../../../src/shared/schemas.js";

function validatePathStructure(path: UserContext[]): void {
  if (path.length === 0) {
    return;
  }

  expect(path[0]!.previousContextId).toBeNull();

  if (path.length === 1) {
    return;
  }

  // Chronological order
  for (let i = 0; i < path.length - 1; i++) {
    const current = path[i]!;
    const next = path[i + 1]!;
    const currentTime = new Date(current.createdAt).getTime();
    const nextTime = new Date(next.createdAt).getTime();

    expect(currentTime).not.toBeNaN();
    expect(nextTime).not.toBeNaN();
    expect(currentTime).toBeLessThanOrEqual(nextTime);
  }

  // No gaps in PREVIOUS_CONTEXT relationships
  for (let i = 1; i < path.length; i++) {
    const current = path[i]!;
    const previous = path[i - 1]!;
    expect(current.previousContextId).toBe(previous.contextId);
  }
}

function validatePathLeadsTo(path: UserContext[], matchedContextId: string): void {
  if (path.length === 0) {
    return;
  }

  const lastPathContext = path.at(-1)!;
  expect(lastPathContext.contextId).toBe(matchedContextId);
}

/**
 * Validate all paths in search results
 *
 * Checks path structure and endpoints for all results with paths.
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
