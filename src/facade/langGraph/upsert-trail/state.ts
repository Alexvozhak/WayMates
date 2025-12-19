import { Annotation, messagesStateReducer } from "@langchain/langgraph";

import { PHASE } from "../shared/phases.js";
import { lastValue } from "../shared/state-utils.js";

import type { ContextId, MissingField, Trail, UserId } from "../../../shared/schemas.js";
import type { ParsedDecision } from "../shared/decision.js";
import type { SimpleConfirmationPhase } from "../shared/phases.js";
import type { ExtractableTrail } from "../shared-tools/extraction-models.js";
import type { BaseMessage } from "@langchain/core/messages";

export type UpsertTrailPhase = SimpleConfirmationPhase;

/** Node names in upsert-trail graph - single source of truth for graph topology */

export const NODE = {
  extract_trail: "extract_trail",
  validate_trail: "validate_trail",
  clarify: "clarify",
  show_trail: "show_trail",
  parse_decision: "parse_decision",
  edit_trail: "edit_trail",
  persist_trail: "persist_trail",
  cancel: "cancel",
} as const;

export type NodeName = (typeof NODE)[keyof typeof NODE];

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
  missingFields: Annotation<MissingField[]>({ reducer: lastValue, default: () => [] }),
  clarificationRound: Annotation<number>({ reducer: lastValue, default: () => 0 }),
});

export type UpsertTrailStateType = typeof upsertTrailStateAnnotation.State;

export { PHASE, simpleConfirmationPhaseSchema as phaseSchema } from "../shared/phases.js";
