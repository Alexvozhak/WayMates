import { PHASE } from "../state.js";

import type { UpdateContextStateType } from "../state.js";

export function cancelNode(state: UpdateContextStateType): Partial<UpdateContextStateType> {
  if (state.validationErrors.length > 0) {
    return { phase: PHASE.failed };
  }
  return { phase: PHASE.cancelled };
}
