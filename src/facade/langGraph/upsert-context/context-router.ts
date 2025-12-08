import { NODE, PHASE } from "./state.js";

import type { NodeName, UpsertContextStateType } from "./state.js";

export function routeAfterValidation(state: UpsertContextStateType): NodeName {
  if (state.phase === PHASE.failed) {
    return NODE.cancel;
  }
  if (state.missingFields.length > 0) {
    return NODE.clarify;
  }
  return NODE.show_context;
}

export function routeAfterDecision(state: UpsertContextStateType): NodeName {
  const intent = state.parsedDecision?.intent;
  switch (intent) {
    case "approve": {
      return NODE.persist_context;
    }
    case "edit": {
      return NODE.edit_context;
    }
    case "cancel": {
      return NODE.cancel;
    }
    default: {
      return NODE.show_context;
    }
  }
}
