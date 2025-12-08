import { ValidationError } from "../../errors.js";

import { BaseTool } from "./base-tool.js";

import type { ScoredMatchedCandidate, UserId } from "../../../shared/schemas.js";
import type { FacadeAdhocSearchParams } from "../schemas.js";

export class SearchCareersTool extends BaseTool<FacadeAdhocSearchParams, ScoredMatchedCandidate[]> {
  protected async executeImpl(params: FacadeAdhocSearchParams, userId: UserId): Promise<ScoredMatchedCandidate[]> {
    const hasAnyField = Object.keys(params.referenceContext).length > 0;
    if (!hasAnyField) {
      throw new ValidationError("At least one field is required in reference context");
    }

    const normalized = await this.normalizer.normalizeUserContext(params.referenceContext, userId);

    const { sessionId: _sessionId, referenceContext: _ref, ...searchParams } = params;

    return this.coreClient.client.search.adhoc.query({
      userId,
      ...searchParams,
      referenceContext: normalized,
    });
  }
}
