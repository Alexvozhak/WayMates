import { z } from "zod";

import {
  targetContextSchema,
  updateContextInputSchema,
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
