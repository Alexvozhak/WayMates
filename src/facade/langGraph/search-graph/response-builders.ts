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
  [PHASE.asking_adhoc_context]: (state) => ({
    phase: PHASE.asking_adhoc_context,
    adhocContext: state.adhocContext,
    missingFields: state.missingFields,
    optionalFields: state.optionalFields,
  }),

  [PHASE.confirming_adhoc_context]: (state) => ({
    phase: PHASE.confirming_adhoc_context,
    adhocContext: state.adhocContext,
    goal: state.storedGoal,
    missingFields: state.missingFields,
    optionalFields: state.optionalFields,
  }),

  [PHASE.checking_goal]: () => ({
    phase: PHASE.checking_goal,
  }),

  [PHASE.exploring]: () => ({
    phase: PHASE.exploring,
  }),

  [PHASE.showing_exploration_candidates]: (state) => ({
    phase: PHASE.showing_exploration_candidates,
    appliedFilters: state.currentSearchParams,
    adhocContext: state.adhocContext,
    candidates: state.explorationResults,
    chartUrl: state.chartUrl,
  }),

  [PHASE.showing_exploration_facets]: (state) => ({
    phase: PHASE.showing_exploration_facets,
    appliedFilters: state.currentSearchParams,
    adhocContext: state.adhocContext,
    facets: state.facets!,
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

  [PHASE.asking_after_validate_candidates]: (state) => ({
    phase: PHASE.asking_after_validate_candidates,
    appliedFilters: state.targetSearchParams,
    adhocContext: state.adhocContext,
    extractedGoal: state.extractedGoal,
    candidates: state.validationResults,
    chartUrl: state.chartUrl,
  }),

  [PHASE.asking_after_validate_facets]: (state) => ({
    phase: PHASE.asking_after_validate_facets,
    appliedFilters: state.targetSearchParams,
    adhocContext: state.adhocContext,
    extractedGoal: state.extractedGoal,
    facets: state.facets!,
  }),

  [PHASE.setting_goal]: () => ({
    phase: PHASE.setting_goal,
  }),

  [PHASE.asking_search_mode]: (state) => ({
    phase: PHASE.asking_search_mode,
    storedGoal: state.storedGoal!,
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

  [PHASE.showing_results_facets]: (state) => ({
    phase: PHASE.showing_results_facets,
    goal: state.storedGoal,
    appliedFilters: state.currentSearchParams,
    adhocContext: state.adhocContext,
    facets: state.facets!,
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
