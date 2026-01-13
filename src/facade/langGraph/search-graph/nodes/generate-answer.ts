import { ADVISOR_SYSTEM_PROMPT } from "#prompts/search-graph/advisor.js";

import { simpleDictionaryTypeSchema } from "../../../../../private/schemas.js";
import { getModel } from "../../shared-tools/models.js";
import { ADVISOR_SKILLS_LIMIT, AdvisorContextBuilder } from "../advisor-context-builder.js";
import { NODE, PHASE } from "../state.js";
import { withLogging } from "../with-logging.js";

import type { CandidateBase } from "../../../../../private/schemas.js";
import type { SearchStateType } from "../state.js";

const ALL_DICTIONARY_TYPES = simpleDictionaryTypeSchema.options;

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
 *
 * Handles questionType:
 * - "general": uses candidates + trajectory context
 * - "dictionary": injects all dictionary values for reference
 * - "chart": (future) will use vision to analyze chart
 */
export const generateAnswerNode = withLogging<SearchStateType>(
  NODE.generate_answer,
  async (state, _config, { dictionariesService }) => {
    const question = state.advisorQuestion ?? state.userResponse;
    const questionType = state.questionType ?? "general";

    const candidates = getCandidatesForPhase(state);

    // Guard: no candidates → fixed message, skip LLM to prevent hallucination
    if (candidates.length === 0) {
      return {
        answerText:
          "No candidates found matching your criteria. " +
          "Try adjusting your goal parameters or search with different filters.",
      };
    }

    const hasTrajectory = state.userTrajectory.length > 0;

    const builder = new AdvisorContextBuilder();

    if (hasTrajectory) {
      builder.addUserTrajectory(state.userTrajectory);
    } else {
      builder.addUserContext(state.userContext);
    }

    builder
      .addGoal(state.storedGoal)
      .addCandidates(candidates)
      .addCandidateDetails(candidates.slice(0, ADVISOR_SKILLS_LIMIT))
      .addChart(state.chartUrl);

    // For dictionary questions, inject all available dictionary values
    if (questionType === "dictionary") {
      const hints = await dictionariesService.buildHints(ALL_DICTIONARY_TYPES);
      builder.addDictionaries(hints);
    }

    const context = builder.build();

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
  },
);
