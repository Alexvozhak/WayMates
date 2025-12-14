import { HumanMessage } from "@langchain/core/messages";
import { interrupt } from "@langchain/langgraph";

import { targetContextSchema } from "../../../../shared/schemas.js";
import { getModel } from "../../shared-tools/models.js";
import { GOAL_CLARIFICATION_PROMPT } from "../prompts.js";
import { PHASE } from "../state.js";

import type { SearchStateType } from "../state.js";

const clarificationModel = getModel("extraction").withStructuredOutput(targetContextSchema.partial());

export async function clarifyGoalNode(state: SearchStateType): Promise<Partial<SearchStateType>> {
  const { extractedGoal, messages, clarifyRound } = state;

  const userResponse = interrupt({
    type: "clarify_goal",
    currentGoal: extractedGoal,
    message: "What would you like to clarify or add?",
    phase: PHASE.clarifyingGoal,
  });

  const response = String(userResponse);
  const currentGoalJson = JSON.stringify(extractedGoal ?? {});

  const prompt = GOAL_CLARIFICATION_PROMPT.replace("{currentGoal}", currentGoalJson).replace(
    "{userMessage}",
    response,
  );

  const updated = await clarificationModel.invoke([
    { role: "system", content: prompt },
    { role: "user", content: response },
  ]);

  return {
    extractedGoal: updated,
    userResponse: response,
    clarifyRound: clarifyRound + 1,
    phase: PHASE.showingGoal,
    messages: [...messages, new HumanMessage(response)],
  };
}
