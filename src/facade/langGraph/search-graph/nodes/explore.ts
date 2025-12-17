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

  // DEBUG: Log what we're sending to Core
  console.log("[EXPLORE NODE] Mode:", adhocContext ? "ADHOC" : "BY_USER");
  console.log("[EXPLORE NODE] adhocContext:", JSON.stringify(adhocContext));
  console.log("[EXPLORE NODE] params:", JSON.stringify(params));

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

  // DEBUG: Check what Core returns
  console.log("[EXPLORE NODE] results count:", results.length);
  if (results.length > 0) {
    console.log("[EXPLORE NODE] first result sample:", JSON.stringify(results[0], null, 2));
  } else {
    console.log("[EXPLORE NODE] NO RESULTS - check Core search.adhoc logic");
  }

  return {
    explorationResults: results,
    phase: PHASE.showingExploration,
  };
}
