import { loadCurrentContext } from "./context-utils.js";
import { createResponse } from "./converse-response.js";

import type { ConverseResponse } from "./converse-response.js";
import type { UserIntent } from "./intent-classifier.js";
import type { UserId } from "../../../shared/schemas.js";
import type { CoreClient } from "../../core-client.js";

/**
 * Query message hints for MCP clients.
 * Facade returns informative hints (not full NLP), clients expand to natural language.
 */
const QUERY_MESSAGES = {
  storyEmpty: "Info: user has no saved career story, suggest sharing their background",
  goalNotSet: "Info: user has no career goal set, ask if they want to set one",
  goalExists: "Info: user has active career goal",
  goalDeleted: "Success: career goal deleted",
  goalDeleteFailed: "Error: no goal to delete",
  contextDeleted: "Success: current career position deleted",
  contextDeleteFailed: "Error: no current context to delete",
  trailDeleteUsage: "Info: to delete a trail, use get_story to find trail ID, then delete_trail tool",
} as const;

/**
 * Creates story stats hint with dynamic data.
 */
function createStoryStatsHint(contexts: number, trails: number): string {
  return `Info: show user story stats - ${contexts} positions, ${trails} learning trails`;
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
        return createResponse(QUERY_MESSAGES.trailDeleteUsage);
      }
      default: {
        return null;
      }
    }
  }

  private async getStory(userId: UserId): Promise<ConverseResponse> {
    const story = await this.coreClient.client.story.getStory.query({ userId });
    if (story.contexts.length === 0) {
      return createResponse(QUERY_MESSAGES.storyEmpty);
    }
    return createResponse(createStoryStatsHint(story.contexts.length, story.trails.length));
  }

  private async getGoal(userId: UserId): Promise<ConverseResponse> {
    const goal = await this.coreClient.client.goal.getByUser.query({ userId });
    if (!goal) {
      return createResponse(QUERY_MESSAGES.goalNotSet);
    }
    return createResponse(QUERY_MESSAGES.goalExists);
  }

  private async deleteGoal(userId: UserId): Promise<ConverseResponse> {
    const result = await this.coreClient.client.goal.delete.mutate({ userId });
    if (!result.success) {
      return createResponse(QUERY_MESSAGES.goalDeleteFailed);
    }
    return createResponse(QUERY_MESSAGES.goalDeleted);
  }

  private async deleteContext(userId: UserId): Promise<ConverseResponse> {
    const currentContext = await loadCurrentContext(this.coreClient, userId);
    if (!currentContext) {
      return createResponse(QUERY_MESSAGES.contextDeleteFailed);
    }
    await this.coreClient.client.context.delete.mutate({ userId, contextId: currentContext.contextId });
    return createResponse(QUERY_MESSAGES.contextDeleted);
  }
}
