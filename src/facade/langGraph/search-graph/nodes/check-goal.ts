import { hasConfigDeps } from "../../shared/types.js";
import { PHASE } from "../state.js";

import type { Goal } from "../../../../shared/schemas.js";
import type { SearchStateType } from "../state.js";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

export async function checkGoalNode(
  state: SearchStateType,
  config: LangGraphRunnableConfig,
): Promise<Partial<SearchStateType>> {
  if (!hasConfigDeps(config)) {
    return { phase: PHASE.failed };
  }
  const { coreClient } = config.configurable;

  const goal: Goal | null = await coreClient.client.goal.getByUser.query({ userId: state.userId });

  return {
    existingGoal: goal,
    phase: goal ? PHASE.askingWithGoal : PHASE.askingNoGoal,
  };
}
