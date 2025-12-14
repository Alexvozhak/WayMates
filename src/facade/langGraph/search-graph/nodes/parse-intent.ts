import { z } from "zod";

import { getModel } from "../../shared-tools/models.js";
import { USER_INTENT_PROMPT } from "../prompts.js";

import type { SearchUserIntent } from "../state.js";

const intentSchema = z.object({
  intent: z.enum(["search", "validate", "change", "explore", "clarify", "confirm", "cancel"]),
});

const intentParser = getModel("deterministic").withStructuredOutput(intentSchema);

export async function parseUserIntent(userMessage: string): Promise<SearchUserIntent> {
  const result = await intentParser.invoke([
    { role: "system", content: USER_INTENT_PROMPT },
    { role: "user", content: userMessage },
  ]);

  return result.intent;
}
