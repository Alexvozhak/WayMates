import { Annotation, messagesStateReducer } from "@langchain/langgraph";

import { PHASE } from "../shared/phases.js";
import { lastValue } from "../shared/state-utils.js";

import type { Locale, MissingField, UserContext, UserId } from "../../../../private/schemas.js";
import type { ParsedDecision } from "../shared/decision.js";
import type { SimpleConfirmationPhase } from "../shared/phases.js";
import type { ExtractableContext } from "../shared-tools/extraction-models.js";
import type { BaseMessage } from "@langchain/core/messages";

export type UpsertContextPhase = SimpleConfirmationPhase;

export const NODE = {
  extract_context: "extract_context",
  validate_context: "validate_context",
  clarify: "clarify",
  show_context: "show_context",
  parse_decision: "parse_decision",
  edit_context: "edit_context",
  persist_context: "persist_context",
  cancel: "cancel",
} as const;

export type NodeName = (typeof NODE)[keyof typeof NODE];

export const upsertContextStateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({ reducer: messagesStateReducer, default: () => [] }),
  userId: Annotation<UserId>({ reducer: lastValue, default: () => "" }),
  locale: Annotation<Locale>({ reducer: lastValue, default: () => "en" }),
  phase: Annotation<UpsertContextPhase>({ reducer: lastValue, default: () => PHASE.extracting }),
  userResponse: Annotation<string>({ reducer: lastValue, default: () => "" }),
  parsedDecision: Annotation<ParsedDecision | null>({ reducer: lastValue, default: () => null }),

  extractedContext: Annotation<ExtractableContext | null>({ reducer: lastValue, default: () => null }),
  validatedContext: Annotation<UserContext | null>({ reducer: lastValue, default: () => null }),

  validationErrors: Annotation<string[]>({ reducer: lastValue, default: () => [] }),
  missingFields: Annotation<MissingField[]>({ reducer: lastValue, default: () => [] }),
  clarificationRound: Annotation<number>({ reducer: lastValue, default: () => 0 }),
});

export type UpsertContextStateType = typeof upsertContextStateAnnotation.State;

export { PHASE, simpleConfirmationPhaseSchema as phaseSchema } from "../shared/phases.js";
