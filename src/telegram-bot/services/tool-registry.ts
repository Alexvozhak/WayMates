import { z } from "zod";

import {
  coldStartResponseSchema,
  getGoalResponseSchema,
  getStoryResponseSchema,
  mcpAuthParamsSchema,
  mcpColdStartParamsSchema,
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
  searchResultResponseSchema,
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
    responseSchema: coldStartResponseSchema,
  },
  get_story: {
    paramsSchema: mcpGetStoryParamsSchema,
    responseSchema: getStoryResponseSchema,
  },
  search_careers: {
    paramsSchema: mcpSearchCareersParamsSchema,
    responseSchema: searchResultResponseSchema,
  },
  search_user_careers: {
    paramsSchema: mcpSearchUserCareersParamsSchema,
    responseSchema: searchResultResponseSchema,
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
    responseSchema: z.boolean(),
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
    responseSchema: z.boolean(),
  },
  search_by_target: {
    paramsSchema: mcpSearchByTargetParamsSchema,
    responseSchema: searchResultResponseSchema,
  },
  upsert_trail: {
    paramsSchema: mcpUpsertTrailParamsSchema,
    responseSchema: upsertTrailResponseSchema,
  },
  delete_trail: {
    paramsSchema: mcpDeleteTrailParamsSchema,
    responseSchema: z.boolean(),
  },
  register_telegram: {
    paramsSchema: mcpTelegramRegisterParamsSchema,
    responseSchema: telegramRegisterResponseSchema,
  },
  link_telegram: {
    paramsSchema: mcpTelegramLinkParamsSchema,
    responseSchema: telegramLinkResponseSchema,
  },
} as const;

export type FacadeToolName = keyof typeof TOOL_REGISTRY;

export type ToolRegistry = typeof TOOL_REGISTRY;

export type ToolParams<T extends keyof ToolRegistry> = z.infer<ToolRegistry[T]["paramsSchema"]>;

export type ToolResponse<T extends keyof ToolRegistry> = z.infer<ToolRegistry[T]["responseSchema"]>;
