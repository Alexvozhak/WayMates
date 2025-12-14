import { interrupt } from "@langchain/langgraph";

import { AgentInvariantError } from "../../../errors.js";
import { NODE, PHASE } from "../state.js";

import { parseUserIntent } from "./parse-intent.js";


import type { SearchStateType } from "../state.js";

export async function confirmGoalNode(state: SearchStateType): Promise<Partial<SearchStateType>> {
  const { extractedGoal } = state;

  if (!extractedGoal) {
    throw new AgentInvariantError(NODE.confirm_goal, "extractedGoal must exist before confirming");
  }

  const userResponse = interrupt({
    type: "confirm_goal",
    extractedGoal,
    message: "Save this goal?",
    options: ["confirm", "cancel"],
    phase: PHASE.confirmingGoal,
  });

  const response = String(userResponse);
  const intent = await parseUserIntent(response);

  return {
    userResponse: response,
    searchUserIntent: intent,
  };
}
