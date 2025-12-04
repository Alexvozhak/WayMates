import type { UpsertTrailStateType } from "../state.js";

export function routeAfterValidation(state: UpsertTrailStateType): string {
  if (state.validationErrors.length > 0 && !state.validatedTrail) {
    return "cancel";
  }
  return "show_trail";
}

export function routeAfterDecision(state: UpsertTrailStateType): string {
  const intent = state.parsedDecision?.intent;
  switch (intent) {
    case "approve": {
      return "persist_trail";
    }
    case "edit": {
      return "edit_trail";
    }
    case "cancel": {
      return "cancel";
    }
    default: {
      return "show_trail";
    }
  }
}
