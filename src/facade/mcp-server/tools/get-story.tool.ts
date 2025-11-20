import { BaseTool } from "./base-tool.js";

import type { StoryInput, UserId } from "../../../shared/schemas.js";
import type { SessionId } from "../result.js";
import type { GetStoryParams } from "../schemas.js";

export class GetStoryTool extends BaseTool<GetStoryParams, StoryInput> {
  protected extractSessionId(params: GetStoryParams): SessionId {
    return params.sessionId;
  }

  protected async executeImpl(params: GetStoryParams, userId: UserId): Promise<StoryInput> {
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
