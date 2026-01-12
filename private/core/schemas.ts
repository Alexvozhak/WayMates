import { contextIdSchema, trailIdSchema } from "@shared/schemas.js";
import { z } from "zod";


/**
 * Core-only schemas (not used in facade or telegram)
 */

export const upsertSingleContextResultSchema = z.object({
  success: z.boolean(),
  contextId: contextIdSchema,
});

export const upsertSingleTrailResultSchema = z.object({
  success: z.boolean(),
  trailId: trailIdSchema,
});

export type UpsertSingleContextResult = z.infer<typeof upsertSingleContextResultSchema>;
export type UpsertSingleTrailResult = z.infer<typeof upsertSingleTrailResultSchema>;
