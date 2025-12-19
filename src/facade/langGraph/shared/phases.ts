import { z } from "zod";

/**
 * Phase schema for simple confirmation graphs (upsert-context, upsert-trail, update-context).
 * All three share identical phases.
 */
export const simpleConfirmationPhaseSchema = z.enum([
  "extracting",
  "awaiting_clarification",
  "awaiting_confirmation",
  "saved",
  "cancelled",
  "failed",
]);

export type SimpleConfirmationPhase = z.infer<typeof simpleConfirmationPhaseSchema>;

export const PHASE = simpleConfirmationPhaseSchema.Values;
