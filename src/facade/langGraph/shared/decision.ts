import { z } from "zod";

import { getModel } from "../shared-tools/models.js";

export const decisionSchema = z.object({
  intent: z.enum(["approve", "edit", "cancel"]),
  editTarget: z.string(),
  editInstructions: z.string(),
});

export type ParsedDecision = z.infer<typeof decisionSchema>;

export const CONFIRMATION_PROMPT = `Parse the user's intent from their response.

Intent classification:
- APPROVE: User confirms, agrees, or accepts (yes, ok, correct, approve, save, confirm, done, looks good, да, подтверждаю, согласен, верно, давай, норм, пойдёт, сохрани, etc.)
- EDIT: User wants to change something (edit, change, fix, modify, add, remove, update, изменить, поправить, измени, добавь, убери, etc.)
- CANCEL: User wants to stop or abort (no, cancel, stop, abort, exit, quit, nevermind, нет, отмена, стоп, выход, etc.)

Note: User may respond in any language. Map their response to the correct intent.

Return JSON:
- intent: "approve", "edit", or "cancel"
- editTarget: what to edit if intent is "edit", empty string otherwise
- editInstructions: how to edit if intent is "edit", empty string otherwise`;

const intentParser = getModel("deterministic").withStructuredOutput(decisionSchema);

export type ParseDecisionState = {
  userResponse: string;
  parsedDecision: ParsedDecision | null;
};

export async function parseDecision<T extends ParseDecisionState>(state: T): Promise<Pick<T, "parsedDecision">> {
  const parsedDecision = await intentParser.invoke([
    { role: "system", content: CONFIRMATION_PROMPT },
    { role: "user", content: state.userResponse },
  ]);
  return { parsedDecision };
}
