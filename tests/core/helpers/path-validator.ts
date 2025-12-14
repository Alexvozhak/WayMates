/**
 * Path structure validator for integration tests
 *
 * Validates career trajectory paths in Target Search results:
 * - Chronological order (createdAt ascending)
 * - No gaps in PREVIOUS_CONTEXT relationships
 * - Path contains matched context (anywhere in trajectory)
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

function validatePathContainsMatchedContext(path: UserContext[], matchedContextId: string): void {
  if (path.length === 0) {
    return;
  }

  // Path must contain matchedContext somewhere in trajectory
  const matchedIndex = path.findIndex((ctx) => ctx.contextId === matchedContextId);
  expect(matchedIndex, `matchedContext ${matchedContextId} must be in path`).toBeGreaterThanOrEqual(0);

  // Path[-1] must be the most recent context (current context)
  const lastContext = path.at(-1)!;
  const maxCreatedAt = Math.max(...path.map((ctx) => new Date(ctx.createdAt).getTime()));
  expect(new Date(lastContext.createdAt).getTime(), "Last path element must be the most recent (current) context").toBe(
    maxCreatedAt,
  );
}

/**
 * Validate all paths in search results
 *
 * Checks path structure and that matched context exists in path.
 * Path is FULL trajectory (from first context to current context).
 */
export function validateAllPaths(
  results: { path?: UserContext[]; matchedContext: { contextId: string } }[],
  testTag: string,
): void {
  results.forEach((r) => {
    if (r.path && r.path.length > 0) {
      validatePathStructure(r.path);
      validatePathContainsMatchedContext(r.path, r.matchedContext.contextId);
    }
  });

  const validatedCount = results.filter((r) => r.path && r.path.length > 0).length;
  console.log(`[${testTag}] Path validation: ${validatedCount} paths validated`);
}
