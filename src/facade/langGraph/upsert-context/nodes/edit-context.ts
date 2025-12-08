import { HumanMessage } from "@langchain/core/messages";

import { extractableContextSchema } from "../../shared-tools/extraction-models.js";
import { getModel } from "../../shared-tools/models.js";
import { CONTEXT_EDIT_PROMPT } from "../prompts.js";

import type { UpsertContextStateType } from "../state.js";

const editModel = getModel("extraction").withStructuredOutput(extractableContextSchema);

export async function editContextNode(state: UpsertContextStateType): Promise<Partial<UpsertContextStateType>> {
  const { extractedContext, parsedDecision, messages } = state;

  const corrections = parsedDecision?.editInstructions ?? "";

  const edited = await editModel.invoke([
    { role: "system", content: CONTEXT_EDIT_PROMPT },
    { role: "user", content: `Current context: ${JSON.stringify(extractedContext)}\n\nCorrections: ${corrections}` },
  ]);

  return {
    extractedContext: edited,
    messages: [...messages, new HumanMessage(corrections)],
  };
}
