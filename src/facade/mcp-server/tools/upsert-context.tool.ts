import { BaseTool } from "./base-tool.js";

import type { UpsertSingleContextResult, UserId } from "../../../shared/schemas.js";
import type { UpsertContextParams } from "../schemas.js";

export class UpsertContextTool extends BaseTool<UpsertContextParams, UpsertSingleContextResult> {
  protected async executeImpl(
    params: UpsertContextParams,
    userId: UserId,
  ): Promise<UpsertSingleContextResult> {
    // userId extracted from sessionId by BaseTool
    // Remove sessionId before passing to Core API
    const { sessionId: _, ...contextData } = params;

    return this.coreClient.client.context.upsertContext.mutate({
      userId,
      ...contextData,
    });
  }
}
