import { MessagesZodState } from "@langchain/langgraph";
import { z } from "zod";

import {
  contextAgendaSchema,
  contextOptionalFieldSchema,
  missingFieldSchema,
  trailSchema,
  userContextSchema,
} from "../../../shared/schemas.js";

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

export const NODE = {
  gather_story: "gather_story",
  parse_story_decision: "parse_story_decision",
  plan_career: "plan_career",
  show_plan: "show_plan",
  parse_plan_decision: "parse_plan_decision",
  extract_context: "extract_context",
  validate_context: "validate_context",
  clarify_fields: "clarify_fields",
  clarify_intent: "clarify_intent",
  show_context: "show_context",
  parse_context_decision: "parse_context_decision",
  edit_context: "edit_context",
  next_context: "next_context",
  show_final: "show_final",
  parse_final_decision: "parse_final_decision",
  persist: "persist",
  cancel: "cancel",
} as const;

export type NodeName = (typeof NODE)[keyof typeof NODE];

export const currentEntityContextSchema = z.object({
  contextIndex: z.number().describe("Index in queue (0-based)"),
  preview: z.string().describe("Preview string for the current context"),
});

export type CurrentEntityContext = z.infer<typeof currentEntityContextSchema>;

export const decisionSchema = z.object({
  intent: z.enum(["approve", "edit", "cancel", "continue", "unknown"]),
  editTarget: z.string(),
  editInstructions: z.string(),
});

export type ParsedDecision = z.infer<typeof decisionSchema>;

export const coldStartStateSchema = z.object({
  messages: MessagesZodState.shape.messages,

  phase: coldStartPhaseSchema.default("story_gathering"),

  queue: z.array(contextAgendaSchema).default([]),
  currentContextIndex: z.number().default(0),

  collectedContexts: z.array(userContextSchema).default([]),
  collectedTrails: z.array(trailSchema).default([]),

  pendingContext: z.record(z.unknown()).nullable().default(null),
  pendingTrails: z.array(z.unknown()).default([]),

  missingFields: z.array(missingFieldSchema).default([]),
  optionalFields: z.array(contextOptionalFieldSchema).default([]),
  clarificationRound: z.number().default(0),

  currentEntityContext: currentEntityContextSchema.nullable().default(null),

  userId: z.string(),

  userResponse: z.string().default(""),

  cvText: z.string().nullable().default(null),

  parsedDecision: decisionSchema.nullable().default(null),
});

export type ColdStartState = z.infer<typeof coldStartStateSchema>;
