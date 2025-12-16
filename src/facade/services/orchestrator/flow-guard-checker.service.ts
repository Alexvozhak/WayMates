import { createResponse } from "./converse-response.js";

import type { ConverseResponse } from "./converse-response.js";
import type { UserIntent } from "./intent-classifier.js";
import type { UserId } from "../../../shared/schemas.js";
import type { CoreClient } from "../../core-client.js";

/**
 * System message codes for i18n translation in Telegram Bot.
 * Facade returns codes, Telegram Bot translates via ctx.t(`guard-${code}`).
 */
type GuardMessageCode = "onboarding" | "help" | "cancel-no-active" | "goal-not-set" | "goal-not-set-delete";

function createGuardResponse(code: GuardMessageCode): ConverseResponse {
  return createResponse(`guard-${code}`);
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
      return createGuardResponse("cancel-no-active");
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
      return createGuardResponse("goal-not-set");
    }
    if (intent === "deleteGoal" && !state.hasGoal) {
      return createGuardResponse("goal-not-set-delete");
    }

    return null;
  }
}
