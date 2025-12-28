import { safeGenerateChart } from "../chart-utils.js";
import { computeFacets, shouldUseFacets } from "../facets.js";
import { NODE, PHASE } from "../state.js";
import { DEFAULT_CURRENT_SEARCH_PARAMS } from "../types.js";
import { withLogging } from "../with-logging.js";

import type { SearchStateType } from "../state.js";

/**
 * Explore node: searches ALL candidates without goal filter.
 * Used when user has no goal yet or wants to browse all matches.
 */
export const exploreNode = withLogging<SearchStateType>(
  NODE.explore,
  async (state, _config, { coreClient, dictionariesService, logger }) => {
    const { userId, adhocContext, userTrajectory, currentSearchParams } = state;

    const params = currentSearchParams ?? { ...DEFAULT_CURRENT_SEARCH_PARAMS };

    const results = await coreClient.client.search.waymates.query({
      userId,
      referenceContext: adhocContext ?? undefined,
      ...params,
    });

    const needsFiltering = shouldUseFacets(results);

    // Skip chart generation if showing facets (chart won't be used)
    const chartUrl = needsFiltering
      ? null
      : await safeGenerateChart({
          mode: "explore",
          userTrajectory,
          adhocContext,
          candidates: results,
          locale: state.locale,
          dictionariesService,
          logger,
          nodeName: NODE.explore,
        });

    return {
      explorationResults: results,
      currentSearchParams: params,
      phase: needsFiltering ? PHASE.showing_exploration_facets : PHASE.showing_exploration_candidates,
      facets: needsFiltering ? computeFacets(results) : null,
      chartUrl,
    };
  },
);
