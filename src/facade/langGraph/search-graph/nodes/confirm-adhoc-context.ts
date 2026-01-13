import { interrupt } from "@langchain/langgraph";

import { NODE, PHASE } from "../state.js";
import { withLogging } from "../with-logging.js";

import type { Goal } from "../../../../../private/schemas.js";
import type { SearchStateType } from "../state.js";

/**
 * Confirm adhoc context node: shows extracted context and asks what to do next.
 * Loads goal from DB and presents options based on whether goal exists.
 * NLP formatter generates user-facing text based on structured data.
 */
export const confirmAdhocContextNode = withLogging<SearchStateType>(
  NODE.confirm_adhoc_context,
  async (state, _config, { coreClient }) => {
    // Load goal from DB
    let storedGoal: Goal | null = null;
    try {
      storedGoal = await coreClient.client.goal.getByUser.query({ userId: state.userId });
    } catch {
      storedGoal = null;
    }

    const userResponse = interrupt({
      type: "confirm_adhoc_context",
      phase: PHASE.confirming_adhoc_context,
      adhocContext: state.adhocContext,
      hasGoal: storedGoal !== null,
    });

    return {
      userResponse: String(userResponse),
      storedGoal,
      phase: PHASE.confirming_adhoc_context,
      currentSearchParams: state.currentSearchParams,
      targetSearchParams: state.targetSearchParams,
    };
  },
);
