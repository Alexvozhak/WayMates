import { AgentInvariantError } from "../../../errors.js";
import { hasConfigDeps } from "../../shared/types.js";
import { NODE, PHASE } from "../state.js";

import type { SearchStateType } from "../state.js";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

export async function validateGoalNode(
  state: SearchStateType,
  config: LangGraphRunnableConfig,
): Promise<Partial<SearchStateType>> {
  const { extractedGoal, existingGoal, userId } = state;

  const targetContext = extractedGoal ?? existingGoal?.targetCriteria;

  if (!targetContext) {
    throw new AgentInvariantError(NODE.validate_goal, "No goal to validate");
  }

  if (!hasConfigDeps(config)) {
    return { phase: PHASE.failed };
  }
  const { coreClient, normalizer } = config.configurable;

  const normalized = await normalizer.normalizeTargetContext(targetContext, userId);

  const candidates = await coreClient.client.search.byTarget.query({
    userId,
    targetContext: normalized,
    limit: 5,
  });

  return {
    validationResults: candidates,
    phase: PHASE.askingAfterValidate,
  };
}
