import { AgentInvariantError } from "../../../errors.js";
import { logger } from "../../../logger.js";
import { MAX_CLARIFY_ROUNDS, MAX_NEW_POSITION_ROUNDS, NODE, PHASE } from "../state.js";
import { clampSearchParams } from "../types.js";
import { withLogging } from "../with-logging.js";

import { parseUserIntent } from "./parse-intent.js";

import type { RouteFlags } from "../search-router.js";
import type { ParsedIntent } from "./parse-intent.js";
import type { TargetContext } from "../../../../shared/schemas.js";
import type { Normalizer } from "../../../services/normalizer.js";
import type { SearchStateType } from "../state.js";
import type { TargetSearchParamsWithFeedback } from "../types.js";

function buildRouteFlags(state: SearchStateType): RouteFlags {
  return {
    canClarify: state.clarifyRound < MAX_CLARIFY_ROUNDS,
    canChangePosition: state.newPositionRound < MAX_NEW_POSITION_ROUNDS,
    hasGoal: state.storedGoal !== null,
  };
}

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

async function buildCurrentSearchParams(
  parsed: ParsedIntent,
  normalizer: Normalizer,
): Promise<SearchStateType["currentSearchParams"]> {
  if (parsed.intent !== "filter" || !parsed.filters) return null;

  // Filter out 'skills' — Core API requires skills for ranking when no userTrajectory exists.
  // See: core/routers/search/waymates.ts (excludedContextFields validation)
  const requestedFields = (parsed.filters.excludedContextFields ?? []).filter((f) => f !== "skills");

  const { normalized: fields, rejected: rejectedFields } = await normalizer.normalizeContextFields(requestedFields);

  const { normalized: reasons, rejected: rejectedReasons } = await normalizer.normalizeReasons(
    parsed.filters.excludedCreationReasons ?? [],
  );

  const { limit, pathLimit, recencyThresholdMonths } = clampSearchParams(parsed.filters);

  return {
    excludedContextFields: fields,
    excludedCreationReasons: reasons,
    recencyThresholdMonths,
    limit,
    pathLimit,
    rejectedFields: [...rejectedFields, ...rejectedReasons],
  };
}

function extractAdvisorQuestion(parsed: ParsedIntent): string | null {
  if (parsed.intent !== "ask") return null;
  if (!("question" in parsed)) return null;
  return parsed.question;
}

function extractQuestionType(parsed: ParsedIntent): "general" | "dictionary" | "chart" | null {
  if (parsed.intent !== "ask") return null;
  if (!("questionType" in parsed)) return null;
  return parsed.questionType;
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

    const flags = buildRouteFlags(state);
    const parsed = await parseUserIntent(userResponse, phase, flags);

    logger.info(
      { userResponse, phase, intent: parsed.intent, reasoning: parsed.reasoning },
      "intent classification with reasoning",
    );

    // Only update targetSearchParams if intent=validate from showing_goal, otherwise preserve existing
    const newTargetParams =
      phase === PHASE.showing_goal && extractedGoal
        ? await buildTargetSearchParams(parsed, extractedGoal, normalizerService)
        : null;
    const targetSearchParams = newTargetParams ?? state.targetSearchParams;

    // Only update currentSearchParams if intent=filter, otherwise preserve existing
    const newSearchParams = await buildCurrentSearchParams(parsed, normalizerService);
    const currentSearchParams = newSearchParams ?? state.currentSearchParams;

    const updatedRound = computeNewPositionRound(phase, parsed.intent, newPositionRound);

    return {
      searchUserIntent: parsed.intent,
      targetSearchParams,
      currentSearchParams,
      advisorQuestion: extractAdvisorQuestion(parsed),
      questionType: extractQuestionType(parsed),
      newPositionRound: updatedRound,
    };
  },
);
