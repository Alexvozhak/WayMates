import type { ColdStartStateType, ParsedDecision } from "../state.js";

type Intent = ParsedDecision["intent"];
type RouteMap = Partial<Record<Intent, string>>;

function routeByIntent(intent: Intent | undefined, routes: RouteMap, defaultRoute: string): string {
  return (intent && routes[intent]) ?? defaultRoute;
}

export function routeAfterStoryDecision(state: ColdStartStateType): string {
  return routeByIntent(state.parsedDecision?.intent, { approve: "plan_career", cancel: "cancel" }, "gather_story");
}

export function routeAfterPlanDecision(state: ColdStartStateType): string {
  return routeByIntent(
    state.parsedDecision?.intent,
    { approve: "extract_context", edit: "gather_story", cancel: "cancel" },
    "show_plan",
  );
}

export function routeAfterValidation(state: ColdStartStateType): string {
  if (state.phase === "failed") return "cancel";
  if (state.missingFields.length > 0) return "clarify";
  return "show_context";
}

export function routeAfterContextDecision(state: ColdStartStateType): string {
  const { parsedDecision, currentContextIndex, queue } = state;
  const intent = parsedDecision?.intent;

  if (intent === "approve") {
    return currentContextIndex < queue.length - 1 ? "next_context" : "show_final";
  }

  return routeByIntent(intent, { edit: "edit_context", cancel: "cancel" }, "show_context");
}

export function routeAfterFinalDecision(state: ColdStartStateType): string {
  return routeByIntent(
    state.parsedDecision?.intent,
    { approve: "persist", edit: "show_context", cancel: "cancel" },
    "show_final",
  );
}
