import { AgentInvariantError } from "../../../errors.js";
import { NODE } from "../state.js";
import { DEFAULT_LIMIT, MAX_LIMIT, MIN_LIMIT, MIN_RECENCY_THRESHOLD_MONTHS } from "../types.js";
import { withLogging } from "../with-logging.js";

import { parseUserIntent } from "./parse-intent.js";

import type { SearchStateType } from "../state.js";

export const applyFiltersNode = withLogging<SearchStateType>(
  NODE.apply_filters,
  // eslint-disable-next-line complexity
  async (state, _config, { normalizerService }) => {
    const { userResponse } = state;

    if (!userResponse) {
      throw new AgentInvariantError(NODE.apply_filters, "userResponse must exist before applying filters");
    }

    const parsed = await parseUserIntent(userResponse);

    if (parsed.intent !== "filter" || !parsed.filters) {
      return { searchUserIntent: parsed.intent };
    }

    const { normalized: fields, rejected: rejectedFields } = await normalizerService.normalizeContextFields(
      parsed.filters.excludedContextFields ?? [],
    );

    const { normalized: reasons, rejected: rejectedReasons } = await normalizerService.normalizeReasons(
      parsed.filters.excludedCreationReasons ?? [],
    );

    const { filters } = parsed;
    const limit = filters.limit ? Math.min(Math.max(filters.limit, MIN_LIMIT), MAX_LIMIT) : DEFAULT_LIMIT;
    const pathLimit = filters.pathLimit ? Math.min(Math.max(filters.pathLimit, MIN_LIMIT), limit) : limit;
    const recency = filters.recencyThresholdMonths
      ? Math.max(filters.recencyThresholdMonths, MIN_RECENCY_THRESHOLD_MONTHS)
      : null;

    const params = {
      excludedContextFields: fields,
      excludedCreationReasons: reasons,
      recencyThresholdMonths: recency,
      limit,
      pathLimit,
    };

    return {
      searchUserIntent: parsed.intent,
      currentSearchParams: params,
      appliedFilters: { ...params, rejectedFields: [...rejectedFields, ...rejectedReasons] },
    };
  },
);
