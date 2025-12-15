import { AgentInvariantError } from "../../../errors.js";
import { NODE } from "../state.js";

import type { SearchStateType } from "../state.js";

/**
 * Load existing goal node: copies existingGoal.targetCriteria to extractedGoal.
 * Used when user wants to change their saved goal from show_results.
 */
export function loadExistingGoalNode(state: SearchStateType): Partial<SearchStateType> {
  const { existingGoal } = state;

  if (!existingGoal) {
    throw new AgentInvariantError(NODE.load_existing_goal, "existingGoal must exist to load");
  }

  return {
    extractedGoal: existingGoal.targetCriteria,
    clarifyRound: 0,
  };
}
