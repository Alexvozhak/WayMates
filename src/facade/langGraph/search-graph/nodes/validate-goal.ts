import { AgentInvariantError } from "../../../errors.js";
import { hasConfigDeps } from "../../shared/types.js";
import { NODE, PHASE } from "../state.js";
import { DEFAULT_LIMIT, DEFAULT_RECENCY_THRESHOLD_MONTHS } from "../types.js";

import type { SearchStateType } from "../state.js";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

export async function validateGoalNode(
  state: SearchStateType,
  config: LangGraphRunnableConfig,
): Promise<Partial<SearchStateType>> {
  const { extractedGoal, existingGoal, userId, targetSearchParams } = state;

  const goalToValidate = extractedGoal ?? existingGoal?.targetCriteria;

  if (!goalToValidate) {
    throw new AgentInvariantError(NODE.validate_goal, "No goal to validate");
  }

  if (!hasConfigDeps(config)) {
    throw new AgentInvariantError(NODE.validate_goal, "Missing coreClient or normalizer");
  }
  const { coreClient, normalizer } = config.configurable;

  const normalized = await normalizer.normalizeTargetContext(goalToValidate, userId);

  // Apply filters from targetSearchParams or use defaults
  const params = targetSearchParams ?? {
    targetContext: goalToValidate,
    excludedCreationReasons: [],
    recencyThresholdMonths: DEFAULT_RECENCY_THRESHOLD_MONTHS,
    limit: DEFAULT_LIMIT,
  };

  const candidates = await coreClient.client.search.byTarget.query({
    userId,
    ...params,
    targetContext: normalized,
  });

  return {
    validationResults: candidates,
    phase: PHASE.asking_after_validate,
  };
}
