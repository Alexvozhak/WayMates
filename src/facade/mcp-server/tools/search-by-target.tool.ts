import { BaseTool } from "./base-tool.js";

import type { MatchedCandidateWithPath, UserId } from "../../../shared/schemas.js";
import type { SearchByTargetParams } from "../schemas.js";

export class SearchByTargetTool extends BaseTool<SearchByTargetParams, MatchedCandidateWithPath[]> {
  protected async executeImpl(
    params: SearchByTargetParams,
    userId: UserId,
  ): Promise<MatchedCandidateWithPath[]> {
    return this.coreClient.client.search.byTarget.query({
      userId,
      criteria: params.targetContext,
      limit: params.limit,
    });
  }
}
