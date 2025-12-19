import { z } from "zod";

import { getModel } from "../shared-tools/models.js";

export const decisionSchema = z.object({
  intent: z
    .enum(["approve", "edit", "cancel", "unknown"])
    .describe("User intent: approve/edit/cancel, or unknown if unclear"),
  editTarget: z.string().describe("What to edit if intent is 'edit', empty string otherwise"),
  editInstructions: z.string().describe("How to edit if intent is 'edit', empty string otherwise"),
});

export type ParsedDecision = z.infer<typeof decisionSchema>;

/**
 * Creates decision routes table for simple confirmation graphs.
 * Standard mapping: approve→persist, edit→edit, cancel→cancel, unknown→show (retry)
 */
export function createDecisionRoutes<T extends string>(nodes: {
  persist: T;
  edit: T;
  cancel: T;
  show: T;
}): Record<ParsedDecision["intent"], T> {
  return {
    approve: nodes.persist,
    edit: nodes.edit,
    cancel: nodes.cancel,
    unknown: nodes.show,
  };
}

export const CONFIRMATION_PROMPT = `Classify user intent. Response may be in any language.

APPROVE: User confirms, agrees, accepts, or wants to proceed/save.
EDIT: User wants to change, modify, or correct something.
CANCEL: User wants to stop, cancel, or abort completely.
UNKNOWN: Cannot determine intent with confidence.`;

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
