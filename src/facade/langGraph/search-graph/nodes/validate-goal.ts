import { AgentInvariantError } from "../../../errors.js";
import { NODE, PHASE } from "../state.js";
import { DEFAULT_TARGET_SEARCH_PARAMS } from "../types.js";
import { withLogging } from "../with-logging.js";

import type { SearchStateType } from "../state.js";

export const validateGoalNode = withLogging<SearchStateType>(
  NODE.validate_goal,
  async (state, _config, { coreClient, normalizerService }) => {
    const { extractedGoal, storedGoal, userId, targetSearchParams } = state;

    const goalToValidate = extractedGoal ?? storedGoal?.targetContext;

    if (!goalToValidate) {
      throw new AgentInvariantError(NODE.validate_goal, "No goal to validate");
    }

    const normalized = await normalizerService.normalizeTargetContext(goalToValidate, userId);

    const params = targetSearchParams ?? {
      ...DEFAULT_TARGET_SEARCH_PARAMS,
      targetContext: goalToValidate,
    };

    const candidates = await coreClient.client.search.byTarget.query({
      userId,
      ...params,
      targetContext: normalized,
    });

    return {
      validationResults: candidates,
      targetSearchParams: params,
      phase: PHASE.asking_after_validate,
    };
  },
);
