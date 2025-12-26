import { getModel } from "../../shared-tools/models.js";
import { AdvisorContextBuilder } from "../advisor-context-builder.js";
import { ADVISOR_SYSTEM_PROMPT } from "../prompts/advisor.js";
import { NODE, PHASE } from "../state.js";
import { withLogging } from "../with-logging.js";

import type { SearchStateType } from "../state.js";

/**
 * Generate answer node: creates advisor response based on search context.
 * Business logic only — no interrupt. Saves answer to state for show_answer.
 */
export const generateAnswerNode = withLogging<SearchStateType>(NODE.generate_answer, async (state, _config, _deps) => {
  const question = state.advisorQuestion ?? state.userResponse;

  const hasTrajectory = state.userTrajectory.length > 0;

  const builder = new AdvisorContextBuilder();

  if (hasTrajectory) {
    builder.addUserTrajectory(state.userTrajectory);
  } else {
    builder.addUserContext(state.userContext);
  }

  const context = builder
    .addGoal(state.storedGoal)
    .addCandidates(state.searchResults)
    .addCandidateDetails(state.searchResults.slice(0, 5))
    .addChart(state.chartUrl)
    .build();

  const model = getModel("agent");
  const response = await model.invoke([
    { role: "system", content: ADVISOR_SYSTEM_PROMPT },
    { role: "user", content: `${context}\n\nQUESTION: ${question}` },
  ]);

  const answerText = typeof response.content === "string" ? response.content : String(response.content);

  return {
    currentAnswer: answerText,
    phase: PHASE.advising,
  };
});
