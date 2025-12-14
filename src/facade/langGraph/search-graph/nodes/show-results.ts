import { PHASE } from "../state.js";

import type { SearchStateType } from "../state.js";

export function showResultsNode(_state: SearchStateType): Partial<SearchStateType> {
  return { phase: PHASE.showingResults };
}
