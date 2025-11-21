import { BaseTool } from "./base-tool.js";

import type { UserId } from "../../../shared/schemas.js";
import type { SessionId } from "../result.js";
import type { DeleteContextParams } from "../schemas.js";

export class DeleteContextTool extends BaseTool<DeleteContextParams, void> {
  protected extractSessionId(params: DeleteContextParams): SessionId {
    return params.sessionId;
  }

  protected async executeImpl(params: DeleteContextParams, userId: UserId): Promise<void> {
    await this.coreClient.client.context.delete.mutate({
      userId,
      contextId: params.contextId,
    });
  }
}
