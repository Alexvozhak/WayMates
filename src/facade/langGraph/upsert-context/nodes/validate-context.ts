import { v7 as uuidv7 } from "uuid";

import { userContextSchema } from "../../../../shared/schemas.js";
import { config } from "../../../env.js";
import { extractMissingFields } from "../../cold-start-v2/nodes/validate-context.js";
import { PHASE } from "../state.js";

import type { UpsertContextStateType } from "../state.js";

const MAX_CLARIFICATION_ROUNDS = config.LANGCHAIN_MAX_CLARIFICATION_ROUNDS;

export function validateContextNode(state: UpsertContextStateType): Partial<UpsertContextStateType> {
  const { extractedContext, clarificationRound, validatedContext } = state;

  if (!extractedContext) {
    return { phase: PHASE.failed, validationErrors: ["No context extracted"] };
  }

  const existingContextId = validatedContext?.contextId;

  const fullContext = {
    ...extractedContext,
    contextId: existingContextId ?? `ctx_${uuidv7()}`,
    previousContextId: null,
    nextContextId: null,
  };

  const result = userContextSchema.safeParse(fullContext);

  if (!result.success) {
    const missing = extractMissingFields(result, "Context", "context");

    const nextRound = clarificationRound + 1;
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
    validatedContext: result.data,
    validationErrors: [],
    missingFields: [],
    clarificationRound: 0,
    phase: PHASE.awaitingConfirmation,
  };
}
