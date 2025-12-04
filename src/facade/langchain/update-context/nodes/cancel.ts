import { PHASE } from "../state.js";

import type { UpdateContextStateType } from "../state.js";

export function cancelNode(_state: UpdateContextStateType): Partial<UpdateContextStateType> {
  return { phase: PHASE.cancelled };
}
