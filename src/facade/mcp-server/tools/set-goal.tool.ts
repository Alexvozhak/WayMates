import { targetContextSchema } from "../../../shared/schemas.js";

import { BaseTool } from "./base-tool.js";

import type { UserId } from "../../../shared/schemas.js";
import type { SetGoalParams } from "../schemas.js";

type SetGoalResult = {
  goalId: string;
};

export class SetGoalTool extends BaseTool<SetGoalParams, SetGoalResult> {
  protected async executeImpl(params: SetGoalParams, userId: UserId): Promise<SetGoalResult> {
    const normalizedPartial = await this.normalizer.normalizeTargetContext(
      params.targetContext,
      userId,
    );

    const normalized = targetContextSchema.parse(normalizedPartial);

    const result = await this.coreClient.client.goal.set.mutate({
      userId,
      targetContext: normalized,
    });

    return result;
  }
}
