import { AgentInvariantError } from "../../../errors.js";
import { matchedToChart, safeGenerateChart } from "../chart-utils.js";
import { computeFacets, shouldUseFacets } from "../facets.js";
import { NODE, PHASE } from "../state.js";
import { DEFAULT_TARGET_SEARCH_PARAMS } from "../types.js";
import { withLogging } from "../with-logging.js";

import type { SearchStateType } from "../state.js";

export const validateGoalNode = withLogging<SearchStateType>(
  NODE.validate_goal,
  async (state, _config, { coreClient, normalizerService, dictionariesService, logger }) => {
    const { extractedGoal, storedGoal, userId, targetSearchParams, locale, userTrajectory, adhocContext } = state;

    const goalToValidate = extractedGoal ?? storedGoal?.targetContext;

    if (!goalToValidate) {
      throw new AgentInvariantError(NODE.validate_goal, "No goal to validate");
    }

    const normalized = await normalizerService.normalizeTargetContext(goalToValidate, userId);

    const params = targetSearchParams ?? {
      ...DEFAULT_TARGET_SEARCH_PARAMS,
      targetContext: goalToValidate,
    };

    const candidates = await coreClient.client.search.reversePathfinders.query({
      userId,
      ...params,
      targetContext: normalized,
    });

    const needsFiltering = shouldUseFacets(candidates);

    // Skip chart generation if showing facets (chart won't be used)
    // goal-only mode: no user trajectory → no overlap calculation → excludedContextFields N/A
    const chartUrl = needsFiltering
      ? null
      : await safeGenerateChart({
          mode: "goal-only",
          userTrajectory,
          adhocContext,
          storedGoal,
          candidates: candidates.map((c) => matchedToChart(c, "pathfinder")),
          locale,
          dictionariesService,
          logger,
          nodeName: NODE.validate_goal,
          excludedContextFields: [],
        });

    return {
      validationResults: candidates,
      targetSearchParams: params,
      phase: needsFiltering ? PHASE.asking_after_validate_facets : PHASE.asking_after_validate_candidates,
      facets: needsFiltering ? computeFacets(candidates) : null,
      chartUrl,
    };
  },
);
