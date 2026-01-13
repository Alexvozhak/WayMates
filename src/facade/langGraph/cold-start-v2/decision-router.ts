import { AgentInvariantError } from "../../errors.js";
import { buildRouteMap } from "../shared/routing.js";

import { NODE, PHASE } from "./types.js";

import type { ColdStartStateType } from "./state.js";
import type { ColdStartPhase, NodeName, ParsedDecision } from "./types.js";

type RouteMap = Partial<Record<ParsedDecision["intent"], NodeName>>;

// =============================================================================
// SOURCE OF TRUTH: valid destinations for each phase
// =============================================================================

// prettier-ignore
const DECISION_ROUTE_MAPS = new Map<ColdStartPhase, Partial<Record<NodeName, NodeName>>>([
  [PHASE.story_gathering,               buildRouteMap([NODE.plan_career, NODE.gather_story, NODE.clarify_intent, NODE.cancel])],
  [PHASE.awaiting_plan_confirmation,    buildRouteMap([NODE.extract_context, NODE.gather_story, NODE.clarify_intent, NODE.cancel])],
  [PHASE.awaiting_context_confirmation, buildRouteMap([NODE.next_context, NODE.show_final, NODE.edit_context, NODE.clarify_intent, NODE.cancel])],
  [PHASE.awaiting_final_confirmation,   buildRouteMap([NODE.persist, NODE.show_context, NODE.clarify_intent, NODE.cancel])],
]);

// prettier-ignore
const CLARIFY_INTENT_ROUTES = new Map<ColdStartPhase, NodeName>([
  [PHASE.story_gathering,               NODE.parse_story_decision],
  [PHASE.awaiting_plan_confirmation,    NODE.parse_plan_decision],
  [PHASE.awaiting_context_confirmation, NODE.parse_context_decision],
  [PHASE.awaiting_final_confirmation,   NODE.parse_final_decision],
]);

// Static route maps (not phase-dependent)
export const PLAN_CAREER_ROUTE_MAP = buildRouteMap([NODE.show_plan, NODE.cancel]);
export const VALIDATION_ROUTE_MAP = buildRouteMap([NODE.clarify_fields, NODE.show_context, NODE.cancel]);
// prettier-ignore
export const CLARIFY_INTENT_ROUTE_MAP = buildRouteMap([NODE.parse_story_decision, NODE.parse_plan_decision, NODE.parse_context_decision, NODE.parse_final_decision, NODE.cancel]);

// =============================================================================
// ROUTES: intent → node mapping (factory with state-dependent parameter)
// =============================================================================

function createDecisionRoutes(hasMoreContexts: boolean): Partial<Record<ColdStartPhase, RouteMap>> {
  // prettier-ignore
  return {
    [PHASE.story_gathering]:              { approve: NODE.plan_career,     continue: NODE.gather_story, cancel: NODE.cancel, unknown: NODE.clarify_intent },
    [PHASE.awaiting_plan_confirmation]:   { approve: NODE.extract_context, continue: NODE.extract_context, edit: NODE.gather_story, cancel: NODE.cancel, unknown: NODE.clarify_intent },
    [PHASE.awaiting_context_confirmation]:{ approve: hasMoreContexts ? NODE.next_context : NODE.show_final, edit: NODE.edit_context, cancel: NODE.cancel, unknown: NODE.clarify_intent },
    [PHASE.awaiting_final_confirmation]:  { approve: NODE.persist,         edit: NODE.show_context,     cancel: NODE.cancel, unknown: NODE.clarify_intent },
  } satisfies Partial<Record<ColdStartPhase, RouteMap>>;
}

// =============================================================================
// EXPORTS
// =============================================================================

export function availableNodesByPhase(phase: ColdStartPhase): Partial<Record<NodeName, NodeName>> {
  const map = DECISION_ROUTE_MAPS.get(phase);
  if (!map) throw new AgentInvariantError("availableNodesByPhase", `No route map for phase: ${phase}`);
  return map;
}

export function routeNextNodeAfterDecision(state: ColdStartStateType): NodeName {
  const { phase, currentContextIndex, queue, parsedDecision } = state;

  if (phase === PHASE.failed) return NODE.cancel;
  if (!parsedDecision) throw new AgentInvariantError("routeNextNodeAfterDecision", "parsedDecision missing");

  const hasMoreContexts = currentContextIndex < queue.length - 1;
  const routes = createDecisionRoutes(hasMoreContexts);
  const phaseRoutes = routes[phase];

  return phaseRoutes?.[parsedDecision.intent] ?? NODE.clarify_intent;
}

export function routeNextNodeAfterClarifyIntent(state: ColdStartStateType): NodeName {
  if (state.phase === PHASE.failed) return NODE.cancel;
  const route = CLARIFY_INTENT_ROUTES.get(state.phase);
  if (!route) throw new AgentInvariantError("routeNextNodeAfterClarifyIntent", `No route for phase: ${state.phase}`);
  return route;
}

export function routeNextNodeAfterValidation(state: ColdStartStateType): NodeName {
  if (state.phase === PHASE.failed) return NODE.cancel;
  if (state.missingFields.length > 0 || state.rolePositionSuggestions.length > 0) return NODE.clarify_fields;
  return NODE.show_context;
}

export function routeNextNodeAfterPlanCareer(state: ColdStartStateType): NodeName {
  if (state.phase === PHASE.failed || state.queue.length === 0) return NODE.cancel;
  return NODE.show_plan;
}
