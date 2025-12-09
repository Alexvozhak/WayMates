import { targetContextSchema } from "../../../shared/schemas.js";
import { ValidationError } from "../../errors.js";

import { BaseTool } from "./base-tool.js";

import type { MatchedCandidateWithPath, UserId } from "../../../shared/schemas.js";
import type { SearchByTargetParams } from "../schemas.js";

export class SearchByTargetTool extends BaseTool<SearchByTargetParams, MatchedCandidateWithPath[]> {
  protected async executeImpl(params: SearchByTargetParams, userId: UserId): Promise<MatchedCandidateWithPath[]> {
    const normalizedPartial = await this.normalizer.normalizeTargetContext(params.targetContext, userId);

    const normalized = targetContextSchema.parse(normalizedPartial);

    const hasAnyCriterion = Object.values(normalized).some((v) => v !== undefined);
    if (!hasAnyCriterion) {
      throw new ValidationError("At least one target criterion is required");
    }

    const coreParams = {
      userId,
      targetContext: normalized,
      excludedCreationReasons: params.excludedCreationReasons,
      recencyThresholdMonths: params.recencyThresholdMonths,
      limit: params.limit,
    };

    return this.coreClient.client.search.byTarget.query(coreParams);
  }
}
