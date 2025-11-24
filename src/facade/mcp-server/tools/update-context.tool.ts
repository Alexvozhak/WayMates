import { updateContextInputSchema } from "../../../shared/schemas.js";

import { BaseTool } from "./base-tool.js";

import type { UserContext, UserId } from "../../../shared/schemas.js";
import type { UpdateContextToolParams } from "../schemas.js";

export class UpdateContextTool extends BaseTool<UpdateContextToolParams, UserContext> {
  protected async executeImpl(
    params: UpdateContextToolParams,
    userId: UserId,
  ): Promise<UserContext> {
    const updateInput = updateContextInputSchema.parse(params.updates);
    const normalizedPartial = await this.normalizer.normalizeUserContext(updateInput, userId);

    // Merge normalized fields with original updates (normalizer only returns normalized fields)
    const fullUpdates = { ...updateInput, ...normalizedPartial };

    const validated = updateContextInputSchema.parse(fullUpdates);

    const result = await this.coreClient.client.context.update.mutate({
      userId,
      updates: validated,
    });

    return result;
  }
}
