import { userContextSchema } from "../../../../shared/schemas.js";
import { PHASE } from "../state.js";

import type { UpdateContextStateType } from "../state.js";

export function mergeContextNode(state: UpdateContextStateType): Partial<UpdateContextStateType> {
  const { currentContext, extractedUpdates } = state;

  if (!currentContext) {
    return { phase: PHASE.failed, validationErrors: ["No current context provided"] };
  }

  if (!extractedUpdates || Object.keys(extractedUpdates).length === 0) {
    return { phase: PHASE.failed, validationErrors: ["No updates extracted from message"] };
  }

  const merged = {
    ...currentContext,
    ...extractedUpdates,
    contextId: currentContext.contextId,
    previousContextId: currentContext.previousContextId,
    nextContextId: currentContext.nextContextId,
  };

  const result = userContextSchema.safeParse(merged);

  if (!result.success) {
    const errors = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    return { phase: PHASE.failed, validationErrors: errors };
  }

  return {
    mergedContext: result.data,
    validationErrors: [],
    phase: PHASE.awaitingConfirmation,
  };
}
