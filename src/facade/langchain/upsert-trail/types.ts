import { z } from "zod";

import { trailSchema } from "../../../shared/schemas.js";

import { PHASE } from "./state.js";

export const upsertTrailResponseSchema = z.discriminatedUnion("phase", [
  z.object({ phase: z.literal(PHASE.extracting), message: z.string() }),
  z.object({ phase: z.literal(PHASE.awaitingConfirmation), trail: trailSchema }),
  z.object({ phase: z.literal(PHASE.approved), trail: trailSchema }),
  z.object({ phase: z.literal(PHASE.cancelled), message: z.string() }),
  z.object({ phase: z.literal(PHASE.failed), message: z.string() }),
]);

export type UpsertTrailResponse = z.infer<typeof upsertTrailResponseSchema>;
