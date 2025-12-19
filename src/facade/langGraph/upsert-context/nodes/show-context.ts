import { interrupt } from "@langchain/langgraph";

import { AgentInvariantError } from "../../../errors.js";
import { NODE, PHASE } from "../state.js";

import type { UpsertContextStateType } from "../state.js";

export function showContextNode(state: UpsertContextStateType): Partial<UpsertContextStateType> {
  const { validatedContext, validationErrors } = state;

  if (!validatedContext) {
    throw new AgentInvariantError(NODE.show_context, "validatedContext must exist before showing");
  }

  const userResponse = interrupt({
    type: "context_confirmation",
    context: validatedContext,
    errors: validationErrors,
    options: ["approve", "edit", "cancel"],
    phase: PHASE.awaiting_confirmation,
  });

  return { userResponse: String(userResponse) };
}
