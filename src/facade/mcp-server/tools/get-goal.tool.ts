import { BaseTool } from "./base-tool.js";

import type { Goal, McpGetGoalParams, UserId } from "../../../shared/schemas.js";

export class GetGoalTool extends BaseTool<McpGetGoalParams, Goal | null> {
  protected async executeImpl(params: McpGetGoalParams, userId: UserId): Promise<Goal | null> {
    const targetUserId = params.targetUserId || userId;

    return this.coreClient.client.goal.getByUser.query({ userId: targetUserId });
  }
}
