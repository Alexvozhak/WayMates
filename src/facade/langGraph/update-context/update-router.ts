import { AgentInvariantError } from "../../errors.js";
import { createDecisionRoutes } from "../shared/decision.js";
import { buildRouteMap } from "../shared/routing.js";

import { NODE, PHASE } from "./state.js";

import type { NodeName, UpdateContextStateType } from "./state.js";

const DECISION_ROUTES = createDecisionRoutes({
  persist: NODE.persist_update,
  edit: NODE.edit_update,
  cancel: NODE.cancel,
  show: NODE.show_update,
});

export const MERGE_ROUTE_MAP = buildRouteMap([NODE.clarify, NODE.show_update, NODE.cancel]);
export const DECISION_ROUTE_MAP = buildRouteMap([NODE.persist_update, NODE.edit_update, NODE.show_update, NODE.cancel]);

export function routeAfterMerge(state: UpdateContextStateType): NodeName {
  if (state.phase === PHASE.failed) return NODE.cancel;
  if (state.missingFields.length > 0) return NODE.clarify;
  if (state.validationErrors.length > 0 && !state.mergedContext) return NODE.cancel;
  return NODE.show_update;
}

export function routeAfterDecision(state: UpdateContextStateType): NodeName {
  const { parsedDecision } = state;
  if (!parsedDecision) throw new AgentInvariantError("routeAfterDecision", "parsedDecision missing");
  return DECISION_ROUTES[parsedDecision.intent];
}
