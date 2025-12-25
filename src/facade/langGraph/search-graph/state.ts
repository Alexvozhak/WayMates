import { Annotation, messagesStateReducer } from "@langchain/langgraph";
import { z } from "zod";

import { lastValue } from "../shared/state-utils.js";

import type { CurrentSearchParamsWithFeedback, TargetSearchParamsWithFeedback } from "./types.js";
import type {
  AdhocContextBase,
  CandidateFacets,
  Goal,
  MatchedCandidateWithPath,
  ScoredMatchedCandidate,
  TargetContext,
  UserContext,
  UserId,
} from "../../../shared/schemas.js";
import type { UserIntent } from "../../services/orchestrator/intent-classifier.js";
import type { BaseMessage } from "@langchain/core/messages";

export const searchPhaseSchema = z.enum([
  "asking_adhoc_context",
  "confirming_adhoc_context",
  "checking_goal",
  "exploring",
  "showing_exploration_candidates",
  "showing_exploration_facets",
  "extracting_goal",
  "showing_goal",
  "clarifying_goal",
  "validating_goal",
  "asking_after_validate_candidates",
  "asking_after_validate_facets",
  "setting_goal",
  "deleting_goal",
  "searching",
  "showing_results",
  "advising",
  "cancelled",
  "failed",
]);

export type SearchPhase = z.infer<typeof searchPhaseSchema>;

export const PHASE = searchPhaseSchema.Values;

export const NODE = {
  load_context: "load_context",
  ask_adhoc_context: "ask_adhoc_context",
  confirm_adhoc_context: "confirm_adhoc_context",
  check_goal: "check_goal",
  explore: "explore",
  show_exploration: "show_exploration",
  parse_search_intent: "parse_search_intent",
  clarify_intent: "clarify_intent",
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
  generate_answer: "generate_answer",
  show_answer: "show_answer",
  parse_advisor_intent: "parse_advisor_intent",
  cancel: "cancel",
} as const;

export type NodeName = (typeof NODE)[keyof typeof NODE];

export type SearchUserIntent =
  | "proceed"
  | "validate"
  | "clarify"
  | "save"
  | "change"
  | "delete"
  | "filter"
  | "ask"
  | "cancel"
  | "unknown";

export type AdvisorIntent = "ask" | "done";

export const searchStateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({ reducer: messagesStateReducer, default: () => [] }),
  userId: Annotation<UserId>({ reducer: lastValue, default: () => "" }),
  phase: Annotation<SearchPhase>({ reducer: lastValue, default: () => PHASE.checking_goal }),
  userResponse: Annotation<string>({ reducer: lastValue, default: () => "" }),
  orchestratorIntent: Annotation<UserIntent | null>({ reducer: lastValue, default: () => null }),

  // Context for search: either from DB (userContext) or extracted from message (adhocContext)
  userContext: Annotation<UserContext | null>({ reducer: lastValue, default: () => null }),
  adhocContext: Annotation<AdhocContextBase | null>({ reducer: lastValue, default: () => null }),
  userTrajectory: Annotation<UserContext[]>({ reducer: lastValue, default: () => [] }),

  storedGoal: Annotation<Goal | null>({ reducer: lastValue, default: () => null }),
  extractedGoal: Annotation<TargetContext | null>({ reducer: lastValue, default: () => null }),
  targetSearchParams: Annotation<TargetSearchParamsWithFeedback | null>({ reducer: lastValue, default: () => null }),
  currentSearchParams: Annotation<CurrentSearchParamsWithFeedback | null>({ reducer: lastValue, default: () => null }),

  clarifyRound: Annotation<number>({ reducer: lastValue, default: () => 0 }),
  newPositionRound: Annotation<number>({ reducer: lastValue, default: () => 0 }),
  clarificationText: Annotation<string | null>({ reducer: lastValue, default: () => null }),

  explorationResults: Annotation<ScoredMatchedCandidate[]>({ reducer: lastValue, default: () => [] }),
  validationResults: Annotation<MatchedCandidateWithPath[]>({ reducer: lastValue, default: () => [] }),
  searchResults: Annotation<ScoredMatchedCandidate[]>({ reducer: lastValue, default: () => [] }),
  chartUrl: Annotation<string | null>({ reducer: lastValue, default: () => null }),
  facets: Annotation<CandidateFacets | null>({ reducer: lastValue, default: () => null }),

  searchUserIntent: Annotation<SearchUserIntent | null>({ reducer: lastValue, default: () => null }),

  // Advisor mode state
  advisorIntent: Annotation<AdvisorIntent | null>({ reducer: lastValue, default: () => null }),
  advisorQuestion: Annotation<string | null>({ reducer: lastValue, default: () => null }),
  currentAnswer: Annotation<string | null>({ reducer: lastValue, default: () => null }),
});

export type SearchStateType = typeof searchStateAnnotation.State;

export const MAX_CLARIFY_ROUNDS = 3;
export const MAX_NEW_POSITION_ROUNDS = 2;
