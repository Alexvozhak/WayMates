import { interrupt } from "@langchain/langgraph";

import { AgentInvariantError } from "../../../errors.js";
import { NODE, OPTIONS, PHASE } from "../state.js";

import type { SearchStateType } from "../state.js";

/**
 * Show goal node: displays extracted goal and waits for user decision.
 * User can validate, clarify, save, or cancel.
 *
 * Conditional interrupt: skips interrupt if userResponse already exists
 * (from load_existing_goal flow where initial message should be used).
 */
export function showGoalNode(state: SearchStateType): Partial<SearchStateType> {
  const { extractedGoal, userResponse: stateUserResponse } = state;

  if (!extractedGoal) {
    throw new AgentInvariantError(NODE.show_goal, "extractedGoal must exist before showing");
  }

  // Conditional interrupt: use state.userResponse if available (from load_existing_goal),
  // otherwise interrupt for user input (from clarify_goal/extract_goal flow)
  const hasExistingResponse = stateUserResponse && stateUserResponse !== "";

  if (hasExistingResponse) {
    return {
      userResponse: stateUserResponse,
      phase: PHASE.showingGoal,
    };
  }

  const userResponse = interrupt({
    type: "show_goal",
    extractedGoal,
    options: OPTIONS.showGoal,
    phase: PHASE.showingGoal,
  });

  return {
    userResponse: String(userResponse),
    phase: PHASE.showingGoal,
  };
}
