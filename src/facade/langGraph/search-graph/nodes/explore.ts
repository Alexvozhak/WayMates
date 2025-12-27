import { generateTrajectoryChart, isChartServiceEnabled } from "../../../../chart/index.js";
import { config } from "../../../env.js";
import { computeFacets, shouldUseFacets } from "../facets.js";
import { NODE, PHASE } from "../state.js";
import { DEFAULT_CURRENT_SEARCH_PARAMS } from "../types.js";
import { withLogging } from "../with-logging.js";

import type { GenerateChartInput } from "../../../../chart/index.js";
import type { AdhocContextBase, ScoredMatchedCandidate, UserContext } from "../../../../shared/schemas.js";
import type { SearchStateType } from "../state.js";

type ExploreChartDeps = {
  userTrajectory: UserContext[];
  adhocContext: AdhocContextBase | null;
  results: ScoredMatchedCandidate[];
  dictionariesService: { getPositionOrder: () => Promise<string[]> };
  logger: { error: (obj: object, msg: string) => void };
};

function buildChartInput(deps: ExploreChartDeps, positionOrder: string[]): GenerateChartInput {
  const base = {
    candidates: deps.results,
    maxCandidates: config.CANDIDATES_DISPLAY_LIMIT,
    positionOrder,
    locale: "ru" as const,
    existingGoal: false,
  };
  if (deps.userTrajectory.length > 0) {
    return { mode: "full", userTrajectory: deps.userTrajectory, ...base };
  }
  return { mode: "candidates-only", adhocContext: deps.adhocContext!, ...base };
}

async function safeGenerateExploreChart(deps: ExploreChartDeps): Promise<string | null> {
  const hasDataForChart = deps.results.length > 0 && (deps.userTrajectory.length > 0 || deps.adhocContext !== null);
  if (!isChartServiceEnabled() || !hasDataForChart) {
    return null;
  }
  try {
    const positionOrder = await deps.dictionariesService.getPositionOrder();
    const chartInput = buildChartInput(deps, positionOrder);
    const result = await generateTrajectoryChart(chartInput);
    return result.chartUrl;
  } catch (error) {
    deps.logger.error({ err: error }, "Chart generation failed in explore");
    return null;
  }
}

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
      : await safeGenerateExploreChart({
          userTrajectory,
          adhocContext,
          results,
          dictionariesService,
          logger,
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
