import { userContextSchema } from "../../../../shared/schemas.js";
import { config } from "../../../env.js";
import { extractMissingFields } from "../../cold-start-v2/nodes/validate-context.js";
import { PHASE } from "../state.js";

import type { UpdateContextStateType } from "../state.js";

const MAX_CLARIFICATION_ROUNDS = config.LANGCHAIN_MAX_CLARIFICATION_ROUNDS;

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
    const missing = extractMissingFields(result, "Updated Context", "context");

    const nextRound = state.clarificationRound + 1;
    if (nextRound > MAX_CLARIFICATION_ROUNDS) {
      const errors = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
      return { phase: PHASE.failed, validationErrors: errors };
    }

    return {
      phase: PHASE.awaitingClarification,
      missingFields: missing,
      clarificationRound: nextRound,
      validationErrors: [],
    };
  }

  return {
    mergedContext: result.data,
    validationErrors: [],
    missingFields: [],
    clarificationRound: 0,
    phase: PHASE.awaitingConfirmation,
  };
}
