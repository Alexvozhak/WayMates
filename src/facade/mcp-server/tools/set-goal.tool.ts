import { mcpSetGoalParamsSchema, targetContextSchema } from "../../../shared/schemas.js";
import { ValidationError } from "../../errors.js";

import { BaseTool } from "./base-tool.js";

import type { BaseToolDependencies } from "./base-tool.js";
import type { McpSetGoalParams, SetGoalResponse, UserId } from "../../../shared/schemas.js";

export class SetGoalTool extends BaseTool<McpSetGoalParams, SetGoalResponse> {
  constructor(deps: BaseToolDependencies) {
    super(deps, mcpSetGoalParamsSchema);
  }

  protected async executeImpl(params: McpSetGoalParams, userId: UserId): Promise<SetGoalResponse> {
    const normalizedPartial = await this.normalizer.normalizeTargetContext(params.targetContext, userId);

    const normalized = targetContextSchema.parse(normalizedPartial);

    const hasAnyCriterion = Object.values(normalized).some((v) => v !== undefined);
    if (!hasAnyCriterion) {
      throw new ValidationError("At least one target criterion is required for goal");
    }

    const result = await this.coreClient.client.goal.set.mutate({
      userId,
      targetContext: normalized,
    });

    return result;
  }
}
