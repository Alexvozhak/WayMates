import { AgentInvariantError } from "../../../errors.js";
import { logger } from "../../../logger.js";
import { NODE, PHASE } from "../state.js";
import { clampSearchParams } from "../types.js";
import { withLogging } from "../with-logging.js";

import { parseUserIntent } from "./parse-intent.js";

import type { ParsedIntent } from "./parse-intent.js";
import type { TargetContext } from "../../../../shared/schemas.js";
import type { Normalizer } from "../../../services/normalizer.js";
import type { SearchStateType } from "../state.js";
import type { TargetSearchParamsWithFeedback } from "../types.js";

async function buildTargetSearchParams(
  parsed: ParsedIntent,
  extractedGoal: TargetContext,
  normalizer: Normalizer,
): Promise<TargetSearchParamsWithFeedback | null> {
  if (parsed.intent !== "validate" || !parsed.filters) return null;

  const { normalized, rejected } = await normalizer.normalizeReasons(parsed.filters.excludedCreationReasons ?? []);
  const { limit, recencyThresholdMonths } = clampSearchParams(parsed.filters);

  return {
    targetContext: extractedGoal,
    excludedCreationReasons: normalized,
    recencyThresholdMonths,
    limit: limit,
    rejectedReasons: rejected,
  };
}

function extractClarificationText(parsed: ParsedIntent): string | null {
  if (parsed.intent !== "clarify") return null;
  if (!("clarificationText" in parsed)) return null;
  return parsed.clarificationText;
}

function extractAdvisorQuestion(parsed: ParsedIntent): string | null {
  if (parsed.intent !== "ask") return null;
  if (!("question" in parsed)) return null;
  return parsed.question;
}

function shouldKeepUserResponse(intent: ParsedIntent["intent"]): boolean {
  return intent === "proceed" || intent === "filter" || intent === "ask" || intent === "change";
}

function computeNewPositionRound(
  phase: SearchStateType["phase"],
  intent: ParsedIntent["intent"],
  currentRound: number,
): number {
  const isAskingAfterValidate =
    phase === PHASE.asking_after_validate_candidates || phase === PHASE.asking_after_validate_facets;
  const isChangeAfterValidate = isAskingAfterValidate && intent === "change";
  return isChangeAfterValidate ? currentRound + 1 : currentRound;
}

/**
 * Parse search intent node: classifies user response and extracts intent-specific data.
 */
export const parseSearchIntentNode = withLogging<SearchStateType>(
  NODE.parse_search_intent,
  async (state, _config, { normalizerService }) => {
    const { userResponse, phase, extractedGoal, newPositionRound } = state;

    if (!userResponse) {
      throw new AgentInvariantError(NODE.parse_search_intent, "userResponse must exist");
    }

    const parsed = await parseUserIntent(userResponse, phase);

    logger.info(
      { userResponse, phase, intent: parsed.intent, reasoning: parsed.reasoning },
      "intent classification with reasoning",
    );

    const targetSearchParams =
      phase === PHASE.showing_goal && extractedGoal
        ? await buildTargetSearchParams(parsed, extractedGoal, normalizerService)
        : null;

    const updatedRound = computeNewPositionRound(phase, parsed.intent, newPositionRound);

    const stateUpdate: Partial<SearchStateType> = {
      searchUserIntent: parsed.intent,
      targetSearchParams,
      clarificationText: extractClarificationText(parsed),
      advisorQuestion: extractAdvisorQuestion(parsed),
      newPositionRound: updatedRound,
    };

    if (!shouldKeepUserResponse(parsed.intent)) {
      stateUpdate.userResponse = "";
    }

    return stateUpdate;
  },
);
