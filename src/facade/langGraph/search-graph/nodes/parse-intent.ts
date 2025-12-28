import { z } from "zod";

import {
  currentContextSearchFilterNullableSchema,
  targetContextSearchFilterNullableSchema,
} from "../../../../shared/schemas.js";
import { getModel } from "../../shared-tools/models.js";
import { buildUserIntentPrompt } from "../prompts/classification.js";
import { SIMPLE_INTENTS } from "../state.js";

import type { RouteFlags } from "../search-router.js";
import type { SearchPhase } from "../state.js";

// Workaround for OpenAI structured output: discriminatedUnion must be wrapped in object
// See: https://github.com/openai/openai-node/issues/995
const intentWithFiltersSchema = z.object({
  parsed: z.discriminatedUnion("intent", [
    z.object({
      intent: z.literal("validate"),
      reasoning: z.string(),
      filters: targetContextSearchFilterNullableSchema.nullable(),
    }),
    z.object({
      intent: z.literal("filter"),
      reasoning: z.string(),
      filters: currentContextSearchFilterNullableSchema.nullable(),
    }),
    z.object({
      intent: z.literal("clarify"),
      reasoning: z.string(),
      filters: z.null(),
    }),
    z.object({
      intent: z.literal("ask"),
      reasoning: z.string(),
      question: z.string(),
      filters: z.null(),
    }),
    z.object({
      intent: z.enum(SIMPLE_INTENTS),
      reasoning: z.string(),
      filters: z.null(),
    }),
  ]),
});

export type ParsedIntent = z.infer<typeof intentWithFiltersSchema>["parsed"];

const intentParser = getModel("deterministic").withStructuredOutput(intentWithFiltersSchema);

export async function parseUserIntent(
  userMessage: string,
  phase: SearchPhase,
  flags: RouteFlags,
): Promise<ParsedIntent> {
  const prompt = buildUserIntentPrompt(phase, flags);

  const { parsed } = await intentParser.invoke([
    { role: "system", content: prompt },
    { role: "user", content: userMessage },
  ]);

  return parsed;
}
