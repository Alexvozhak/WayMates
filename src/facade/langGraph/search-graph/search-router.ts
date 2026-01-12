import { AgentInvariantError } from "../../errors.js";
import { buildRouteMap } from "../shared/routing.js";

import { COMPLEX_INTENTS, MAX_CLARIFY_ROUNDS, MAX_NEW_POSITION_ROUNDS, NODE, PHASE, SIMPLE_INTENTS } from "./state.js";

import type { NodeName, SearchPhase, SearchStateType, SearchUserIntent } from "./state.js";

type RouteMap = Partial<Record<SearchUserIntent, NodeName>>;

// =============================================================================
// SOURCE OF TRUTH: valid destinations for each phase
// =============================================================================

// prettier-ignore
// NODE.generate_answer added to all phases — user can ask meta-questions anytime
const PARSE_INTENT_ROUTE_MAPS = new Map<SearchPhase, Partial<Record<NodeName, NodeName>>>([
  [PHASE.confirming_adhoc_context,         buildRouteMap([NODE.search_waymates, NODE.search_pathfinders, NODE.validate_goal, NODE.load_existing_goal, NODE.explore, NODE.extract_goal, NODE.load_context, NODE.delete_goal, NODE.generate_answer, NODE.clarify_intent, NODE.cancel])],
  [PHASE.showing_exploration_candidates,   buildRouteMap([NODE.extract_goal, NODE.apply_filters, NODE.load_context, NODE.generate_answer, NODE.clarify_intent, NODE.cancel])],
  [PHASE.showing_exploration_facets,       buildRouteMap([NODE.extract_goal, NODE.apply_filters, NODE.load_context, NODE.generate_answer, NODE.clarify_intent, NODE.cancel])],
  [PHASE.clarifying_goal,                  buildRouteMap([NODE.extract_goal, NODE.generate_answer, NODE.clarify_intent, NODE.cancel])],
  [PHASE.showing_goal,                     buildRouteMap([NODE.validate_goal, NODE.extract_goal, NODE.set_goal, NODE.delete_goal, NODE.generate_answer, NODE.clarify_intent, NODE.cancel])],
  [PHASE.asking_after_validate_candidates, buildRouteMap([NODE.set_goal, NODE.extract_goal, NODE.extract_goal, NODE.apply_filters, NODE.generate_answer, NODE.clarify_intent, NODE.cancel])],
  [PHASE.asking_after_validate_facets,     buildRouteMap([NODE.set_goal, NODE.extract_goal, NODE.extract_goal, NODE.apply_filters, NODE.generate_answer, NODE.clarify_intent, NODE.cancel])],
  [PHASE.asking_search_mode,               buildRouteMap([NODE.search_waymates, NODE.search_pathfinders, NODE.extract_goal, NODE.delete_goal, NODE.generate_answer, NODE.clarify_intent, NODE.cancel])],
  [PHASE.showing_waymate_results,          buildRouteMap([NODE.search_waymates, NODE.search_pathfinders, NODE.load_existing_goal, NODE.extract_goal, NODE.delete_goal, NODE.apply_filters, NODE.generate_answer, NODE.show_results, NODE.clarify_intent, NODE.cancel])],
  [PHASE.showing_pathfinder_results,       buildRouteMap([NODE.search_waymates, NODE.search_pathfinders, NODE.load_existing_goal, NODE.extract_goal, NODE.delete_goal, NODE.apply_filters, NODE.generate_answer, NODE.show_results, NODE.clarify_intent, NODE.cancel])],
]);

// Static route maps (not phase-dependent)
export const LOAD_CONTEXT_ROUTE_MAP = buildRouteMap([
  NODE.confirm_adhoc_context,
  NODE.ask_adhoc_context,
  NODE.check_goal,
]);
export const CHECK_GOAL_ROUTE_MAP = buildRouteMap([
  NODE.search_waymates,
  NODE.explore,
  NODE.load_existing_goal,
  NODE.extract_goal,
]);
export const APPLY_FILTERS_ROUTE_MAP = buildRouteMap([NODE.explore, NODE.search_waymates, NODE.search_pathfinders]);

// =============================================================================
// ROUTES: intent → node mapping (factory with state-dependent parameters)
// =============================================================================

export type RouteFlags = {
  canClarify: boolean;
  canChangePosition: boolean;
  hasGoal: boolean;
};

// All valid intents for type-safe key filtering
const ALL_INTENTS: readonly SearchUserIntent[] = [...SIMPLE_INTENTS, ...COMPLEX_INTENTS];
const INTENT_SET = new Set<string>(ALL_INTENTS);

function isSearchUserIntent(key: string): key is SearchUserIntent {
  return INTENT_SET.has(key);
}

/**
 * Get valid intents for a given phase and flags.
 * Used by intent classification prompt to show only valid options.
 */
export function getValidIntentsForPhase(phase: SearchPhase, flags: RouteFlags): SearchUserIntent[] {
  const routes = createIntentRoutes(flags)[phase];
  if (!routes) return [];
  return Object.keys(routes).filter((key) => isSearchUserIntent(key));
}

// Static routes (no flags dependency)
const EXPLORATION_ROUTES: RouteMap = {
  proceed: NODE.extract_goal,
  clarify: NODE.extract_goal,
  setGoal: NODE.extract_goal,
  editAdhoc: NODE.load_context,
  filter: NODE.apply_filters,
  ask: NODE.generate_answer,
  cancel: NODE.cancel,
  unknown: NODE.clarify_intent,
};
const SEARCH_MODE_ROUTES: RouteMap = {
  searchWaymates: NODE.search_waymates,
  searchPathfinders: NODE.search_pathfinders,
  change: NODE.extract_goal,
  delete: NODE.delete_goal,
  ask: NODE.generate_answer,
  cancel: NODE.cancel,
  unknown: NODE.clarify_intent,
};
const RESULTS_ROUTES: RouteMap = {
  searchWaymates: NODE.search_waymates,
  searchPathfinders: NODE.search_pathfinders,
  filter: NODE.apply_filters,
  clarify: NODE.load_existing_goal,
  change: NODE.extract_goal,
  delete: NODE.delete_goal,
  ask: NODE.generate_answer,
  done: NODE.show_results,
  cancel: NODE.cancel,
  unknown: NODE.clarify_intent,
};
// Confirming adhoc context routes (hasGoal-dependent)
const CONFIRMING_WITH_GOAL_ROUTES: RouteMap = {
  searchWaymates: NODE.search_waymates,
  searchPathfinders: NODE.search_pathfinders,
  validate: NODE.validate_goal,
  setGoal: NODE.extract_goal,
  editGoal: NODE.load_existing_goal,
  editAdhoc: NODE.load_context,
  delete: NODE.delete_goal,
  ask: NODE.generate_answer,
  cancel: NODE.cancel,
  unknown: NODE.clarify_intent,
};
const CONFIRMING_NO_GOAL_ROUTES: RouteMap = {
  explore: NODE.explore,
  setGoal: NODE.extract_goal,
  editAdhoc: NODE.load_context,
  ask: NODE.generate_answer,
  cancel: NODE.cancel,
  unknown: NODE.clarify_intent,
};

export function createIntentRoutes(flags: RouteFlags): Partial<Record<SearchPhase, RouteMap>> {
  const { canClarify, canChangePosition, hasGoal } = flags;

  const validateRoutes: RouteMap = {
    save: NODE.set_goal,
    clarify: canClarify ? NODE.extract_goal : NODE.set_goal,
    change: canChangePosition ? NODE.extract_goal : NODE.set_goal,
    filter: NODE.apply_filters,
    ask: NODE.generate_answer,
    cancel: NODE.cancel,
    unknown: NODE.clarify_intent,
  };
  const confirmingRoutes = hasGoal ? CONFIRMING_WITH_GOAL_ROUTES : CONFIRMING_NO_GOAL_ROUTES;
  const goalRoutes: RouteMap = {
    validate: NODE.validate_goal,
    clarify: canClarify ? NODE.extract_goal : NODE.set_goal,
    save: NODE.set_goal,
    delete: NODE.delete_goal,
    ask: NODE.generate_answer,
    cancel: NODE.cancel,
    unknown: NODE.clarify_intent,
  };
  // clarifying_goal: user specifies target position (goal was empty)
  const clarifyingGoalRoutes: RouteMap = {
    clarify: NODE.extract_goal,
    ask: NODE.generate_answer,
    cancel: NODE.cancel,
    unknown: NODE.clarify_intent,
  };

  return {
    [PHASE.confirming_adhoc_context]: confirmingRoutes,
    [PHASE.showing_exploration_candidates]: EXPLORATION_ROUTES,
    [PHASE.showing_exploration_facets]: EXPLORATION_ROUTES,
    [PHASE.clarifying_goal]: clarifyingGoalRoutes,
    [PHASE.showing_goal]: goalRoutes,
    [PHASE.asking_after_validate_candidates]: validateRoutes,
    [PHASE.asking_after_validate_facets]: validateRoutes,
    [PHASE.asking_search_mode]: SEARCH_MODE_ROUTES,
    [PHASE.showing_waymate_results]: RESULTS_ROUTES,
    [PHASE.showing_pathfinder_results]: RESULTS_ROUTES,
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
  ...availableNodesByPhase(PHASE.confirming_adhoc_context),
  ...availableNodesByPhase(PHASE.showing_exploration_candidates),
  ...availableNodesByPhase(PHASE.showing_exploration_facets),
  ...availableNodesByPhase(PHASE.clarifying_goal),
  ...availableNodesByPhase(PHASE.showing_goal),
  ...availableNodesByPhase(PHASE.asking_after_validate_candidates),
  ...availableNodesByPhase(PHASE.asking_after_validate_facets),
  ...availableNodesByPhase(PHASE.asking_search_mode),
  ...availableNodesByPhase(PHASE.showing_waymate_results),
  ...availableNodesByPhase(PHASE.showing_pathfinder_results),
};

export function routeAfterParseSearchIntent(state: SearchStateType): NodeName {
  const { phase, clarifyRound, newPositionRound, searchUserIntent, storedGoal } = state;

  if (phase === PHASE.failed) return NODE.cancel;
  if (!searchUserIntent) throw new AgentInvariantError("routeAfterParseSearchIntent", "searchUserIntent missing");

  const flags: RouteFlags = {
    canClarify: clarifyRound < MAX_CLARIFY_ROUNDS,
    canChangePosition: newPositionRound < MAX_NEW_POSITION_ROUNDS,
    hasGoal: storedGoal !== null,
  };

  const routes = createIntentRoutes(flags);
  const phaseRoutes = routes[phase];
  const defaultRoute = phase === PHASE.showing_goal ? NODE.set_goal : NODE.cancel;

  return phaseRoutes?.[searchUserIntent] ?? defaultRoute;
}

export function routeAfterLoadContext(state: SearchStateType): NodeName {
  if (state.phase === PHASE.asking_adhoc_context) return NODE.ask_adhoc_context;
  if (state.phase === PHASE.confirming_adhoc_context) return NODE.confirm_adhoc_context;
  return NODE.check_goal; // profile flow
}

export function routeAfterCheckGoal(state: SearchStateType): NodeName {
  // If user explicitly wants to set goal, go to extract_goal
  if (state.orchestratorIntent === "setGoal") return NODE.extract_goal;
  return state.storedGoal ? NODE.load_existing_goal : NODE.explore;
}

export function routeAfterApplyFilters(state: SearchStateType): NodeName {
  if (!state.storedGoal) return NODE.explore;
  return state.searchMode === "pathfinders" ? NODE.search_pathfinders : NODE.search_waymates;
}
