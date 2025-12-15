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
  [PHASE.checkingGoal]: () => ({
    phase: PHASE.checkingGoal,
  }),

  [PHASE.exploring]: () => ({
    phase: PHASE.exploring,
  }),

  [PHASE.showingExploration]: (state) => ({
    phase: PHASE.showingExploration,
    candidates: state.explorationResults,
    options: OPTIONS.showExploration,
  }),

  [PHASE.extractingGoal]: () => ({
    phase: PHASE.extractingGoal,
  }),

  [PHASE.showingGoal]: (state) => {
    const extractedGoal = requireExtractedGoal(state, PHASE.showingGoal);
    return {
      phase: PHASE.showingGoal,
      extractedGoal,
      options: OPTIONS.showGoal,
    };
  },

  [PHASE.clarifyingGoal]: (state) => {
    const extractedGoal = requireExtractedGoal(state, PHASE.clarifyingGoal);
    return {
      phase: PHASE.clarifyingGoal,
      extractedGoal,
    };
  },

  [PHASE.validatingGoal]: (state) => ({
    phase: PHASE.validatingGoal,
    candidates: state.validationResults,
  }),

  [PHASE.askingAfterValidate]: (state) => ({
    phase: PHASE.askingAfterValidate,
    candidates: state.validationResults,
    options: OPTIONS.askAfterValidate,
  }),

  [PHASE.settingGoal]: () => ({
    phase: PHASE.settingGoal,
  }),

  [PHASE.deletingGoal]: () => ({
    phase: PHASE.deletingGoal,
  }),

  [PHASE.searching]: () => ({
    phase: PHASE.searching,
  }),

  [PHASE.showingResults]: (state) => ({
    phase: PHASE.showingResults,
    results: state.searchResults,
    goal: state.existingGoal ?? undefined,
    options: OPTIONS.showResults,
  }),

  [PHASE.cancelled]: () => ({
    phase: PHASE.cancelled,
  }),

  [PHASE.failed]: () => ({
    phase: PHASE.failed,
  }),
};
