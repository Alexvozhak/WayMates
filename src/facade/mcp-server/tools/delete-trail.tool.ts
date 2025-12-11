import { BaseTool } from "./base-tool.js";

import type { McpDeleteTrailParams, UserId } from "../../../shared/schemas.js";

export class DeleteTrailTool extends BaseTool<McpDeleteTrailParams, void> {
  protected async executeImpl(params: McpDeleteTrailParams, userId: UserId): Promise<void> {
    await this.coreClient.client.trail.delete.mutate({
      userId,
      trailId: params.trailId,
    });
  }
}
