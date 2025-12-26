import { z } from "zod";

import { getModel } from "../../shared-tools/models.js";
import { ADVISOR_INTENT_PROMPT } from "../prompts/advisor.js";
import { NODE } from "../state.js";
import { withLogging } from "../with-logging.js";

import type { AdvisorIntent, SearchStateType } from "../state.js";

const advisorIntentSchema = z.object({
  intent: z.enum(["ask", "done"]),
});

const intentParser = getModel("deterministic").withStructuredOutput(advisorIntentSchema);

async function parseAdvisorIntent(userMessage: string): Promise<AdvisorIntent> {
  const result = await intentParser.invoke([
    { role: "system", content: ADVISOR_INTENT_PROMPT },
    { role: "user", content: userMessage },
  ]);

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
      userResponse: "",
    };
  },
);
