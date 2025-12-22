import { NODE, PHASE } from "../state.js";
import { withLogging } from "../with-logging.js";

import type { SearchStateType } from "../state.js";

/**
 * Delete goal node: removes user's goal from database.
 * After deletion, flow returns to explore (all candidates without goal filter).
 */
export const deleteGoalNode = withLogging<SearchStateType>(NODE.delete_goal, async (state, _config, { coreClient }) => {
  const { userId } = state;

  await coreClient.client.goal.delete.mutate({ userId });

  return {
    existingGoal: null,
    extractedGoal: null,
    phase: PHASE.exploring,
  };
});
