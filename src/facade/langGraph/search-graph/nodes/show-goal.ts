import { interrupt } from "@langchain/langgraph";

import { AgentInvariantError } from "../../../errors.js";
import { NODE, PHASE } from "../state.js";
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
  const { extractedGoal, userResponse: stateUserResponse, phase: statePhase } = state;

  if (!extractedGoal) {
    throw new AgentInvariantError(NODE.show_goal, "extractedGoal must exist before showing");
  }

  // Use phase from state (clarifying_goal or showing_goal) — set by extract_goal
  const phase = statePhase === PHASE.clarifying_goal ? PHASE.clarifying_goal : PHASE.showing_goal;

  const hasExistingResponse = stateUserResponse && stateUserResponse !== "";

  if (hasExistingResponse) {
    return {
      userResponse: stateUserResponse,
      phase,
      currentSearchParams: state.currentSearchParams,
      targetSearchParams: state.targetSearchParams,
    };
  }

  const userResponse = interrupt({
    type: "show_goal",
    extractedGoal,
    phase,
  });

  return {
    userResponse: String(userResponse),
    phase,
    currentSearchParams: state.currentSearchParams,
    targetSearchParams: state.targetSearchParams,
  };
});
