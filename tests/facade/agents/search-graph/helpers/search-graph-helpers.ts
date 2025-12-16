import { vi } from "vitest";

import { Command } from "@langchain/langgraph";

import { AgentInvariantError } from "../../../../../src/facade/errors.js";
import { SearchGraph } from "../../../../../src/facade/langGraph/search-graph/search-graph.js";
import {
  DEFAULT_LIMIT,
  DEFAULT_RECENCY_THRESHOLD_MONTHS,
} from "../../../../../src/facade/langGraph/search-graph/types.js";

import type { SearchGraphResponse } from "../../../../../src/facade/langGraph/search-graph/types.js";
import type { SearchStateType } from "../../../../../src/facade/langGraph/search-graph/state.js";
import type { CoreClient } from "../../../../../src/facade/core-client.js";
import type { CreateGoalInput, CurrentSearchParamsBase, UserId } from "../../../../../src/shared/schemas.js";
import type { GraphDeps } from "../../../../../src/facade/langGraph/shared/types.js";

/**
 * Test user ID from fixtures (U1).
 * U1 has 2 contexts (junior → middle), single domain ["frontend"].
 * Single domain allows finding candidates (U6 has ["frontend", "backend"] which filters out everyone).
 * Loaded via globalSetup.
 */
export const TEST_USER_ID: UserId = "usr_019a6ea7-18be-770d-85a1-ea515ab10d65";

/**
 * Relaxed filters for test fixtures matching.
 * Excludes geo/personal fields that vary across fixtures (countryCode, cityName, birthYear, languages).
 * Allows matching on core professional fields (position, domains, industry, etc).
 */
export const RELAXED_FILTERS: CurrentSearchParamsBase = {
  excludedContextFields: ["countryCode", "cityName", "birthYear", "languages"],
  excludedCreationReasons: [],
  recencyThresholdMonths: DEFAULT_RECENCY_THRESHOLD_MONTHS,
  limit: DEFAULT_LIMIT,
  pathLimit: DEFAULT_LIMIT,
};

/**
 * Type guard: check if input is a plain object (not Command, not null).
 * Used to detect initial graph invocation vs resume calls.
 */
function isInitialInvocation(input: unknown): input is Record<string, unknown> {
  return !(input instanceof Command) && typeof input === "object" && input !== null;
}

export async function setupUserWithGoal(coreClient: CoreClient, params: CreateGoalInput): Promise<void> {
  await coreClient.client.goal.set.mutate(params);
}

export async function cleanupUserGoal(coreClient: CoreClient, userId: UserId): Promise<void> {
  await coreClient.client.goal.delete.mutate({ userId });
}

/**
 * Run SearchGraph with custom initial state (for test scenarios).
 * Uses vi.spyOn to inject state fields without modifying production code.
 *
 * Type safety approach:
 * - Reflect.get for private field access (explicit reflection)
 * - Type guard (typeof === 'object') instead of cast (TypeScript inference)
 * - Partial<SearchStateType> for type-safe state overrides
 *
 * @param initialStateOverrides - State fields to inject (e.g., currentSearchParams, existingGoal, adhocContext)
 * @example
 * // Inject relaxed filters
 * runSearchGraphWithInitialState(deps, msg, tid, uid, { currentSearchParams: RELAXED_FILTERS })
 *
 * // Inject adhoc context
 * runSearchGraphWithInitialState(deps, msg, tid, uid, { adhocContext: { position: "senior" } })
 */
export async function runSearchGraphWithInitialState(
  deps: GraphDeps,
  message: string,
  threadId: string,
  userId: UserId,
  initialStateOverrides?: Partial<SearchStateType>,
): Promise<SearchGraphResponse> {
  const graph = new SearchGraph(deps);

  // Access private compiledGraph via bracket notation (test-only pattern)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions -- private field access for state injection
  const compiledGraph = (graph as any)["compiledGraph"];
  if (!compiledGraph?.invoke) {
    throw new AgentInvariantError("test-helper", "SearchGraph.compiledGraph field not found or missing invoke method");
  }

  const originalInvoke = compiledGraph.invoke.bind(compiledGraph);

  // Only spy if we need to inject state
  if (initialStateOverrides) {
    vi.spyOn(compiledGraph, "invoke").mockImplementation((input: unknown, config: unknown) => {
      if (isInitialInvocation(input)) {
        // Initial call: inject state overrides
        const modifiedInput = { ...input, ...initialStateOverrides };
        return originalInvoke(modifiedInput, config);
      }
      // Resume calls: pass through unchanged
      return originalInvoke(input, config);
    });
  }

  const response = await graph.run(message, threadId, userId, null);
  vi.restoreAllMocks();
  return response;
}

/**
 * Convenience helper: run SearchGraph with relaxed filters (most common test case).
 * Shorthand for `runSearchGraphWithInitialState(deps, msg, tid, uid, { currentSearchParams: RELAXED_FILTERS })`.
 */
export async function runSearchGraphWithRelaxedFilters(
  deps: GraphDeps,
  message: string,
  threadId: string,
  userId: UserId,
): Promise<SearchGraphResponse> {
  return runSearchGraphWithInitialState(deps, message, threadId, userId, {
    currentSearchParams: RELAXED_FILTERS,
  });
}
