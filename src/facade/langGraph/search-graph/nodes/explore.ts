import { generateTrajectoryChart, isChartServiceEnabled } from "../../../../chart/index.js";
import { config } from "../../../env.js";
import { computeFacets, shouldUseFacets } from "../facets.js";
import { NODE, PHASE } from "../state.js";
import { DEFAULT_CURRENT_SEARCH_PARAMS } from "../types.js";
import { withLogging } from "../with-logging.js";

import type { SearchStateType } from "../state.js";

/**
 * Explore node: searches ALL candidates without goal filter.
 * Used when user has no goal yet or wants to browse all matches.
 * Supports CurrentSearchParams filtering (excludedContextFields, excludedCreationReasons).
 */
export const exploreNode = withLogging<SearchStateType>(
  NODE.explore,
  async (state, _config, { coreClient, dictionariesService, logger }) => {
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

    const needsFiltering = shouldUseFacets(results);

    if (needsFiltering) {
      return {
        explorationResults: results,
        currentSearchParams: params,
        phase: PHASE.showing_exploration_facets,
        facets: computeFacets(results),
        chartUrl: null,
      };
    }

    let chartUrl: string | null = null;

    const hasDataForChart = results.length > 0 && adhocContext !== null;
    const shouldGenerateChart = isChartServiceEnabled() && hasDataForChart;

    if (shouldGenerateChart) {
      try {
        const positionOrder = await dictionariesService.getPositionOrder();
        const result = await generateTrajectoryChart({
          mode: "candidates-only",
          adhocContext,
          candidates: results,
          maxCandidates: config.CANDIDATES_DISPLAY_LIMIT,
          positionOrder,
          locale: "ru",
          existingGoal: false,
        });
        chartUrl = result.chartUrl;
      } catch (error) {
        logger.error({ err: error }, "Chart generation failed in explore");
      }
    }

    return {
      explorationResults: results,
      currentSearchParams: params,
      phase: PHASE.showing_exploration_candidates,
      facets: null,
      chartUrl,
    };
  },
);
