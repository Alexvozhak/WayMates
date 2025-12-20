import { createSystemMessage } from "./converse-response.js";

import type { ConverseResponse } from "./converse-response.js";
import type { UserIntent } from "./intent-classifier.js";
import type { UserId } from "../../../shared/schemas.js";
import type { CoreClient } from "../../core-client.js";

/**
 * System messages for flow guards - full English NLP.
 * Client LLMs translate to user's language (no expansion needed).
 */
const helpMessage = `I can help you find your career path!

• Tell me about yourself — I'll save your career story
• Set a goal — Define where you want to go
• Find similar — I'll show pathfinders who reached your goal

Just write naturally and I'll understand what you need.`;

const onboardingMessage = `Let's start! Tell me about yourself:
• Full career story — your complete trajectory
• Quick search — find similar careers without saving profile`;

const cancelNoActiveMessage = "No active operations to cancel.";
const goalNotSetMessage = "You don't have a goal set yet.";
const goalNotSetDeleteMessage = "You have no goal to delete.";

const unknownMessage = `I didn't understand that command. Here's what I can do:

Search:
• Quick search — "I'm a junior backend developer"
• Find careers — "show career paths"

Profile:
• Tell story — "tell my career story"
• Add context — "add new position"

Goal:
• Set goal — "I want to become a senior engineer"
• View goal — "show my goal"

Type "help" for more options.`;

export class FlowGuardChecker {
  constructor(private readonly coreClient: CoreClient) {}

  /* eslint-disable-next-line complexity -- guard conditions are linear and readable */
  async check(intent: UserIntent, userId: UserId): Promise<ConverseResponse | null> {
    // Help
    if (intent === "help") {
      return createSystemMessage(helpMessage);
    }

    // Unknown — unclear or garbage input
    if (intent === "unknown") {
      return createSystemMessage(unknownMessage);
    }

    // Cancel without active graph (active graph handled in ConverseTool)
    if (intent === "cancel") {
      return createSystemMessage(cancelNoActiveMessage);
    }

    const state = await this.coreClient.client.user.getState.query({ userId });

    // Onboarding — no context
    if (!state.hasContext) {
      const isStart = intent === "startStory" || intent === "startAdhoc";
      if (!isStart) {
        return createSystemMessage(onboardingMessage);
      }
      return null;
    }

    // Goal guards
    if (intent === "getGoal" && !state.hasGoal) {
      return createSystemMessage(goalNotSetMessage);
    }
    if (intent === "deleteGoal" && !state.hasGoal) {
      return createSystemMessage(goalNotSetDeleteMessage);
    }

    return null;
  }
}
