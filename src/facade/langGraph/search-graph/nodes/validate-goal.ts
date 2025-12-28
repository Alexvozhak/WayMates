import { extractGoalValues, generateTrajectoryChart, isChartServiceEnabled } from "../../../../chart/index.js";
import { config } from "../../../env.js";
import { AgentInvariantError } from "../../../errors.js";
import { computeFacets, shouldUseFacets } from "../facets.js";
import { NODE, PHASE } from "../state.js";
import { DEFAULT_TARGET_SEARCH_PARAMS } from "../types.js";
import { withLogging } from "../with-logging.js";

import type { MatchedCandidateWithPath, WaymateCandidate } from "../../../../shared/schemas.js";
import type { SearchStateType } from "../state.js";

/**
 * Convert MatchedCandidateWithPath to chart-compatible WaymateCandidate.
 */
function toChartCandidate(c: MatchedCandidateWithPath): WaymateCandidate {
  const createdAt = new Date(c.matchedContext.createdAt);
  const monthsSince = Math.floor((Date.now() - createdAt.getTime()) / (30 * 24 * 60 * 60 * 1000));
  return {
    userId: c.userId,
    matchedContext: c.matchedContext,
    timeSinceMatchedMonths: monthsSince,
    contextMatchScore: 0,
    isWaymate: false,
    path: c.path,
    trails: c.trails,
  };
}

type ChartDeps = {
  storedGoal: Parameters<typeof extractGoalValues>[0];
  dictionariesService: { getPositionOrder: () => Promise<string[]> };
  candidates: MatchedCandidateWithPath[];
  logger: { error: (obj: object, msg: string) => void };
};

async function generateValidationChart(deps: ChartDeps): Promise<string | null> {
  if (!isChartServiceEnabled() || deps.candidates.length === 0) {
    return null;
  }
  try {
    const goalValues = extractGoalValues(deps.storedGoal);
    const positionOrder = await deps.dictionariesService.getPositionOrder();
    const result = await generateTrajectoryChart({
      mode: "goal-only",
      candidates: deps.candidates.map((c) => toChartCandidate(c)),
      maxCandidates: config.CANDIDATES_DISPLAY_LIMIT,
      positionOrder,
      locale: "ru",
      existingGoal: true,
      goalValues,
    });
    return result.chartUrl;
  } catch (error) {
    deps.logger.error({ err: error }, "Chart generation failed in validate-goal");
    return null;
  }
}

export const validateGoalNode = withLogging<SearchStateType>(
  NODE.validate_goal,
  async (state, _config, { coreClient, normalizerService, dictionariesService, logger }) => {
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

    const candidates = await coreClient.client.search.reversePathfinders.query({
      userId,
      ...params,
      targetContext: normalized,
    });

    const needsFiltering = shouldUseFacets(candidates);

    // Skip chart generation if showing facets (chart won't be used)
    const chartUrl = needsFiltering
      ? null
      : await generateValidationChart({ storedGoal, dictionariesService, candidates, logger });

    return {
      validationResults: candidates,
      targetSearchParams: params,
      phase: needsFiltering ? PHASE.asking_after_validate_facets : PHASE.asking_after_validate_candidates,
      facets: needsFiltering ? computeFacets(candidates) : null,
      chartUrl,
    };
  },
);
