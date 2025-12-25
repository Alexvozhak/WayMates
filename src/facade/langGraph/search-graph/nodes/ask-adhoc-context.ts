import { interrupt } from "@langchain/langgraph";

import { NODE, PHASE } from "../state.js";
import { withLogging } from "../with-logging.js";

import type { SearchStateType } from "../state.js";

const ASK_ADHOC_CONTEXT_MESSAGE = `Для поиска нужен хотя бы один параметр:
• Позиция (junior, middle, senior)
• Роль (backend, frontend, data scientist)
• Навыки (Python, React, SQL)
• Страна`;

/**
 * Ask adhoc context node: requests user to provide context for adhoc search.
 * Triggered when startAdhoc intent received but no valid context extracted.
 */
export const askAdhocContextNode = withLogging<SearchStateType>(NODE.ask_adhoc_context, () => {
  const userResponse = interrupt({
    type: "ask_adhoc_context",
    message: ASK_ADHOC_CONTEXT_MESSAGE,
    phase: PHASE.asking_adhoc_context,
  });

  return {
    userResponse: String(userResponse),
    phase: PHASE.asking_adhoc_context,
  };
});
