import { interrupt } from "@langchain/langgraph";

import { NODE, OPTIONS, PHASE } from "../state.js";
import { withLogging } from "../with-logging.js";

import type { SearchStateType } from "../state.js";

/**
 * Show exploration node: displays all candidates and waits for user decision.
 * User can either proceed to set a goal, apply filters, or cancel.
 */
export const showExplorationNode = withLogging<SearchStateType>(NODE.show_exploration, (state, _config, _deps) => {
  const userResponse = interrupt({
    type: "show_exploration",
    candidates: state.explorationResults,
    options: OPTIONS.showExploration,
    phase: PHASE.showing_exploration,
  });

  return {
    userResponse: String(userResponse),
    phase: PHASE.showing_exploration,
  };
});
