import { NODE, PHASE } from "../state.js";
import { DEFAULT_CURRENT_SEARCH_PARAMS } from "../types.js";
import { withLogging } from "../with-logging.js";

import type { SearchStateType } from "../state.js";

/**
 * Explore node: searches ALL candidates without goal filter.
 * Used when user has no goal yet or wants to browse all matches.
 * Supports CurrentSearchParams filtering (excludedContextFields, excludedCreationReasons).
 */
export const exploreNode = withLogging<SearchStateType>(NODE.explore, async (state, _config, { coreClient }) => {
  const { userId, adhocContext, currentSearchParams } = state;

  const params = currentSearchParams ?? { ...DEFAULT_CURRENT_SEARCH_PARAMS };

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
    currentSearchParams: params,
    phase: PHASE.showing_exploration,
  };
});
