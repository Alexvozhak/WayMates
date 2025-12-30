import { z } from "zod";

import { logger } from "../../../logger.js";
import { withReasoning } from "../../../utils/llm-schemas.js";
import { getModel } from "../../shared-tools/models.js";
import { ADVISOR_INTENT_PROMPT } from "../prompts/advisor.js";
import { NODE } from "../state.js";
import { withLogging } from "../with-logging.js";

import type { AdvisorIntent, SearchStateType } from "../state.js";

const advisorIntentSchema = z.object({
  intent: z.enum(["ask", "action", "done"]),
});

const intentParser = getModel("deterministic").withStructuredOutput(
  withReasoning(advisorIntentSchema, "Explain why you classified this as ask/action/done")
);

async function parseAdvisorIntent(userMessage: string): Promise<AdvisorIntent> {
  const { reasoning, ...result } = await intentParser.invoke([
    { role: "system", content: ADVISOR_INTENT_PROMPT },
    { role: "user", content: userMessage },
  ]);
  logger.info({ reasoning }, "advisor intent reasoning");

  return result.intent;
}

export const parseAdvisorIntentNode = withLogging<SearchStateType>(
  NODE.parse_advisor_intent,
  async (state, _config, _deps) => {
    const { userResponse } = state;

    const intent = await parseAdvisorIntent(userResponse);

    const advisorQuestion = intent === "ask" ? userResponse : null;

    return {
      advisorIntent: intent,
      advisorQuestion,
      // Keep userResponse for action — main flow will process it
      userResponse: intent === "action" ? userResponse : "",
    };
  },
);
