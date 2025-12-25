import { AgentInvariantError } from "../../../errors.js";
import { NODE } from "../state.js";
import { clampSearchParams } from "../types.js";
import { withLogging } from "../with-logging.js";

import { parseUserIntent } from "./parse-intent.js";

import type { SearchStateType } from "../state.js";

export const applyFiltersNode = withLogging<SearchStateType>(
  NODE.apply_filters,
  async (state, _config, { normalizerService }) => {
    const { userResponse, phase } = state;

    if (!userResponse) {
      throw new AgentInvariantError(NODE.apply_filters, "userResponse must exist before applying filters");
    }

    const parsed = await parseUserIntent(userResponse, phase);

    if (parsed.intent !== "filter" || !parsed.filters) {
      return { searchUserIntent: parsed.intent };
    }

    const { normalized: fields, rejected: rejectedFields } = await normalizerService.normalizeContextFields(
      parsed.filters.excludedContextFields ?? [],
    );

    const { normalized: reasons, rejected: rejectedReasons } = await normalizerService.normalizeReasons(
      parsed.filters.excludedCreationReasons ?? [],
    );

    const { limit, pathLimit, recencyThresholdMonths } = clampSearchParams(parsed.filters);

    return {
      searchUserIntent: parsed.intent,
      currentSearchParams: {
        excludedContextFields: fields,
        excludedCreationReasons: reasons,
        recencyThresholdMonths,
        limit: limit,
        pathLimit: pathLimit,
        rejectedFields: [...rejectedFields, ...rejectedReasons],
      },
    };
  },
);
