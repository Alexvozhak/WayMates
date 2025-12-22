import { AgentInvariantError } from "../../../errors.js";
import { NODE } from "../state.js";
import { DEFAULT_LIMIT, MAX_LIMIT, MIN_LIMIT, MIN_RECENCY_THRESHOLD_MONTHS } from "../types.js";
import { withLogging } from "../with-logging.js";

import { parseUserIntent } from "./parse-intent.js";

import type { SearchStateType } from "../state.js";

export const applyFiltersNode = withLogging<SearchStateType>(
  NODE.apply_filters,
  async (state, _config, { normalizer }) => {
    const { userResponse } = state;

    if (!userResponse) {
      throw new AgentInvariantError(NODE.apply_filters, "userResponse must exist before applying filters");
    }

    const parsed = await parseUserIntent(userResponse);

    if (parsed.intent !== "filter" || !parsed.filters) {
      return {
        searchUserIntent: parsed.intent,
      };
    }

    const { normalized: normalizedFields, rejected: rejectedFields } = await normalizer.normalizeContextFields(
      parsed.filters.excludedContextFields ?? [],
    );

    const { normalized: normalizedReasons, rejected: rejectedReasons } = await normalizer.normalizeReasons(
      parsed.filters.excludedCreationReasons ?? [],
    );

    const limit = parsed.filters.limit ? Math.min(Math.max(parsed.filters.limit, MIN_LIMIT), MAX_LIMIT) : DEFAULT_LIMIT;

    const recencyThresholdMonths = parsed.filters.recencyThresholdMonths
      ? Math.max(parsed.filters.recencyThresholdMonths, MIN_RECENCY_THRESHOLD_MONTHS)
      : null;

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
  },
);
