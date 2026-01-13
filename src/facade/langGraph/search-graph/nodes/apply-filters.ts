import { NODE } from "../state.js";
import { withLogging } from "../with-logging.js";

import type { SearchStateType } from "../state.js";

/**
 * Apply filters node: pass-through for currentSearchParams already extracted by parse_search_intent.
 * Clears userResponse after processing.
 */
export const applyFiltersNode = withLogging<SearchStateType>(NODE.apply_filters, () => {
  return { userResponse: "" };
});
