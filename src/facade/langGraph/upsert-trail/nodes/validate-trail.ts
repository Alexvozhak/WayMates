import { v7 as uuidv7 } from "uuid";

import { trailSchema } from "../../../../shared/schemas.js";
import { config } from "../../../env.js";
import { extractMissingFields } from "../../cold-start-v2/nodes/validate-context.js";
import { PHASE } from "../state.js";

import type { UpsertTrailStateType } from "../state.js";

const MAX_CLARIFICATION_ROUNDS = config.LANGCHAIN_MAX_CLARIFICATION_ROUNDS;

export function validateTrailNode(state: UpsertTrailStateType): Partial<UpsertTrailStateType> {
  const { extractedTrail, fromContextId, clarificationRound, validatedTrail } = state;

  if (!extractedTrail) {
    return { phase: PHASE.failed, validationErrors: ["No trail extracted"] };
  }

  const existingTrailId = validatedTrail?.trailId;

  const fullTrail = {
    ...extractedTrail,
    trailId: existingTrailId ?? `trl_${uuidv7()}`,
    fromContextId,
    toContextId: null,
  };

  const result = trailSchema.safeParse(fullTrail);

  if (!result.success) {
    const missing = extractMissingFields(result, "Trail", "trail");

    const nextRound = clarificationRound + 1;
    if (nextRound > MAX_CLARIFICATION_ROUNDS) {
      const errors = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
      return { phase: PHASE.failed, validationErrors: errors };
    }

    return {
      phase: PHASE.awaiting_clarification,
      missingFields: missing,
      clarificationRound: nextRound,
      validationErrors: [],
    };
  }

  return {
    validatedTrail: result.data,
    validationErrors: [],
    missingFields: [],
    clarificationRound: 0,
    phase: PHASE.awaiting_confirmation,
  };
}
