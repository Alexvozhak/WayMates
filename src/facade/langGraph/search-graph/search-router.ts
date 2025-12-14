import { MAX_CLARIFY_ROUNDS, MAX_NEW_POSITION_ROUNDS, NODE, PHASE } from "./state.js";

import type { NodeName, SearchStateType } from "./state.js";

export function routeAfterCheckGoal(state: SearchStateType): NodeName {
  if (state.existingGoal) {
    return NODE.search;
  }
  return NODE.explore;
}

export function routeAfterShowExploration(state: SearchStateType): NodeName {
  const { searchUserIntent } = state;

  if (searchUserIntent === "cancel") {
    return NODE.cancel;
  }
  return NODE.extract_goal;
}

export function routeAfterShowGoal(state: SearchStateType): NodeName {
  const { searchUserIntent } = state;

  switch (searchUserIntent) {
    case "validate": {
      return NODE.validate_goal;
    }
    case "clarify": {
      if (state.clarifyRound >= MAX_CLARIFY_ROUNDS) {
        return NODE.set_goal;
      }
      return NODE.clarify_goal;
    }
    case "save": {
      return NODE.set_goal;
    }
    case "cancel": {
      return NODE.cancel;
    }
    default: {
      return NODE.set_goal;
    }
  }
}

export function routeAfterAskAfterValidate(state: SearchStateType): NodeName {
  const { searchUserIntent } = state;

  switch (searchUserIntent) {
    case "save": {
      return NODE.set_goal;
    }
    case "change": {
      if (state.newPositionRound >= MAX_NEW_POSITION_ROUNDS) {
        return NODE.set_goal;
      }
      return NODE.extract_goal;
    }
    case "cancel": {
      return NODE.cancel;
    }
    default: {
      return NODE.set_goal;
    }
  }
}

export function routeAfterShowResults(state: SearchStateType): NodeName {
  const { searchUserIntent } = state;

  switch (searchUserIntent) {
    case "refine": {
      return NODE.load_existing_goal;
    }
    case "delete": {
      return NODE.delete_goal;
    }
    case "cancel": {
      return NODE.cancel;
    }
    default: {
      return NODE.cancel;
    }
  }
}

/* eslint-disable @typescript-eslint/consistent-type-assertions -- LangGraph route map pattern */
export function buildRouteMap(routing: NodeName[]): Record<NodeName, NodeName> {
  const entries = routing.map((n) => [n, n] as const);
  const record: Partial<Record<NodeName, NodeName>> = Object.fromEntries(entries);
  return record as Record<NodeName, NodeName>;
}
/* eslint-enable @typescript-eslint/consistent-type-assertions */

export function isTerminalPhase(phase: SearchStateType["phase"]): boolean {
  return phase === PHASE.showingResults || phase === PHASE.cancelled || phase === PHASE.failed;
}
