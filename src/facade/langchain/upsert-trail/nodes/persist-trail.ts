import { PHASE } from "../state.js";

import type { UpsertTrailStateType } from "../state.js";

export function persistTrailNode(state: UpsertTrailStateType): Partial<UpsertTrailStateType> {
  if (!state.validatedTrail) {
    return { phase: PHASE.failed };
  }
  return { phase: PHASE.approved };
}
