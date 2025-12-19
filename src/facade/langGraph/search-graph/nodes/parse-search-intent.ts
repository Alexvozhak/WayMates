import { AgentInvariantError } from "../../../errors.js";
import { hasConfigDeps } from "../../shared/types.js";
import { NODE, PHASE } from "../state.js";
import { DEFAULT_LIMIT, MAX_LIMIT, MIN_LIMIT, MIN_RECENCY_THRESHOLD_MONTHS } from "../types.js";

import { parseUserIntent } from "./parse-intent.js";

import type { ParsedIntent } from "./parse-intent.js";
import type { TargetContext } from "../../../../shared/schemas.js";
import type { Normalizer } from "../../../services/normalizer.js";
import type { SearchStateType } from "../state.js";
import type { TargetSearchParamsWithFeedback } from "../types.js";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

async function buildTargetSearchParams(
  parsed: ParsedIntent,
  extractedGoal: TargetContext,
  normalizer: Normalizer,
): Promise<TargetSearchParamsWithFeedback | null> {
  if (parsed.intent !== "validate" || !parsed.filters) return null;

  const { normalized, rejected } = await normalizer.normalizeReasons(parsed.filters.excludedCreationReasons ?? []);
  const limit = parsed.filters.limit ? Math.min(Math.max(parsed.filters.limit, MIN_LIMIT), MAX_LIMIT) : DEFAULT_LIMIT;
  const recencyThresholdMonths = parsed.filters.recencyThresholdMonths
    ? Math.max(parsed.filters.recencyThresholdMonths, MIN_RECENCY_THRESHOLD_MONTHS)
    : undefined;

  return {
    targetContext: extractedGoal,
    excludedCreationReasons: normalized,
    recencyThresholdMonths,
    limit,
    rejectedReasons: rejected,
  };
}

function extractClarificationText(parsed: ParsedIntent): string | null {
  if (parsed.intent !== "clarify") return null;
  if (!("clarificationText" in parsed)) return null;
  return parsed.clarificationText;
}

/**
 * Parse search intent node: classifies user response and extracts intent-specific data.
 */
export async function parseSearchIntentNode(
  state: SearchStateType,
  config: LangGraphRunnableConfig,
): Promise<Partial<SearchStateType>> {
  const { userResponse, phase, extractedGoal, newPositionRound } = state;

  if (!userResponse) {
    throw new AgentInvariantError(NODE.parse_search_intent, "userResponse must exist");
  }

  const parsed = await parseUserIntent(userResponse);

  // Build targetSearchParams for showing_goal + validate
  const canBuildTargetParams = phase === PHASE.showing_goal && extractedGoal && hasConfigDeps(config);
  const targetSearchParams = canBuildTargetParams
    ? await buildTargetSearchParams(parsed, extractedGoal, config.configurable.normalizer)
    : null;

  // Increment newPositionRound for ask_after_validate + change
  const updatedRound =
    phase === PHASE.asking_after_validate && parsed.intent === "change" ? newPositionRound + 1 : newPositionRound;

  // Don't clear userResponse for 'proceed' - extract_goal needs it
  // Clear for other intents to prevent re-interpretation
  const shouldClearResponse = parsed.intent !== "proceed";

  return {
    searchUserIntent: parsed.intent,
    targetSearchParams,
    clarificationText: extractClarificationText(parsed),
    newPositionRound: updatedRound,
    ...(shouldClearResponse && { userResponse: "" }),
  };
}
