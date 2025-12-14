import { InvalidStateError } from "../../errors.js";

import { PHASE } from "./state.js";

import type { SearchPhase, SearchStateType } from "./state.js";
import type { SearchGraphResponse } from "./types.js";

type ResponseBuilder = (state: SearchStateType) => SearchGraphResponse;

function requireExtractedGoal(
  state: SearchStateType,
  phase: string,
): NonNullable<SearchStateType["extractedGoal"]> {
  if (!state.extractedGoal) {
    throw new InvalidStateError(phase, "extractedGoal is missing");
  }
  return state.extractedGoal;
}

function requireExistingGoal(state: SearchStateType, phase: string): NonNullable<SearchStateType["existingGoal"]> {
  if (!state.existingGoal) {
    throw new InvalidStateError(phase, "existingGoal is missing");
  }
  return state.existingGoal;
}

export const responseBuilders: Record<SearchPhase, ResponseBuilder> = {
  [PHASE.checkingGoal]: () => ({
    phase: PHASE.checkingGoal,
    message: "Checking your goal...",
  }),

  [PHASE.askingWithGoal]: (state) => {
    const goal = requireExistingGoal(state, PHASE.askingWithGoal);
    return {
      phase: PHASE.askingWithGoal,
      message: formatGoalMessage(goal),
      goal,
      options: ["search", "validate", "change", "explore", "cancel"],
    };
  },

  [PHASE.askingNoGoal]: () => ({
    phase: PHASE.askingNoGoal,
    message: "What career goal would you like to achieve?",
    options: ["confirm", "explore", "cancel"],
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
      options: ["clarify", "validate", "confirm", "cancel"],
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
    options: ["confirm", "clarify", "change", "cancel"],
  }),

  [PHASE.confirmingGoal]: (state) => {
    const extractedGoal = requireExtractedGoal(state, PHASE.confirmingGoal);
    return {
      phase: PHASE.confirmingGoal,
      message: "Save this goal?",
      extractedGoal,
    };
  },

  [PHASE.settingGoal]: () => ({
    phase: PHASE.settingGoal,
    message: "Saving your goal...",
  }),

  [PHASE.searching]: () => ({
    phase: PHASE.searching,
    message: "Searching for similar careers...",
  }),

  [PHASE.showingResults]: (state) => ({
    phase: PHASE.showingResults,
    message: formatResultsMessage(state.searchResults.length),
    results: state.searchResults,
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

function formatGoalMessage(goal: NonNullable<SearchStateType["existingGoal"]>): string {
  const criteria = goal.targetCriteria;
  const parts: string[] = [];

  if (criteria.position?.values.length) {
    parts.push(`Position: ${criteria.position.values.join(", ")}`);
  }
  if (criteria.domains?.values.length) {
    parts.push(`Domains: ${criteria.domains.values.join(", ")}`);
  }

  return parts.length > 0 ? `Your current goal:\n${parts.join("\n")}` : "Your current goal is set.";
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
    return "No matching careers found. Try adjusting your criteria.";
  }
  return `Found ${count} matching career${count === 1 ? "" : "s"}:`;
}
