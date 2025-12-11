import { BaseTool } from "./base-tool.js";

import type { McpSearchUserCareersParams, ScoredMatchedCandidate, UserId } from "../../../shared/schemas.js";

/**
 * User search careers tool (Mode 2)
 * Core API fetches user's current context from DB automatically
 * No need for LibreChat to provide referenceContext
 */
export class SearchUserCareersTool extends BaseTool<McpSearchUserCareersParams, ScoredMatchedCandidate[]> {
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
