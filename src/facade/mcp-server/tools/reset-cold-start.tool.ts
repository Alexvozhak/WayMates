import { BaseTool } from "./base-tool.js";

import type { McpResetColdStartParams, UserId } from "../../../shared/schemas.js";

type ResetResult = {
  success: boolean;
  message: string;
};

export class ResetColdStartTool extends BaseTool<McpResetColdStartParams, ResetResult> {
  protected async executeImpl(_params: McpResetColdStartParams, userId: UserId): Promise<ResetResult> {
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
