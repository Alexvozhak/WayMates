import { z } from "zod";

import { userContextSchema } from "../../../shared/schemas.js";
import { missingFieldSchema } from "../cold-start-v2/types.js";

import { PHASE } from "./state.js";

export const upsertContextResponseSchema = z.discriminatedUnion("phase", [
  z.object({ phase: z.literal(PHASE.extracting), message: z.string() }),
  z.object({ phase: z.literal(PHASE.awaitingClarification), missingFields: z.array(missingFieldSchema) }),
  z.object({ phase: z.literal(PHASE.awaitingConfirmation), context: userContextSchema }),
  z.object({ phase: z.literal(PHASE.saved), context: userContextSchema }),
  z.object({ phase: z.literal(PHASE.cancelled), message: z.string() }),
  z.object({ phase: z.literal(PHASE.failed), message: z.string() }),
]);

export type UpsertContextResponse = z.infer<typeof upsertContextResponseSchema>;
