import { Annotation, messagesStateReducer } from "@langchain/langgraph";

import { lastValue } from "../shared/state-utils.js";

import type { UserContext, UserId } from "../../../shared/schemas.js";
import type { MissingField } from "../cold-start-v2/types.js";
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

export type UpsertContextPhase = (typeof PHASE)[keyof typeof PHASE];

export const upsertContextStateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({ reducer: messagesStateReducer, default: () => [] }),
  userId: Annotation<UserId>({ reducer: lastValue, default: () => "" }),
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
