import { interrupt } from "@langchain/langgraph";

import { OPTIONS, PHASE } from "../state.js";

import type { SearchStateType } from "../state.js";

/**
 * Show exploration node: displays all candidates and waits for user decision.
 * User can either proceed to set a goal, apply filters, or cancel.
 */
export function showExplorationNode(state: SearchStateType): Partial<SearchStateType> {
  const userResponse = interrupt({
    type: "show_exploration",
    candidates: state.explorationResults,
    options: OPTIONS.showExploration,
    phase: PHASE.showingExploration,
  });

  return {
    userResponse: String(userResponse),
    phase: PHASE.showingExploration,
  };
}
