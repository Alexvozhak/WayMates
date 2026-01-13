import { PHASE } from "../state.js";

import type { UpsertTrailStateType } from "../state.js";

export function cancelNode(_state: UpsertTrailStateType): Partial<UpsertTrailStateType> {
  return { phase: PHASE.cancelled };
}
