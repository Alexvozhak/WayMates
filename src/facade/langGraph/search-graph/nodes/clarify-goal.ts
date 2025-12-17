import { HumanMessage } from "@langchain/core/messages";

import { makeNullable, targetContextSchema } from "../../../../shared/schemas.js";
import { AgentInvariantError } from "../../../errors.js";
import { getModel } from "../../shared-tools/models.js";
import { GOAL_CLARIFICATION_PROMPT } from "../prompts.js";
import { NODE, PHASE } from "../state.js";

import type { SearchStateType } from "../state.js";

const clarifiableGoalSchema = makeNullable(targetContextSchema);
const clarificationModel = getModel("extraction").withStructuredOutput(clarifiableGoalSchema);

export async function clarifyGoalNode(state: SearchStateType): Promise<Partial<SearchStateType>> {
  const { extractedGoal, messages, clarifyRound, clarificationText } = state;

  if (!clarificationText) {
    throw new AgentInvariantError(NODE.clarify_goal, "clarificationText missing in state");
  }

  const currentGoalJson = JSON.stringify(extractedGoal ?? {});

  const prompt = GOAL_CLARIFICATION_PROMPT.replace("{currentGoal}", currentGoalJson).replace(
    "{userMessage}",
    clarificationText,
  );

  const updated = await clarificationModel.invoke([
    { role: "system", content: prompt },
    { role: "user", content: clarificationText },
  ]);

  return {
    extractedGoal: updated,
    clarifyRound: clarifyRound + 1,
    userResponse: "", // Clear to ensure show_goal does interrupt
    phase: PHASE.showingGoal,
    messages: [...messages, new HumanMessage(clarificationText)],
  };
}
