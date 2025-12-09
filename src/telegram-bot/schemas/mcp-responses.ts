import { z } from "zod";

import { scoredMatchedCandidateSchema, sessionIdSchema, tokenSchema, userIdSchema } from "../../shared/schemas.js";

// TODO: Remove dead code in separate telegram session
// export const errorCodeSchema = z.enum(["session_expired", "session_invalid", "unauthorized"]);
// export const errorResponseSchema = z.object({
//   code: errorCodeSchema,
//   message: z.string(),
// });

export const telegramRegisterResponseSchema = z.object({
  userId: userIdSchema,
  token: tokenSchema,
  sessionId: sessionIdSchema,
  isNewUser: z.boolean(),
  hasStory: z.boolean(),
});

export const coldStartResponseSchema = z.object({
  phase: z.enum(["COLLECTING", "CONFIRMATION", "COMPLETED"]),
  message: z.string(),
  hasStory: z.boolean().optional(),
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
