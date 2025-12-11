import { AgentInvariantError } from "../../errors.js";

import { NODE, PHASE } from "./state.js";

import type { NodeName, UpsertContextStateType } from "./state.js";
import type { ParsedDecision } from "../shared/decision.js";

type Intent = ParsedDecision["intent"];

function getRequiredIntent(state: UpsertContextStateType, afterNode: string): Intent {
  const { parsedDecision } = state;
  if (!parsedDecision) {
    throw new AgentInvariantError(afterNode, "parsedDecision must exist after parse node");
  }
  return parsedDecision.intent;
}

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
  const intent = getRequiredIntent(state, NODE.parse_decision);
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
  }
}
