import { z } from "zod";

import {
  adhocContextBase,
  contextFieldSchema,
  newContextReasonSchema,
  requestIdSchema,
  sessionIdSchema,
} from "../../../shared/schemas.js";
import { ValidationError } from "../../errors.js";

import { BaseTool } from "./base-tool.js";

import type { BaseToolDependencies } from "./base-tool.js";
import type { ScoredMatchedCandidate, UserId } from "../../../shared/schemas.js";

/**
 * MCP params schema for search_careers tool.
 * Internal facade type (isolated from shared per ADR-031).
 *
 * Structure:
 * - sessionId: auth mapping (interface concern)
 * - referenceContext: adhocContextBase (domain fields)
 * - search filters: excludedContextFields, limit, pathLimit, etc.
 */
export const mcpSearchCareersParamsSchema = z
  .object({
    sessionId: sessionIdSchema,
    requestId: requestIdSchema,
    referenceContext: adhocContextBase,
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

export type McpSearchCareersParams = z.infer<typeof mcpSearchCareersParamsSchema>;

export class SearchCareersTool extends BaseTool<McpSearchCareersParams, ScoredMatchedCandidate[]> {
  constructor(deps: BaseToolDependencies) {
    super(deps, mcpSearchCareersParamsSchema);
  }

  protected async executeImpl(params: McpSearchCareersParams, userId: UserId): Promise<ScoredMatchedCandidate[]> {
    const hasAnyField = Object.keys(params.referenceContext).length > 0;
    if (!hasAnyField) {
      throw new ValidationError("At least one field is required in reference context");
    }

    // 1. Normalize user input (fuzzy matching, dictionary lookup)
    const normalizedPartial = await this.normalizer.normalizeAdhocContext(params.referenceContext, userId);

    // 2. Validation (ADR-031 Правило 3: validation после normalizer)
    // Ensures all fields match schema (min length, array constraints)
    // Throws ZodError if invalid (caught by MCP error handler)
    const validated = adhocContextBase.parse(normalizedPartial);

    const { sessionId: _sessionId, referenceContext: _ref, recencyThresholdMonths, ...searchParams } = params;

    return this.coreClient.client.search.adhoc.query({
      userId,
      ...searchParams,
      recencyThresholdMonths: recencyThresholdMonths ?? null,
      referenceContext: validated,
    });
  }
}
