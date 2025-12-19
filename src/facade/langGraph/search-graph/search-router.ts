import { AgentInvariantError } from "../../errors.js";
import { buildRouteMap } from "../shared/routing.js";

import { MAX_CLARIFY_ROUNDS, MAX_NEW_POSITION_ROUNDS, NODE, PHASE } from "./state.js";

import type { NodeName, SearchPhase, SearchStateType, SearchUserIntent } from "./state.js";

type RouteMap = Partial<Record<SearchUserIntent, NodeName>>;

// =============================================================================
// SOURCE OF TRUTH: допустимые destinations для каждой фазы
// =============================================================================

// prettier-ignore
const PARSE_INTENT_ROUTE_MAPS = new Map<SearchPhase, Partial<Record<NodeName, NodeName>>>([
  [PHASE.showing_exploration,   buildRouteMap([NODE.extract_goal, NODE.apply_filters, NODE.clarify_intent, NODE.cancel])],
  [PHASE.showing_goal,          buildRouteMap([NODE.validate_goal, NODE.clarify_goal, NODE.set_goal, NODE.clarify_intent, NODE.cancel])],
  [PHASE.asking_after_validate,  buildRouteMap([NODE.set_goal, NODE.clarify_goal, NODE.extract_goal, NODE.clarify_intent, NODE.cancel])],
  [PHASE.showing_results,       buildRouteMap([NODE.load_existing_goal, NODE.delete_goal, NODE.apply_filters, NODE.clarify_intent, NODE.cancel])],
]);

// Static route maps (not phase-dependent)
export const CHECK_GOAL_ROUTE_MAP = buildRouteMap([NODE.search, NODE.explore, NODE.load_existing_goal]);
export const APPLY_FILTERS_ROUTE_MAP = buildRouteMap([NODE.explore, NODE.search]);

// =============================================================================
// ROUTES: маппинг intent → node (фабрика с state-dependent параметрами)
// =============================================================================

type RouteFlags = {
  canClarify: boolean;
  canChangePosition: boolean;
};

function createIntentRoutes(flags: RouteFlags): Partial<Record<SearchPhase, RouteMap>> {
  const { canClarify, canChangePosition } = flags;

  // prettier-ignore
  return {
    [PHASE.showing_exploration]: { proceed: NODE.extract_goal, filter: NODE.apply_filters, cancel: NODE.cancel, unknown: NODE.clarify_intent },
    [PHASE.showing_goal]:        { validate: NODE.validate_goal, clarify: canClarify ? NODE.clarify_goal : NODE.set_goal, save: NODE.set_goal, cancel: NODE.cancel, unknown: NODE.clarify_intent },
    [PHASE.asking_after_validate]:{ save: NODE.set_goal, clarify: canClarify ? NODE.clarify_goal : NODE.set_goal, change: canChangePosition ? NODE.extract_goal : NODE.set_goal, cancel: NODE.cancel, unknown: NODE.clarify_intent },
    [PHASE.showing_results]:     { filter: NODE.apply_filters, clarify: NODE.load_existing_goal, change: NODE.load_existing_goal, delete: NODE.delete_goal, cancel: NODE.cancel, unknown: NODE.clarify_intent },
  } satisfies Partial<Record<SearchPhase, RouteMap>>;
}

// =============================================================================
// EXPORTS
// =============================================================================

export function availableNodesByPhase(phase: SearchPhase): Partial<Record<NodeName, NodeName>> {
  const map = PARSE_INTENT_ROUTE_MAPS.get(phase);
  if (!map) throw new AgentInvariantError("availableNodesByPhase", `No route map for phase: ${phase}`);
  return map;
}

// Combined destinations for parse_search_intent (routes to all phase-specific nodes)
export const PARSE_INTENT_ALL_DESTINATIONS = {
  ...availableNodesByPhase(PHASE.showing_exploration),
  ...availableNodesByPhase(PHASE.showing_goal),
  ...availableNodesByPhase(PHASE.asking_after_validate),
  ...availableNodesByPhase(PHASE.showing_results),
};

export function routeAfterParseSearchIntent(state: SearchStateType): NodeName {
  const { phase, clarifyRound, newPositionRound, searchUserIntent } = state;

  if (phase === PHASE.failed) return NODE.cancel;
  if (!searchUserIntent) throw new AgentInvariantError("routeAfterParseSearchIntent", "searchUserIntent missing");

  const flags: RouteFlags = {
    canClarify: clarifyRound < MAX_CLARIFY_ROUNDS,
    canChangePosition: newPositionRound < MAX_NEW_POSITION_ROUNDS,
  };

  const routes = createIntentRoutes(flags);
  const phaseRoutes = routes[phase];
  const defaultRoute = phase === PHASE.showing_goal ? NODE.set_goal : NODE.cancel;

  return phaseRoutes?.[searchUserIntent] ?? defaultRoute;
}

export function routeAfterCheckGoal(state: SearchStateType): NodeName {
  return state.existingGoal ? NODE.load_existing_goal : NODE.explore;
}

export function routeAfterApplyFilters(state: SearchStateType): NodeName {
  return state.existingGoal ? NODE.search : NODE.explore;
}

export function isTerminalPhase(phase: SearchPhase): boolean {
  return phase === PHASE.showing_results || phase === PHASE.cancelled || phase === PHASE.failed;
}
