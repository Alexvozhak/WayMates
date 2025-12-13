import { mcpUpdateContextParamsSchema } from "../../../shared/schemas.js";
import { PHASE } from "../../langGraph/update-context/state.js";
import { UpdateContextGraph } from "../../langGraph/update-context/update-context-graph.js";

import { BaseTool } from "./base-tool.js";

import type { BaseToolDependencies } from "./base-tool.js";
import type { McpUpdateContextParams, UpdateContextResponse, UserContext, UserId } from "../../../shared/schemas.js";

export class UpdateContextTool extends BaseTool<McpUpdateContextParams, UpdateContextResponse> {
  constructor(deps: BaseToolDependencies) {
    super(deps, mcpUpdateContextParamsSchema);
  }

  protected async executeImpl(params: McpUpdateContextParams, userId: UserId): Promise<UpdateContextResponse> {
    const threadId = `update_ctx_${userId}`;
    const checkpointer = this.checkpointService.getCheckpointer();

    const currentContext = await this.loadCurrentContext(userId);
    if (!currentContext) {
      return {
        phase: PHASE.failed,
        message: "No current context found. Use cold_start first.",
      };
    }

    const graph = new UpdateContextGraph(userId, currentContext, checkpointer);
    const response = await graph.run(params.message, threadId, this.coreClient, this.normalizer);

    if (response.phase === PHASE.saved) {
      await this.checkpointService.delete(threadId);
    }

    return response;
  }

  private async loadCurrentContext(userId: UserId): Promise<UserContext | null> {
    const story = await this.coreClient.client.story.getStory.query({ userId });
    const current = story.contexts.find((ctx) => ctx.nextContextId === null);
    return current ?? null;
  }
}
