import { postgresService } from "../../infrastructure/postgres.service.js";
import { PHASE } from "../../langchain/upsert-trail/state.js";
import { UpsertTrailGraph } from "../../langchain/upsert-trail/upsert-trail-graph.js";

import { BaseTool } from "./base-tool.js";

import type { Trail, UserId } from "../../../shared/schemas.js";
import type { UpsertTrailResponse } from "../../langchain/upsert-trail/types.js";
import type { UpsertTrailParams } from "../schemas.js";

export class UpsertTrailTool extends BaseTool<UpsertTrailParams, UpsertTrailResponse> {
  protected async executeImpl(params: UpsertTrailParams, userId: UserId): Promise<UpsertTrailResponse> {
    const threadId = `upsert_trail_${userId}`;

    const graph = new UpsertTrailGraph(userId, params.fromContextId ?? null);
    const response = await graph.run(params.message, threadId);

    if (response.phase === PHASE.approved) {
      await this.saveTrail(response.trail, userId);
      await postgresService.deleteCheckpoint(threadId);
    }

    return response;
  }

  private async saveTrail(trail: Trail, userId: UserId): Promise<void> {
    const normalizedSkill = await this.normalizer.normalizeSkill(trail.skill, userId);
    const normalizedPlatform = await this.normalizer.normalizePlatform(trail.platform, userId);

    const normalizedTrail = {
      ...trail,
      skill: normalizedSkill,
      platform: normalizedPlatform,
    };

    await this.coreClient.client.trail.upsert.mutate({
      userId,
      trail: normalizedTrail,
    });
  }
}
