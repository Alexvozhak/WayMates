import { PHASE } from "../../langGraph/upsert-context/state.js";
import { UpsertContextGraph } from "../../langGraph/upsert-context/upsert-context-graph.js";

import { BaseTool } from "./base-tool.js";

import type { UserId } from "../../../shared/schemas.js";
import type { UpsertContextResponse } from "../../langGraph/upsert-context/types.js";
import type { UpsertContextParams } from "../schemas.js";

export class UpsertContextTool extends BaseTool<UpsertContextParams, UpsertContextResponse> {
  protected async executeImpl(params: UpsertContextParams, userId: UserId): Promise<UpsertContextResponse> {
    const threadId = `upsert_ctx_${userId}`;

    const checkpointer = this.checkpointService.getCheckpointer();
    const graph = new UpsertContextGraph(userId, checkpointer);
    const response = await graph.run(params.message, threadId, this.coreClient, this.normalizer);

    if (response.phase === PHASE.saved) {
      await this.checkpointService.delete(threadId);
    }

    return response;
  }
}
