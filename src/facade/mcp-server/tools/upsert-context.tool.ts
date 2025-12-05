import { postgresService } from "../../infrastructure/postgres.service.js";
import { PHASE } from "../../langchain/upsert-context/state.js";
import { UpsertContextGraph } from "../../langchain/upsert-context/upsert-context-graph.js";

import { BaseTool } from "./base-tool.js";

import type { AdhocUserContext, UserContext, UserId } from "../../../shared/schemas.js";
import type { UpsertContextResponse } from "../../langchain/upsert-context/types.js";
import type { UpsertContextParams } from "../schemas.js";

export class UpsertContextTool extends BaseTool<UpsertContextParams, UpsertContextResponse> {
  protected async executeImpl(params: UpsertContextParams, userId: UserId): Promise<UpsertContextResponse> {
    const threadId = `upsert_ctx_${userId}`;

    const graph = new UpsertContextGraph(userId);
    const response = await graph.run(params.message, threadId);

    if (response.phase === PHASE.approved) {
      await this.saveContext(response.context, userId);
      await postgresService.deleteCheckpoint(threadId);
    }

    return response;
  }

  private async saveContext(context: UserContext, userId: UserId): Promise<void> {
    const normalized = await this.normalizer.normalizeUserContext(
      {
        position: context.position,
        skills: context.skills,
        domains: context.domains,
        industry: context.industry,
        cityName: context.cityName,
      },
      userId,
    );

    const merged = this.mergeNormalized(context, normalized);

    await this.coreClient.client.context.upsertContext.mutate({
      userId,
      context: merged,
    });
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
}
