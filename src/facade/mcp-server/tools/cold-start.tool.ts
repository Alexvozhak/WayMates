import { postgresService } from "../../infrastructure/postgres.service.js";
import { ColdStartGraph } from "../../langchain/cold-start-v2/cold-start-graph.js";

import { BaseTool } from "./base-tool.js";

import type { AdhocUserContext, UserContext, UserId } from "../../../shared/schemas.js";
import type { ColdStartResponse, SavedResult } from "../../langchain/cold-start-v2/types.js";
import type { ColdStartParams } from "../schemas.js";

export class ColdStartTool extends BaseTool<ColdStartParams, ColdStartResponse> {
  protected async executeImpl(params: ColdStartParams, userId: UserId): Promise<ColdStartResponse> {
    const threadId = `cold_start_${userId}`;

    const alreadySaved = await postgresService.isColdStartCompleted(userId);
    if (alreadySaved) {
      return {
        phase: "already_saved",
        message: "Cold start already saved for this user.",
      };
    }

    const graph = new ColdStartGraph(userId);
    const response = await graph.run(params.message, threadId);

    if (response.phase === "saved") {
      await this.handleSaved(response, threadId);
    }

    if (response.phase === "failed") {
      console.error(`❌ Cold start failed for user ${userId}: ${response.message}`);
    }

    return response;
  }

  private async handleSaved(response: SavedResult, threadId: string): Promise<void> {
    const { userId, contexts, trails } = response;

    const normalizedContexts = await Promise.all(
      contexts.map(async (ctx) => {
        const normalized = await this.normalizeContext(ctx, userId);
        return this.mergeNormalized(ctx, normalized);
      }),
    );

    await this.coreClient.client.story.upsertStory.mutate({
      userId,
      contexts: normalizedContexts,
      trails,
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
