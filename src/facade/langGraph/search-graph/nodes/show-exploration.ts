import { interrupt } from "@langchain/langgraph";

import { OPTIONS, PHASE } from "../state.js";

import { parseUserIntent } from "./parse-intent.js";

import type { SearchStateType } from "../state.js";

/**
 * Show exploration node: displays all candidates and waits for user decision.
 * User can either proceed to set a goal or cancel.
 */
export async function showExplorationNode(state: SearchStateType): Promise<Partial<SearchStateType>> {
  const userResponse = interrupt({
    type: "show_exploration",
    candidates: state.explorationResults,
    options: OPTIONS.showExploration,
    phase: PHASE.showingExploration,
  });

  const response = String(userResponse);
  const parsed = await parseUserIntent(response);

  return {
    userResponse: response,
    searchUserIntent: parsed.intent,
  };
}
