import { mcpUpsertTrailParamsSchema } from "../../../shared/schemas.js";
import { PHASE } from "../../langGraph/upsert-trail/state.js";
import { UpsertTrailGraph } from "../../langGraph/upsert-trail/upsert-trail-graph.js";

import { BaseTool } from "./base-tool.js";

import type { BaseToolDependencies } from "./base-tool.js";
import type { Locale, McpUpsertTrailParams, UserId } from "../../../shared/schemas.js";
import type { UpsertTrailResponse } from "../../langGraph/upsert-trail/types.js";

export class UpsertTrailTool extends BaseTool<McpUpsertTrailParams, UpsertTrailResponse> {
  constructor(deps: BaseToolDependencies) {
    super(deps, mcpUpsertTrailParamsSchema);
  }

  protected async executeImpl(params: McpUpsertTrailParams, userId: UserId): Promise<UpsertTrailResponse> {
    const threadId = `upsert_trail_${userId}`;
    const locale: Locale = params.locale ?? "en";

    const graph = new UpsertTrailGraph(this.graphDeps);
    const response = await graph.run(params.message, threadId, userId, params.fromContextId ?? null, locale);

    if (response.phase === PHASE.saved) {
      await this.checkpointService.delete(threadId);
    }

    return response;
  }
}
