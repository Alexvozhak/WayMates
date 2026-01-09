import { getModel } from "../../langGraph/shared-tools/models.js";
import { NlpFormatter } from "../nlp-formatter/index.js";

import { createNlpResponse } from "./converse-response.js";

import type { ConverseResponse } from "./converse-response.js";
import type { UserIntent } from "./intent-classifier.js";
import type { Locale, UserId } from "../../../shared/schemas.js";
import type { CoreClient } from "../../core-client.js";
import type { GuardType } from "../nlp-formatter/prompts.js";

type UserState = { hasContext: boolean; hasGoal: boolean };

const STATELESS_GUARDS: Partial<Record<UserIntent, GuardType>> = {
  help: "help",
  unknown: "unknown",
  cancel: "cancelNoActive",
};

export class FlowGuardChecker {
  private readonly nlpFormatter: NlpFormatter;

  constructor(private readonly coreClient: CoreClient) {
    this.nlpFormatter = new NlpFormatter(getModel("agent"));
  }

  async check(intent: UserIntent, userId: UserId, locale: Locale): Promise<ConverseResponse | null> {
    const statelessGuard = STATELESS_GUARDS[intent];
    if (statelessGuard) {
      return this.formatGuard(statelessGuard, locale);
    }

    const state = await this.coreClient.client.user.getState.query({ userId });
    return this.checkStatefulGuards(intent, state, locale);
  }

  private async checkStatefulGuards(
    intent: UserIntent,
    state: UserState,
    locale: Locale,
  ): Promise<ConverseResponse | null> {
    const guard = this.getStatefulGuard(intent, state);
    if (guard) {
      return this.formatGuard(guard, locale);
    }
    return null;
  }

  private getStatefulGuard(intent: UserIntent, state: UserState): GuardType | null {
    if (!state.hasContext) {
      return this.getNoContextGuard(intent);
    }

    // Has profile
    if (intent === "greeting") {
      return state.hasGoal ? "greetingWithProfileWithGoal" : "greetingWithProfileNoGoal";
    }

    // Block startStory for users who already have profile
    if (intent === "startStory") {
      return state.hasGoal ? "greetingWithProfileWithGoal" : "greetingWithProfileNoGoal";
    }

    if (!state.hasGoal) {
      return this.getNoGoalGuard(intent);
    }

    return null;
  }

  private getNoContextGuard(intent: UserIntent): GuardType | null {
    if (intent === "startStory" || intent === "startAdhoc") {
      return null;
    }
    if (intent === "getStory") {
      return "storyNotSet";
    }
    // greeting without profile → same as onboarding
    return "onboarding";
  }

  private getNoGoalGuard(intent: UserIntent): GuardType | null {
    if (intent === "getGoal") {
      return "goalNotSet";
    }
    if (intent === "deleteGoal") {
      return "goalNotSetDelete";
    }
    return null;
  }

  private async formatGuard(guardType: GuardType, locale: Locale): Promise<ConverseResponse> {
    const message = await this.nlpFormatter.formatGuard(guardType, locale);
    return createNlpResponse(message);
  }
}
