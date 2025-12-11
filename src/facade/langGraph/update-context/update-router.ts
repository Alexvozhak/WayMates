import { NODE } from "./state.js";

import type { NodeName, UpdateContextStateType } from "./state.js";

export function routeAfterMerge(state: UpdateContextStateType): NodeName {
  if (state.missingFields.length > 0) {
    return NODE.clarify;
  }
  if (state.validationErrors.length > 0 && !state.mergedContext) {
    return NODE.cancel;
  }
  return NODE.show_update;
}

export function routeAfterDecision(state: UpdateContextStateType): NodeName {
  const intent = state.parsedDecision?.intent;
  switch (intent) {
    case "approve": {
      return NODE.persist_update;
    }
    case "edit": {
      return NODE.edit_update;
    }
    case "cancel": {
      return NODE.cancel;
    }
    default: {
      return NODE.show_update;
    }
  }
}
