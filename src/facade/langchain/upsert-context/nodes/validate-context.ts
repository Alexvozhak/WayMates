import { v7 as uuidv7 } from "uuid";

import { userContextSchema } from "../../../../shared/schemas.js";
import { PHASE } from "../state.js";

import type { UpsertContextStateType } from "../state.js";

export function validateContextNode(state: UpsertContextStateType): Partial<UpsertContextStateType> {
  const { extractedContext } = state;

  if (!extractedContext) {
    return { phase: PHASE.failed, validationErrors: ["No context extracted"] };
  }

  const fullContext = {
    ...extractedContext,
    contextId: `ctx_${uuidv7()}`,
    previousContextId: null,
    nextContextId: null,
  };

  const result = userContextSchema.safeParse(fullContext);

  if (!result.success) {
    const errors = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    return { phase: PHASE.failed, validationErrors: errors };
  }

  return {
    validatedContext: result.data,
    validationErrors: [],
    phase: PHASE.awaitingConfirmation,
  };
}
