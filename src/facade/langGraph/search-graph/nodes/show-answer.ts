import { interrupt } from "@langchain/langgraph";

import { NODE, OPTIONS, PHASE } from "../state.js";
import { withLogging } from "../with-logging.js";

import type { SearchStateType } from "../state.js";

/**
 * Show answer node: displays advisor response and waits for user's next action.
 * Interrupt only — reads answer from state (set by generate_answer).
 */
export const showAnswerNode = withLogging<SearchStateType>(NODE.show_answer, (state, _config, _deps) => {
  const userResponse = interrupt({
    type: "advising",
    answerText: state.currentAnswer,
    options: OPTIONS.advising,
    phase: PHASE.advising,
  });

  return {
    userResponse: String(userResponse),
    phase: PHASE.advising,
  };
});
