import { interrupt } from "@langchain/langgraph";

import { PHASE } from "../state.js";

import type { UpsertTrailStateType } from "../state.js";

export function showTrailNode(state: UpsertTrailStateType): Partial<UpsertTrailStateType> {
  const { validatedTrail, validationErrors } = state;

  const userResponse = interrupt({
    type: "trail_confirmation",
    trail: validatedTrail,
    errors: validationErrors,
    options: ["approve", "edit", "cancel"],
    phase: PHASE.awaitingConfirmation,
  });

  return { userResponse: String(userResponse) };
}
