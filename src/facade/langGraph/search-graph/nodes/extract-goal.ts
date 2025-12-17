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

  // DEBUG: Check what LLM extracted
  console.log("[EXTRACT GOAL] LLM extracted:", JSON.stringify(extracted, null, 2));

  // Convert null to undefined for OpenAI structured output compatibility
  // makeNullable() returns T | null, but targetContextSchema expects T | undefined
  // Filter out null fields (LLM may return { position: {...}, domains: null, ... })
  const extractedGoal = extracted
    ? (Object.fromEntries(Object.entries(extracted).filter(([, v]) => v != null)) as typeof extracted)
    : null;

  // DEBUG: Check result after filtering
  console.log("[EXTRACT GOAL] After filter:", JSON.stringify(extractedGoal, null, 2));

  return {
    extractedGoal,
    phase: PHASE.showingGoal,
    messages: messages.length === 0 ? [new HumanMessage(userResponse)] : messages,
  };
}
