import { interrupt } from "@langchain/langgraph";

import { NODE } from "../state.js";
import { withLogging } from "../with-logging.js";

import type { SearchStateType } from "../state.js";

/**
 * Show answer node: displays advisor response and waits for user's next action.
 * Interrupt only — reads answer from state (set by generate_answer).
 * Phase stays unchanged (showing_*_results) — no separate advising phase.
 */
export const showAnswerNode = withLogging<SearchStateType>(NODE.show_answer, (state, _config, _deps) => {
  const userResponse = interrupt({
    type: "show_answer",
    answerText: state.currentAnswer,
    phase: state.phase,
  });

  return {
    userResponse: String(userResponse),
    // Phase unchanged — stay in showing_*_results
  };
});
