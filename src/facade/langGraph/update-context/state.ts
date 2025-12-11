import { Annotation, messagesStateReducer } from "@langchain/langgraph";

import { lastValue } from "../shared/state-utils.js";

import type { MissingField, UserContext, UserId } from "../../../shared/schemas.js";
import type { ParsedDecision } from "../shared/decision.js";
import type { ExtractableContext } from "../shared-tools/extraction-models.js";
import type { BaseMessage } from "@langchain/core/messages";

export const PHASE = {
  extracting: "extracting",
  awaitingClarification: "awaiting_clarification",
  awaitingConfirmation: "awaiting_confirmation",
  saved: "saved",
  cancelled: "cancelled",
  failed: "failed",
} as const;

export type UpdateContextPhase = (typeof PHASE)[keyof typeof PHASE];

/** Node names in update-context graph - single source of truth for graph topology */
/* eslint-disable @typescript-eslint/naming-convention -- node names must match LangGraph API (snake_case) */
export const NODE = {
  extract_updates: "extract_updates",
  merge_context: "merge_context",
  clarify: "clarify",
  show_update: "show_update",
  parse_decision: "parse_decision",
  edit_update: "edit_update",
  persist_update: "persist_update",
  cancel: "cancel",
} as const;
/* eslint-enable @typescript-eslint/naming-convention */

export type NodeName = (typeof NODE)[keyof typeof NODE];

export const updateContextStateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({ reducer: messagesStateReducer, default: () => [] }),
  userId: Annotation<UserId>({ reducer: lastValue, default: () => "" }),
  phase: Annotation<UpdateContextPhase>({ reducer: lastValue, default: () => PHASE.extracting }),
  userResponse: Annotation<string>({ reducer: lastValue, default: () => "" }),
  parsedDecision: Annotation<ParsedDecision | null>({ reducer: lastValue, default: () => null }),

  currentContext: Annotation<UserContext | null>({ reducer: lastValue, default: () => null }),
  extractedUpdates: Annotation<ExtractableContext | null>({ reducer: lastValue, default: () => null }),
  mergedContext: Annotation<UserContext | null>({ reducer: lastValue, default: () => null }),

  validationErrors: Annotation<string[]>({ reducer: lastValue, default: () => [] }),
  missingFields: Annotation<MissingField[]>({ reducer: lastValue, default: () => [] }),
  clarificationRound: Annotation<number>({ reducer: lastValue, default: () => 0 }),
});

export type UpdateContextStateType = typeof updateContextStateAnnotation.State;
