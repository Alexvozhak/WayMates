import { z } from "zod";

import {
  contextIdSchema,
  targetContextSchema,
  updateContextInputSchema,
  upsertContextInputSchema,
  userContextSchema,
  userIdSchema,
  userSearchParamsRawSchema,
} from "../../shared/schemas.js";

import { sessionIdSchema } from "./result.js";

export const getStoryParamsSchema = z.object({
  targetUserId: userIdSchema.optional(),
  sessionId: sessionIdSchema,
});

export type GetStoryParams = z.infer<typeof getStoryParamsSchema>;

/**
 * Facade MCP tool parameters: Core raw schemas WITHOUT userId + sessionId
 * userId extracted automatically from sessionId by BaseTool
 * Validation (pathLimit <= limit) inherited from Core raw schema
 */
export const searchCareersParamsSchema = userSearchParamsRawSchema
  .omit({ userId: true })
  .extend({
    referenceContext: userContextSchema.describe(
      "Custom reference context (extracted from user text)",
    ),
    sessionId: sessionIdSchema,
  })
  .refine((data) => data.pathLimit <= data.limit, {
    message: "pathLimit must be <= limit (cannot return more results than fetched from DB)",
    path: ["pathLimit"],
  });

export type SearchCareersParams = z.infer<typeof searchCareersParamsSchema>;

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

export const updateContextToolParamsSchema = z.object({
  updates: updateContextInputSchema,
  sessionId: sessionIdSchema,
});

export type UpdateContextToolParams = z.infer<typeof updateContextToolParamsSchema>;

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

export const upsertContextParamsSchema = upsertContextInputSchema.omit({ userId: true }).extend({
  sessionId: sessionIdSchema,
});

export type UpsertContextParams = z.infer<typeof upsertContextParamsSchema>;
