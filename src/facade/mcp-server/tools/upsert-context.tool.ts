import { mcpUpsertContextParamsSchema } from "../../../shared/schemas.js";
import { PHASE } from "../../langGraph/upsert-context/state.js";
import { UpsertContextGraph } from "../../langGraph/upsert-context/upsert-context-graph.js";

import { BaseTool } from "./base-tool.js";

import type { BaseToolDependencies } from "./base-tool.js";
import type { McpUpsertContextParams, UserId } from "../../../shared/schemas.js";
import type { UpsertContextResponse } from "../../langGraph/upsert-context/types.js";

export class UpsertContextTool extends BaseTool<McpUpsertContextParams, UpsertContextResponse> {
  constructor(deps: BaseToolDependencies) {
    super(deps, mcpUpsertContextParamsSchema);
  }

  protected async executeImpl(params: McpUpsertContextParams, userId: UserId): Promise<UpsertContextResponse> {
    const threadId = `upsert_ctx_${userId}`;

    const graph = new UpsertContextGraph(this.graphDeps);
    const response = await graph.run(params.message, threadId, userId);

    if (response.phase === PHASE.saved) {
      await this.checkpointService.delete(threadId);
    }

    return response;
  }
}
