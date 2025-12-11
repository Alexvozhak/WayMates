import { ColdStartGraph } from "../../langGraph/cold-start-v2/cold-start-graph.js";

import { BaseTool } from "./base-tool.js";

import type { ColdStartResponse, McpColdStartParams, UserId } from "../../../shared/schemas.js";

export class ColdStartTool extends BaseTool<McpColdStartParams, ColdStartResponse> {
  protected async executeImpl(params: McpColdStartParams, userId: UserId): Promise<ColdStartResponse> {
    const threadId = `cold_start_${userId}`;

    const alreadySaved = await this.userService.isColdStartCompleted(userId);
    if (alreadySaved) {
      return {
        phase: "already_saved",
        message: "Cold start already saved for this user.",
      };
    }

    const checkpointer = this.checkpointService.getCheckpointer();
    const graph = new ColdStartGraph(userId, checkpointer);
    const response = await graph.run(params.message, threadId, this.coreClient, this.normalizer, this.userService);

    if (response.phase === "saved") {
      await this.checkpointService.delete(threadId);
    }

    return response;
  }
}
