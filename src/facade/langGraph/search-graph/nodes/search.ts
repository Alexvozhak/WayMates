import { AgentInvariantError } from "../../../errors.js";
import { hasConfigDeps } from "../../shared/types.js";
import { NODE, PHASE } from "../state.js";
import { DEFAULT_LIMIT, DEFAULT_RECENCY_THRESHOLD_MONTHS } from "../types.js";

import type { SearchStateType } from "../state.js";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

/**
 * Search node: searches candidates WITH goal filtering.
 * Used after user saves a goal.
 * Supports CurrentSearchParams filtering (excludedContextFields, excludedCreationReasons).
 */
export async function searchNode(
  state: SearchStateType,
  config: LangGraphRunnableConfig,
): Promise<Partial<SearchStateType>> {
  const { userId, adhocContext, currentSearchParams } = state;

  if (!hasConfigDeps(config)) {
    throw new AgentInvariantError(NODE.search, "Missing coreClient or normalizer");
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

  // Adhoc mode: use temporary context instead of user's saved context
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
    searchResults: results,
    phase: PHASE.showingResults,
  };
}
