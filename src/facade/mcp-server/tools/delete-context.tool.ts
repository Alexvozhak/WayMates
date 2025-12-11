import { BaseTool } from "./base-tool.js";

import type { McpDeleteContextParams, UserId } from "../../../shared/schemas.js";

export class DeleteContextTool extends BaseTool<McpDeleteContextParams, void> {
  protected async executeImpl(params: McpDeleteContextParams, userId: UserId): Promise<void> {
    await this.coreClient.client.context.delete.mutate({
      userId,
      contextId: params.contextId,
    });
  }
}
