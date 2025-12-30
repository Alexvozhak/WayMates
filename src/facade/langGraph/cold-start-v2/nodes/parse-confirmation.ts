import { logger } from "../../../logger.js";
import { getModel } from "../../shared-tools/models.js";
import { decisionSchema } from "../types.js";

import type { ColdStartStateType } from "../state.js";

const intentParser = getModel("deterministic").withStructuredOutput(decisionSchema);

const CONFIRMATION_PROMPT = `Classify user intent. Response may be in any language.

APPROVE: User signals agreement, acceptance, or readiness to proceed. Any affirmative response — even brief acknowledgments — indicates approval.
EDIT: User explicitly wants to change, modify, or correct something specific.
CANCEL: User explicitly wants to stop, cancel, or abort completely.
UNKNOWN: User provides unrelated content or asks a question instead of responding to the confirmation.`;

export async function parseConfirmationNode(state: ColdStartStateType): Promise<Partial<ColdStartStateType>> {
  const { userResponse } = state;

  const parsedDecision = await intentParser.invoke([
    { role: "system", content: CONFIRMATION_PROMPT },
    { role: "user", content: userResponse },
  ]);

  logger.info({ parsedDecision, userResponse }, "parse_confirmation reasoning");

  return { parsedDecision };
}
