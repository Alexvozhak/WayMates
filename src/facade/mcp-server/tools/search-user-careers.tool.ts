import { z } from "zod";

import {
  contextFieldSchema,
  newContextReasonSchema,
  requestIdSchema,
  sessionIdSchema,
} from "../../../shared/schemas.js";

import { BaseTool } from "./base-tool.js";

import type { BaseToolDependencies } from "./base-tool.js";
import type { ScoredMatchedCandidate, UserId } from "../../../shared/schemas.js";

/**
 * MCP params schema for search_user_careers tool.
 * Internal facade type (isolated from shared per ADR-031).
 *
 * Search candidates using authenticated user's story (context from DB).
 */
export const mcpSearchUserCareersParamsSchema = z
  .object({
    sessionId: sessionIdSchema,
    requestId: requestIdSchema,
    excludedContextFields: z
      .array(contextFieldSchema)
      .default([])
      .refine((fields) => !fields.includes("skills"), {
        message: "Cannot exclude 'skills' - required for ranking candidates",
      }),
    excludedCreationReasons: z.array(newContextReasonSchema).default([]),
    recencyThresholdMonths: z.number().min(1).nullable().default(null),
    limit: z.number().min(1).max(100).default(20),
    pathLimit: z.number().min(1).max(100).default(20),
  })
  .transform((data) => ({
    ...data,
    pathLimit: Math.min(data.pathLimit, data.limit),
  }));

export type McpSearchUserCareersParams = z.infer<typeof mcpSearchUserCareersParamsSchema>;

export class SearchUserCareersTool extends BaseTool<McpSearchUserCareersParams, ScoredMatchedCandidate[]> {
  constructor(deps: BaseToolDependencies) {
    super(deps, mcpSearchUserCareersParamsSchema);
  }

  protected async executeImpl(params: McpSearchUserCareersParams, userId: UserId): Promise<ScoredMatchedCandidate[]> {
    const { sessionId: _, recencyThresholdMonths, ...coreParams } = params;

    return this.coreClient.client.search.waymates.query({
      userId,
      ...coreParams,
      recencyThresholdMonths: recencyThresholdMonths ?? null,
    });
  }
}
