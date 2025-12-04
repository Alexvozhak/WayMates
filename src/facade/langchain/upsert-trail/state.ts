import { Annotation, messagesStateReducer } from "@langchain/langgraph";

import { lastValue } from "../shared/index.js";

import type { ContextId, Trail, UserId } from "../../../shared/schemas.js";
import type { ParsedDecision } from "../shared/index.js";
import type { ExtractableTrail } from "../shared-tools/extraction-models.js";
import type { BaseMessage } from "@langchain/core/messages";

export const PHASE = {
  extracting: "extracting",
  awaitingConfirmation: "awaiting_confirmation",
  approved: "approved",
  cancelled: "cancelled",
  failed: "failed",
} as const;

export type UpsertTrailPhase = (typeof PHASE)[keyof typeof PHASE];

export const upsertTrailStateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({ reducer: messagesStateReducer, default: () => [] }),
  userId: Annotation<UserId>({ reducer: lastValue, default: () => "" }),
  phase: Annotation<UpsertTrailPhase>({ reducer: lastValue, default: () => PHASE.extracting }),
  userResponse: Annotation<string>({ reducer: lastValue, default: () => "" }),
  parsedDecision: Annotation<ParsedDecision | null>({ reducer: lastValue, default: () => null }),

  fromContextId: Annotation<ContextId | null>({ reducer: lastValue, default: () => null }),

  extractedTrail: Annotation<ExtractableTrail | null>({ reducer: lastValue, default: () => null }),
  validatedTrail: Annotation<Trail | null>({ reducer: lastValue, default: () => null }),

  validationErrors: Annotation<string[]>({ reducer: lastValue, default: () => [] }),
});

export type UpsertTrailStateType = typeof upsertTrailStateAnnotation.State;
