import { z } from "zod";

import {
  currentContextSearchFilterNullableSchema,
  targetContextSearchFilterNullableSchema,
} from "../../../../shared/schemas.js";
import { getModel } from "../../shared-tools/models.js";
import { USER_INTENT_PROMPT } from "../prompts.js";

// Workaround for OpenAI structured output: discriminatedUnion must be wrapped in object
// See: https://github.com/openai/openai-node/issues/995
const intentWithFiltersSchema = z.object({
  parsed: z.discriminatedUnion("intent", [
    z.object({
      intent: z.literal("validate"),
      filters: targetContextSearchFilterNullableSchema.nullable(),
    }),
    z.object({
      intent: z.literal("filter"),
      filters: currentContextSearchFilterNullableSchema.nullable(),
    }),
    z.object({
      intent: z.literal("clarify"),
      clarificationText: z.string(),
      filters: z.null(),
    }),
    z.object({
      intent: z.literal("ask"),
      question: z.string(),
      filters: z.null(),
    }),
    z.object({
      intent: z.enum(["proceed", "save", "change", "delete", "cancel", "unknown"]),
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
