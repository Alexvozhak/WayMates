import { loadCurrentContext } from "./context-utils.js";
import { createResponse } from "./converse-response.js";

import type { ConverseResponse } from "./converse-response.js";
import type { UserIntent } from "./intent-classifier.js";
import type { UserId } from "../../../shared/schemas.js";
import type { CoreClient } from "../../core-client.js";

export class QueryExecutor {
  constructor(private readonly coreClient: CoreClient) {}

  async execute(intent: UserIntent, userId: UserId): Promise<ConverseResponse | null> {
    switch (intent) {
      case "getStory": {
        return this.getStory(userId);
      }
      case "getGoal": {
        return this.getGoal(userId);
      }
      case "deleteGoal": {
        return this.deleteGoal(userId);
      }
      case "deleteContext": {
        return this.deleteContext(userId);
      }
      case "deleteTrail": {
        return createResponse("To delete a trail, use get_story to find trail ID, then delete_trail tool.");
      }
      default: {
        return null;
      }
    }
  }

  private async getStory(userId: UserId): Promise<ConverseResponse> {
    const story = await this.coreClient.client.story.getStory.query({ userId });
    if (story.contexts.length === 0) {
      return createResponse("You don't have a saved story yet. Tell me about yourself!");
    }
    return createResponse(`Your story: ${story.contexts.length} positions, ${story.trails.length} trails.`);
  }

  private async getGoal(userId: UserId): Promise<ConverseResponse> {
    const goal = await this.coreClient.client.goal.getByUser.query({ userId });
    if (!goal) {
      return createResponse("You don't have a goal set. Would you like to set one?");
    }
    return createResponse("Your goal is set.");
  }

  private async deleteGoal(userId: UserId): Promise<ConverseResponse> {
    const result = await this.coreClient.client.goal.delete.mutate({ userId });
    if (!result.success) {
      return createResponse("No goal to delete.");
    }
    return createResponse("Goal deleted.");
  }

  private async deleteContext(userId: UserId): Promise<ConverseResponse> {
    const currentContext = await loadCurrentContext(this.coreClient, userId);
    if (!currentContext) {
      return createResponse("No context to delete.");
    }
    await this.coreClient.client.context.delete.mutate({ userId, contextId: currentContext.contextId });
    return createResponse("Current context deleted.");
  }
}
