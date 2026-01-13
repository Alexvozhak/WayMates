import { interrupt } from "@langchain/langgraph";

import { NODE } from "../state.js";
import { withLogging } from "../with-logging.js";

import type { SearchStateType } from "../state.js";

/**
 * Ask after validate node: shows validation results and asks if user wants to proceed.
 * User can save, change goal, clarify, or cancel.
 */
export const askAfterValidateNode = withLogging<SearchStateType>(NODE.ask_after_validate, (state, _config, _deps) => {
  // Phase is already set by validate_goal node (asking_after_validate_candidates or asking_after_validate_facets)
  const userResponse = interrupt({
    type: "ask_after_validate",
    candidates: state.validationResults,
    message: "Based on these trajectories, is this the goal you want?",
    phase: state.phase,
  });

  return {
    userResponse: String(userResponse),
    // Keep phase as set by validate_goal - don't override
  };
});
