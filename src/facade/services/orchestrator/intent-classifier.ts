import { z } from "zod";

import { getModel } from "../../langGraph/shared-tools/models.js";

export const GRAPH_INTENT = {
  startStory: "startStory",
  startAdhoc: "startAdhoc",
  setGoal: "setGoal",
  addContext: "addContext",
  updateContext: "updateContext",
  addTrail: "addTrail",
  search: "search",
} as const;

export const NON_GRAPH_INTENT = {
  getStory: "getStory",
  getGoal: "getGoal",
  deleteGoal: "deleteGoal",
  deleteContext: "deleteContext",
  deleteTrail: "deleteTrail",
  cancel: "cancel",
  help: "help",
  greeting: "greeting",
  projectInvestor: "projectInvestor",
  projectTech: "projectTech",
  projectUser: "projectUser",
  unknown: "unknown",
} as const;

export const graphIntentSchema = z.enum([
  GRAPH_INTENT.startStory,
  GRAPH_INTENT.startAdhoc,
  GRAPH_INTENT.setGoal,
  GRAPH_INTENT.addContext,
  GRAPH_INTENT.updateContext,
  GRAPH_INTENT.addTrail,
  GRAPH_INTENT.search,
]);

export const nonGraphIntentSchema = z.enum([
  NON_GRAPH_INTENT.getStory,
  NON_GRAPH_INTENT.getGoal,
  NON_GRAPH_INTENT.deleteGoal,
  NON_GRAPH_INTENT.deleteContext,
  NON_GRAPH_INTENT.deleteTrail,
  NON_GRAPH_INTENT.cancel,
  NON_GRAPH_INTENT.help,
  NON_GRAPH_INTENT.greeting,
  NON_GRAPH_INTENT.projectInvestor,
  NON_GRAPH_INTENT.projectTech,
  NON_GRAPH_INTENT.projectUser,
  NON_GRAPH_INTENT.unknown,
]);

export type GraphIntent = z.infer<typeof graphIntentSchema>;
export type NonGraphIntent = z.infer<typeof nonGraphIntentSchema>;
export type UserIntent = GraphIntent | NonGraphIntent;

export const userIntentSchema = z.enum([...graphIntentSchema.options, ...nonGraphIntentSchema.options]);

// Type-safe: TypeScript enforces all UserIntent keys are present
const INTENT_DESCRIPTIONS: Record<UserIntent, string> = {
  startStory: "wants to tell full career story with trajectory",
  startAdhoc: "describes their professional identity or role, wants quick search without saving profile",
  setGoal: "wants to set career goal",
  addContext: "wants to add new career position/context",
  updateContext: "wants to update/edit current position details",
  addTrail: "wants to add learning trail (course, certification, bootcamp)",
  search: "wants to find similar careers",
  getStory: "wants to see saved career story",
  getGoal: "wants to see current goal",
  deleteGoal: "wants to delete goal",
  deleteContext: "wants to delete a career position",
  deleteTrail: "wants to delete a learning trail",
  cancel: "wants to cancel current operation",
  help: "needs help with commands",
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
