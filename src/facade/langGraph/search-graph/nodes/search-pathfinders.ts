import { config } from "../../../env.js";
import { AgentInvariantError } from "../../../errors.js";
import { NODE, PHASE } from "../state.js";
import { withLogging } from "../with-logging.js";

import type { SearchStateType } from "../state.js";

/**
 * Search pathfinders node: finds people who went FROM user's context TO user's goal.
 *
 * Value for user: proof of transition, concrete trajectories, time estimates.
 */
export const searchPathfindersNode = withLogging<SearchStateType>(
  NODE.search_pathfinders,
  async (state, _config, { coreClient }) => {
    const { userId, adhocContext, userContext, storedGoal } = state;

    if (!storedGoal) {
      throw new AgentInvariantError(NODE.search_pathfinders, "storedGoal required for pathfinder search");
    }

    const referenceContext = adhocContext ?? userContext;
    if (!referenceContext) {
      throw new AgentInvariantError(NODE.search_pathfinders, "referenceContext required (adhoc or profile)");
    }

    const results = await coreClient.client.search.pathfinders.query({
      userId,
      referenceContext,
      targetContext: storedGoal.targetContext,
      referenceRecencyMonths: null,
      targetRecencyMonths: null,
      excludedContextFields: [],
      excludedCreationReasons: [],
      limit: config.CANDIDATES_FETCH_LIMIT,
    });

    return {
      pathfinderResults: results,
      searchMode: "pathfinders" as const,
      phase: PHASE.showing_results,
    };
  },
);
