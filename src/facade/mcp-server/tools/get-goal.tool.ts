import { BaseTool } from "./base-tool.js";

import type { Goal, UserId } from "../../../shared/schemas.js";
import type { SessionId } from "../result.js";
import type { GetGoalParams } from "../schemas.js";

export class GetGoalTool extends BaseTool<GetGoalParams, Goal | null> {
  protected extractSessionId(params: GetGoalParams): SessionId {
    return params.sessionId;
  }

  protected async executeImpl(params: GetGoalParams, userId: UserId): Promise<Goal | null> {
    const targetUserId = params.targetUserId || userId;

    return this.coreClient.client.goal.getByUser.query({ userId: targetUserId });
  }
}
