import { interrupt } from "@langchain/langgraph";

import { PHASE } from "../types.js";

import type { ColdStartStateType } from "../state.js";
import type { ColdStartPhase } from "../types.js";

function getOptionsForPhase(phase: ColdStartPhase): string[] {
  switch (phase) {
    case PHASE.story_gathering: {
      return ["approve", "continue", "cancel"];
    }
    case PHASE.awaiting_plan_confirmation: {
      return ["approve", "edit", "cancel"];
    }
    case PHASE.awaiting_context_confirmation: {
      return ["approve", "edit", "cancel"];
    }
    case PHASE.awaiting_final_confirmation: {
      return ["approve", "edit", "cancel"];
    }
    default: {
      return ["approve", "cancel"];
    }
  }
}

export function clarifyIntentNode(state: ColdStartStateType): Partial<ColdStartStateType> {
  const { phase } = state;

  const userResponse = interrupt({
    type: "clarify_intent",
    message: "I didn't understand your response. Please choose an action:",
    options: getOptionsForPhase(phase),
    phase,
  });

  return { userResponse: String(userResponse) };
}
