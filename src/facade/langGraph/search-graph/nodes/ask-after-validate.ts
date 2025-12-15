import { interrupt } from "@langchain/langgraph";

import { OPTIONS, PHASE } from "../state.js";

import { parseUserIntent } from "./parse-intent.js";

import type { SearchStateType } from "../state.js";

export async function askAfterValidateNode(state: SearchStateType): Promise<Partial<SearchStateType>> {
  const { validationResults, newPositionRound } = state;

  const userResponse = interrupt({
    type: "ask_after_validate",
    candidates: validationResults,
    message: "Based on these trajectories, is this the goal you want?",
    options: OPTIONS.askAfterValidate,
    phase: PHASE.askingAfterValidate,
  });

  const response = String(userResponse);
  const parsed = await parseUserIntent(response);

  return {
    userResponse: response,
    searchUserIntent: parsed.intent,
    newPositionRound: parsed.intent === "change" ? newPositionRound + 1 : newPositionRound,
  };
}
