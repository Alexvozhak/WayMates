import { AgentInvariantError } from "../../errors.js";

import { NODE } from "./types.js";

import type { ColdStartStateType, ParsedDecision } from "./state.js";
import type { NodeName } from "./types.js";

type Intent = ParsedDecision["intent"];
type RouteMap = Partial<Record<Intent, NodeName>>;

function getRequiredIntent(state: ColdStartStateType, afterNode: string): Intent {
  const { parsedDecision } = state;
  if (!parsedDecision) {
    throw new AgentInvariantError(afterNode, "parsedDecision must exist after parse node");
  }
  return parsedDecision.intent;
}

function routeByIntent(intent: Intent, routes: RouteMap, defaultRoute: NodeName): NodeName {
  return routes[intent] ?? defaultRoute;
}

export function routeAfterStoryDecision(state: ColdStartStateType): NodeName {
  const intent = getRequiredIntent(state, NODE.parse_story_decision);
  return routeByIntent(intent, { approve: NODE.plan_career, cancel: NODE.cancel }, NODE.gather_story);
}

export function routeAfterPlanDecision(state: ColdStartStateType): NodeName {
  const intent = getRequiredIntent(state, NODE.parse_plan_decision);
  return routeByIntent(
    intent,
    { approve: NODE.extract_context, edit: NODE.gather_story, cancel: NODE.cancel },
    NODE.show_plan,
  );
}

export function routeAfterValidation(state: ColdStartStateType): NodeName {
  if (state.phase === "failed") return NODE.cancel;
  if (state.missingFields.length > 0) return NODE.clarify;
  return NODE.show_context;
}

export function routeAfterPlanCareer(state: ColdStartStateType): NodeName {
  if (state.phase === "failed" || state.queue.length === 0) return NODE.cancel;
  return NODE.show_plan;
}

export function routeAfterContextDecision(state: ColdStartStateType): NodeName {
  const intent = getRequiredIntent(state, NODE.parse_context_decision);
  const { currentContextIndex, queue } = state;

  if (intent === "approve") {
    return currentContextIndex < queue.length - 1 ? NODE.next_context : NODE.show_final;
  }

  return routeByIntent(intent, { edit: NODE.edit_context, cancel: NODE.cancel }, NODE.show_context);
}

export function routeAfterFinalDecision(state: ColdStartStateType): NodeName {
  const intent = getRequiredIntent(state, NODE.parse_final_decision);
  return routeByIntent(
    intent,
    { approve: NODE.persist, edit: NODE.show_context, cancel: NODE.cancel },
    NODE.show_final,
  );
}
