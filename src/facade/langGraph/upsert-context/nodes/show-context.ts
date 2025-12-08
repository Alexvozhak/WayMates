import { interrupt } from "@langchain/langgraph";

import { PHASE } from "../state.js";

import type { UpsertContextStateType } from "../state.js";

export function showContextNode(state: UpsertContextStateType): Partial<UpsertContextStateType> {
  const { validatedContext, validationErrors } = state;

  const userResponse = interrupt({
    type: "context_confirmation",
    context: validatedContext,
    errors: validationErrors,
    options: ["approve", "edit", "cancel"],
    phase: PHASE.awaitingConfirmation,
  });

  return { userResponse: String(userResponse) };
}
