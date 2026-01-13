import { interrupt } from "@langchain/langgraph";

import { NODE } from "../state.js";
import { withLogging } from "../with-logging.js";

import type { SearchStateType } from "../state.js";

export const clarifyIntentNode = withLogging<SearchStateType>(NODE.clarify_intent, (state, _config, _deps) => {
  const { phase } = state;

  const userResponse = interrupt({
    type: "clarify_intent",
    message: "I didn't understand your response. Please try again.",
    phase,
  });

  return { userResponse: String(userResponse) };
});
