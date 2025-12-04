import { HumanMessage } from "@langchain/core/messages";

import { userContextSchemaPartial } from "../../../../shared/schemas.js";
import { getModel } from "../../shared-tools/models.js";
import { UPDATE_EDIT_PROMPT } from "../prompts.js";

import type { UpdateContextStateType } from "../state.js";

const editModel = getModel("extraction").withStructuredOutput(userContextSchemaPartial);

export async function editUpdateNode(state: UpdateContextStateType): Promise<Partial<UpdateContextStateType>> {
  const { mergedContext, parsedDecision, messages } = state;

  const corrections = parsedDecision?.editInstructions ?? "";

  const edited = await editModel.invoke([
    { role: "system", content: UPDATE_EDIT_PROMPT },
    { role: "user", content: `Current update: ${JSON.stringify(mergedContext)}\n\nCorrections: ${corrections}` },
  ]);

  return {
    extractedUpdates: edited,
    messages: [...messages, new HumanMessage(corrections)],
  };
}
