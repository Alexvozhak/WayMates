import { PHASE } from "../state.js";

import type { UpdateContextStateType } from "../state.js";

export function persistUpdateNode(state: UpdateContextStateType): Partial<UpdateContextStateType> {
  if (!state.mergedContext) {
    return { phase: PHASE.failed };
  }
  return { phase: PHASE.approved };
}
