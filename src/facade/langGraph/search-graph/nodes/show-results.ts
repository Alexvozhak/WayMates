import { interrupt } from "@langchain/langgraph";

import { OPTIONS, PHASE } from "../state.js";

import { parseUserIntent } from "./parse-intent.js";

import type { SearchStateType } from "../state.js";

/**
 * Show results node: displays search results with current goal and waits for user decision.
 * User can change goal, delete goal (return to explore), or finish.
 */
export async function showResultsNode(state: SearchStateType): Promise<Partial<SearchStateType>> {
  const userResponse = interrupt({
    type: "show_results",
    results: state.searchResults,
    goal: state.existingGoal,
    options: OPTIONS.showResults,
    phase: PHASE.showingResults,
  });

  const response = String(userResponse);
  const parsed = await parseUserIntent(response);

  return {
    userResponse: response,
    searchUserIntent: parsed.intent,
  };
}
