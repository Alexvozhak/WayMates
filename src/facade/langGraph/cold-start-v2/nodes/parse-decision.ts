import { getModel } from "../../shared-tools/models.js";
import { decisionSchema } from "../state.js";

import type { ColdStartStateType } from "../state.js";

const intentParser = getModel("deterministic").withStructuredOutput(decisionSchema);

const CONFIRMATION_PROMPT = `Parse the user's intent from their message.

Three possible intents:

APPROVE: User confirms and agrees to proceed with the current state.

EDIT: User wants to change, modify, or redo something. This includes rejections with intent to improve or fix.

CANCEL: User wants to stop the process completely and exit, with no intent to continue or improve.

Return structured JSON with:
- intent: "approve", "edit", or "cancel"
- editTarget: what to edit if intent is "edit" (empty string otherwise)
- editInstructions: how to edit if intent is "edit" (empty string otherwise)`;

const STORY_DECISION_PROMPT = `Determine if the user has finished telling their career story.

STRICT RULES (priority order):
1. NO EXPERIENCE STATED: If message explicitly states "никогда не работал", "no work experience", "нет опыта"
   → return CONTINUE (ask for clarification, even if completion signal present)

2. EXPLICIT COMPLETION SIGNAL + SUFFICIENT DETAIL: If message contains "готово", "done", "that's all", "это всё", "всё"
   AND has 1+ career positions with dates/companies/technologies
   → return APPROVE

3. EXPLICIT COMPLETION SIGNAL + INSUFFICIENT DETAIL: If message contains completion signal
   BUT has NO career positions (e.g., student with no work history)
   → return CONTINUE (ask for clarification)

4. SUFFICIENT DETAIL WITHOUT SIGNAL: If message contains 2+ career positions with dates/companies/technologies
   → return APPROVE

5. INSUFFICIENT DETAIL: If greeting ("привет", "hello") OR single vague sentence with no career details
   → return CONTINUE

Three possible intents:
- APPROVE: Story complete (signal + details OR 2+ positions with details)
- CONTINUE: Greeting, insufficient detail, or explicit no experience
- CANCEL: User wants to stop

Return structured JSON with:
- intent: "approve" (story complete/detailed), "continue" (greeting/incomplete), or "cancel"
- editTarget: empty string
- editInstructions: empty string`;

export async function parseDecisionNode(state: ColdStartStateType): Promise<Partial<ColdStartStateType>> {
  const { userResponse } = state;

  const parsedDecision = await intentParser.invoke([
    { role: "system", content: CONFIRMATION_PROMPT },
    { role: "user", content: userResponse },
  ]);

  return { parsedDecision };
}

export async function parseStoryDecisionNode(state: ColdStartStateType): Promise<Partial<ColdStartStateType>> {
  const { userResponse } = state;

  const parsedDecision = await intentParser.invoke([
    { role: "system", content: STORY_DECISION_PROMPT },
    { role: "user", content: userResponse },
  ]);

  return { parsedDecision };
}
