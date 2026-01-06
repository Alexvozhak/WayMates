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
  approve: `User EXPLICITLY signals story is COMPLETE
  REQUIRED: explicit completion phrase indicating nothing more to add
  Having work experience alone is NOT enough — user must SAY they finished`,

  continue: `DEFAULT - keep gathering story
  Use when: user shares info, asks questions, OR no explicit completion signal
  Describing positions is sharing info, NOT completion — user may have more`,

  cancel: `User wants to STOP the flow entirely, give up, abort`,
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

CRITICAL RULES:
1. Education-only background without employment → CONTINUE (ask about internships, freelance)
2. Claims of lacking work history → CONTINUE (dig deeper)
3. APPROVE requires at least one described employment position (not just education)`;
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
