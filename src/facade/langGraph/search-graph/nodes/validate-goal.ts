import { AgentInvariantError } from "../../../errors.js";
import { NODE, PHASE } from "../state.js";
import { DEFAULT_LIMIT, DEFAULT_RECENCY_THRESHOLD_MONTHS } from "../types.js";
import { withLogging } from "../with-logging.js";

import type { SearchStateType } from "../state.js";

export const validateGoalNode = withLogging<SearchStateType>(
  NODE.validate_goal,
  async (state, _config, { coreClient, normalizer }) => {
    const { extractedGoal, existingGoal, userId, targetSearchParams } = state;

    const goalToValidate = extractedGoal ?? existingGoal?.targetCriteria;

    if (!goalToValidate) {
      throw new AgentInvariantError(NODE.validate_goal, "No goal to validate");
    }

    const normalized = await normalizer.normalizeTargetContext(goalToValidate, userId);

    const params = targetSearchParams ?? {
      targetContext: goalToValidate,
      excludedCreationReasons: [],
      recencyThresholdMonths: DEFAULT_RECENCY_THRESHOLD_MONTHS,
      limit: DEFAULT_LIMIT,
    };

    const candidates = await coreClient.client.search.byTarget.query({
      userId,
      ...params,
      targetContext: normalized,
    });

    return {
      validationResults: candidates,
      phase: PHASE.asking_after_validate,
    };
  },
);
