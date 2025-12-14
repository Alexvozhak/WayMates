import { PHASE } from "../state.js";

import type { SearchStateType } from "../state.js";

export function cancelNode(_state: SearchStateType): Partial<SearchStateType> {
  return { phase: PHASE.cancelled };
}
