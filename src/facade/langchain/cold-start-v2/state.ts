import { Annotation, messagesStateReducer } from "@langchain/langgraph";
import { z } from "zod";

import { PHASE } from "../cold-start/types.js";

import type { Trail, UserContext, UserId } from "../../../shared/schemas.js";
import type { ColdStartPhase, ContextAgenda, CurrentEntityContext, MissingField } from "../cold-start/types.js";
import type { BaseMessage } from "@langchain/core/messages";

export { PHASE } from "../cold-start/types.js";
export type {
  ColdStartPhase,
  ContextAgenda,
  ContextAgendaBase,
  CurrentEntityContext,
  MissingField,
} from "../cold-start/types.js";
export type { Trail, UserContext, UserId } from "../../../shared/schemas.js";

export const decisionSchema = z.object({
  intent: z
    .enum(["approve", "edit", "cancel", "continue"])
    .describe("User intent: approve/edit/cancel for confirmations, continue for story telling"),
  editTarget: z.string().describe("What to edit if intent is 'edit', empty string otherwise"),
  editInstructions: z.string().describe("How to edit if intent is 'edit', empty string otherwise"),
});

export type ParsedDecision = z.infer<typeof decisionSchema>;

const lastValue = <T>(_: T, y: T): T => y;

export const coldStartStateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({ reducer: messagesStateReducer, default: () => [] }),

  userId: Annotation<UserId>({ reducer: lastValue, default: () => "" }),
  phase: Annotation<ColdStartPhase>({ reducer: lastValue, default: () => PHASE.story_gathering }),
  userResponse: Annotation<string>({ reducer: lastValue, default: () => "" }),
  parsedDecision: Annotation<ParsedDecision | null>({ reducer: lastValue, default: () => null }),

  queue: Annotation<ContextAgenda[]>({ reducer: lastValue, default: () => [] }),
  currentContextIndex: Annotation<number>({ reducer: lastValue, default: () => 0 }),

  collectedContexts: Annotation<UserContext[]>({ reducer: lastValue, default: () => [] }),
  collectedTrails: Annotation<Trail[]>({ reducer: lastValue, default: () => [] }),

  pendingContext: Annotation<Partial<UserContext> | null>({ reducer: lastValue, default: () => null }),
  pendingTrails: Annotation<Partial<Trail>[]>({ reducer: lastValue, default: () => [] }),

  missingFields: Annotation<MissingField[]>({ reducer: lastValue, default: () => [] }),
  clarificationRound: Annotation<number>({ reducer: lastValue, default: () => 0 }),
  currentEntityContext: Annotation<CurrentEntityContext | undefined>({ reducer: lastValue }),
});

export type ColdStartStateType = typeof coldStartStateAnnotation.State;
