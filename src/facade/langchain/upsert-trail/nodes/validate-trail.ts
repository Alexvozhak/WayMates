import { v7 as uuidv7 } from "uuid";

import { trailSchema } from "../../../../shared/schemas.js";
import { PHASE } from "../state.js";

import type { UpsertTrailStateType } from "../state.js";

export function validateTrailNode(state: UpsertTrailStateType): Partial<UpsertTrailStateType> {
  const { extractedTrail, fromContextId } = state;

  if (!extractedTrail) {
    return { phase: PHASE.failed, validationErrors: ["No trail extracted"] };
  }

  const fullTrail = {
    ...extractedTrail,
    trailId: `trl_${uuidv7()}`,
    fromContextId,
    toContextId: null,
  };

  const result = trailSchema.safeParse(fullTrail);

  if (!result.success) {
    const errors = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    return { phase: PHASE.failed, validationErrors: errors };
  }

  return {
    validatedTrail: result.data,
    validationErrors: [],
    phase: PHASE.awaitingConfirmation,
  };
}
