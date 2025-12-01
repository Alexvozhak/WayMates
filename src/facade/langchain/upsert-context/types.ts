import { MessagesZodState } from "@langchain/langgraph";
import { z } from "zod";

import { userContextSchema, userContextSchemaPartial, userIdSchema } from "../../../shared/schemas.js";

export const upsertContextPhaseSchema = z.enum(["extracting", "awaiting_confirmation", "saved", "failed"]);

export type UpsertContextPhase = z.infer<typeof upsertContextPhaseSchema>;

export const PHASE = upsertContextPhaseSchema.Values;

export const upsertContextStateSchema = z.object({
  messages: MessagesZodState.shape.messages,
  phase: upsertContextPhaseSchema.default("extracting"),
  userId: userIdSchema,
  extractedContext: userContextSchemaPartial.optional(),
  validatedContext: userContextSchema.optional(),
});

export type UpsertContextState = z.infer<typeof upsertContextStateSchema>;

export const upsertContextResponseSchema = z.discriminatedUnion("phase", [
  z.object({
    phase: z.literal("extracting"),
    message: z.string(),
  }),
  z.object({
    phase: z.literal("awaiting_confirmation"),
    context: userContextSchema,
  }),
  z.object({
    phase: z.literal("saved"),
    context: userContextSchema,
  }),
  z.object({
    phase: z.literal("failed"),
    message: z.string(),
  }),
]);

export type UpsertContextResponse = z.infer<typeof upsertContextResponseSchema>;
