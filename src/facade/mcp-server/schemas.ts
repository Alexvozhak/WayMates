import { z } from "zod";

import {
  adhocUserContextSchema,
  contextIdSchema,
  targetContextSchema,
  trailIdSchema,
  userIdSchema,
  userSearchParamsRawSchema,
} from "../../shared/schemas.js";

import { sessionIdSchema } from "./result.js";

export const getStoryParamsSchema = z.object({
  targetUserId: userIdSchema.optional(),
  sessionId: sessionIdSchema,
});

export type GetStoryParams = z.infer<typeof getStoryParamsSchema>;

export const facadeAdhocSearchParamsSchema = userSearchParamsRawSchema
  .omit({ userId: true })
  .extend({
    referenceContext: adhocUserContextSchema,
    sessionId: sessionIdSchema,
  })
  .refine((data) => data.pathLimit <= data.limit, {
    message: "pathLimit must be <= limit (cannot return more results than fetched from DB)",
    path: ["pathLimit"],
  });

export type FacadeAdhocSearchParams = z.infer<typeof facadeAdhocSearchParamsSchema>;

export const searchUserCareersParamsSchema = userSearchParamsRawSchema
  .omit({ userId: true })
  .extend({
    sessionId: sessionIdSchema,
  })
  .refine((data) => data.pathLimit <= data.limit, {
    message: "pathLimit must be <= limit (cannot return more results than fetched from DB)",
    path: ["pathLimit"],
  });

export type SearchUserCareersParams = z.infer<typeof searchUserCareersParamsSchema>;

export const setGoalParamsSchema = z.object({
  targetContext: targetContextSchema,
  sessionId: sessionIdSchema,
});

export type SetGoalParams = z.infer<typeof setGoalParamsSchema>;

export const updateContextParamsSchema = z.object({
  message: z
    .string()
    .min(10)
    .describe(
      "User message describing context updates in natural language. " +
        "Example: 'Добавь React в мои навыки' or 'Измени позицию на Senior Developer'",
    ),
  sessionId: sessionIdSchema,
});

export type UpdateContextParams = z.infer<typeof updateContextParamsSchema>;

export const getGoalParamsSchema = z.object({
  targetUserId: userIdSchema.optional(),
  sessionId: sessionIdSchema,
});

export type GetGoalParams = z.infer<typeof getGoalParamsSchema>;

export const deleteGoalParamsSchema = z.object({
  sessionId: sessionIdSchema,
});

export type DeleteGoalParams = z.infer<typeof deleteGoalParamsSchema>;

export const searchByTargetParamsSchema = z.object({
  targetContext: targetContextSchema,
  limit: z.number().int().positive().default(20),
  sessionId: sessionIdSchema,
});

export type SearchByTargetParams = z.infer<typeof searchByTargetParamsSchema>;

export const deleteContextParamsSchema = z.object({
  contextId: contextIdSchema,
  sessionId: sessionIdSchema,
});

export type DeleteContextParams = z.infer<typeof deleteContextParamsSchema>;

export const upsertContextParamsSchema = z.object({
  message: z
    .string()
    .min(10)
    .describe(
      "User message describing a new career context in natural language. " +
        "Example: 'Я работаю senior backend в Яндексе с 2023 года в Москве, пишу на Python и Go'",
    ),
  sessionId: sessionIdSchema,
});

export type UpsertContextParams = z.infer<typeof upsertContextParamsSchema>;

export const coldStartParamsSchema = z.object({
  message: z.string().min(1).describe("User message (career history or confirmation)"),
  sessionId: sessionIdSchema,
});

export type ColdStartParams = z.infer<typeof coldStartParamsSchema>;

export const resetColdStartParamsSchema = z.object({
  sessionId: sessionIdSchema,
});

export type ResetColdStartParams = z.infer<typeof resetColdStartParamsSchema>;

export const upsertTrailParamsSchema = z.object({
  message: z
    .string()
    .min(10)
    .describe(
      "User message describing a learning trail in natural language. " +
        "Example: 'I took a React course on Udemy for 8 weeks'",
    ),
  fromContextId: contextIdSchema
    .nullable()
    .optional()
    .describe("Source context ID if trail originates from a specific context"),
  sessionId: sessionIdSchema,
});

export type UpsertTrailParams = z.infer<typeof upsertTrailParamsSchema>;

export const deleteTrailParamsSchema = z.object({
  trailId: trailIdSchema,
  sessionId: sessionIdSchema,
});

export type DeleteTrailParams = z.infer<typeof deleteTrailParamsSchema>;

export const tokenSchema = z.string().uuid().describe("User token (UUID v7 format) for authentication");

export type Token = z.infer<typeof tokenSchema>;

export const authParamsSchema = z.object({
  token: tokenSchema.optional(),
});

export type AuthParams = z.infer<typeof authParamsSchema>;
