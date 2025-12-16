import { createResponse } from "./converse-response.js";

import type { ConverseResponse } from "./converse-response.js";
import type { UserIntent } from "./intent-classifier.js";
import type { UserId } from "../../../shared/schemas.js";
import type { CoreClient } from "../../core-client.js";

/**
 * Guard message hints for MCP clients.
 * Facade returns informative hints (not full NLP), clients expand to natural language.
 */
const GUARD_MESSAGES = {
  help: "Help: explain bot features - save career story, set goals, find similar professionals who reached your target",
  onboarding: "Onboarding: offer two paths - full career story (complete trajectory) or quick search (no saving)",
  cancelNoActive: "Info: no active operations to cancel",
  goalNotSet: "Info: user has no career goal set yet",
  goalNotSetDelete: "Error: cannot delete goal - user has no goal set",
} as const;

type GuardMessageCode = keyof typeof GUARD_MESSAGES;

function createGuardResponse(code: GuardMessageCode): ConverseResponse {
  return createResponse(GUARD_MESSAGES[code]);
}

export class FlowGuardChecker {
  constructor(private readonly coreClient: CoreClient) {}

  /* eslint-disable-next-line complexity -- guard conditions are linear and readable */
  async check(intent: UserIntent, userId: UserId): Promise<ConverseResponse | null> {
    // Help
    if (intent === "help") {
      return createGuardResponse("help");
    }

    // Cancel without active graph (active graph handled in ConverseTool)
    if (intent === "cancel") {
      return createGuardResponse("cancelNoActive");
    }

    const state = await this.coreClient.client.user.getState.query({ userId });

    // Onboarding — no context
    if (!state.hasContext) {
      const isStart = intent === "startStory" || intent === "startAdhoc";
      if (!isStart) {
        return createGuardResponse("onboarding");
      }
      return null;
    }

    // Goal guards
    if (intent === "getGoal" && !state.hasGoal) {
      return createGuardResponse("goalNotSet");
    }
    if (intent === "deleteGoal" && !state.hasGoal) {
      return createGuardResponse("goalNotSetDelete");
    }

    return null;
  }
}
