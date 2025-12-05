import { PHASE } from "./state.js";

import type { UpsertContextStateType } from "./state.js";

export function routeAfterValidation(state: UpsertContextStateType): string {
  if (state.phase === PHASE.failed) {
    return "cancel";
  }
  if (state.missingFields.length > 0) {
    return "clarify";
  }
  return "show_context";
}

export function routeAfterDecision(state: UpsertContextStateType): string {
  const intent = state.parsedDecision?.intent;
  switch (intent) {
    case "approve": {
      return "persist_context";
    }
    case "edit": {
      return "edit_context";
    }
    case "cancel": {
      return "cancel";
    }
    default: {
      return "show_context";
    }
  }
}
