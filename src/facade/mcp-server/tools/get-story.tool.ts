import { BaseTool } from "./base-tool.js";

import type { McpGetStoryParams, StoryInput, UserId } from "../../../shared/schemas.js";

export class GetStoryTool extends BaseTool<McpGetStoryParams, StoryInput> {
  protected async executeImpl(params: McpGetStoryParams, userId: UserId): Promise<StoryInput> {
    // targetUserId optional - if not provided, use service userId
    // If provided, user can request any userId (own or other user's profile)
    const targetUserId = params.targetUserId || userId;

    const result = await this.coreClient.client.story.getStory.query({ userId: targetUserId });

    return {
      userId: targetUserId,
      contexts: result.contexts,
      trails: result.trails,
    };
  }
}
