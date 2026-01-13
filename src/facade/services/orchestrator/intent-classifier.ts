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
    "EXPLICITLY wants to tell FULL career history, create persistent profile, save story for future, upload CV/resume. Keywords: 'share my story', 'create profile', 'save my career', 'upload CV'. NOT just describing current position. Only for NEW users without profile",
  startAdhoc:
    "describes current position/role for QUICK SEARCH, wants temporary lookup, no commitment. Keywords: 'quick search', 'fast search', 'just looking', 'I am [role]', 'current position'. Default when user just states who they are. Only for NEW users without profile",
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
1. If message contains BOTH greeting AND substantive content, prioritize substantive intent over greeting
2. greeting = ONLY pure greetings without meaningful information
3. startAdhoc vs startStory: stating current position = startAdhoc. startStory requires EXPLICIT intent to share full history or create profile
4. If unclear or garbage = unknown`;

const classificationSchema = z.object({ intent: userIntentSchema });
const classifier = getModel("deterministic").withStructuredOutput(classificationSchema);

export async function classifyIntent(message: string): Promise<UserIntent> {
  const { intent } = await classifier.invoke([
    { role: "system", content: INTENT_CLASSIFICATION_PROMPT },
    { role: "user", content: message },
  ]);
  return intent;
}
