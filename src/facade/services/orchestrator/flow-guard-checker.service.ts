import { createNlpResponse } from "./converse-response.js";

import type { ConverseResponse } from "./converse-response.js";
import type { UserIntent } from "./intent-classifier.js";
import type { UserId } from "../../../shared/schemas.js";
import type { CoreClient } from "../../core-client.js";

/**
 * System messages for flow guards - full English, friendly style.
 * Client LLMs translate to user's language (no expansion needed).
 */
const greetingMessage = `Hey! 👋 I help with career stuff.

Tell me about yourself — or just write "I'm a backend developer" and let's find similar folks.`;

const helpMessage = `Sure, here's what I can do:

• Tell your story — I'll save your career path
• Set a goal — where do you want to be?
• Find similar — people like you or who reached your goal

Just write naturally, I'll get it.`;

const onboardingMessage = `Let's go! Tell me about yourself:

• Full story — share your career journey
• Quick search — just describe who you are and we'll find matches`;

const cancelNoActiveMessage = "Nothing to cancel right now.";
const goalNotSetMessage = "You don't have a goal yet. Want to set one?";
const goalNotSetDeleteMessage = "No goal to delete — you haven't set one yet.";

const unknownMessage = `Hmm, didn't catch that. Try:

• Describe yourself — "I'm a senior frontend dev"
• Set a goal — "I want to move into data science"
• Or just say "help"`;

export class FlowGuardChecker {
  constructor(private readonly coreClient: CoreClient) {}

  /* eslint-disable-next-line complexity -- guard conditions are linear and readable */
  async check(intent: UserIntent, userId: UserId): Promise<ConverseResponse | null> {
    // Greeting — friendly opener
    if (intent === "greeting") {
      return createNlpResponse(greetingMessage);
    }

    // Help
    if (intent === "help") {
      return createNlpResponse(helpMessage);
    }

    // Unknown — unclear or garbage input
    if (intent === "unknown") {
      return createNlpResponse(unknownMessage);
    }

    // Cancel without active graph (active graph handled in ConverseTool)
    if (intent === "cancel") {
      return createNlpResponse(cancelNoActiveMessage);
    }

    const state = await this.coreClient.client.user.getState.query({ userId });

    // Onboarding — no context
    if (!state.hasContext) {
      const isStart = intent === "startStory" || intent === "startAdhoc";
      if (!isStart) {
        return createNlpResponse(onboardingMessage);
      }
      return null;
    }

    // Goal guards
    if (intent === "getGoal" && !state.hasGoal) {
      return createNlpResponse(goalNotSetMessage);
    }
    if (intent === "deleteGoal" && !state.hasGoal) {
      return createNlpResponse(goalNotSetDeleteMessage);
    }

    return null;
  }
}
