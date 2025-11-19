import { BaseTool } from "./base-tool.js";

import type { UserContext, UserId } from "../../../shared/schemas.js";
import type { SessionId } from "../result.js";
import type { UpdateContextToolParams } from "../schemas.js";

export class UpdateContextTool extends BaseTool<UpdateContextToolParams, UserContext> {
  protected extractSessionId(params: UpdateContextToolParams): SessionId {
    return params.sessionId;
  }

  protected async executeImpl(
    params: UpdateContextToolParams,
    userId: UserId,
  ): Promise<UserContext> {
    return this.coreClient.client.context.update.mutate({
      userId,
      updates: params.updates,
    });
  }
}
