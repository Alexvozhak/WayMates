import { MessagesZodState } from "@langchain/langgraph";
import { z } from "zod";

import { contextAgendaSchema, missingFieldSchema, trailSchema, userContextSchema } from "../../../shared/schemas.js";

export const coldStartPhaseSchema = z.enum([
  "story_gathering",
  "awaiting_plan_confirmation",
  "awaiting_clarification",
  "awaiting_context_confirmation",
  "awaiting_final_confirmation",
  "saved",
  "already_saved",
  "failed",
]);

export type ColdStartPhase = z.infer<typeof coldStartPhaseSchema>;

/** Alias for coldStartPhaseSchema.Values for shorter access: PHASE.failed */
export const PHASE = coldStartPhaseSchema.Values;

/* eslint-disable @typescript-eslint/naming-convention -- node names must match LangGraph API (snake_case) */
export const NODE = {
  gather_story: "gather_story",
  parse_story_decision: "parse_story_decision",
  plan_career: "plan_career",
  show_plan: "show_plan",
  parse_plan_decision: "parse_plan_decision",
  extract_context: "extract_context",
  validate_context: "validate_context",
  clarify: "clarify",
  show_context: "show_context",
  parse_context_decision: "parse_context_decision",
  edit_context: "edit_context",
  next_context: "next_context",
  show_final: "show_final",
  parse_final_decision: "parse_final_decision",
  persist: "persist",
  cancel: "cancel",
} as const;
/* eslint-enable @typescript-eslint/naming-convention */

export type NodeName = (typeof NODE)[keyof typeof NODE];

export const currentEntityContextSchema = z.object({
  contextIndex: z.number().describe("Index in queue (0-based)"),
  preview: z.string().describe("Preview string for the current context"),
});

export type CurrentEntityContext = z.infer<typeof currentEntityContextSchema>;

export const coldStartStateSchema = z.object({
  messages: MessagesZodState.shape.messages,

  phase: coldStartPhaseSchema.default("story_gathering"),

  queue: z.array(contextAgendaSchema).default([]),

  collectedContexts: z.array(userContextSchema).default([]),
  collectedTrails: z.array(trailSchema).default([]),

  missingFields: z.array(missingFieldSchema).default([]),
  clarificationRound: z.number().default(0),

  currentEntityContext: currentEntityContextSchema.optional(),

  userId: z.string(),

  userResponse: z
    .string()
    .optional()
    .describe("User response after interrupt - Agent parses NLP and decides next tool"),
});

export type ColdStartState = z.infer<typeof coldStartStateSchema>;
