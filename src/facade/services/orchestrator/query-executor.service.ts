import { loadCurrentContext } from "./context-utils.js";
import { createNlpResponse } from "./converse-response.js";

import type { ConverseResponse } from "./converse-response.js";
import type { UserIntent } from "./intent-classifier.js";
import type { Locale, UserId } from "../../../shared/schemas.js";
import type { CoreClient } from "../../core-client.js";

type QueryMessageType = "storyEmpty" | "goalNotSet" | "goalExists" | "deleted" | "nothingToDelete" | "trailDeleteUsage";

// Only en/ru hardcoded, other locales fallback to en
const QUERY_MESSAGES: Record<"en" | "ru", Record<QueryMessageType, string>> = {
  en: {
    storyEmpty: "No saved story yet. Tell me about your career journey.",
    goalNotSet: "No goal set. Describe where you want to be.",
    goalExists: "Goal is set.",
    deleted: "Done.",
    nothingToDelete: "Nothing to delete.",
    trailDeleteUsage: "To delete a learning record, first check your story.",
  },
  ru: {
    storyEmpty: "История не сохранена. Расскажи о карьерном пути.",
    goalNotSet: "Цель не установлена. Опиши куда хочешь прийти.",
    goalExists: "Цель установлена.",
    deleted: "Готово.",
    nothingToDelete: "Нечего удалять.",
    trailDeleteUsage: "Чтобы удалить запись об обучении, сначала посмотри историю.",
  },
};

function createStoryStatsMessage(contexts: number, trails: number, locale: Locale): string {
  if (locale === "ru") {
    return `Твоя история: ${contexts} позиций, ${trails} переходов.`;
  }
  return `Your story: ${contexts} positions, ${trails} trails.`;
}

function getMessages(locale: Locale): Record<QueryMessageType, string> {
  return locale === "ru" ? QUERY_MESSAGES.ru : QUERY_MESSAGES.en;
}

export class QueryExecutor {
  constructor(private readonly coreClient: CoreClient) {}

  async execute(intent: UserIntent, userId: UserId, locale: Locale): Promise<ConverseResponse | null> {
    const msg = getMessages(locale);

    switch (intent) {
      case "getStory": {
        return this.getStory(userId, locale);
      }
      case "getGoal": {
        return this.getGoal(userId, locale);
      }
      case "deleteGoal": {
        return this.deleteGoal(userId, locale);
      }
      case "deleteContext": {
        return this.deleteContext(userId, locale);
      }
      case "deleteTrail": {
        return createNlpResponse(msg.trailDeleteUsage);
      }
      default: {
        return null;
      }
    }
  }

  private async getStory(userId: UserId, locale: Locale): Promise<ConverseResponse> {
    const msg = getMessages(locale);
    const story = await this.coreClient.client.story.getStory.query({ userId });
    if (story.contexts.length === 0) {
      return createNlpResponse(msg.storyEmpty);
    }
    return createNlpResponse(createStoryStatsMessage(story.contexts.length, story.trails.length, locale));
  }

  private async getGoal(userId: UserId, locale: Locale): Promise<ConverseResponse> {
    const msg = getMessages(locale);
    const goal = await this.coreClient.client.goal.getByUser.query({ userId });
    if (!goal) {
      return createNlpResponse(msg.goalNotSet);
    }
    return createNlpResponse(msg.goalExists);
  }

  private async deleteGoal(userId: UserId, locale: Locale): Promise<ConverseResponse> {
    const msg = getMessages(locale);
    const result = await this.coreClient.client.goal.delete.mutate({ userId });
    if (!result.success) {
      return createNlpResponse(msg.nothingToDelete);
    }
    return createNlpResponse(msg.deleted);
  }

  private async deleteContext(userId: UserId, locale: Locale): Promise<ConverseResponse> {
    const msg = getMessages(locale);
    const currentContext = await loadCurrentContext(this.coreClient, userId);
    if (!currentContext) {
      return createNlpResponse(msg.nothingToDelete);
    }
    await this.coreClient.client.context.delete.mutate({ userId, contextId: currentContext.contextId });
    return createNlpResponse(msg.deleted);
  }
}
