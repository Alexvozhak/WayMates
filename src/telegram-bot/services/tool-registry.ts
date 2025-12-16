import { z } from "zod";

import {
  coldStartResponseSchema,
  converseResponseSchema,
  deleteSuccessResponseSchema,
  getGoalResponseSchema,
  getStoryResponseSchema,
  matchedCandidateWithPathSchema,
  mcpAuthParamsSchema,
  mcpColdStartParamsSchema,
  mcpConverseParamsSchema,
  mcpDeleteContextParamsSchema,
  mcpDeleteGoalParamsSchema,
  mcpDeleteTrailParamsSchema,
  mcpGetGoalParamsSchema,
  mcpGetStoryParamsSchema,
  mcpResetColdStartParamsSchema,
  mcpSearchByTargetParamsSchema,
  mcpSearchCareersParamsSchema,
  mcpSearchUserCareersParamsSchema,
  mcpSetGoalParamsSchema,
  mcpTelegramLinkParamsSchema,
  mcpTelegramRegisterParamsSchema,
  mcpUpdateContextParamsSchema,
  mcpUpsertContextParamsSchema,
  mcpUpsertTrailParamsSchema,
  resetColdStartResponseSchema,
  scoredMatchedCandidateSchema,
  setGoalResponseSchema,
  telegramLinkResponseSchema,
  telegramRegisterResponseSchema,
  updateContextResponseSchema,
  upsertContextResponseSchema,
  upsertTrailResponseSchema,
} from "../../shared/schemas.js";

export const TOOL_REGISTRY = {
  auth: {
    paramsSchema: mcpAuthParamsSchema,
    responseSchema: telegramRegisterResponseSchema,
  },
  cold_start: {
    paramsSchema: mcpColdStartParamsSchema,
    responseSchema: coldStartResponseSchema,
  },
  reset_cold_start: {
    paramsSchema: mcpResetColdStartParamsSchema,
    responseSchema: resetColdStartResponseSchema,
  },
  get_story: {
    paramsSchema: mcpGetStoryParamsSchema,
    responseSchema: getStoryResponseSchema,
  },
  search_careers: {
    paramsSchema: mcpSearchCareersParamsSchema,
    responseSchema: z.array(scoredMatchedCandidateSchema),
  },
  search_user_careers: {
    paramsSchema: mcpSearchUserCareersParamsSchema,
    responseSchema: z.array(scoredMatchedCandidateSchema),
  },
  set_goal: {
    paramsSchema: mcpSetGoalParamsSchema,
    responseSchema: setGoalResponseSchema,
  },
  get_goal: {
    paramsSchema: mcpGetGoalParamsSchema,
    responseSchema: getGoalResponseSchema,
  },
  delete_goal: {
    paramsSchema: mcpDeleteGoalParamsSchema,
    responseSchema: deleteSuccessResponseSchema,
  },
  update_context: {
    paramsSchema: mcpUpdateContextParamsSchema,
    responseSchema: updateContextResponseSchema,
  },
  upsert_context: {
    paramsSchema: mcpUpsertContextParamsSchema,
    responseSchema: upsertContextResponseSchema,
  },
  delete_context: {
    paramsSchema: mcpDeleteContextParamsSchema,
    responseSchema: deleteSuccessResponseSchema,
  },
  search_by_target: {
    paramsSchema: mcpSearchByTargetParamsSchema,
    responseSchema: z.array(matchedCandidateWithPathSchema),
  },
  upsert_trail: {
    paramsSchema: mcpUpsertTrailParamsSchema,
    responseSchema: upsertTrailResponseSchema,
  },
  delete_trail: {
    paramsSchema: mcpDeleteTrailParamsSchema,
    responseSchema: deleteSuccessResponseSchema,
  },
  register_telegram: {
    paramsSchema: mcpTelegramRegisterParamsSchema,
    responseSchema: telegramRegisterResponseSchema,
  },
  link_telegram: {
    paramsSchema: mcpTelegramLinkParamsSchema,
    responseSchema: telegramLinkResponseSchema,
  },
  converse: {
    paramsSchema: mcpConverseParamsSchema,
    responseSchema: converseResponseSchema,
  },
} as const;

export type FacadeToolName = keyof typeof TOOL_REGISTRY;

export type ToolRegistry = typeof TOOL_REGISTRY;

export type ToolParams<T extends keyof ToolRegistry> = z.infer<ToolRegistry[T]["paramsSchema"]>;

export type ToolResponse<T extends keyof ToolRegistry> = z.infer<ToolRegistry[T]["responseSchema"]>;
