import { HumanMessage } from "@langchain/core/messages";

import { extractableTrailSchema } from "../../shared-tools/extraction-models.js";
import { getModel } from "../../shared-tools/models.js";
import { TRAIL_EXTRACTION_PROMPT } from "../prompts.js";

import type { UpsertTrailStateType } from "../state.js";

const extractionModel = getModel("extraction").withStructuredOutput(extractableTrailSchema);

export async function extractTrailNode(state: UpsertTrailStateType): Promise<Partial<UpsertTrailStateType>> {
  const { messages, userResponse } = state;

  const inputText = messages.length === 0 ? userResponse : messages.map((m) => m.content).join("\n");

  const extracted = await extractionModel.invoke([
    { role: "system", content: TRAIL_EXTRACTION_PROMPT },
    { role: "user", content: inputText },
  ]);

  return {
    extractedTrail: extracted,
    messages: messages.length === 0 ? [new HumanMessage(userResponse)] : messages,
  };
}
