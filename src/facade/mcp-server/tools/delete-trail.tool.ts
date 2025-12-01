import { BaseTool } from "./base-tool.js";

import type { UserId } from "../../../shared/schemas.js";
import type { DeleteTrailParams } from "../schemas.js";

export class DeleteTrailTool extends BaseTool<DeleteTrailParams, void> {
  protected async executeImpl(params: DeleteTrailParams, userId: UserId): Promise<void> {
    await this.coreClient.client.trail.delete.mutate({
      userId,
      trailId: params.trailId,
    });
  }
}
