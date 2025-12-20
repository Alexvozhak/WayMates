import { getModel } from "../../shared-tools/models.js";
import { decisionSchema } from "../types.js";

import type { ColdStartStateType } from "../state.js";
import type { BaseMessage } from "@langchain/core/messages";

const intentParser = getModel("deterministic").withStructuredOutput(decisionSchema);

function serializeMessages(messages: BaseMessage[]): string {
  return messages.map((m) => `${m.type}: ${m.content}`).join("\n");
}

function buildStoryCompletionPrompt(cvText: string | null, conversationText: string | null): string {
  const cvSection = cvText
    ? `
═══════════════════════════════════════════════════
CV/RESUME PROVIDED (anonymized):
═══════════════════════════════════════════════════
${cvText}
`
    : "";

  const conversationSection = conversationText
    ? `
═══════════════════════════════════════════════════
CONVERSATION HISTORY:
═══════════════════════════════════════════════════
${conversationText}
`
    : "";

  return `Determine if user has FINISHED telling their career story AND has career content to plan.

${cvSection}${conversationSection}
═══════════════════════════════════════════════════
DECISION RULES (priority order):
═══════════════════════════════════════════════════

1. NO CAREER EXPERIENCE: User explicitly states they have no work experience
   ("никогда не работал", "нет опыта", "no experience", "never worked")
   → return CONTINUE (ask about internships, freelance, part-time work, etc.)
   IMPORTANT: This takes priority even if user says they are "done"

2. USER SIGNALS COMPLETION + HAS CAREER CONTENT:
   User conveys finality (finished, nothing more, ready to proceed)
   AND (CV provided OR conversation mentions at least 1 work position)
   → return APPROVE

3. CV PROVIDED AS STORY: CV is provided and user confirms/acknowledges
   → return APPROVE

4. USER WANTS TO STOP: User expresses desire to cancel or abort
   → return CANCEL

5. DEFAULT - CONTINUE GATHERING: In ALL other cases
   - User shares career info but no completion signal → CONTINUE
   - User still telling their story → CONTINUE
   - Greeting or unclear message → CONTINUE

═══════════════════════════════════════════════════
IMPORTANT:
═══════════════════════════════════════════════════
- Simply mentioning a job does NOT mean done - may have more positions
- If user says "no experience" - ALWAYS return CONTINUE, even with completion signal
- Only APPROVE when: has career content + signals completion

═══════════════════════════════════════════════════
OUTPUT:
═══════════════════════════════════════════════════
Return structured JSON with:
- intent: "approve" (finished + has content), "continue" (default), or "cancel"
- editTarget: empty string
- editInstructions: empty string`;
}

export async function parseStoryCompletionNode(state: ColdStartStateType): Promise<Partial<ColdStartStateType>> {
  const { userResponse, cvText, messages } = state;

  const conversationText = messages.length > 0 ? serializeMessages(messages) : null;
  const prompt = buildStoryCompletionPrompt(cvText, conversationText);

  const parsedDecision = await intentParser.invoke([
    { role: "system", content: prompt },
    { role: "user", content: userResponse },
  ]);

  return { parsedDecision };
}
