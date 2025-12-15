import { AgentInvariantError } from "../../../errors.js";
import { hasConfigDeps } from "../../shared/types.js";
import { NODE } from "../state.js";
import { DEFAULT_LIMIT, MAX_LIMIT, MIN_LIMIT, MIN_RECENCY_THRESHOLD_MONTHS } from "../types.js";

import { parseUserIntent } from "./parse-intent.js";

import type { SearchStateType } from "../state.js";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

/* eslint-disable complexity -- Node function with parameter validation and normalization */
export async function applyFiltersNode(
  state: SearchStateType,
  config: LangGraphRunnableConfig,
): Promise<Partial<SearchStateType>> {
  const { userResponse } = state;

  if (!userResponse) {
    throw new AgentInvariantError(NODE.apply_filters, "userResponse must exist before applying filters");
  }

  if (!hasConfigDeps(config)) {
    throw new AgentInvariantError(NODE.apply_filters, "Missing dependencies");
  }
  const { normalizer } = config.configurable;

  const parsed = await parseUserIntent(userResponse);

  // Only process if intent is filter
  if (parsed.intent !== "filter" || !parsed.filters) {
    return {
      searchUserIntent: parsed.intent,
    };
  }

  // Normalize excludedContextFields
  const { normalized: normalizedFields, rejected: rejectedFields } = await normalizer.normalizeContextFields(
    parsed.filters.excludedContextFields ?? [],
  );

  // Normalize excludedCreationReasons
  const { normalized: normalizedReasons, rejected: rejectedReasons } = await normalizer.normalizeReasons(
    parsed.filters.excludedCreationReasons ?? [],
  );

  // Apply clamping for numeric parameters
  const limit = parsed.filters.limit ? Math.min(Math.max(parsed.filters.limit, MIN_LIMIT), MAX_LIMIT) : DEFAULT_LIMIT;

  const recencyThresholdMonths = parsed.filters.recencyThresholdMonths
    ? Math.max(parsed.filters.recencyThresholdMonths, MIN_RECENCY_THRESHOLD_MONTHS)
    : undefined;

  return {
    searchUserIntent: parsed.intent,
    currentSearchParams: {
      excludedContextFields: normalizedFields,
      excludedCreationReasons: normalizedReasons,
      recencyThresholdMonths,
      limit,
      pathLimit: limit,
    },
    appliedFilters: {
      excludedContextFields: normalizedFields,
      excludedCreationReasons: normalizedReasons,
      recencyThresholdMonths,
      limit,
      pathLimit: limit,
      rejectedFields: [...rejectedFields, ...rejectedReasons],
    },
  };
}
/* eslint-enable complexity */
