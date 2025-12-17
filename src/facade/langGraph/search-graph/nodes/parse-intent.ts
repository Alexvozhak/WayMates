import { z } from "zod";

import { getModel } from "../../shared-tools/models.js";
import { USER_INTENT_PROMPT } from "../prompts.js";
import { currentSearchParamsModificationSchema, targetSearchParamsModificationSchema } from "../types.js";

// Workaround for OpenAI structured output: discriminatedUnion must be wrapped in object
// See: https://github.com/openai/openai-node/issues/995
const intentWithFiltersSchema = z.object({
  parsed: z.discriminatedUnion("intent", [
    z.object({
      intent: z.literal("validate"),
      filters: targetSearchParamsModificationSchema.nullable(),
    }),
    z.object({
      intent: z.literal("filter"),
      filters: currentSearchParamsModificationSchema.nullable(),
    }),
    z.object({
      intent: z.enum(["proceed", "clarify", "save", "change", "delete", "cancel", "unknown"]),
      filters: z.null(),
    }),
  ]),
});

export type ParsedIntent = z.infer<typeof intentWithFiltersSchema>["parsed"];

const intentParser = getModel("deterministic").withStructuredOutput(intentWithFiltersSchema);

export async function parseUserIntent(userMessage: string): Promise<ParsedIntent> {
  const { parsed } = await intentParser.invoke([
    { role: "system", content: USER_INTENT_PROMPT },
    { role: "user", content: userMessage },
  ]);

  return parsed;
}
