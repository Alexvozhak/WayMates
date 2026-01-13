import { HumanMessage } from "@langchain/core/messages";

import { buildUpdateClarificationPrompt } from "#prompts/update-context.js";

import { logger } from "../../../logger.js";
import { withReasoning } from "../../../utils/llm-schemas.js";
import { extractableContextSchema } from "../../shared-tools/extraction-models.js";
import { getModel } from "../../shared-tools/models.js";
import { NODE } from "../state.js";
import { withLogging } from "../with-logging.js";

import type { UpdateContextStateType } from "../state.js";

const editModel = getModel("extraction").withStructuredOutput(
  withReasoning(extractableContextSchema, "Explain what corrections you applied and why"),
);

export const editUpdateNode = withLogging<UpdateContextStateType>(
  NODE.edit_update,
  async (state, _config, { dictionariesService }) => {
    const { mergedContext, parsedDecision, messages } = state;

    const corrections = parsedDecision?.editInstructions ?? "";
    const hints = await dictionariesService.buildHints([
      "role",
      "position",
      "domain",
      "skill",
      "industry",
      "education_level",
    ]);
    const prompt = buildUpdateClarificationPrompt(hints, JSON.stringify(mergedContext, null, 2), corrections);

    const { reasoning, ...edited } = await editModel.invoke([
      { role: "system", content: prompt },
      { role: "user", content: corrections },
    ]);
    logger.info({ reasoning }, "update context edit reasoning");

    return {
      extractedUpdates: edited,
      messages: [...messages, new HumanMessage(corrections)],
    };
  },
);
