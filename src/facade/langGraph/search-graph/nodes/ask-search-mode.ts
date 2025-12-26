import { interrupt } from "@langchain/langgraph";

import { AgentInvariantError } from "../../../errors.js";
import { NODE, PHASE } from "../state.js";
import { withLogging } from "../with-logging.js";

import type { SearchStateType } from "../state.js";

/**
 * Ask search mode node: after goal is saved, asks user which search mode they want.
 *
 * Options:
 * - Pathfinders: people who went FROM user's context TO user's goal (proof of transition)
 * - Waymates: similar people heading to the same goal (networking, peers)
 */
export const askSearchModeNode = withLogging<SearchStateType>(NODE.ask_search_mode, (state, _config, _deps) => {
  const { storedGoal } = state;

  if (!storedGoal) {
    throw new AgentInvariantError(NODE.ask_search_mode, "storedGoal must exist");
  }

  const userResponse = interrupt({
    type: "ask_search_mode",
    storedGoal,
    phase: PHASE.asking_search_mode,
  });

  return {
    userResponse: String(userResponse),
    phase: PHASE.asking_search_mode,
  };
});
