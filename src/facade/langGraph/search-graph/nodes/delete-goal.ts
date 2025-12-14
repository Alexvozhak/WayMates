import { AgentInvariantError } from "../../../errors.js";
import { hasConfigDeps } from "../../shared/types.js";
import { NODE, PHASE } from "../state.js";

import type { SearchStateType } from "../state.js";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

/**
 * Delete goal node: removes user's goal from database.
 * After deletion, flow returns to explore (all candidates without goal filter).
 */
export async function deleteGoalNode(
  state: SearchStateType,
  config: LangGraphRunnableConfig,
): Promise<Partial<SearchStateType>> {
  const { userId } = state;

  if (!hasConfigDeps(config)) {
    throw new AgentInvariantError(NODE.delete_goal, "Missing coreClient or normalizer");
  }
  const { coreClient } = config.configurable;

  await coreClient.client.goal.delete.mutate({ userId });

  return {
    existingGoal: null,
    extractedGoal: null,
    phase: PHASE.exploring,
  };
}
