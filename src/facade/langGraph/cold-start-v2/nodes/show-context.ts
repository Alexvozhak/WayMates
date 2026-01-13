import { interrupt } from "@langchain/langgraph";

import { AgentInvariantError } from "../../../errors.js";
import { PHASE } from "../state.js";

import type { ColdStartStateType } from "../state.js";

export function showContextNode(state: ColdStartStateType): Partial<ColdStartStateType> {
  const { collectedContexts, collectedTrails, currentContextIndex, queue } = state;

  const currentContext = collectedContexts[currentContextIndex];
  if (!currentContext) {
    throw new AgentInvariantError("showContextNode", "currentContext must exist after validation", {
      currentContextIndex,
      collectedContextsLength: collectedContexts.length,
    });
  }

  const relatedTrails = collectedTrails.filter((t) => t.toContextId === currentContext.contextId);

  const userResponse = interrupt({
    type: "context_confirmation",
    message: `Context #${currentContextIndex + 1} of ${queue.length}:`,
    entity: currentContext,
    relatedTrails,
    progress: {
      current: currentContextIndex + 1,
      total: queue.length,
    },
    options: ["approve", "edit", "cancel"],
    phase: PHASE.awaiting_context_confirmation,
  });

  return {
    userResponse: String(userResponse),
    phase: PHASE.awaiting_context_confirmation,
  };
}
