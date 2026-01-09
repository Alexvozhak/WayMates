import { safeGenerateChart } from "../chart-utils.js";
import { computeFacets, shouldUseFacets } from "../facets.js";
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
  async (state, _config, { coreClient, dictionariesService, logger }) => {
    const { userId, adhocContext, userTrajectory, storedGoal, currentSearchParams, locale } = state;

    const params = currentSearchParams ?? { ...DEFAULT_CURRENT_SEARCH_PARAMS };

    // waymatesOnly=true: Core filters by isWaymate BEFORE applying pathLimit
    const results = await coreClient.client.search.waymates.query({
      userId,
      referenceContext: adhocContext ?? undefined,
      waymatesOnly: true,
      ...params,
    });

    logger.info({ resultsCount: results.length }, "waymates results (filtered by Core)");

    const needsFiltering = shouldUseFacets(results);

    const chartUrl = needsFiltering
      ? null
      : await safeGenerateChart({
          mode: "with-goal",
          userTrajectory,
          adhocContext,
          storedGoal,
          candidates: results,
          locale,
          dictionariesService,
          logger,
          nodeName: NODE.search_waymates,
          excludedContextFields: params.excludedContextFields,
        });

    return {
      waymatesResults: results,
      currentSearchParams: params,
      searchMode: "waymates" as const,
      phase: needsFiltering ? PHASE.showing_results_facets : PHASE.showing_waymate_results,
      facets: needsFiltering ? computeFacets(results) : null,
      chartUrl,
      answerText: null, // Clear previous advisor answer
    };
  },
);
