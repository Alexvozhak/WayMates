import { loadCurrentContext } from "./context-utils.js";
import { createSystemMessage } from "./converse-response.js";

import type { ConverseResponse } from "./converse-response.js";
import type { UserIntent } from "./intent-classifier.js";
import type { UserId } from "../../../shared/schemas.js";
import type { CoreClient } from "../../core-client.js";

/**
 * System messages for query operations - full English NLP.
 * Client LLMs translate to user's language (no expansion needed).
 */
const storyEmptyMessage = "You don't have a saved story yet. Tell me about yourself!";
const goalNotSetMessage = "You don't have a goal set. Would you like to set one?";
const goalExistsMessage = "Your goal is set.";
const goalDeletedMessage = "Goal deleted.";
const goalDeleteFailedMessage = "No goal to delete.";
const contextDeletedMessage = "Current context deleted.";
const contextDeleteFailedMessage = "No context to delete.";
const trailDeleteUsageMessage = "To delete a trail, use get_story to find trail ID, then delete_trail tool.";

/**
 * Creates story stats message with dynamic data.
 */
function createStoryStatsMessage(contexts: number, trails: number): string {
  return `Your story: ${contexts} positions, ${trails} trails.`;
}

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
        return createSystemMessage(trailDeleteUsageMessage);
      }
      default: {
        return null;
      }
    }
  }

  private async getStory(userId: UserId): Promise<ConverseResponse> {
    const story = await this.coreClient.client.story.getStory.query({ userId });
    if (story.contexts.length === 0) {
      return createSystemMessage(storyEmptyMessage);
    }
    return createSystemMessage(createStoryStatsMessage(story.contexts.length, story.trails.length));
  }

  private async getGoal(userId: UserId): Promise<ConverseResponse> {
    const goal = await this.coreClient.client.goal.getByUser.query({ userId });
    if (!goal) {
      return createSystemMessage(goalNotSetMessage);
    }
    return createSystemMessage(goalExistsMessage);
  }

  private async deleteGoal(userId: UserId): Promise<ConverseResponse> {
    const result = await this.coreClient.client.goal.delete.mutate({ userId });
    if (!result.success) {
      return createSystemMessage(goalDeleteFailedMessage);
    }
    return createSystemMessage(goalDeletedMessage);
  }

  private async deleteContext(userId: UserId): Promise<ConverseResponse> {
    const currentContext = await loadCurrentContext(this.coreClient, userId);
    if (!currentContext) {
      return createSystemMessage(contextDeleteFailedMessage);
    }
    await this.coreClient.client.context.delete.mutate({ userId, contextId: currentContext.contextId });
    return createSystemMessage(contextDeletedMessage);
  }
}
