import {
  converseResponseSchema,
  mcpAuthParamsSchema,
  mcpConverseParamsSchema,
  mcpParseCvToTextParamsSchema,
  mcpTelegramLinkParamsSchema,
  mcpTelegramRegisterParamsSchema,
  parseCvToTextResponseSchema,
  telegramLinkResponseSchema,
  telegramRegisterResponseSchema,
} from "../../shared/schemas.js";

import type { z } from "zod";

/**
 * Registry of MCP tools with validation schemas.
 *
 * After Phase 4 cleanup: Only 4 tools remain.
 * All user interactions now route through converse.
 */
export const TOOL_REGISTRY = {
  auth: {
    paramsSchema: mcpAuthParamsSchema,
    responseSchema: telegramRegisterResponseSchema,
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
  parse_cv_to_text: {
    paramsSchema: mcpParseCvToTextParamsSchema,
    responseSchema: parseCvToTextResponseSchema,
  },
} as const;

export type FacadeToolName = keyof typeof TOOL_REGISTRY;

export type ToolRegistry = typeof TOOL_REGISTRY;

export type ToolParams<T extends keyof ToolRegistry> = z.infer<ToolRegistry[T]["paramsSchema"]>;

export type ToolResponse<T extends keyof ToolRegistry> = z.infer<ToolRegistry[T]["responseSchema"]>;
