import { AgentInvariantError } from "../../../errors.js";
import { NODE, PHASE } from "../state.js";
import { withLogging } from "../with-logging.js";

import type { SearchStateType } from "../state.js";

export const setGoalNode = withLogging<SearchStateType>(
  NODE.set_goal,
  async (state, _config, { coreClient, normalizer }) => {
    const { extractedGoal, userId } = state;

    if (!extractedGoal) {
      throw new AgentInvariantError(NODE.set_goal, "extractedGoal must exist before setting");
    }

    const normalized = await normalizer.normalizeTargetContext(extractedGoal, userId);

    await coreClient.client.goal.set.mutate({
      userId,
      targetContext: normalized,
    });

    return { phase: PHASE.searching };
  },
);
