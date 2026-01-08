import { DTW_MIN_TRAJECTORY_LENGTH } from "../../../../config/scoring.js";
import { adhocContextBase } from "../../../../shared/schemas.js";
import { config } from "../../../env.js";
import { AgentInvariantError } from "../../../errors.js";
import { pathfinderToChartCandidate, safeGenerateChart } from "../chart-utils.js";
import { computeFacets, shouldUseFacets } from "../facets.js";
import { NODE, PHASE } from "../state.js";
import { DEFAULT_EXCLUDED_CONTEXT_FIELDS } from "../types.js";
import { withLogging } from "../with-logging.js";

import type { SearchStateType } from "../state.js";

/**
 * Search pathfinders node: finds people who went FROM user's context TO user's goal.
 *
 * Value for user: proof of transition, concrete trajectories, time estimates.
 */
/* eslint-disable complexity -- pathfinders node has more validation/params than waymates */
export const searchPathfindersNode = withLogging<SearchStateType>(
  NODE.search_pathfinders,
  async (state, _config, { coreClient, dictionariesService, logger }) => {
    const { userId, adhocContext, userContext, userTrajectory, storedGoal, locale, currentSearchParams } = state;

    if (!storedGoal) {
      throw new AgentInvariantError(NODE.search_pathfinders, "storedGoal required for pathfinder search");
    }

    // Convert userContext to adhocContext format (strips extra fields like contextId, dates)
    const referenceContext = adhocContext ?? (userContext ? adhocContextBase.parse(userContext) : null);
    if (!referenceContext) {
      throw new AgentInvariantError(NODE.search_pathfinders, "referenceContext required (adhoc or profile)");
    }

    const searchParams = {
      userId,
      referenceContext,
      targetContext: storedGoal.targetContext,
      userTrajectory: userTrajectory.length >= DTW_MIN_TRAJECTORY_LENGTH ? userTrajectory : undefined,
      referenceRecencyMonths: currentSearchParams?.recencyThresholdMonths ?? null,
      targetRecencyMonths: null,
      excludedContextFields: [
        ...DEFAULT_EXCLUDED_CONTEXT_FIELDS,
        ...(currentSearchParams?.excludedContextFields ?? []),
      ],
      excludedCreationReasons: currentSearchParams?.excludedCreationReasons ?? [],
      limit: config.CANDIDATES_FETCH_LIMIT,
      pathLimit: config.CANDIDATES_DISPLAY_LIMIT,
    };

    logger.info({ referenceContext, targetContext: storedGoal.targetContext }, "search_pathfinders params");
    const results = await coreClient.client.search.pathfinders.query(searchParams);

    const needsFiltering = shouldUseFacets(results);

    const chartUrl = needsFiltering
      ? null
      : await safeGenerateChart({
          mode: "with-goal",
          userTrajectory,
          adhocContext,
          storedGoal,
          candidates: results.map((c) => pathfinderToChartCandidate(c)),
          locale,
          dictionariesService,
          logger,
          nodeName: NODE.search_pathfinders,
          excludedContextFields: searchParams.excludedContextFields,
        });

    return {
      pathfinderResults: results,
      searchMode: "pathfinders" as const,
      phase: needsFiltering ? PHASE.showing_results_facets : PHASE.showing_pathfinder_results,
      facets: needsFiltering ? computeFacets(results) : null,
      chartUrl,
      answerText: null, // Clear previous advisor answer
    };
  },
);
/* eslint-enable complexity */
