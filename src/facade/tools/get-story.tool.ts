import { BaseTool } from "./base-tool.js";

import type { StoryInput, UserId } from "../../shared/schemas.js";
import type { SessionId } from "../result.js";
import type { GetStoryParams } from "../schemas.js";

export class GetStoryTool extends BaseTool<GetStoryParams, StoryInput> {
  protected extractSessionId(params: GetStoryParams): SessionId {
    return params.sessionId;
  }

  protected async executeImpl(
    params: GetStoryParams,
    userId: UserId,
  ): Promise<StoryInput> {
    const targetUserId = params.userId || userId;

    const result = await this.coreClient.get<StoryInput>(
      `/story/${targetUserId}`,
    );

    return result;
  }
}
