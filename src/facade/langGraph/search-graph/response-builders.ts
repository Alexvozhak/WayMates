import { InvalidStateError } from "../../errors.js";

import { OPTIONS, PHASE } from "./state.js";

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
  [PHASE.checking_goal]: () => ({
    phase: PHASE.checking_goal,
  }),

  [PHASE.exploring]: () => ({
    phase: PHASE.exploring,
  }),

  [PHASE.showing_exploration]: (state) => ({
    phase: PHASE.showing_exploration,
    candidates: state.explorationResults,
    options: OPTIONS.showExploration,
    currentFilters: null, // enrichResponse() adds from CONTEXT_FIELD_NAMES
    appliedCurrentFilters: state.currentSearchParams,
  }),

  [PHASE.extracting_goal]: () => ({
    phase: PHASE.extracting_goal,
  }),

  [PHASE.showing_goal]: (state) => {
    const extractedGoal = requireExtractedGoal(state, PHASE.showing_goal);
    return {
      phase: PHASE.showing_goal,
      extractedGoal,
      options: OPTIONS.showGoal,
      availableFilters: null, // enrichResponse() adds from cache.getReasons()
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
    options: OPTIONS.askAfterValidate,
    appliedFilters: state.targetSearchParams,
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
    options: OPTIONS.showResults,
    availableFilters: null, // enrichResponse() adds from cache.getReasons()
    currentFilters: null, // enrichResponse() adds from CONTEXT_FIELD_NAMES
    appliedCurrentFilters: state.currentSearchParams,
  }),

  [PHASE.advising]: (state) => ({
    phase: PHASE.advising,
    answerText: state.currentAnswer ?? "",
    options: OPTIONS.advising,
  }),

  [PHASE.cancelled]: () => ({
    phase: PHASE.cancelled,
  }),

  [PHASE.failed]: () => ({
    phase: PHASE.failed,
  }),
};
