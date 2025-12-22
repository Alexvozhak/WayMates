import { NODE, PHASE } from "../state.js";
import { DEFAULT_LIMIT, DEFAULT_RECENCY_THRESHOLD_MONTHS } from "../types.js";
import { withLogging } from "../with-logging.js";

import type { SearchStateType } from "../state.js";

/**
 * Search node: searches candidates WITH goal filtering.
 * Used after user saves a goal.
 * Supports CurrentSearchParams filtering (excludedContextFields, excludedCreationReasons).
 */
export const searchNode = withLogging<SearchStateType>(NODE.search, async (state, _config, { coreClient }) => {
  const { userId, adhocContext, currentSearchParams } = state;

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
    searchResults: results,
    phase: PHASE.showing_results,
  };
});
