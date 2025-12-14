import { interrupt } from "@langchain/langgraph";

import { AgentInvariantError } from "../../../errors.js";
import { NODE, PHASE } from "../state.js";

import { parseUserIntent } from "./parse-intent.js";


import type { SearchStateType } from "../state.js";

export async function showGoalNode(state: SearchStateType): Promise<Partial<SearchStateType>> {
  const { extractedGoal } = state;

  if (!extractedGoal) {
    throw new AgentInvariantError(NODE.show_goal, "extractedGoal must exist before showing");
  }

  const userResponse = interrupt({
    type: "show_goal",
    extractedGoal,
    options: ["clarify", "validate", "confirm", "cancel"],
    phase: PHASE.showingGoal,
  });

  const response = String(userResponse);
  const intent = await parseUserIntent(response);

  return {
    userResponse: response,
    searchUserIntent: intent,
  };
}
