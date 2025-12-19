import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";

const currentSearchParamsModificationSchema = z.object({
  excludedContextFields: z.array(z.string()).nullable(),
  excludedCreationReasons: z.array(z.string()).nullable(),
  recencyThresholdMonths: z.number().nullable(),
  limit: z.number().nullable(),
});

const intentWithFiltersSchema = z.object({
  parsed: z.discriminatedUnion("intent", [
    z.object({
      intent: z.literal("validate"),
      filters: z.object({}).nullable(),
    }),
    z.object({
      intent: z.literal("filter"),
      filters: currentSearchParamsModificationSchema.nullable(),
    }),
    z.object({
      intent: z.literal("clarify"),
      clarificationText: z.string(),
      filters: z.null(),
    }),
    z.object({
      intent: z.enum(["proceed", "save", "change", "delete", "cancel", "unknown"]),
      filters: z.null(),
    }),
  ]),
});

const USER_INTENT_PROMPT = `Classify user's intent. Response may be in any language.

Intents:
- PROCEED: User expresses a career goal, states what position/role they want, confirms readiness to move forward, or agrees
- VALIDATE: User wants to see real people who achieved similar goals, check trajectories, validate feasibility
- CLARIFY: User adds details or refines the current goal (countries, skills, domains)
- SAVE: User explicitly confirms saving the goal
- CHANGE: User wants to completely change the goal to something different (not add details)
- DELETE: User wants to delete the goal and start over
- FILTER: User wants to refine search parameters (exclude fields, reasons, adjust limits)
  + filters: { excludedContextFields, excludedCreationReasons, recencyThresholdMonths, limit } or null
- CANCEL: User explicitly wants to stop, cancel, or exit
- UNKNOWN: Message is unrelated, unclear, or gibberish

Return: { intent, clarificationText (for clarify), filters (for validate/filter) }`;

async function main() {
  const model = new ChatOpenAI({
    model: "openai/gpt-4o-mini",
    temperature: 0,
    configuration: {
      baseURL: "https://openrouter.ai/api/v1",
    },
  }).withStructuredOutput(intentWithFiltersSchema);

  const testMessages = [
    "покажи без учёта города и страны",
    "покажи без учёта индустрии",
    "исключи город и страну из поиска",
  ];

  for (const msg of testMessages) {
    console.log(`\n=== Message: "${msg}" ===`);
    const result = await model.invoke([
      { role: "system", content: USER_INTENT_PROMPT },
      { role: "user", content: msg },
    ]);
    console.log("Result:", JSON.stringify(result, null, 2));
  }
}

main().catch(console.error);
