import { BaseTool } from "./base-tool.js";

import type { UserId } from "../../../shared/schemas.js";
import type { SessionId } from "../result.js";
import type { SetGoalParams } from "../schemas.js";

type SetGoalResult = {
  goalId: string;
};

export class SetGoalTool extends BaseTool<SetGoalParams, SetGoalResult> {
  protected extractSessionId(params: SetGoalParams): SessionId {
    return params.sessionId;
  }

  protected async executeImpl(params: SetGoalParams, userId: UserId): Promise<SetGoalResult> {
    const result = await this.coreClient.client.goal.set.mutate({
      userId,
      targetContext: params.targetContext,
    });

    return result;
  }
}
