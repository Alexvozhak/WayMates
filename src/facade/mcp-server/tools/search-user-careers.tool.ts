import { mcpSearchUserCareersParamsSchema } from "../../../shared/schemas.js";

import { BaseTool } from "./base-tool.js";

import type { BaseToolDependencies } from "./base-tool.js";
import type { McpSearchUserCareersParams, ScoredMatchedCandidate, UserId } from "../../../shared/schemas.js";

export class SearchUserCareersTool extends BaseTool<McpSearchUserCareersParams, ScoredMatchedCandidate[]> {
  constructor(deps: BaseToolDependencies) {
    super(deps, mcpSearchUserCareersParamsSchema);
  }

  protected async executeImpl(params: McpSearchUserCareersParams, userId: UserId): Promise<ScoredMatchedCandidate[]> {
    // userId extracted from sessionId by BaseTool
    // Remove sessionId before passing to Core API
    const { sessionId: _, ...coreParams } = params;

    const result = await this.coreClient.client.search.byUser.query({
      userId,
      ...coreParams,
    });

    return result;
  }
}
