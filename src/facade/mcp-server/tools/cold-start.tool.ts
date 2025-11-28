import { postgresService } from "../../infrastructure/postgres.service.js";
import { collectContexts } from "../../langchain/cold-start/cold-start-agent.js";

import { BaseTool } from "./base-tool.js";

import type { AdhocUserContext, UserContext, UserId } from "../../../shared/schemas.js";
import type { ColdStartResponse, CompleteResult } from "../../langchain/cold-start/types.js";
import type { ColdStartParams } from "../schemas.js";

export class ColdStartTool extends BaseTool<ColdStartParams, ColdStartResponse> {
  protected async executeImpl(params: ColdStartParams, userId: UserId): Promise<ColdStartResponse> {
    const threadId = `cold_start_${userId}`;

    const alreadyCompleted = await postgresService.isColdStartCompleted(userId);
    if (alreadyCompleted) {
      return {
        phase: "already_completed",
        message: "Cold start already completed for this user.",
      };
    }

    const response = await collectContexts(params.message, threadId, userId);

    if (response.phase === "complete") {
      await this.handleComplete(response, userId, threadId);
    }

    if (response.phase === "failed") {
      console.error(`❌ Cold start failed for user ${userId}: ${response.message}`);
    }

    return response;
  }

  private async handleComplete(
    response: CompleteResult,
    userId: UserId,
    threadId: string,
  ): Promise<void> {
    const { collectedContexts, collectedTrails } = response;

    const contextsWithNormalization = await Promise.all(
      collectedContexts.map(async (ctx) => {
        const normalized = await this.normalizeContext(ctx, userId);
        return this.mergeNormalized(ctx, normalized);
      }),
    );

    await this.coreClient.client.story.upsertStory.mutate({
      userId,
      contexts: contextsWithNormalization,
      trails: collectedTrails,
    });

    await postgresService.markColdStartCompleted(userId);
    await postgresService.deleteCheckpoint(threadId);
  }

  private mergeNormalized(original: UserContext, normalized: AdhocUserContext): UserContext {
    return {
      ...original,
      position: normalized.position ?? original.position,
      skills: normalized.skills ?? original.skills,
      domains: normalized.domains ?? original.domains,
      industry: normalized.industry ?? original.industry,
      cityName: normalized.cityName ?? original.cityName,
    };
  }

  private async normalizeContext(ctx: UserContext, userId: UserId): Promise<AdhocUserContext> {
    const adhocContext: AdhocUserContext = {
      position: ctx.position,
      skills: ctx.skills,
      domains: ctx.domains,
      industry: ctx.industry,
      cityName: ctx.cityName,
    };

    return this.normalizer.normalizeUserContext(adhocContext, userId);
  }
}
