import { PHASE } from "../state.js";

import type { ColdStartStateType } from "../state.js";

export function cancelNode(_state: ColdStartStateType): Partial<ColdStartStateType> {
  return {
    phase: PHASE.failed,
  };
}
