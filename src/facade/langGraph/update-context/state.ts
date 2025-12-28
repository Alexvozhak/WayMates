import { Annotation, messagesStateReducer } from "@langchain/langgraph";

import { PHASE } from "../shared/phases.js";
import { lastValue } from "../shared/state-utils.js";

import type { Locale, MissingField, UserContext, UserId } from "../../../shared/schemas.js";
import type { ParsedDecision } from "../shared/decision.js";
import type { SimpleConfirmationPhase } from "../shared/phases.js";
import type { ExtractableContext } from "../shared-tools/extraction-models.js";
import type { BaseMessage } from "@langchain/core/messages";

export type UpdateContextPhase = SimpleConfirmationPhase;

/** Node names in update-context graph - single source of truth for graph topology */

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

export type NodeName = (typeof NODE)[keyof typeof NODE];

export const updateContextStateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({ reducer: messagesStateReducer, default: () => [] }),
  userId: Annotation<UserId>({ reducer: lastValue, default: () => "" }),
  locale: Annotation<Locale>({ reducer: lastValue, default: () => "en" }),
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

export { PHASE, simpleConfirmationPhaseSchema as phaseSchema } from "../shared/phases.js";
