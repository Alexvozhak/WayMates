import { interrupt } from "@langchain/langgraph";

import { NODE, PHASE } from "../state.js";
import { withLogging } from "../with-logging.js";

import type { SearchStateType } from "../state.js";

/**
 * Show results node: displays search results with current goal and waits for user decision.
 * User can change goal, delete goal (return to explore), apply filters, or cancel.
 *
 * Chart is generated in search_waymates/search_pathfinders nodes (before interrupt).
 */
export const showResultsNode = withLogging<SearchStateType>(NODE.show_results, (state, _config, _deps) => {
  const isPathfinderPhase = state.phase === PHASE.showing_pathfinder_results;

  const userResponse = interrupt({
    type: "show_results",
    results: isPathfinderPhase ? state.pathfinderResults : state.waymatesResults,
    goal: state.storedGoal,
    chartUrl: state.chartUrl,
    phase: state.phase,
  });

  return {
    userResponse: String(userResponse),
  };
});
