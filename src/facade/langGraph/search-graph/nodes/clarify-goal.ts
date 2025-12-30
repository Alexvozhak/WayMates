import { HumanMessage } from "@langchain/core/messages";

import { targetContextSchema } from "../../../../shared/schemas.js";
import { AgentInvariantError } from "../../../errors.js";
import { logger } from "../../../logger.js";
import { withReasoning } from "../../../utils/llm-schemas.js";
import { getModel } from "../../shared-tools/models.js";
import { buildGoalClarificationPrompt } from "../prompts/extraction.js";
import { NODE, PHASE } from "../state.js";
import { withLogging } from "../with-logging.js";

import type { SearchStateType } from "../state.js";

const clarificationModel = getModel("extraction").withStructuredOutput(
  withReasoning(targetContextSchema, "Explain what clarifications you applied to the goal")
);

export const clarifyGoalNode = withLogging<SearchStateType>(NODE.clarify_goal, async (state, _config, _deps) => {
  const { extractedGoal, messages, clarifyRound, userResponse } = state;

  if (!userResponse) {
    throw new AgentInvariantError(NODE.clarify_goal, "userResponse missing in state");
  }

  const currentGoalJson = JSON.stringify(extractedGoal ?? {});
  const prompt = buildGoalClarificationPrompt(currentGoalJson, userResponse);

  const { reasoning, ...updated } = await clarificationModel.invoke([
    { role: "system", content: prompt },
    { role: "user", content: userResponse },
  ]);
  logger.info({ reasoning }, "goal clarification reasoning");

  return {
    extractedGoal: targetContextSchema.parse(updated),
    clarifyRound: clarifyRound + 1,
    userResponse: "",
    phase: PHASE.showing_goal,
    messages: [...messages, new HumanMessage(userResponse)],
  };
});
