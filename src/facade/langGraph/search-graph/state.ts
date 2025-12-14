import { Annotation, messagesStateReducer } from "@langchain/langgraph";

import { lastValue } from "../shared/state-utils.js";

import type {
  AdhocUserContext,
  Goal,
  MatchedCandidateWithPath,
  ScoredMatchedCandidate,
  TargetContext,
  UserContext,
  UserId,
} from "../../../shared/schemas.js";
import type { UserIntent } from "../../services/orchestrator/intent-classifier.js";
import type { BaseMessage } from "@langchain/core/messages";

export const PHASE = {
  checkingGoal: "checking_goal",
  askingWithGoal: "asking_with_goal",
  askingNoGoal: "asking_no_goal",
  extractingGoal: "extracting_goal",
  showingGoal: "showing_goal",
  clarifyingGoal: "clarifying_goal",
  validatingGoal: "validating_goal",
  askingAfterValidate: "asking_after_validate",
  confirmingGoal: "confirming_goal",
  settingGoal: "setting_goal",
  searching: "searching",
  showingResults: "showing_results",
  cancelled: "cancelled",
  failed: "failed",
} as const;

export type SearchPhase = (typeof PHASE)[keyof typeof PHASE];

/* eslint-disable @typescript-eslint/naming-convention -- node names must match LangGraph API (snake_case) */
export const NODE = {
  load_context: "load_context",
  check_goal: "check_goal",
  ask_with_goal: "ask_with_goal",
  ask_no_goal: "ask_no_goal",
  extract_goal: "extract_goal",
  show_goal: "show_goal",
  clarify_goal: "clarify_goal",
  validate_goal: "validate_goal",
  ask_after_validate: "ask_after_validate",
  confirm_goal: "confirm_goal",
  set_goal: "set_goal",
  search: "search",
  show_results: "show_results",
  cancel: "cancel",
} as const;
/* eslint-enable @typescript-eslint/naming-convention */

export type NodeName = (typeof NODE)[keyof typeof NODE];

export type SearchUserIntent =
  | "search"
  | "validate"
  | "change"
  | "explore"
  | "clarify"
  | "confirm"
  | "cancel";

export const searchStateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({ reducer: messagesStateReducer, default: () => [] }),
  userId: Annotation<UserId>({ reducer: lastValue, default: () => "" }),
  phase: Annotation<SearchPhase>({ reducer: lastValue, default: () => PHASE.checkingGoal }),
  userResponse: Annotation<string>({ reducer: lastValue, default: () => "" }),
  intent: Annotation<UserIntent | null>({ reducer: lastValue, default: () => null }),

  // Context for search: either from DB (userContext) or extracted from message (adhocContext)
  userContext: Annotation<UserContext | null>({ reducer: lastValue, default: () => null }),
  adhocContext: Annotation<AdhocUserContext | null>({ reducer: lastValue, default: () => null }),

  existingGoal: Annotation<Goal | null>({ reducer: lastValue, default: () => null }),
  extractedGoal: Annotation<TargetContext | null>({ reducer: lastValue, default: () => null }),

  clarifyRound: Annotation<number>({ reducer: lastValue, default: () => 0 }),
  newPositionRound: Annotation<number>({ reducer: lastValue, default: () => 0 }),

  validationResults: Annotation<MatchedCandidateWithPath[]>({ reducer: lastValue, default: () => [] }),
  searchResults: Annotation<ScoredMatchedCandidate[]>({ reducer: lastValue, default: () => [] }),

  searchUserIntent: Annotation<SearchUserIntent | null>({ reducer: lastValue, default: () => null }),
});

export type SearchStateType = typeof searchStateAnnotation.State;

export const MAX_CLARIFY_ROUNDS = 3;
export const MAX_NEW_POSITION_ROUNDS = 2;
