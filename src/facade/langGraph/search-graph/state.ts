import { Annotation, messagesStateReducer } from "@langchain/langgraph";

import { lastValue } from "../shared/state-utils.js";

import type { CurrentSearchParamsWithFeedback, TargetSearchParamsWithFeedback } from "./types.js";
import type {
  AdhocUserContext,
  CurrentSearchParamsBase,
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
  exploring: "exploring",
  showingExploration: "showing_exploration",
  extractingGoal: "extracting_goal",
  showingGoal: "showing_goal",
  clarifyingGoal: "clarifying_goal",
  validatingGoal: "validating_goal",
  askingAfterValidate: "asking_after_validate",
  settingGoal: "setting_goal",
  deletingGoal: "deleting_goal",
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
  explore: "explore",
  show_exploration: "show_exploration",
  extract_goal: "extract_goal",
  show_goal: "show_goal",
  clarify_goal: "clarify_goal",
  validate_goal: "validate_goal",
  ask_after_validate: "ask_after_validate",
  load_existing_goal: "load_existing_goal",
  set_goal: "set_goal",
  delete_goal: "delete_goal",
  search: "search",
  show_results: "show_results",
  apply_filters: "apply_filters",
  cancel: "cancel",
} as const;
/* eslint-enable @typescript-eslint/naming-convention */

export type NodeName = (typeof NODE)[keyof typeof NODE];

export type SearchUserIntent =
  | "proceed"
  | "validate"
  | "clarify"
  | "save"
  | "change"
  | "delete"
  | "filter"
  | "cancel"
  | "unknown";

export const searchStateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({ reducer: messagesStateReducer, default: () => [] }),
  userId: Annotation<UserId>({ reducer: lastValue, default: () => "" }),
  phase: Annotation<SearchPhase>({ reducer: lastValue, default: () => PHASE.checkingGoal }),
  userResponse: Annotation<string>({ reducer: lastValue, default: () => "" }),
  intent: Annotation<UserIntent | null>({ reducer: lastValue, default: () => null }),

  // Context for search: either from DB (userContext) or extracted from message (adhocContext)
  userContext: Annotation<UserContext | null>({ reducer: lastValue, default: () => null }),
  adhocContext: Annotation<AdhocUserContext | null>({ reducer: lastValue, default: () => null }),
  userTrajectory: Annotation<UserContext[]>({ reducer: lastValue, default: () => [] }),

  existingGoal: Annotation<Goal | null>({ reducer: lastValue, default: () => null }),
  extractedGoal: Annotation<TargetContext | null>({ reducer: lastValue, default: () => null }),
  targetSearchParams: Annotation<TargetSearchParamsWithFeedback | null>({ reducer: lastValue, default: () => null }),
  currentSearchParams: Annotation<CurrentSearchParamsBase | null>({ reducer: lastValue, default: () => null }),
  appliedFilters: Annotation<CurrentSearchParamsWithFeedback | null>({ reducer: lastValue, default: () => null }),

  clarifyRound: Annotation<number>({ reducer: lastValue, default: () => 0 }),
  newPositionRound: Annotation<number>({ reducer: lastValue, default: () => 0 }),
  clarificationText: Annotation<string | null>({ reducer: lastValue, default: () => null }),

  explorationResults: Annotation<ScoredMatchedCandidate[]>({ reducer: lastValue, default: () => [] }),
  validationResults: Annotation<MatchedCandidateWithPath[]>({ reducer: lastValue, default: () => [] }),
  searchResults: Annotation<ScoredMatchedCandidate[]>({ reducer: lastValue, default: () => [] }),
  chartUrl: Annotation<string | null>({ reducer: lastValue, default: () => null }),

  searchUserIntent: Annotation<SearchUserIntent | null>({ reducer: lastValue, default: () => null }),
});

export type SearchStateType = typeof searchStateAnnotation.State;

export const MAX_CLARIFY_ROUNDS = 3;
export const MAX_NEW_POSITION_ROUNDS = 2;

export const OPTIONS = {
  showExploration: ["proceed", "filter", "cancel"],
  showGoal: ["validate", "clarify", "save", "cancel"],
  askAfterValidate: ["save", "change", "cancel"],
  showResults: ["change", "delete", "filter", "cancel"],
};
