import { PHASE } from "../state.js";

import type { UpsertContextStateType } from "../state.js";

export function cancelNode(_state: UpsertContextStateType): Partial<UpsertContextStateType> {
  return { phase: PHASE.cancelled };
}
