import { BaseTool } from "./base-tool.js";

import type { UserId } from "../../../shared/schemas.js";
import type { DeleteContextParams } from "../schemas.js";

export class DeleteContextTool extends BaseTool<DeleteContextParams, void> {
  protected async executeImpl(params: DeleteContextParams, userId: UserId): Promise<void> {
    await this.coreClient.client.context.delete.mutate({
      userId,
      contextId: params.contextId,
    });
  }
}
