import { upsertContextInputSchema } from "../../../shared/schemas.js";

import { BaseTool } from "./base-tool.js";

import type { UpsertSingleContextResult, UserId } from "../../../shared/schemas.js";
import type { UpsertContextParams } from "../schemas.js";

export class UpsertContextTool extends BaseTool<UpsertContextParams, UpsertSingleContextResult> {
  protected async executeImpl(
    params: UpsertContextParams,
    userId: UserId,
  ): Promise<UpsertSingleContextResult> {
    const normalizedPartial = await this.normalizer.normalizeUserContext(params.context, userId);

    const validated = upsertContextInputSchema.parse({ userId, context: normalizedPartial });

    return this.coreClient.client.context.upsertContext.mutate(validated);
  }
}
