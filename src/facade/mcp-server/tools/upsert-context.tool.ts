import { mcpUpsertContextParamsSchema } from "../../../../private/schemas.js";
import { PHASE } from "../../langGraph/upsert-context/state.js";
import { UpsertContextGraph } from "../../langGraph/upsert-context/upsert-context-graph.js";

import { BaseTool } from "./base-tool.js";

import type { BaseToolDependencies } from "./base-tool.js";
import type { Locale, McpUpsertContextParams, UserId } from "../../../../private/schemas.js";
import type { UpsertContextResponse } from "../../langGraph/upsert-context/types.js";

export class UpsertContextTool extends BaseTool<McpUpsertContextParams, UpsertContextResponse> {
  constructor(deps: BaseToolDependencies) {
    super(deps, mcpUpsertContextParamsSchema);
  }

  protected async executeImpl(params: McpUpsertContextParams, userId: UserId): Promise<UpsertContextResponse> {
    const threadId = `upsert_ctx_${userId}`;
    const locale: Locale = params.locale ?? "en";

    const graph = new UpsertContextGraph(this.graphDeps);
    const response = await graph.run(params.message, threadId, userId, locale);

    if (response.phase === PHASE.saved) {
      await this.checkpointService.delete(threadId);
    }

    return response;
  }
}
