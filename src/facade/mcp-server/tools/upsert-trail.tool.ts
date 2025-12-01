import { upsertTrailInputSchema } from "../../../shared/schemas.js";

import { BaseTool } from "./base-tool.js";

import type { UpsertSingleTrailResult, UserId } from "../../../shared/schemas.js";
import type { UpsertTrailParams } from "../schemas.js";

export class UpsertTrailTool extends BaseTool<UpsertTrailParams, UpsertSingleTrailResult> {
  protected async executeImpl(
    params: UpsertTrailParams,
    userId: UserId,
  ): Promise<UpsertSingleTrailResult> {
    const normalizedSkill = await this.normalizer.normalizeSkill(params.trail.skill, userId);

    const normalizedTrail = { ...params.trail, skill: normalizedSkill };

    const validated = upsertTrailInputSchema.parse({ userId, trail: normalizedTrail });

    return this.coreClient.client.trail.upsert.mutate(validated);
  }
}
