import { mcpCancelAllGraphsParamsSchema } from "../../../../private/schemas.js";
import { GraphManager } from "../../services/orchestrator/graph-manager.service.js";

import { BaseTool } from "./base-tool.js";

import type { BaseToolDependencies } from "./base-tool.js";
import type { McpCancelAllGraphsParams, UserId } from "../../../../private/schemas.js";

export class CancelAllGraphsTool extends BaseTool<McpCancelAllGraphsParams, void> {
  private readonly graphManager: GraphManager;

  constructor(deps: BaseToolDependencies) {
    super(deps, mcpCancelAllGraphsParamsSchema);
    this.graphManager = new GraphManager(this.graphDeps);
  }

  protected async executeImpl(_params: McpCancelAllGraphsParams, userId: UserId): Promise<void> {
    await this.graphManager.cancelAllActiveGraphs(userId);
  }
}
