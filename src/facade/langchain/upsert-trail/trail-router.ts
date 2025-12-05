import { PHASE } from "./state.js";

import type { UpsertTrailStateType } from "./state.js";

export function routeAfterValidation(state: UpsertTrailStateType): string {
  if (state.phase === PHASE.failed) {
    return "cancel";
  }
  if (state.missingFields.length > 0) {
    return "clarify";
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
