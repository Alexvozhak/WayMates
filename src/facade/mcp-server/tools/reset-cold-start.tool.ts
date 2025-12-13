import { mcpResetColdStartParamsSchema } from "../../../shared/schemas.js";

import { BaseTool } from "./base-tool.js";

import type { BaseToolDependencies } from "./base-tool.js";
import type { McpResetColdStartParams, ResetColdStartResponse, UserId } from "../../../shared/schemas.js";

export class ResetColdStartTool extends BaseTool<McpResetColdStartParams, ResetColdStartResponse> {
  constructor(deps: BaseToolDependencies) {
    super(deps, mcpResetColdStartParamsSchema);
  }

  protected async executeImpl(_params: McpResetColdStartParams, userId: UserId): Promise<ResetColdStartResponse> {
    const threadId = `cold_start_${userId}`;

    const wasCompleted = await this.userService.resetColdStartStatus(userId);
    await this.checkpointService.delete(threadId);

    if (wasCompleted) {
      return {
        success: true,
        message: "Cold start reset. You can now start fresh.",
      };
    }

    return {
      success: true,
      message: "Cold start was not completed. Checkpoint cleared.",
    };
  }
}
