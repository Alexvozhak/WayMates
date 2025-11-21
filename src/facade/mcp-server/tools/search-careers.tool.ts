import { BaseTool } from "./base-tool.js";

import type { ScoredMatchedCandidate, UserId } from "../../../shared/schemas.js";
import type { SearchCareersParams } from "../schemas.js";

/**
 * Search careers tool with structured input
 * LibreChat LLM extracts structured UserContext from text
 * Facade validates session and calls Core API
 */
export class SearchCareersTool extends BaseTool<SearchCareersParams, ScoredMatchedCandidate[]> {
  protected async executeImpl(
    params: SearchCareersParams,
    userId: UserId,
  ): Promise<ScoredMatchedCandidate[]> {
    // userId extracted from sessionId by BaseTool
    // Remove sessionId before passing to Core API
    const { sessionId: _, ...coreParams } = params;

    const result = await this.coreClient.client.search.adhoc.query({
      userId,
      ...coreParams,
    });

    return result;
  }
}
