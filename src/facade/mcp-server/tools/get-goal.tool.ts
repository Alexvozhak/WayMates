import { mcpGetGoalParamsSchema } from "../../../../private/schemas.js";

import { BaseTool } from "./base-tool.js";

import type { BaseToolDependencies } from "./base-tool.js";
import type { Goal, McpGetGoalParams, UserId } from "../../../../private/schemas.js";

export class GetGoalTool extends BaseTool<McpGetGoalParams, Goal | null> {
  constructor(deps: BaseToolDependencies) {
    super(deps, mcpGetGoalParamsSchema);
  }

  protected async executeImpl(params: McpGetGoalParams, userId: UserId): Promise<Goal | null> {
    const targetUserId = params.targetUserId || userId;

    return this.coreClient.client.goal.getByUser.query({ userId: targetUserId });
  }
}
