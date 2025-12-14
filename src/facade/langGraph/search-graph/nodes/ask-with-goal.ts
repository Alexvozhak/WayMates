import { interrupt } from "@langchain/langgraph";

import { PHASE } from "../state.js";

import { parseUserIntent } from "./parse-intent.js";


import type { SearchStateType } from "../state.js";

export async function askWithGoalNode(state: SearchStateType): Promise<Partial<SearchStateType>> {
  const userResponse = interrupt({
    type: "ask_with_goal",
    goal: state.existingGoal,
    options: ["search", "validate", "change", "explore", "cancel"],
    phase: PHASE.askingWithGoal,
  });

  const response = String(userResponse);
  const intent = await parseUserIntent(response);

  return {
    userResponse: response,
    searchUserIntent: intent,
  };
}
