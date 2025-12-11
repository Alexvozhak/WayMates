import { ValidationError } from "../../errors.js";

import { BaseTool } from "./base-tool.js";

import type { McpSearchCareersParams, ScoredMatchedCandidate, UserId } from "../../../shared/schemas.js";

export class SearchCareersTool extends BaseTool<McpSearchCareersParams, ScoredMatchedCandidate[]> {
  protected async executeImpl(params: McpSearchCareersParams, userId: UserId): Promise<ScoredMatchedCandidate[]> {
    const hasAnyField = Object.keys(params.referenceContext).length > 0;
    if (!hasAnyField) {
      throw new ValidationError("At least one field is required in reference context");
    }

    const normalized = await this.normalizer.normalizeAdhocContext(params.referenceContext, userId);

    const { sessionId: _sessionId, referenceContext: _ref, ...searchParams } = params;

    return this.coreClient.client.search.adhoc.query({
      userId,
      ...searchParams,
      referenceContext: normalized,
    });
  }
}
