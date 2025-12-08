import { targetContextSchema } from "../../../shared/schemas.js";
import { ValidationError } from "../../errors.js";

import { BaseTool } from "./base-tool.js";

import type { UserId } from "../../../shared/schemas.js";
import type { SetGoalParams } from "../schemas.js";

type SetGoalResult = {
  goalId: string;
};

export class SetGoalTool extends BaseTool<SetGoalParams, SetGoalResult> {
  protected async executeImpl(params: SetGoalParams, userId: UserId): Promise<SetGoalResult> {
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
