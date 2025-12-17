import { AgentInvariantError } from "../../../errors.js";
import { hasConfigDeps } from "../../shared/types.js";
import { NODE, PHASE } from "../state.js";
import { DEFAULT_LIMIT, DEFAULT_RECENCY_THRESHOLD_MONTHS } from "../types.js";

import type { SearchStateType } from "../state.js";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

/**
 * Explore node: searches ALL candidates without goal filter.
 * Used when user has no goal yet or wants to browse all matches.
 * Supports CurrentSearchParams filtering (excludedContextFields, excludedCreationReasons).
 */
export async function exploreNode(
  state: SearchStateType,
  config: LangGraphRunnableConfig,
): Promise<Partial<SearchStateType>> {
  const { userId, adhocContext, currentSearchParams } = state;

  if (!hasConfigDeps(config)) {
    throw new AgentInvariantError(NODE.explore, "Missing coreClient or normalizer");
  }
  const { coreClient } = config.configurable;

  // Apply filters from currentSearchParams or use strict defaults
  const params = currentSearchParams ?? {
    excludedContextFields: [],
    excludedCreationReasons: [],
    recencyThresholdMonths: DEFAULT_RECENCY_THRESHOLD_MONTHS,
    limit: DEFAULT_LIMIT,
    pathLimit: DEFAULT_LIMIT,
  };

  const results = adhocContext
    ? await coreClient.client.search.adhoc.query({
        userId,
        referenceContext: adhocContext,
        ...params,
      })
    : await coreClient.client.search.byUser.query({
        userId,
        ...params,
      });

  return {
    explorationResults: results,
    phase: PHASE.showingExploration,
  };
}
