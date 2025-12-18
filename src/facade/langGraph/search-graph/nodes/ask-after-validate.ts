import { interrupt } from "@langchain/langgraph";

import { OPTIONS, PHASE } from "../state.js";

import type { SearchStateType } from "../state.js";

/**
 * Ask after validate node: shows validation results and asks if user wants to proceed.
 * User can save, change goal, clarify, or cancel.
 */
export function askAfterValidateNode(state: SearchStateType): Partial<SearchStateType> {
  const userResponse = interrupt({
    type: "ask_after_validate",
    candidates: state.validationResults,
    message: "Based on these trajectories, is this the goal you want?",
    options: OPTIONS.askAfterValidate,
    phase: PHASE.askingAfterValidate,
  });

  return {
    userResponse: String(userResponse),
    phase: PHASE.askingAfterValidate,
  };
}
