import { NODE, PHASE } from "../state.js";
import { DEFAULT_CURRENT_SEARCH_PARAMS } from "../types.js";
import { withLogging } from "../with-logging.js";

import type { SearchStateType } from "../state.js";

/**
 * Search waymates node: finds people similar to user heading to the same goal.
 *
 * Value for user: networking, peers who understand the journey, mutual support.
 */
export const searchWaymatesNode = withLogging<SearchStateType>(
  NODE.search_waymates,
  async (state, _config, { coreClient }) => {
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
      searchMode: "waymates" as const,
      phase: PHASE.showing_results,
    };
  },
);
