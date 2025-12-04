import { Annotation, messagesStateReducer } from "@langchain/langgraph";

import { lastValue } from "../shared/index.js";

import type { UserContext, UserContextPartial, UserId } from "../../../shared/schemas.js";
import type { ParsedDecision } from "../shared/index.js";
import type { BaseMessage } from "@langchain/core/messages";

export const PHASE = {
  extracting: "extracting",
  awaitingConfirmation: "awaiting_confirmation",
  approved: "approved",
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

  extractedContext: Annotation<UserContextPartial | null>({ reducer: lastValue, default: () => null }),
  validatedContext: Annotation<UserContext | null>({ reducer: lastValue, default: () => null }),

  validationErrors: Annotation<string[]>({ reducer: lastValue, default: () => [] }),
});

export type UpsertContextStateType = typeof upsertContextStateAnnotation.State;
