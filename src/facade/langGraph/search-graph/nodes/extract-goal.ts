import { HumanMessage } from "@langchain/core/messages";

import { targetContextSchema } from "../../../../shared/schemas.js";
import { AgentInvariantError } from "../../../errors.js";
import { logger } from "../../../logger.js";
import { withReasoning } from "../../../utils/llm-schemas.js";
import { getModel } from "../../shared-tools/models.js";
import { buildGoalClarificationPrompt, buildGoalExtractionPrompt } from "../prompts/extraction.js";
import { NODE, PHASE } from "../state.js";
import { withLogging } from "../with-logging.js";

import type { SearchStateType } from "../state.js";

const extractionModel = getModel("extraction").withStructuredOutput(
  withReasoning(targetContextSchema, "Explain what career goal you extracted and why"),
);

/**
 * Extract or clarify goal from user message.
 *
 * Mode determined by state.extractedGoal:
 * - null/empty → fresh extraction (null for unmentioned fields)
 * - exists → clarification/merge (keep existing for unmentioned fields)
 *
 * No inheritance from adhocContext — goal contains only what user explicitly stated.
 */
export const extractGoalNode = withLogging<SearchStateType>(
  NODE.extract_goal,
  async (state, _config, { dictionariesService }) => {
    const { messages, userResponse, extractedGoal: currentGoal, clarifyRound } = state;

    if (!userResponse) {
      throw new AgentInvariantError(NODE.extract_goal, "userResponse missing in state");
    }

    const isClarification = currentGoal !== null;
    const prompt = isClarification
      ? buildGoalClarificationPrompt(JSON.stringify(currentGoal), userResponse)
      : buildGoalExtractionPrompt(
          await dictionariesService.buildHints(["role", "position", "domain", "skill", "industry", "education_level"]),
        );

    const { reasoning, ...extracted } = await extractionModel.invoke([
      { role: "system", content: prompt },
      { role: "user", content: userResponse },
    ]);
    logger.info({ reasoning, isClarification }, "goal extraction reasoning");

    const extractedGoal = extracted ? targetContextSchema.parse(extracted) : null;
    const isEmpty = !extractedGoal || Object.values(extractedGoal).every((v) => v == null || v === 0);
    const phase = isEmpty ? PHASE.clarifying_goal : PHASE.showing_goal;

    return {
      extractedGoal,
      userResponse: "",
      phase,
      clarifyRound: isClarification ? clarifyRound + 1 : clarifyRound,
      messages: [...messages, new HumanMessage(userResponse)],
      currentSearchParams: state.currentSearchParams,
      targetSearchParams: state.targetSearchParams,
    };
  },
);
