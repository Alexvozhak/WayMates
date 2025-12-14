import { HumanMessage } from "@langchain/core/messages";

import { makeNullable, targetContextSchema } from "../../../../shared/schemas.js";
import { getModel } from "../../shared-tools/models.js";
import { GOAL_EXTRACTION_PROMPT } from "../prompts.js";
import { PHASE } from "../state.js";

import type { SearchStateType } from "../state.js";

const extractableGoalSchema = makeNullable(targetContextSchema);

const extractionModel = getModel("extraction").withStructuredOutput(extractableGoalSchema);

export async function extractGoalNode(state: SearchStateType): Promise<Partial<SearchStateType>> {
  const { messages, userResponse } = state;

  const extracted = await extractionModel.invoke([
    { role: "system", content: GOAL_EXTRACTION_PROMPT },
    { role: "user", content: userResponse },
  ]);

  return {
    extractedGoal: extracted,
    phase: PHASE.showingGoal,
    messages: messages.length === 0 ? [new HumanMessage(userResponse)] : messages,
  };
}
