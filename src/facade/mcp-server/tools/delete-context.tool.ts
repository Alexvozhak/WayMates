import { mcpDeleteContextParamsSchema } from "../../../../private/schemas.js";

import { BaseTool } from "./base-tool.js";

import type { BaseToolDependencies } from "./base-tool.js";
import type { McpDeleteContextParams, UserId } from "../../../../private/schemas.js";

export class DeleteContextTool extends BaseTool<McpDeleteContextParams, void> {
  constructor(deps: BaseToolDependencies) {
    super(deps, mcpDeleteContextParamsSchema);
  }

  protected async executeImpl(params: McpDeleteContextParams, userId: UserId): Promise<void> {
    await this.coreClient.client.context.delete.mutate({
      userId,
      contextId: params.contextId,
    });
  }
}
