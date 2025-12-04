import { z } from "zod";

import { userContextSchema } from "../../../shared/schemas.js";

import { PHASE } from "./state.js";

export const updateContextResponseSchema = z.discriminatedUnion("phase", [
  z.object({ phase: z.literal(PHASE.extracting), message: z.string() }),
  z.object({
    phase: z.literal(PHASE.awaitingConfirmation),
    before: userContextSchema,
    after: userContextSchema,
  }),
  z.object({ phase: z.literal(PHASE.approved), updatedContext: userContextSchema }),
  z.object({ phase: z.literal(PHASE.cancelled), message: z.string() }),
  z.object({ phase: z.literal(PHASE.failed), message: z.string() }),
]);

export type UpdateContextResponse = z.infer<typeof updateContextResponseSchema>;
