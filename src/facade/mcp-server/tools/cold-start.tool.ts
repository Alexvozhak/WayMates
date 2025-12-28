import { mcpColdStartParamsSchema } from "../../../shared/schemas.js";
import { ColdStartGraph } from "../../langGraph/cold-start-v2/cold-start-graph.js";

import { BaseTool } from "./base-tool.js";

import type { BaseToolDependencies } from "./base-tool.js";
import type { ColdStartResponse, Locale, McpColdStartParams, UserId } from "../../../shared/schemas.js";

export class ColdStartTool extends BaseTool<McpColdStartParams, ColdStartResponse> {
  constructor(deps: BaseToolDependencies) {
    super(deps, mcpColdStartParamsSchema);
  }

  protected async executeImpl(params: McpColdStartParams, userId: UserId): Promise<ColdStartResponse> {
    const threadId = `cold_start_${userId}`;
    const locale: Locale = params.locale ?? "en";

    const graph = new ColdStartGraph(this.graphDeps);
    const response = await graph.run(params.message, threadId, userId, params.cvText, locale);

    if (response.phase === "saved") {
      await this.checkpointService.delete(threadId);
    }

    return response;
  }
}
