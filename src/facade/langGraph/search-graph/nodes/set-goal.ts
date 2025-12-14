import { AgentInvariantError } from "../../../errors.js";
import { hasConfigDeps } from "../../shared/types.js";
import { NODE, PHASE } from "../state.js";

import type { SearchStateType } from "../state.js";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

export async function setGoalNode(
  state: SearchStateType,
  config: LangGraphRunnableConfig,
): Promise<Partial<SearchStateType>> {
  const { extractedGoal, userId } = state;

  if (!extractedGoal) {
    throw new AgentInvariantError(NODE.set_goal, "extractedGoal must exist before setting");
  }

  if (!hasConfigDeps(config)) {
    return { phase: PHASE.failed };
  }
  const { coreClient, normalizer } = config.configurable;

  const normalized = await normalizer.normalizeTargetContext(extractedGoal, userId);

  await coreClient.client.goal.set.mutate({
    userId,
    targetContext: normalized,
  });

  return { phase: PHASE.searching };
}
