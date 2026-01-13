import { mcpSearchByTargetParamsSchema, targetContextSchema } from "../../../../private/schemas.js";
import { ValidationError } from "../../errors.js";

import { BaseTool } from "./base-tool.js";

import type { BaseToolDependencies } from "./base-tool.js";
import type { MatchedCandidateWithPath, McpSearchByTargetParams, UserId } from "../../../../private/schemas.js";

export class SearchByTargetTool extends BaseTool<McpSearchByTargetParams, MatchedCandidateWithPath[]> {
  constructor(deps: BaseToolDependencies) {
    super(deps, mcpSearchByTargetParamsSchema);
  }

  protected async executeImpl(params: McpSearchByTargetParams, userId: UserId): Promise<MatchedCandidateWithPath[]> {
    const normalizedPartial = await this.normalizerService.normalizeTargetContext(params.targetContext, userId);

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

    return this.coreClient.client.search.reversePathfinders.query(coreParams);
  }
}
