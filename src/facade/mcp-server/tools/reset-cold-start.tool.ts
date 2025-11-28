import { postgresService } from "../../infrastructure/postgres.service.js";

import { BaseTool } from "./base-tool.js";

import type { UserId } from "../../../shared/schemas.js";
import type { ResetColdStartParams } from "../schemas.js";

type ResetResult = {
  success: boolean;
  message: string;
};

export class ResetColdStartTool extends BaseTool<ResetColdStartParams, ResetResult> {
  protected async executeImpl(_params: ResetColdStartParams, userId: UserId): Promise<ResetResult> {
    const threadId = `cold_start_${userId}`;

    const wasCompleted = await postgresService.resetColdStartStatus(userId);
    await postgresService.deleteCheckpoint(threadId);

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
