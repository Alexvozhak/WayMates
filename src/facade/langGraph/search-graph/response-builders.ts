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
    message: "Checking your goal...",
  }),

  [PHASE.exploring]: () => ({
    phase: PHASE.exploring,
    message: "Searching all candidates...",
  }),

  [PHASE.showingExploration]: (state) => ({
    phase: PHASE.showingExploration,
    message: formatExplorationMessage(state.explorationResults.length),
    candidates: state.explorationResults,
    options: OPTIONS.showExploration,
  }),

  [PHASE.extractingGoal]: () => ({
    phase: PHASE.extractingGoal,
    message: "Understanding your goal...",
  }),

  [PHASE.showingGoal]: (state) => {
    const extractedGoal = requireExtractedGoal(state, PHASE.showingGoal);
    return {
      phase: PHASE.showingGoal,
      message: formatExtractedGoalMessage(extractedGoal),
      extractedGoal,
      options: OPTIONS.showGoal,
    };
  },

  [PHASE.clarifyingGoal]: (state) => {
    const extractedGoal = requireExtractedGoal(state, PHASE.clarifyingGoal);
    return {
      phase: PHASE.clarifyingGoal,
      message: "What would you like to clarify?",
      extractedGoal,
    };
  },

  [PHASE.validatingGoal]: (state) => ({
    phase: PHASE.validatingGoal,
    message: "Here are professionals who achieved similar goals:",
    candidates: state.validationResults,
  }),

  [PHASE.askingAfterValidate]: (state) => ({
    phase: PHASE.askingAfterValidate,
    message: "Based on these trajectories, is this the goal you want?",
    candidates: state.validationResults,
    options: OPTIONS.askAfterValidate,
  }),

  [PHASE.settingGoal]: () => ({
    phase: PHASE.settingGoal,
    message: "Saving your goal...",
  }),

  [PHASE.deletingGoal]: () => ({
    phase: PHASE.deletingGoal,
    message: "Deleting your goal...",
  }),

  [PHASE.searching]: () => ({
    phase: PHASE.searching,
    message: "Searching for matching careers...",
  }),

  [PHASE.showingResults]: (state) => ({
    phase: PHASE.showingResults,
    message: formatResultsMessage(state.searchResults.length),
    results: state.searchResults,
    goal: state.existingGoal ?? undefined,
    options: OPTIONS.showResults,
  }),

  [PHASE.cancelled]: () => ({
    phase: PHASE.cancelled,
    message: "Search cancelled.",
  }),

  [PHASE.failed]: () => ({
    phase: PHASE.failed,
    message: "Search failed. Please try again.",
  }),
};

function formatExplorationMessage(count: number): string {
  if (count === 0) {
    return "No candidates found. Try providing more details about yourself.";
  }
  return `Found ${count} candidate${count === 1 ? "" : "s"}. Would you like to set a career goal?`;
}

function formatField(
  label: string,
  filter: { mode: string; values: string[] } | undefined,
  showMode = false,
): string | null {
  if (!filter?.values.length) return null;
  const prefix = showMode && filter.mode === "undesired" ? "Not in" : label;
  return `${prefix}: ${filter.values.join(", ")}`;
}

function formatExtractedGoalMessage(goal: NonNullable<SearchStateType["extractedGoal"]>): string {
  const parts: (string | null)[] = [
    formatField("Position", goal.position),
    formatField("Countries", goal.countries, true),
    formatField("Domains", goal.domains),
    formatField("Skills", goal.skills),
    formatField("Languages", goal.languages),
  ];

  const filtered = parts.filter((p): p is string => p !== null);
  return filtered.length > 0 ? `I understood your goal as:\n${filtered.join("\n")}` : "Goal extracted.";
}

function formatResultsMessage(count: number): string {
  if (count === 0) {
    return "No matching careers found. Try adjusting your goal.";
  }
  return `Found ${count} matching career${count === 1 ? "" : "s"}:`;
}
