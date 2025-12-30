import { AgentInvariantError } from "../../../errors.js";
import { NODE, PHASE } from "../state.js";
import { withLogging } from "../with-logging.js";

import type { SearchStateType } from "../state.js";

/**
 * Load existing goal node: copies storedGoal.targetContext to extractedGoal.
 *
 * Called from two places:
 * 1. check_goal → load_existing_goal (first entry with existing goal)
 *    - phase = "searching" (set by check_goal)
 *    - userResponse contains initial message, NOT interrupt response
 *    - Must clear userResponse so show_goal does interrupt
 *
 * 2. show_results → load_existing_goal (user wants to change goal)
 *    - phase = "showing_waymate_results" or "showing_pathfinder_results"
 *    - userResponse contains interrupt response (e.g., "change")
 *    - Must preserve userResponse for show_goal to use
 */
export const loadExistingGoalNode = withLogging<SearchStateType>(NODE.load_existing_goal, (state, _config, _deps) => {
  const { storedGoal, phase } = state;

  if (!storedGoal) {
    throw new AgentInvariantError(NODE.load_existing_goal, "storedGoal must exist to load");
  }

  const isFromCheckGoal = phase === PHASE.searching;

  return {
    extractedGoal: storedGoal.targetContext,
    clarifyRound: 0,
    currentSearchParams: state.currentSearchParams,
    targetSearchParams: state.targetSearchParams,
    ...(isFromCheckGoal && { userResponse: "" }),
  };
});
