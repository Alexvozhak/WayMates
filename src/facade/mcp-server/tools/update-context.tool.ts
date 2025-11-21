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

    const validated = updateContextInputSchema.parse(normalizedPartial);

    return this.coreClient.client.context.update.mutate({
      userId,
      updates: validated,
    });
  }
}
