import { z } from "zod";

import { getModel } from "../../langGraph/shared-tools/models.js";

export const userIntentSchema = z.enum([
  "startStory",
  "startContext",
  "startAdhoc",
  "getStory",
  "setGoal",
  "getGoal",
  "deleteGoal",
  "addContext",
  "updateContext",
  "deleteContext",
  "addTrail",
  "deleteTrail",
  "search",
  "cancel",
  "help",
]);

export type UserIntent = z.infer<typeof userIntentSchema>;

const intentDescriptions: ReadonlyMap<UserIntent, string> = new Map([
  ["startStory", "wants to tell full career story with trajectory"],
  ["startContext", "wants to add only current position"],
  ["startAdhoc", "wants quick search without saving profile"],
  ["getStory", "wants to see saved career story"],
  ["setGoal", "wants to set career goal"],
  ["getGoal", "wants to see current goal"],
  ["deleteGoal", "wants to delete goal"],
  ["addContext", "wants to add new career position/context"],
  ["updateContext", "wants to update/edit current position details"],
  ["deleteContext", "wants to delete a career position"],
  ["addTrail", "wants to add learning trail (course, certification, bootcamp)"],
  ["deleteTrail", "wants to delete a learning trail"],
  ["search", "wants to find similar careers"],
  ["cancel", "wants to cancel current operation"],
  ["help", "needs help with commands"],
]);

const classificationSchema = z.object({
  intent: userIntentSchema,
  extractedData: z
    .object({
      targetPosition: z.string().nullable(),
      searchCriteria: z.string().nullable(),
    })
    .nullable(),
});

export type IntentClassification = z.infer<typeof classificationSchema>;

function buildIntentList(): string {
  return userIntentSchema.options.map((intent) => `- ${intent}: ${intentDescriptions.get(intent)}`).join("\n");
}

const INTENT_CLASSIFICATION_PROMPT = `Classify user intent from their message.

Intent types:
${buildIntentList()}

If user message is unclear or doesn't match any intent, classify as "help".

Extract targetPosition for goal_set, searchCriteria for search intent.`;

const classifier = getModel("deterministic").withStructuredOutput(classificationSchema);

export async function classifyIntent(message: string): Promise<IntentClassification> {
  return classifier.invoke([
    { role: "system", content: INTENT_CLASSIFICATION_PROMPT },
    { role: "user", content: message },
  ]);
}
