import { z } from "zod";

import { userIdSchema } from "../../shared/schemas.js";

import { sessionIdSchema } from "./result.js";

export const getStoryParamsSchema = z.object({
  userId: userIdSchema.optional(),
  sessionId: sessionIdSchema,
});

export type GetStoryParams = z.infer<typeof getStoryParamsSchema>;
