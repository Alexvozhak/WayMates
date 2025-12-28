import { Annotation, messagesStateReducer } from "@langchain/langgraph";

import { lastValue } from "../shared/state-utils.js";

import { PHASE } from "./types.js";

import type { ColdStartPhase, CurrentEntityContext, ParsedDecision } from "./types.js";
import type {
  ContextAgenda,
  ContextOptionalField,
  Locale,
  MissingField,
  Trail,
  UserContext,
  UserId,
} from "../../../shared/schemas.js";
import type { ExtractableContext, ExtractableTrail } from "../shared-tools/extraction-models.js";
import type { BaseMessage } from "@langchain/core/messages";

export { PHASE } from "./types.js";
export type { ColdStartPhase, CurrentEntityContext, ParsedDecision } from "./types.js";
export type {
  ContextAgenda,
  ContextAgendaBase,
  Locale,
  MissingField,
  Trail,
  UserContext,
  UserId,
} from "../../../shared/schemas.js";

export const coldStartStateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({ reducer: messagesStateReducer, default: () => [] }),

  userId: Annotation<UserId>({ reducer: lastValue, default: () => "" }),
  locale: Annotation<Locale>({ reducer: lastValue, default: () => "en" }),
  phase: Annotation<ColdStartPhase>({ reducer: lastValue, default: () => PHASE.story_gathering }),
  userResponse: Annotation<string>({ reducer: lastValue, default: () => "" }),
  cvText: Annotation<string | null>({ reducer: lastValue, default: () => null }),
  parsedDecision: Annotation<ParsedDecision | null>({ reducer: lastValue, default: () => null }),

  queue: Annotation<ContextAgenda[]>({ reducer: lastValue, default: () => [] }),
  currentContextIndex: Annotation<number>({ reducer: lastValue, default: () => 0 }),

  collectedContexts: Annotation<UserContext[]>({ reducer: lastValue, default: () => [] }),
  collectedTrails: Annotation<Trail[]>({ reducer: lastValue, default: () => [] }),

  pendingContext: Annotation<ExtractableContext | null>({ reducer: lastValue, default: () => null }),
  pendingTrails: Annotation<ExtractableTrail[]>({ reducer: lastValue, default: () => [] }),

  missingFields: Annotation<MissingField[]>({ reducer: lastValue, default: () => [] }),
  optionalFields: Annotation<ContextOptionalField[]>({ reducer: lastValue, default: () => [] }),
  clarificationRound: Annotation<number>({ reducer: lastValue, default: () => 0 }),
  currentEntityContext: Annotation<CurrentEntityContext | undefined>({ reducer: lastValue }),
});

export type ColdStartStateType = typeof coldStartStateAnnotation.State;
