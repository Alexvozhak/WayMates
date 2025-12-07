import { interrupt } from "@langchain/langgraph";

import { PHASE } from "../state.js";

import type { UpdateContextStateType } from "../state.js";

export function showUpdateNode(state: UpdateContextStateType): Partial<UpdateContextStateType> {
  const { currentContext, mergedContext, validationErrors } = state;

  const userResponse = interrupt({
    type: "update_confirmation",
    before: currentContext,
    after: mergedContext,
    errors: validationErrors,
    options: ["approve", "edit", "cancel"],
    phase: PHASE.awaitingConfirmation,
  });

  return { userResponse: String(userResponse) };
}
