import { z } from "zod";

import { scoredMatchedCandidateSchema, sessionIdSchema, tokenSchema, userIdSchema } from "../../shared/schemas.js";

// Re-export error schemas for telegram-bot usage

// Re-export coldStartResponseSchema from Facade (single source of truth)
export { coldStartResponseSchema } from "../../facade/langGraph/cold-start-v2/types.js";

export const telegramRegisterResponseSchema = z.object({
  userId: userIdSchema,
  token: tokenSchema,
  sessionId: sessionIdSchema,
  isNewUser: z.boolean(),
  hasStory: z.boolean(),
});

export const searchResultResponseSchema = z.object({
  candidates: z.array(scoredMatchedCandidateSchema),
  totalCount: z.number(),
});

export const telegramLinkResponseSchema = z.object({
  sessionId: sessionIdSchema,
  hasStory: z.boolean(),
  token: tokenSchema,
});

export { errorCodeSchema, errorResponseSchema } from "../../shared/schemas.js";
