import { HumanMessage } from "@langchain/core/messages";
import { buildContextClarificationPrompt } from "@prompts/upsert-context.js";

import { logger } from "../../../logger.js";
import { withReasoning } from "../../../utils/llm-schemas.js";
import { extractableContextSchema } from "../../shared-tools/extraction-models.js";
import { getModel } from "../../shared-tools/models.js";
import { NODE } from "../state.js";
import { withLogging } from "../with-logging.js";

import type { UpsertContextStateType } from "../state.js";

const editModel = getModel("extraction").withStructuredOutput(
  withReasoning(extractableContextSchema, "Explain what corrections you applied and why"),
);

export const editContextNode = withLogging<UpsertContextStateType>(
  NODE.edit_context,
  async (state, _config, { dictionariesService }) => {
    const { extractedContext, parsedDecision, messages } = state;

    const corrections = parsedDecision?.editInstructions ?? "";
    const hints = await dictionariesService.buildHints([
      "role",
      "position",
      "domain",
      "skill",
      "industry",
      "education_level",
    ]);
    const prompt = buildContextClarificationPrompt(hints, JSON.stringify(extractedContext, null, 2), corrections);

    const { reasoning, ...edited } = await editModel.invoke([
      { role: "system", content: prompt },
      { role: "user", content: corrections },
    ]);
    logger.info({ reasoning }, "upsert context edit reasoning");

    return {
      extractedContext: edited,
      messages: [...messages, new HumanMessage(corrections)],
    };
  },
);
