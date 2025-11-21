import { BaseTool } from "./base-tool.js";

import type { ScoredMatchedCandidate, UserId } from "../../../shared/schemas.js";
import type { FacadeAdhocSearchParams } from "../schemas.js";

export class SearchCareersTool extends BaseTool<FacadeAdhocSearchParams, ScoredMatchedCandidate[]> {
  protected async executeImpl(
    params: FacadeAdhocSearchParams,
    userId: UserId,
  ): Promise<ScoredMatchedCandidate[]> {
    const normalized = await this.normalizer.normalizeUserContext(params.referenceContext, userId);

    const { sessionId: _sessionId, referenceContext: _ref, ...searchParams } = params;

    return this.coreClient.client.search.adhoc.query({
      userId,
      ...searchParams,
      referenceContext: normalized,
    });
  }
}
