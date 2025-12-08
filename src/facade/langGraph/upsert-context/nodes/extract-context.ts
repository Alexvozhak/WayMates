import { HumanMessage } from "@langchain/core/messages";

import { extractableContextSchema } from "../../shared-tools/extraction-models.js";
import { getModel } from "../../shared-tools/models.js";
import { CONTEXT_EXTRACTION_PROMPT } from "../prompts.js";

import type { UpsertContextStateType } from "../state.js";

const extractionModel = getModel("extraction").withStructuredOutput(extractableContextSchema);

export async function extractContextNode(state: UpsertContextStateType): Promise<Partial<UpsertContextStateType>> {
  const { messages, userResponse } = state;

  const inputText = messages.length === 0 ? userResponse : messages.map((m) => m.content).join("\n");

  const extracted = await extractionModel.invoke([
    { role: "system", content: CONTEXT_EXTRACTION_PROMPT },
    { role: "user", content: inputText },
  ]);

  return {
    extractedContext: extracted,
    messages: messages.length === 0 ? [new HumanMessage(userResponse)] : messages,
  };
}
