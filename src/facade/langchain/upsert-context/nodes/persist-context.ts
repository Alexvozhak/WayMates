import { PHASE } from "../state.js";

import type { UpsertContextStateType } from "../state.js";

export function persistContextNode(state: UpsertContextStateType): Partial<UpsertContextStateType> {
  if (!state.validatedContext) {
    return { phase: PHASE.failed };
  }
  return { phase: PHASE.approved };
}
