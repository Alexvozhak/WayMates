import { BaseTool } from "./base-tool.js";

import type { UserId } from "../../../shared/schemas.js";
import type { SessionId } from "../result.js";
import type { DeleteGoalParams } from "../schemas.js";

export class DeleteGoalTool extends BaseTool<DeleteGoalParams, void> {
  protected extractSessionId(params: DeleteGoalParams): SessionId {
    return params.sessionId;
  }

  protected async executeImpl(_params: DeleteGoalParams, userId: UserId): Promise<void> {
    await this.coreClient.client.goal.delete.mutate({ userId });
  }
}
