import { HumanMessage } from "@langchain/core/messages";

import { targetContextSchema } from "../../../../shared/schemas.js";
import { logger } from "../../../logger.js";
import { withReasoning } from "../../../utils/llm-schemas.js";
import { getModel } from "../../shared-tools/models.js";
import { buildGoalExtractionPrompt } from "../prompts/extraction.js";
import { NODE, PHASE } from "../state.js";
import { withLogging } from "../with-logging.js";

import type { SearchStateType } from "../state.js";

const extractionModel = getModel("extraction").withStructuredOutput(
  withReasoning(targetContextSchema, "Explain what career goal you extracted and why"),
);

/**
 * Extract goal from user message.
 *
 * No inheritance from adhocContext — goal contains only what user explicitly stated.
 * This ensures pathfinder search is not over-constrained by current context fields.
 */
export const extractGoalNode = withLogging<SearchStateType>(
  NODE.extract_goal,
  async (state, _config, { dictionariesService }) => {
    const { messages, userResponse } = state;
    const textToExtract = userResponse || "";

    const hints = await dictionariesService.buildHints([
      "role",
      "position",
      "domain",
      "skill",
      "industry",
      "education_level",
    ]);
    const prompt = buildGoalExtractionPrompt(hints);

    const { reasoning, ...extracted } = await extractionModel.invoke([
      { role: "system", content: prompt },
      { role: "user", content: textToExtract },
    ]);
    logger.info({ reasoning }, "goal extraction reasoning");

    const extractedGoal = extracted ? targetContextSchema.parse(extracted) : null;

    return {
      extractedGoal,
      userResponse: "",
      phase: PHASE.showing_goal,
      messages: messages.length === 0 ? [new HumanMessage(userResponse)] : messages,
      currentSearchParams: state.currentSearchParams,
      targetSearchParams: state.targetSearchParams,
    };
  },
);
