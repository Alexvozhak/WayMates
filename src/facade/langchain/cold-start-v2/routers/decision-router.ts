import { AgentInvariantError } from "../../../errors.js";

import type { ColdStartStateType, ParsedDecision } from "../state.js";

type Intent = ParsedDecision["intent"];
type RouteMap = Partial<Record<Intent, string>>;

function getRequiredIntent(state: ColdStartStateType, routerName: string): Intent {
  const { parsedDecision } = state;
  if (!parsedDecision) {
    throw new AgentInvariantError(routerName, "parsedDecision must exist after parse node", {
      phase: state.phase,
    });
  }
  return parsedDecision.intent;
}

function routeByIntent(intent: Intent, routes: RouteMap, defaultRoute: string): string {
  return routes[intent] ?? defaultRoute;
}

export function routeAfterStoryDecision(state: ColdStartStateType): string {
  const intent = getRequiredIntent(state, "routeAfterStoryDecision");
  return routeByIntent(intent, { approve: "plan_career", cancel: "cancel" }, "gather_story");
}

export function routeAfterPlanDecision(state: ColdStartStateType): string {
  const intent = getRequiredIntent(state, "routeAfterPlanDecision");
  return routeByIntent(intent, { approve: "extract_context", edit: "gather_story", cancel: "cancel" }, "show_plan");
}

export function routeAfterValidation(state: ColdStartStateType): string {
  if (state.phase === "failed") return "cancel";
  if (state.missingFields.length > 0) return "clarify";
  return "show_context";
}

export function routeAfterContextDecision(state: ColdStartStateType): string {
  const intent = getRequiredIntent(state, "routeAfterContextDecision");
  const { currentContextIndex, queue } = state;

  if (intent === "approve") {
    return currentContextIndex < queue.length - 1 ? "next_context" : "show_final";
  }

  return routeByIntent(intent, { edit: "edit_context", cancel: "cancel" }, "show_context");
}

export function routeAfterFinalDecision(state: ColdStartStateType): string {
  const intent = getRequiredIntent(state, "routeAfterFinalDecision");
  return routeByIntent(intent, { approve: "persist", edit: "show_context", cancel: "cancel" }, "show_final");
}
