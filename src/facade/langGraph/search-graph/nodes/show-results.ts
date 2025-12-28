import { interrupt } from "@langchain/langgraph";

import { extractGoalValues, generateTrajectoryChart, isChartServiceEnabled } from "../../../../chart/index.js";
import { config } from "../../../env.js";
import { NODE, PHASE } from "../state.js";
import { withLogging } from "../with-logging.js";

import type { PathfinderCandidate, WaymateCandidate } from "../../../../shared/schemas.js";
import type { SearchStateType } from "../state.js";

/**
 * Convert PathfinderCandidate to chart-compatible WaymateCandidate.
 * Maps pathfinder-specific fields to standard candidate format.
 */
function toChartCandidate(pf: PathfinderCandidate): WaymateCandidate {
  return {
    userId: pf.userId,
    matchedContext: pf.matchedContext,
    contextMatchScore: 0,
    isWaymate: false,
    path: pf.path,
    trails: pf.trails,
    timeSinceMatchedMonths: pf.timeSinceTargetMonths,
    dtwMetrics: pf.dtwMetrics,
    dtwTotal: pf.dtwTotal,
  };
}

/**
 * Show results node: displays search results with current goal and waits for user decision.
 * User can change goal, delete goal (return to explore), apply filters, or cancel.
 */
export const showResultsNode = withLogging<SearchStateType>(
  NODE.show_results,
  async (state, _config, { logger, dictionariesService }) => {
    let chartUrl: string | undefined;

    const candidates =
      state.searchMode === "pathfinders"
        ? state.pathfinderResults.map((pf) => toChartCandidate(pf))
        : state.searchResults;

    const hasDataForChart = candidates.length > 0 && state.userTrajectory.length > 0;
    const shouldGenerateChart = isChartServiceEnabled() && hasDataForChart;

    if (shouldGenerateChart) {
      try {
        const goalValues = extractGoalValues(state.storedGoal);
        const positionOrder = await dictionariesService.getPositionOrder();
        const result = await generateTrajectoryChart({
          mode: "full",
          userTrajectory: state.userTrajectory,
          candidates,
          maxCandidates: config.CANDIDATES_DISPLAY_LIMIT,
          positionOrder,
          locale: "ru",
          existingGoal: Boolean(state.storedGoal),
          goalValues,
        });
        chartUrl = result.chartUrl;
      } catch (error) {
        logger.error({ err: error }, "Chart generation failed");
      }
    }

    const userResponse = interrupt({
      type: "show_results",
      results: state.searchResults,
      goal: state.storedGoal,
      chartUrl,
      phase: PHASE.showing_results,
    });

    return {
      userResponse: String(userResponse),
      phase: PHASE.showing_results,
      chartUrl: chartUrl ?? null,
    };
  },
);
