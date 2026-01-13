import { NODE, PHASE } from "../state.js";
import { withLogging } from "../with-logging.js";

import type { SearchStateType } from "../state.js";

export const cancelNode = withLogging<SearchStateType>(NODE.cancel, (_state, _config, _deps) => {
  return { phase: PHASE.cancelled };
});
