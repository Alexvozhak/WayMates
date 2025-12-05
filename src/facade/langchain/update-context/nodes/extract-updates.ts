import { HumanMessage } from "@langchain/core/messages";

import { extractableContextSchema } from "../../shared-tools/extraction-models.js";
import { getModel } from "../../shared-tools/models.js";
import { UPDATE_EXTRACTION_PROMPT } from "../prompts.js";

import type { UpdateContextStateType } from "../state.js";

const extractionModel = getModel("extraction").withStructuredOutput(extractableContextSchema);

export async function extractUpdatesNode(state: UpdateContextStateType): Promise<Partial<UpdateContextStateType>> {
  const { messages, userResponse, currentContext } = state;

  const inputText = messages.length === 0 ? userResponse : messages.map((m) => m.content).join("\n");

  const extracted = await extractionModel.invoke([
    { role: "system", content: UPDATE_EXTRACTION_PROMPT },
    {
      role: "user",
      content: `CURRENT_CONTEXT:\n${JSON.stringify(currentContext, null, 2)}\n\nUSER_REQUEST:\n${inputText}`,
    },
  ]);

  return {
    extractedUpdates: extracted,
    messages: messages.length === 0 ? [new HumanMessage(userResponse)] : messages,
  };
}
