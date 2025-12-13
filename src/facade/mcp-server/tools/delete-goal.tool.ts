import { mcpDeleteGoalParamsSchema } from "../../../shared/schemas.js";

import { BaseTool } from "./base-tool.js";

import type { BaseToolDependencies } from "./base-tool.js";
import type { McpDeleteGoalParams, UserId } from "../../../shared/schemas.js";

export class DeleteGoalTool extends BaseTool<McpDeleteGoalParams, void> {
  constructor(deps: BaseToolDependencies) {
    super(deps, mcpDeleteGoalParamsSchema);
  }

  protected async executeImpl(_params: McpDeleteGoalParams, userId: UserId): Promise<void> {
    await this.coreClient.client.goal.delete.mutate({ userId });
  }
}
