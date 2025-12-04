import type { UpdateContextStateType } from "../state.js";

export function routeAfterMerge(state: UpdateContextStateType): string {
  if (state.validationErrors.length > 0 && !state.mergedContext) {
    return "cancel";
  }
  return "show_update";
}

export function routeAfterDecision(state: UpdateContextStateType): string {
  const intent = state.parsedDecision?.intent;
  switch (intent) {
    case "approve": {
      return "persist_update";
    }
    case "edit": {
      return "edit_update";
    }
    case "cancel": {
      return "cancel";
    }
    default: {
      return "show_update";
    }
  }
}
