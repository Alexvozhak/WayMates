import { AgentInvariantError } from "../../errors.js";
import { createDecisionRoutes } from "../shared/decision.js";
import { buildRouteMap } from "../shared/routing.js";

import { NODE, PHASE } from "./state.js";

import type { NodeName, UpsertContextStateType } from "./state.js";

const DECISION_ROUTES = createDecisionRoutes({
  persist: NODE.persist_context,
  edit: NODE.edit_context,
  cancel: NODE.cancel,
  show: NODE.show_context,
});

export const VALIDATION_ROUTE_MAP = buildRouteMap([NODE.clarify, NODE.show_context, NODE.cancel]);
export const DECISION_ROUTE_MAP = buildRouteMap([
  NODE.persist_context,
  NODE.edit_context,
  NODE.show_context,
  NODE.cancel,
]);

export function routeAfterValidation(state: UpsertContextStateType): NodeName {
  if (state.phase === PHASE.failed) return NODE.cancel;
  if (state.missingFields.length > 0) return NODE.clarify;
  return NODE.show_context;
}

export function routeAfterDecision(state: UpsertContextStateType): NodeName {
  const { parsedDecision } = state;
  if (!parsedDecision) throw new AgentInvariantError("routeAfterDecision", "parsedDecision missing");
  return DECISION_ROUTES[parsedDecision.intent];
}
