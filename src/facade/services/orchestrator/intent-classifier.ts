import { z } from "zod";

import { getModel } from "../../langGraph/shared-tools/models.js";

// Zod enum = source of truth, .Values for runtime access
export const graphIntentSchema = z.enum([
  "startStory",
  "startAdhoc",
  "setGoal",
  // MVP: Disabled CRUD operations — cold_start and search only
  // "addContext",
  // "updateContext",
  // "addTrail",
  "search",
]);
export const GRAPH_INTENT = graphIntentSchema.Values;

export const nonGraphIntentSchema = z.enum([
  "getStory",
  "getGoal",
  "deleteGoal",
  "deleteContext",
  "deleteTrail",
  "cancel",
  "help",
  "greeting",
  "projectInvestor",
  "projectTech",
  "projectUser",
  "unknown",
]);
export const NON_GRAPH_INTENT = nonGraphIntentSchema.Values;

export type GraphIntent = z.infer<typeof graphIntentSchema>;
export type NonGraphIntent = z.infer<typeof nonGraphIntentSchema>;
export type UserIntent = GraphIntent | NonGraphIntent;

export const userIntentSchema = z.enum([...graphIntentSchema.options, ...nonGraphIntentSchema.options]);

// Type-safe: TypeScript enforces all UserIntent keys are present
const INTENT_DESCRIPTIONS: Record<UserIntent, string> = {
  startStory:
    "wants to tell about themselves, share career background, create profile, save full career history, upload CV — focus on SHARING information, not on searching",
  startAdhoc:
    "explicitly asks for SEARCH or FIND similar people, wants quick lookup without saving — focus on FINDING candidates",
  setGoal: "wants to set career goal",
  // MVP: Disabled CRUD operations
  // addContext: "wants to add new career position/context",
  // updateContext: "wants to update/edit current position details",
  // addTrail: "wants to add learning trail (course, certification, bootcamp)",
  search: "wants to find similar careers",
  getStory: "wants to see saved career story",
  getGoal: "wants to see current goal",
  deleteGoal: "wants to delete goal",
  deleteContext: "wants to delete a career position",
  deleteTrail: "wants to delete a learning trail",
  cancel: "wants to cancel current operation",
  help: "asks what bot can do, what features are available, needs help, how to use — meta-questions about the service itself",
  greeting: "says hello, hi, hey, good morning — friendly conversation opener",
  projectInvestor: "asks about WayMates business value, investment, accelerator, startup pitch",
  projectTech: "asks about WayMates architecture, tech stack, code quality, engineering",
  projectUser: "asks what WayMates offers, how to use it, features for end users",
  unknown: "unclear message or doesn't match any intent",
};

// Generate intent list from Record (single source of truth)
const INTENT_SECTION = Object.entries(INTENT_DESCRIPTIONS)
  .map(([intent, desc]) => `- ${intent}: ${desc}`)
  .join("\n");

const INTENT_CLASSIFICATION_PROMPT = `Classify user intent from their message.

Intent types:
${INTENT_SECTION}

PRIORITY RULES:
1. If message contains BOTH greeting AND substantive content (role, skills, goal, question), prioritize the substantive intent over greeting
2. "greeting" is ONLY for pure greetings without any other meaningful information
3. If message is unclear, garbage, or doesn't match any intent, classify as "unknown".`;

const classificationSchema = z.object({ intent: userIntentSchema });
const classifier = getModel("deterministic").withStructuredOutput(classificationSchema);

export async function classifyIntent(message: string): Promise<UserIntent> {
  const { intent } = await classifier.invoke([
    { role: "system", content: INTENT_CLASSIFICATION_PROMPT },
    { role: "user", content: message },
  ]);
  return intent;
}
