import { UpdateContextWorkflow } from "../../langchain/update-context/update-context-agent.js";

import { BaseTool } from "./base-tool.js";

import type { UserContext, UserId } from "../../../shared/schemas.js";
import type { UpdateContextResponse } from "../../langchain/update-context/types.js";
import type { UpdateContextParams } from "../schemas.js";

export class UpdateContextTool extends BaseTool<UpdateContextParams, UpdateContextResponse> {
  protected async executeImpl(params: UpdateContextParams, userId: UserId): Promise<UpdateContextResponse> {
    const threadId = `update_ctx_${userId}`;

    const currentContext = await this.loadCurrentContext(userId);
    if (!currentContext) {
      return {
        phase: "failed",
        message: "No current context found. Use cold_start first.",
      };
    }

    const workflow = new UpdateContextWorkflow(userId, currentContext);
    const response = await workflow.run(params.message, threadId);

    if (response.phase === "saved") {
      await this.saveUpdatedContext(response.updatedContext, userId);
    }

    return response;
  }

  private async loadCurrentContext(userId: UserId): Promise<UserContext | null> {
    const story = await this.coreClient.client.story.getStory.query({ userId });
    const current = story.contexts.find((ctx) => ctx.nextContextId === null);
    return current ?? null;
  }

  private async saveUpdatedContext(context: UserContext, userId: UserId): Promise<void> {
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

    const merged = { ...context, ...normalized };

    await this.coreClient.client.context.update.mutate({
      userId,
      updates: merged,
    });
  }
}
