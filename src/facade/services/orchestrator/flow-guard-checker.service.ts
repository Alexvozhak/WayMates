import { createResponse } from "./converse-response.js";

import type { ConverseResponse } from "./converse-response.js";
import type { UserIntent } from "./intent-classifier.js";
import type { UserId } from "../../../shared/schemas.js";
import type { CoreClient } from "../../core-client.js";

const ONBOARDING = `Let's start! Tell me about yourself:
• Full career story — your complete trajectory
• Quick search — find similar careers without saving profile`;

const HELP = `I can help you find your career path!

• Tell me about yourself — I'll save your career story
• Set a goal — Define where you want to go
• Find similar — I'll show pathfinders who reached your goal

Just write naturally and I'll understand what you need.`;

export class FlowGuardChecker {
  constructor(private readonly coreClient: CoreClient) {}

  /* eslint-disable-next-line complexity -- guard conditions are linear and readable */
  async check(intent: UserIntent, userId: UserId): Promise<ConverseResponse | null> {
    // Help
    if (intent === "help") {
      return createResponse(HELP);
    }

    // Cancel without active graph (active graph handled in ConverseTool)
    if (intent === "cancel") {
      return createResponse("No active operations to cancel.");
    }

    const state = await this.coreClient.client.user.getState.query({ userId });

    // Onboarding — no context
    if (!state.hasContext) {
      const isStart = intent === "startStory" || intent === "startAdhoc";
      if (!isStart) {
        return createResponse(ONBOARDING);
      }
      return null;
    }

    // Goal guards
    if (intent === "getGoal" && !state.hasGoal) {
      return createResponse("You don't have a goal set yet.");
    }
    if (intent === "deleteGoal" && !state.hasGoal) {
      return createResponse("You don't have a goal to delete.");
    }

    return null;
  }
}
