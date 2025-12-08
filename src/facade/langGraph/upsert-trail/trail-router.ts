import { NODE, PHASE } from "./state.js";

import type { NodeName, UpsertTrailStateType } from "./state.js";

export function routeAfterValidation(state: UpsertTrailStateType): NodeName {
  if (state.phase === PHASE.failed) {
    return NODE.cancel;
  }
  if (state.missingFields.length > 0) {
    return NODE.clarify;
  }
  return NODE.show_trail;
}

export function routeAfterDecision(state: UpsertTrailStateType): NodeName {
  const intent = state.parsedDecision?.intent;
  switch (intent) {
    case "approve": {
      return NODE.persist_trail;
    }
    case "edit": {
      return NODE.edit_trail;
    }
    case "cancel": {
      return NODE.cancel;
    }
    default: {
      return NODE.show_trail;
    }
  }
}
