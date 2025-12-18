import { getModel } from "../../shared-tools/models.js";
import { decisionSchema } from "../types.js";

import type { ColdStartStateType } from "../state.js";

const intentParser = getModel("deterministic").withStructuredOutput(decisionSchema);

const CONFIRMATION_PROMPT = `Classify user intent.

APPROVE: User confirms, agrees to proceed.
EDIT: User wants to change or modify something.
CANCEL: User wants to stop completely.
UNKNOWN: Cannot determine intent.`;

export async function parseConfirmationNode(state: ColdStartStateType): Promise<Partial<ColdStartStateType>> {
  const { userResponse } = state;

  const parsedDecision = await intentParser.invoke([
    { role: "system", content: CONFIRMATION_PROMPT },
    { role: "user", content: userResponse },
  ]);

  return { parsedDecision };
}
