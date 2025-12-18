import { AgentInvariantError } from "../../../errors.js";
import { NODE, PHASE } from "../state.js";

import type { SearchStateType } from "../state.js";

/**
 * Load existing goal node: copies existingGoal.targetCriteria to extractedGoal.
 *
 * Called from two places:
 * 1. check_goal → load_existing_goal (first entry with existing goal)
 *    - phase = "searching" (set by check_goal)
 *    - userResponse contains initial message, NOT interrupt response
 *    - Must clear userResponse so show_goal does interrupt
 *
 * 2. show_results → load_existing_goal (user wants to change goal)
 *    - phase = "showing_results"
 *    - userResponse contains interrupt response (e.g., "change")
 *    - Must preserve userResponse for show_goal to use
 */
export function loadExistingGoalNode(state: SearchStateType): Partial<SearchStateType> {
  const { existingGoal, phase } = state;

  if (!existingGoal) {
    throw new AgentInvariantError(NODE.load_existing_goal, "existingGoal must exist to load");
  }

  // If coming from check_goal (phase=searching), clear userResponse
  // so show_goal will interrupt instead of using initial message as response
  const isFromCheckGoal = phase === PHASE.searching;

  return {
    extractedGoal: existingGoal.targetCriteria,
    clarifyRound: 0,
    ...(isFromCheckGoal && { userResponse: "" }),
  };
}
