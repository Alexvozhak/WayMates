import { MAX_CLARIFY_ROUNDS, MAX_NEW_POSITION_ROUNDS, NODE, PHASE } from "./state.js";

import type { NodeName, SearchStateType } from "./state.js";

export function routeAfterCheckGoal(state: SearchStateType): NodeName {
  if (state.existingGoal) {
    return NODE.ask_with_goal;
  }
  return NODE.ask_no_goal;
}

export function routeAfterAskWithGoal(state: SearchStateType): NodeName {
  const { searchUserIntent } = state;

  switch (searchUserIntent) {
    case "search": {
      return NODE.search;
    }
    case "validate": {
      return NODE.validate_goal;
    }
    case "change": {
      return NODE.extract_goal;
    }
    case "explore": {
      return NODE.search;
    }
    case "cancel": {
      return NODE.cancel;
    }
    default: {
      return NODE.search;
    }
  }
}

export function routeAfterAskNoGoal(state: SearchStateType): NodeName {
  const { searchUserIntent } = state;

  switch (searchUserIntent) {
    case "confirm": {
      return NODE.extract_goal;
    }
    case "explore": {
      return NODE.search;
    }
    case "cancel": {
      return NODE.cancel;
    }
    default: {
      return NODE.extract_goal;
    }
  }
}

export function routeAfterShowGoal(state: SearchStateType): NodeName {
  const { searchUserIntent } = state;

  switch (searchUserIntent) {
    case "clarify": {
      if (state.clarifyRound >= MAX_CLARIFY_ROUNDS) {
        return NODE.confirm_goal;
      }
      return NODE.clarify_goal;
    }
    case "validate": {
      return NODE.validate_goal;
    }
    case "confirm": {
      return NODE.confirm_goal;
    }
    case "cancel": {
      return NODE.cancel;
    }
    default: {
      return NODE.confirm_goal;
    }
  }
}

export function routeAfterAskAfterValidate(state: SearchStateType): NodeName {
  const { searchUserIntent } = state;

  switch (searchUserIntent) {
    case "confirm": {
      return NODE.confirm_goal;
    }
    case "clarify": {
      if (state.clarifyRound >= MAX_CLARIFY_ROUNDS) {
        return NODE.confirm_goal;
      }
      return NODE.clarify_goal;
    }
    case "change": {
      if (state.newPositionRound >= MAX_NEW_POSITION_ROUNDS) {
        return NODE.confirm_goal;
      }
      return NODE.extract_goal;
    }
    case "cancel": {
      return NODE.cancel;
    }
    default: {
      return NODE.confirm_goal;
    }
  }
}

export function routeAfterConfirmGoal(state: SearchStateType): NodeName {
  const { searchUserIntent } = state;

  if (searchUserIntent === "confirm") {
    return NODE.set_goal;
  }
  if (searchUserIntent === "cancel") {
    return NODE.cancel;
  }
  return NODE.show_goal;
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
