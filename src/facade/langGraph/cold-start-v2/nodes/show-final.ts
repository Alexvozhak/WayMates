import { interrupt } from "@langchain/langgraph";

import { PHASE } from "../state.js";

import type { ColdStartStateType } from "../state.js";

export function showFinalNode(state: ColdStartStateType): Partial<ColdStartStateType> {
  const { collectedContexts, collectedTrails } = state;

  const userResponse = interrupt({
    type: "final_confirmation",
    message: "Final preview of your career history:",
    preview: {
      contexts: collectedContexts,
      trails: collectedTrails,
    },
    summary: {
      contextsCount: collectedContexts.length,
      trailsCount: collectedTrails.length,
    },
    options: ["approve", "edit", "cancel"],
    phase: PHASE.awaiting_final_confirmation,
  });

  return {
    userResponse: String(userResponse),
    phase: PHASE.awaiting_final_confirmation,
  };
}
