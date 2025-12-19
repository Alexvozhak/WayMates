import { vi } from "vitest";

import { Command } from "@langchain/langgraph";

import { AgentInvariantError } from "../../../../../src/facade/errors.js";
import { SearchGraph } from "../../../../../src/facade/langGraph/search-graph/search-graph.js";
import { DEFAULT_LIMIT } from "../../../../../src/facade/langGraph/search-graph/types.js";

import type {
  SearchGraphResponse,
  TargetSearchParamsWithFeedback,
} from "../../../../../src/facade/langGraph/search-graph/types.js";
import type { SearchStateType } from "../../../../../src/facade/langGraph/search-graph/state.js";
import type { CoreClient } from "../../../../../src/facade/core-client.js";
import type { CreateGoalInput, CurrentSearchParamsBase, UserId } from "../../../../../src/shared/schemas.js";
import type { GraphDeps } from "../../../../../src/facade/langGraph/shared/types.js";
import type { UserIntent } from "../../../../../src/facade/services/orchestrator/intent-classifier.js";

/**
 * Test user ID from fixtures (U1).
 * U1 has 2 contexts (junior → middle), single domain ["frontend"].
 * Single domain allows finding candidates (U6 has ["frontend", "backend"] which filters out everyone).
 * Loaded via globalSetup.
 */
export const TEST_USER_ID: UserId = "usr_019a6ea7-18be-770d-85a1-ea515ab10d65";

/**
 * Relaxed recency threshold for test fixtures.
 * Fixtures have contexts from 2022, so 12 months is too restrictive.
 */
const TEST_RECENCY_THRESHOLD_MONTHS = 120;

/**
 * Relaxed filters for test fixtures matching.
 * Excludes geo/personal fields that vary across fixtures (countryCode, cityName, birthYear, languages).
 * Allows matching on core professional fields (position, domains, industry, etc).
 */
export const RELAXED_FILTERS: CurrentSearchParamsBase = {
  excludedContextFields: ["countryCode", "cityName", "birthYear", "languages"],
  excludedCreationReasons: [],
  recencyThresholdMonths: TEST_RECENCY_THRESHOLD_MONTHS,
  limit: DEFAULT_LIMIT,
  pathLimit: DEFAULT_LIMIT,
};

/**
 * Relaxed target search params for validate_goal.
 * Uses extended recency threshold for test fixtures (2022 data).
 */
export const RELAXED_TARGET_FILTERS: TargetSearchParamsWithFeedback = {
  targetContext: {},
  excludedCreationReasons: [],
  recencyThresholdMonths: TEST_RECENCY_THRESHOLD_MONTHS,
  limit: DEFAULT_LIMIT,
  rejectedReasons: [],
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
 * @param intent - Pre-parsed intent (e.g., GRAPH_INTENT.startAdhoc) or null for LLM parsing
 * @param initialStateOverrides - State fields to inject (e.g., currentSearchParams, existingGoal, adhocContext)
 * @example
 * // Inject relaxed filters
 * runSearchGraphWithInitialState(deps, msg, tid, uid, null, { currentSearchParams: RELAXED_FILTERS })
 *
 * // Adhoc mode with pre-parsed intent
 * runSearchGraphWithInitialState(deps, msg, tid, uid, { type: "start_adhoc" }, { currentSearchParams: RELAXED_FILTERS })
 */
export async function runSearchGraphWithInitialState(
  deps: GraphDeps,
  message: string,
  threadId: string,
  userId: UserId,
  intent: UserIntent | null = null,
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

  const response = await graph.run(message, threadId, userId, intent);
  vi.restoreAllMocks();
  return response;
}

/**
 * Convenience helper: run SearchGraph with relaxed filters (most common test case).
 * Shorthand for `runSearchGraphWithInitialState(deps, msg, tid, uid, intent, { currentSearchParams, targetSearchParams })`.
 *
 * Injects both currentSearchParams (for adhoc search) and targetSearchParams (for validate_goal).
 * Both use extended recency threshold (120 months) to work with test fixtures from 2022.
 *
 * @param intent - Pre-parsed intent (e.g., GRAPH_INTENT.startAdhoc) or null for LLM parsing
 */
export async function runSearchGraphWithRelaxedFilters(
  deps: GraphDeps,
  message: string,
  threadId: string,
  userId: UserId,
  intent: UserIntent | null = null,
): Promise<SearchGraphResponse> {
  return runSearchGraphWithInitialState(deps, message, threadId, userId, intent, {
    currentSearchParams: RELAXED_FILTERS,
    targetSearchParams: RELAXED_TARGET_FILTERS,
  });
}
