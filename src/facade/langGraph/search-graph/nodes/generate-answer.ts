import { getModel } from "../../shared-tools/models.js";
import { ADVISOR_SKILLS_LIMIT, AdvisorContextBuilder } from "../advisor-context-builder.js";
import { ADVISOR_SYSTEM_PROMPT } from "../prompts/advisor.js";
import { NODE, PHASE } from "../state.js";
import { withLogging } from "../with-logging.js";

import type { CandidateBase } from "../../../../shared/schemas.js";
import type { SearchStateType } from "../state.js";

function getCandidatesForPhase(state: SearchStateType): CandidateBase[] {
  switch (state.phase) {
    case PHASE.showing_pathfinder_results: {
      return state.pathfinderResults;
    }
    case PHASE.showing_exploration_candidates: {
      return state.explorationResults;
    }
    default: {
      return state.waymatesResults;
    }
  }
}

/**
 * Generate answer node: creates advisor response based on search context.
 * Business logic only — no interrupt. Saves answer to state for show_answer.
 * Phase stays unchanged (showing_*_results) — no separate advising phase.
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

  const candidates = getCandidatesForPhase(state);

  const context = builder
    .addGoal(state.storedGoal)
    .addCandidates(candidates)
    .addCandidateDetails(candidates.slice(0, ADVISOR_SKILLS_LIMIT))
    .addChart(state.chartUrl)
    .build();

  const model = getModel("agent");
  const response = await model.invoke([
    { role: "system", content: ADVISOR_SYSTEM_PROMPT },
    { role: "user", content: `${context}\n\nQUESTION: ${question}` },
  ]);

  const answerText = typeof response.content === "string" ? response.content : String(response.content);

  return {
    answerText,
    // Phase unchanged — stay in showing_*_results
  };
});
