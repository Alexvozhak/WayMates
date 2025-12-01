import { MessagesZodState } from "@langchain/langgraph";
import { z } from "zod";

import { userContextSchema, userIdSchema } from "../../../shared/schemas.js";

export const updateContextPhaseSchema = z.enum([
  "collecting",
  "awaiting_clarification",
  "awaiting_confirmation",
  "saved",
  "failed",
]);

export type UpdateContextPhase = z.infer<typeof updateContextPhaseSchema>;

export const PHASE = updateContextPhaseSchema.Values;

export const updateContextStateSchema = z.object({
  messages: MessagesZodState.shape.messages,
  phase: updateContextPhaseSchema.default("collecting"),
  userId: userIdSchema,
  currentContext: userContextSchema,
  extractedUpdates: z.record(z.string(), z.unknown()).optional(),
  updatedContext: userContextSchema.optional(),
  clarificationRound: z.number().default(0),
});

export type UpdateContextState = z.infer<typeof updateContextStateSchema>;

export const updateContextResponseSchema = z.discriminatedUnion("phase", [
  z.object({
    phase: z.literal("collecting"),
    message: z.string(),
  }),
  z.object({
    phase: z.literal("awaiting_clarification"),
    message: z.string(),
    missingFields: z.string().array(),
  }),
  z.object({
    phase: z.literal("awaiting_confirmation"),
    before: userContextSchema,
    after: userContextSchema,
  }),
  z.object({
    phase: z.literal("saved"),
    updatedContext: userContextSchema,
  }),
  z.object({
    phase: z.literal("failed"),
    message: z.string(),
  }),
]);

export type UpdateContextResponse = z.infer<typeof updateContextResponseSchema>;
