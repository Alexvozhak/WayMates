import { HumanMessage } from "@langchain/core/messages";

import { logger } from "../../../logger.js";
import { withReasoning } from "../../../utils/llm-schemas.js";
import { extractableTrailSchema } from "../../shared-tools/extraction-models.js";
import { getModel } from "../../shared-tools/models.js";
import { TRAIL_EDIT_PROMPT } from "../prompts.js";

import type { UpsertTrailStateType } from "../state.js";

const editModel = getModel("extraction").withStructuredOutput(
  withReasoning(extractableTrailSchema, "Explain what corrections you applied and why")
);

export async function editTrailNode(state: UpsertTrailStateType): Promise<Partial<UpsertTrailStateType>> {
  const { extractedTrail, parsedDecision, messages } = state;

  const corrections = parsedDecision?.editInstructions ?? "";

  const { reasoning, ...edited } = await editModel.invoke([
    { role: "system", content: TRAIL_EDIT_PROMPT },
    { role: "user", content: `Current trail: ${JSON.stringify(extractedTrail)}\n\nCorrections: ${corrections}` },
  ]);
  logger.info({ reasoning }, "upsert trail edit reasoning");

  return {
    extractedTrail: edited,
    messages: [...messages, new HumanMessage(corrections)],
  };
}
