import { HumanMessage } from "@langchain/core/messages";

import { extractableTrailSchema } from "../../shared-tools/extraction-models.js";
import { getModel } from "../../shared-tools/models.js";
import { TRAIL_EDIT_PROMPT } from "../prompts.js";

import type { UpsertTrailStateType } from "../state.js";

const editModel = getModel("extraction").withStructuredOutput(extractableTrailSchema);

export async function editTrailNode(state: UpsertTrailStateType): Promise<Partial<UpsertTrailStateType>> {
  const { extractedTrail, parsedDecision, messages } = state;

  const corrections = parsedDecision?.editInstructions ?? "";

  const edited = await editModel.invoke([
    { role: "system", content: TRAIL_EDIT_PROMPT },
    { role: "user", content: `Current trail: ${JSON.stringify(extractedTrail)}\n\nCorrections: ${corrections}` },
  ]);

  return {
    extractedTrail: edited,
    messages: [...messages, new HumanMessage(corrections)],
  };
}
