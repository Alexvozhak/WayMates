import { NODE, PHASE } from "../state.js";
import { withLogging } from "../with-logging.js";

import type { Goal } from "../../../../shared/schemas.js";
import type { SearchStateType } from "../state.js";

export const checkGoalNode = withLogging<SearchStateType>(NODE.check_goal, async (state, _config, { coreClient }) => {
  const goal: Goal | null = await coreClient.client.goal.getByUser.query({ userId: state.userId });

  return {
    storedGoal: goal,
    phase: goal ? PHASE.searching : PHASE.exploring,
    currentSearchParams: state.currentSearchParams,
    targetSearchParams: state.targetSearchParams,
  };
});
