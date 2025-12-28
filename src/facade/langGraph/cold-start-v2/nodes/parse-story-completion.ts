import { logger } from "../../../logger.js";
import { getModel } from "../../shared-tools/models.js";
import { decisionSchema } from "../types.js";

import type { ColdStartStateType } from "../state.js";
import type { BaseMessage } from "@langchain/core/messages";

const intentParser = getModel("deterministic").withStructuredOutput(decisionSchema);

// Valid intents for story completion decision
const STORY_DECISION_INTENTS = ["approve", "continue", "cancel"] as const;
type StoryDecisionIntent = (typeof STORY_DECISION_INTENTS)[number];

// Semantic descriptions - no literal examples, only meaning
const STORY_DECISION_DESCRIPTIONS: Record<StoryDecisionIntent, string> = {
  approve: `User signals COMPLETION and has career content
  Semantic: finality, ready to proceed, nothing more to add
  Condition: CV provided OR conversation contains work positions`,

  continue: `DEFAULT - keep gathering story
  Semantic: sharing info, greeting, unclear, claims no experience
  Note: "no experience" always continues (ask about internships, freelance)`,

  cancel: `User wants to STOP the flow
  Semantic: abort, exit, give up`,
};

function serializeMessages(messages: BaseMessage[]): string {
  return messages.map((m) => `${m.type}: ${m.content}`).join("\n");
}

function buildStoryCompletionPrompt(cvText: string | null, conversationText: string | null): string {
  const cvSection = cvText ? `CV/RESUME PROVIDED:\n${cvText}\n\n` : "";
  const conversationSection = conversationText ? `CONVERSATION:\n${conversationText}\n\n` : "";

  const intentSection = STORY_DECISION_INTENTS.map(
    (intent) => `${intent} — ${STORY_DECISION_DESCRIPTIONS[intent]}`,
  ).join("\n\n");

  return `Determine if user has FINISHED telling their career story.

${cvSection}${conversationSection}DECISION (pick ONE):

${intentSection}

PRIORITY: "no experience" claim → always CONTINUE (even with completion signal).
Simply mentioning a job does NOT mean done — user may have more positions.`;
}

export async function parseStoryCompletionNode(state: ColdStartStateType): Promise<Partial<ColdStartStateType>> {
  const { userResponse, cvText, messages } = state;

  const conversationText = messages.length > 0 ? serializeMessages(messages) : null;
  const prompt = buildStoryCompletionPrompt(cvText, conversationText);

  const parsedDecision = await intentParser.invoke([
    { role: "system", content: prompt },
    { role: "user", content: userResponse },
  ]);

  logger.info({ parsedDecision, userResponse }, "parse_story_decision reasoning");

  return { parsedDecision };
}
