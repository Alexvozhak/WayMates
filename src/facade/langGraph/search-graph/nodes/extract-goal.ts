import { HumanMessage } from "@langchain/core/messages";

import { makeNullable, targetContextSchema } from "../../../../shared/schemas.js";
import { getModel } from "../../shared-tools/models.js";
import { GOAL_EXTRACTION_PROMPT } from "../prompts.js";
import { PHASE } from "../state.js";

import type { TargetContext } from "../../../../shared/schemas.js";
import type { SearchStateType } from "../state.js";

const extractableGoalSchema = makeNullable(targetContextSchema);

const extractionModel = getModel("extraction").withStructuredOutput(extractableGoalSchema);

export async function extractGoalNode(state: SearchStateType): Promise<Partial<SearchStateType>> {
  const { messages, userResponse } = state;

  const extracted = await extractionModel.invoke([
    { role: "system", content: GOAL_EXTRACTION_PROMPT },
    { role: "user", content: userResponse },
  ]);

  // Convert null to undefined for OpenAI structured output compatibility
  // makeNullable() returns T | null, but targetContextSchema expects T | undefined
  // Filter out null fields (LLM may return { position: {...}, domains: null, ... })
  const extractedGoal: TargetContext | null = extracted
    ? Object.fromEntries(Object.entries(extracted).filter(([, v]) => v != null))
    : null;

  return {
    extractedGoal,
    phase: PHASE.showingGoal,
    messages: messages.length === 0 ? [new HumanMessage(userResponse)] : messages,
  };
}
