import { interrupt } from "@langchain/langgraph";

import { AgentInvariantError } from "../../../errors.js";
import { NODE, OPTIONS, PHASE } from "../state.js";
import { withLogging } from "../with-logging.js";

import type { SearchStateType } from "../state.js";

/**
 * Show goal node: displays extracted goal and waits for user decision.
 * User can validate, clarify, save, or cancel.
 *
 * Conditional interrupt: skips interrupt if userResponse already exists
 * (from load_existing_goal flow where initial message should be used).
 */
export const showGoalNode = withLogging<SearchStateType>(NODE.show_goal, (state, _config, _deps) => {
  const { extractedGoal, userResponse: stateUserResponse } = state;

  if (!extractedGoal) {
    throw new AgentInvariantError(NODE.show_goal, "extractedGoal must exist before showing");
  }

  const hasExistingResponse = stateUserResponse && stateUserResponse !== "";

  if (hasExistingResponse) {
    return {
      userResponse: stateUserResponse,
      phase: PHASE.showing_goal,
    };
  }

  const userResponse = interrupt({
    type: "show_goal",
    extractedGoal,
    options: OPTIONS.showGoal,
    phase: PHASE.showing_goal,
  });

  return {
    userResponse: String(userResponse),
    phase: PHASE.showing_goal,
  };
});
