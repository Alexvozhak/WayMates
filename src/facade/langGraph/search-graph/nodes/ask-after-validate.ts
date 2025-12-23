import { interrupt } from "@langchain/langgraph";

import { NODE, PHASE } from "../state.js";
import { withLogging } from "../with-logging.js";

import type { SearchStateType } from "../state.js";

/**
 * Ask after validate node: shows validation results and asks if user wants to proceed.
 * User can save, change goal, clarify, or cancel.
 */
export const askAfterValidateNode = withLogging<SearchStateType>(NODE.ask_after_validate, (state, _config, _deps) => {
  const userResponse = interrupt({
    type: "ask_after_validate",
    candidates: state.validationResults,
    message: "Based on these trajectories, is this the goal you want?",
    phase: PHASE.asking_after_validate,
  });

  return {
    userResponse: String(userResponse),
    phase: PHASE.asking_after_validate,
  };
});
