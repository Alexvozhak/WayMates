import { AgentInvariantError } from "../../errors.js";
import { createDecisionRoutes } from "../shared/decision.js";
import { buildRouteMap } from "../shared/routing.js";

import { NODE, PHASE } from "./state.js";

import type { NodeName, UpsertTrailStateType } from "./state.js";

const DECISION_ROUTES = createDecisionRoutes({
  persist: NODE.persist_trail,
  edit: NODE.edit_trail,
  cancel: NODE.cancel,
  show: NODE.show_trail,
});

export const VALIDATION_ROUTE_MAP = buildRouteMap([NODE.clarify, NODE.show_trail, NODE.cancel]);
export const DECISION_ROUTE_MAP = buildRouteMap([NODE.persist_trail, NODE.edit_trail, NODE.show_trail, NODE.cancel]);

export function routeAfterValidation(state: UpsertTrailStateType): NodeName {
  if (state.phase === PHASE.failed) return NODE.cancel;
  if (state.missingFields.length > 0) return NODE.clarify;
  return NODE.show_trail;
}

export function routeAfterDecision(state: UpsertTrailStateType): NodeName {
  const { parsedDecision } = state;
  if (!parsedDecision) throw new AgentInvariantError("routeAfterDecision", "parsedDecision missing");
  return DECISION_ROUTES[parsedDecision.intent];
}
