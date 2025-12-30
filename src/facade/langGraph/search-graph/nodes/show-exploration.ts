import { interrupt } from "@langchain/langgraph";

import { NODE } from "../state.js";
import { withLogging } from "../with-logging.js";

import type { SearchStateType } from "../state.js";

/**
 * Show exploration node: displays all candidates and waits for user decision.
 * User can either proceed to set a goal, apply filters, or cancel.
 */
export const showExplorationNode = withLogging<SearchStateType>(NODE.show_exploration, (state, _config, _deps) => {
  // Phase is already set by explore node (showing_exploration_candidates or showing_exploration_facets)
  const userResponse = interrupt({
    type: "show_exploration",
    candidates: state.explorationResults,
    phase: state.phase,
  });

  return {
    userResponse: String(userResponse),
    currentSearchParams: state.currentSearchParams,
    targetSearchParams: state.targetSearchParams,
    // Keep phase as set by explore - don't override
  };
});
