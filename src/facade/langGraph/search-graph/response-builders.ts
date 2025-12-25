import { InvalidStateError } from "../../errors.js";

import { PHASE } from "./state.js";

import type { SearchPhase, SearchStateType } from "./state.js";
import type { SearchGraphResponse } from "./types.js";

type ResponseBuilder = (state: SearchStateType) => SearchGraphResponse;

function requireExtractedGoal(state: SearchStateType, phase: string): NonNullable<SearchStateType["extractedGoal"]> {
  if (!state.extractedGoal) {
    throw new InvalidStateError(phase, "extractedGoal is missing");
  }
  return state.extractedGoal;
}

export const responseBuilders: Record<SearchPhase, ResponseBuilder> = {
  [PHASE.asking_adhoc_context]: () => ({
    phase: PHASE.asking_adhoc_context,
  }),

  [PHASE.confirming_adhoc_context]: (state) => ({
    phase: PHASE.confirming_adhoc_context,
    adhocContext: state.adhocContext,
    goal: state.storedGoal,
  }),

  [PHASE.checking_goal]: () => ({
    phase: PHASE.checking_goal,
  }),

  [PHASE.exploring]: () => ({
    phase: PHASE.exploring,
  }),

  [PHASE.showing_exploration]: (state) => ({
    phase: PHASE.showing_exploration,
    candidates: state.explorationResults,
    appliedFilters: state.currentSearchParams,
    adhocContext: state.adhocContext,
  }),

  [PHASE.extracting_goal]: () => ({
    phase: PHASE.extracting_goal,
  }),

  [PHASE.showing_goal]: (state) => {
    const extractedGoal = requireExtractedGoal(state, PHASE.showing_goal);
    return {
      phase: PHASE.showing_goal,
      extractedGoal,
    };
  },

  [PHASE.clarifying_goal]: (state) => {
    const extractedGoal = requireExtractedGoal(state, PHASE.clarifying_goal);
    return {
      phase: PHASE.clarifying_goal,
      extractedGoal,
    };
  },

  [PHASE.validating_goal]: (state) => ({
    phase: PHASE.validating_goal,
    candidates: state.validationResults,
  }),

  [PHASE.asking_after_validate]: (state) => ({
    phase: PHASE.asking_after_validate,
    candidates: state.validationResults,
    appliedFilters: state.targetSearchParams,
    adhocContext: state.adhocContext,
    extractedGoal: state.extractedGoal,
  }),

  [PHASE.setting_goal]: () => ({
    phase: PHASE.setting_goal,
  }),

  [PHASE.deleting_goal]: () => ({
    phase: PHASE.deleting_goal,
  }),

  [PHASE.searching]: () => ({
    phase: PHASE.searching,
  }),

  [PHASE.showing_results]: (state) => ({
    phase: PHASE.showing_results,
    results: state.searchResults,
    goal: state.storedGoal,
    chartUrl: state.chartUrl,
    appliedFilters: state.currentSearchParams,
    adhocContext: state.adhocContext,
  }),

  [PHASE.advising]: (state) => ({
    phase: PHASE.advising,
    answerText: state.currentAnswer ?? "",
  }),

  [PHASE.cancelled]: () => ({
    phase: PHASE.cancelled,
  }),

  [PHASE.failed]: () => ({
    phase: PHASE.failed,
  }),
};
