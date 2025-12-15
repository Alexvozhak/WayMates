import { interrupt } from "@langchain/langgraph";

import { AgentInvariantError } from "../../../errors.js";
import { hasConfigDeps } from "../../shared/types.js";
import { NODE, OPTIONS, PHASE } from "../state.js";
import { DEFAULT_LIMIT, MAX_LIMIT, MIN_LIMIT, MIN_RECENCY_THRESHOLD_MONTHS } from "../types.js";

import { parseUserIntent } from "./parse-intent.js";

import type { SearchStateType } from "../state.js";
import type { TargetSearchParamsWithFeedback } from "../types.js";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

export async function showGoalNode(
  state: SearchStateType,
  config: LangGraphRunnableConfig,
): Promise<Partial<SearchStateType>> {
  const { extractedGoal } = state;

  if (!extractedGoal) {
    throw new AgentInvariantError(NODE.show_goal, "extractedGoal must exist before showing");
  }

  if (!hasConfigDeps(config)) {
    throw new AgentInvariantError(NODE.show_goal, "Missing dependencies");
  }
  const { normalizer } = config.configurable;

  const userResponse = interrupt({
    type: "show_goal",
    extractedGoal,
    options: OPTIONS.showGoal,
    phase: PHASE.showingGoal,
  });

  const response = String(userResponse);
  const parsed = await parseUserIntent(response);

  // Handle filters for validate intent
  let targetSearchParams: TargetSearchParamsWithFeedback | null = null;

  if (parsed.intent === "validate" && parsed.filters) {
    const { normalized, rejected } = await normalizer.normalizeReasons(parsed.filters.excludedCreationReasons ?? []);

    const limit = parsed.filters.limit ? Math.min(Math.max(parsed.filters.limit, MIN_LIMIT), MAX_LIMIT) : DEFAULT_LIMIT;

    const recencyThresholdMonths = parsed.filters.recencyThresholdMonths
      ? Math.max(parsed.filters.recencyThresholdMonths, MIN_RECENCY_THRESHOLD_MONTHS)
      : undefined;

    targetSearchParams = {
      targetContext: extractedGoal,
      excludedCreationReasons: normalized,
      recencyThresholdMonths,
      limit,
      rejectedReasons: rejected,
    };
  }

  return {
    userResponse: response,
    searchUserIntent: parsed.intent,
    targetSearchParams,
  };
}
