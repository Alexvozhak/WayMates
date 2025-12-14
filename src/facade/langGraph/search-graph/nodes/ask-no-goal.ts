import { interrupt } from "@langchain/langgraph";

import { PHASE } from "../state.js";

import { parseUserIntent } from "./parse-intent.js";


import type { SearchStateType } from "../state.js";

export async function askNoGoalNode(_state: SearchStateType): Promise<Partial<SearchStateType>> {
  const userResponse = interrupt({
    type: "ask_no_goal",
    message: "What career goal would you like to achieve?",
    options: ["confirm", "explore", "cancel"],
    phase: PHASE.askingNoGoal,
  });

  const response = String(userResponse);
  const intent = await parseUserIntent(response);

  return {
    userResponse: response,
    searchUserIntent: intent,
  };
}
