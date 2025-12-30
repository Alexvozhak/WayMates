import { Annotation, messagesStateReducer } from "@langchain/langgraph";
import { z } from "zod";

import { lastValue } from "../shared/state-utils.js";

import type { CurrentSearchParamsWithFeedback, TargetSearchParamsWithFeedback } from "./types.js";
import type {
  AdhocContextBase,
  AdhocMissingField,
  AdhocOptionalField,
  CandidateFacets,
  Goal,
  Locale,
  MatchedCandidateWithPath,
  PathfinderCandidate,
  TargetContext,
  UserContext,
  UserId,
  WaymateCandidate,
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
  "asking_search_mode",
  "deleting_goal",
  "searching",
  "showing_waymate_results",
  "showing_pathfinder_results",
  "showing_results_facets",
  "advising",
  "cancelled",
  "failed",
]);

export type SearchPhase = z.infer<typeof searchPhaseSchema>;

export const PHASE = searchPhaseSchema.Values;

export const nodeSchema = z.enum([
  "load_context",
  "ask_adhoc_context",
  "confirm_adhoc_context",
  "check_goal",
  "explore",
  "show_exploration",
  "parse_search_intent",
  "clarify_intent",
  "extract_goal",
  "show_goal",
  "clarify_goal",
  "validate_goal",
  "ask_after_validate",
  "load_existing_goal",
  "set_goal",
  "ask_search_mode",
  "delete_goal",
  "search_waymates",
  "search_pathfinders",
  "show_results",
  "apply_filters",
  "generate_answer",
  "show_answer",
  "parse_advisor_intent",
  "cancel",
]);

export type NodeName = z.infer<typeof nodeSchema>;
export const NODE = nodeSchema.Values;

// Intent arrays - single source of truth for both Zod schema and prompts
// Simple: no extra fields in schema
export const SIMPLE_INTENTS = [
  "proceed",
  "explore",
  "save",
  "change",
  "delete",
  "searchWaymates",
  "searchPathfinders",
  "setGoal",
  "editGoal",
  "editAdhoc",
  "cancel",
  "unknown",
] as const;
// Complex: have extra fields (filters, question)
export const COMPLEX_INTENTS = ["validate", "clarify", "filter", "ask"] as const;

export type SimpleIntent = (typeof SIMPLE_INTENTS)[number];
export type ComplexIntent = (typeof COMPLEX_INTENTS)[number];
export type SearchUserIntent = SimpleIntent | ComplexIntent;

export type SearchMode = "waymates" | "pathfinders";

export type AdvisorIntent = "ask" | "action" | "done";

export const searchStateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({ reducer: messagesStateReducer, default: () => [] }),
  userId: Annotation<UserId>({ reducer: lastValue, default: () => "" }),
  locale: Annotation<Locale>({ reducer: lastValue, default: () => "en" }),
  phase: Annotation<SearchPhase>({ reducer: lastValue, default: () => PHASE.checking_goal }),
  previousPhase: Annotation<SearchPhase | null>({ reducer: lastValue, default: () => null }),
  userResponse: Annotation<string>({ reducer: lastValue, default: () => "" }),
  orchestratorIntent: Annotation<UserIntent | null>({ reducer: lastValue, default: () => null }),

  // Context for search: either from DB (userContext) or extracted from message (adhocContext)
  userContext: Annotation<UserContext | null>({ reducer: lastValue, default: () => null }),
  adhocContext: Annotation<AdhocContextBase | null>({ reducer: lastValue, default: () => null }),
  missingFields: Annotation<AdhocMissingField[]>({ reducer: lastValue, default: () => [] }),
  optionalFields: Annotation<AdhocOptionalField[]>({ reducer: lastValue, default: () => [] }),
  userTrajectory: Annotation<UserContext[]>({ reducer: lastValue, default: () => [] }),

  storedGoal: Annotation<Goal | null>({ reducer: lastValue, default: () => null }),
  extractedGoal: Annotation<TargetContext | null>({ reducer: lastValue, default: () => null }),
  targetSearchParams: Annotation<TargetSearchParamsWithFeedback | null>({ reducer: lastValue, default: () => null }),
  currentSearchParams: Annotation<CurrentSearchParamsWithFeedback | null>({ reducer: lastValue, default: () => null }),

  clarifyRound: Annotation<number>({ reducer: lastValue, default: () => 0 }),
  newPositionRound: Annotation<number>({ reducer: lastValue, default: () => 0 }),

  explorationResults: Annotation<WaymateCandidate[]>({ reducer: lastValue, default: () => [] }),
  validationResults: Annotation<MatchedCandidateWithPath[]>({ reducer: lastValue, default: () => [] }),
  searchResults: Annotation<WaymateCandidate[]>({ reducer: lastValue, default: () => [] }),
  pathfinderResults: Annotation<PathfinderCandidate[]>({ reducer: lastValue, default: () => [] }),
  chartUrl: Annotation<string | null>({ reducer: lastValue, default: () => null }),
  facets: Annotation<CandidateFacets | null>({ reducer: lastValue, default: () => null }),

  searchUserIntent: Annotation<SearchUserIntent | null>({ reducer: lastValue, default: () => null }),
  searchMode: Annotation<SearchMode | null>({ reducer: lastValue, default: () => null }),

  // Advisor mode state
  advisorIntent: Annotation<AdvisorIntent | null>({ reducer: lastValue, default: () => null }),
  advisorQuestion: Annotation<string | null>({ reducer: lastValue, default: () => null }),
  currentAnswer: Annotation<string | null>({ reducer: lastValue, default: () => null }),
});

export type SearchStateType = typeof searchStateAnnotation.State;

export const MAX_CLARIFY_ROUNDS = 3;
export const MAX_NEW_POSITION_ROUNDS = 2;
