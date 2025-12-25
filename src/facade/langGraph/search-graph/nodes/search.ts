import { NODE, PHASE } from "../state.js";
import { DEFAULT_CURRENT_SEARCH_PARAMS } from "../types.js";
import { withLogging } from "../with-logging.js";

import type { SearchStateType } from "../state.js";

/**
 * Search node: searches candidates WITH goal filtering.
 * Used after user saves a goal.
 * Supports CurrentSearchParams filtering (excludedContextFields, excludedCreationReasons).
 */
export const searchNode = withLogging<SearchStateType>(NODE.search, async (state, _config, { coreClient }) => {
  const { userId, adhocContext, currentSearchParams } = state;

  const params = currentSearchParams ?? { ...DEFAULT_CURRENT_SEARCH_PARAMS };

  const results = await coreClient.client.search.waymates.query({
    userId,
    referenceContext: adhocContext ?? undefined,
    ...params,
  });

  return {
    searchResults: results,
    currentSearchParams: params,
    phase: PHASE.showing_results,
  };
});
