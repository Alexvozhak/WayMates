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

export const CONFIRMATION_PROMPT = `Classify user intent from their response. Response may be in any language.

IMPORTANT: User responses are often very brief — a single word, abbreviation, slang, or informal expression.
Casual affirmations, colloquial agreements, and shorthand approvals are common.

APPROVE: User expresses agreement, confirmation, or willingness to proceed.
This includes any form of positive acknowledgment — formal or informal, verbose or terse.

EDIT: User wants to change, modify, correct, or update something.
This includes disagreement followed by a correction or new value (rejection + alternative = EDIT).

CANCEL: User explicitly wants to stop, cancel, abort, or exit completely.

UNKNOWN: Intent genuinely unclear or ambiguous. Use sparingly — prefer APPROVE for casual positive responses.`;

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
