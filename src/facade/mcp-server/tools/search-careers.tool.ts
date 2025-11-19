import { BaseTool } from "./base-tool.js";

import type { ScoredMatchedCandidate, UserId } from "../../../shared/schemas.js";
import type { SessionId } from "../result.js";
import type { SearchCareersParams } from "../schemas.js";

export class SearchCareersTool extends BaseTool<SearchCareersParams, ScoredMatchedCandidate[]> {
  protected extractSessionId(params: SearchCareersParams): SessionId {
    return params.sessionId;
  }

  protected async executeImpl(
    params: SearchCareersParams,
    userId: UserId,
  ): Promise<ScoredMatchedCandidate[]> {
    const result = await this.coreClient.client.search.adhoc.query({
      userId,
      referenceContext: params.referenceContext,
      excludedContextFields: [],
      excludedCreationReasons: [],
      limit: 20,
      pathLimit: 10,
    });

    return result;
  }
}
