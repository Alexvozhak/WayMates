import { targetContextSchema } from "../../../shared/schemas.js";

import { BaseTool } from "./base-tool.js";

import type { MatchedCandidateWithPath, UserId } from "../../../shared/schemas.js";
import type { SearchByTargetParams } from "../schemas.js";

export class SearchByTargetTool extends BaseTool<SearchByTargetParams, MatchedCandidateWithPath[]> {
  protected async executeImpl(
    params: SearchByTargetParams,
    userId: UserId,
  ): Promise<MatchedCandidateWithPath[]> {
    const normalizedPartial = await this.normalizer.normalizeTargetContext(
      params.targetContext,
      userId,
    );

    const normalized = targetContextSchema.parse(normalizedPartial);

    return this.coreClient.client.search.byTarget.query({
      userId,
      criteria: normalized,
      limit: params.limit,
    });
  }
}
