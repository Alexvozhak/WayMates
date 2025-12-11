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

export async function parseConfirmationNode(state: ColdStartStateType): Promise<Partial<ColdStartStateType>> {
  const { userResponse } = state;

  const parsedDecision = await intentParser.invoke([
    { role: "system", content: CONFIRMATION_PROMPT },
    { role: "user", content: userResponse },
  ]);

  return { parsedDecision };
}
