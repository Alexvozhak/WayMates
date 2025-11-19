import { z } from "zod";

import {
  targetContextSchema,
  updateContextInputSchema,
  userContextSchema,
  userIdSchema,
} from "../../shared/schemas.js";

import { sessionIdSchema } from "./result.js";

export const getStoryParamsSchema = z.object({
  userId: userIdSchema.optional(),
  sessionId: sessionIdSchema,
});

export type GetStoryParams = z.infer<typeof getStoryParamsSchema>;

export const searchCareersParamsSchema = z.object({
  referenceContext: userContextSchema,
  sessionId: sessionIdSchema,
});

export type SearchCareersParams = z.infer<typeof searchCareersParamsSchema>;

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
