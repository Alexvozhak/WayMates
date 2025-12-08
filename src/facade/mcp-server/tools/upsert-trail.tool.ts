import { PHASE } from "../../langGraph/upsert-trail/state.js";
import { UpsertTrailGraph } from "../../langGraph/upsert-trail/upsert-trail-graph.js";

import { BaseTool } from "./base-tool.js";

import type { UserId } from "../../../shared/schemas.js";
import type { UpsertTrailResponse } from "../../langGraph/upsert-trail/types.js";
import type { UpsertTrailParams } from "../schemas.js";

export class UpsertTrailTool extends BaseTool<UpsertTrailParams, UpsertTrailResponse> {
  protected async executeImpl(params: UpsertTrailParams, userId: UserId): Promise<UpsertTrailResponse> {
    const threadId = `upsert_trail_${userId}`;
    const checkpointer = this.checkpointService.getCheckpointer();

    const graph = new UpsertTrailGraph(userId, params.fromContextId ?? null, checkpointer);
    const response = await graph.run(params.message, threadId, this.coreClient, this.normalizer);

    if (response.phase === PHASE.saved) {
      await this.checkpointService.delete(threadId);
    }

    return response;
  }
}
