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
  // When returning from advisor, restore previousPhase
  const phase = state.phase === PHASE.advising && state.previousPhase ? state.previousPhase : state.phase;

  const userResponse = interrupt({
    type: "show_results",
    results: state.searchResults,
    goal: state.storedGoal,
    chartUrl: state.chartUrl,
    phase,
  });

  return {
    userResponse: String(userResponse),
    phase,
    previousPhase: null,
  };
});
