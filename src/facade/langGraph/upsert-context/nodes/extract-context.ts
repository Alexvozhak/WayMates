import { HumanMessage } from "@langchain/core/messages";
import { buildContextExtractionPrompt } from "@prompts/upsert-context.js";

import { logger } from "../../../logger.js";
import { withReasoning } from "../../../utils/llm-schemas.js";
import { extractableContextSchema } from "../../shared-tools/extraction-models.js";
import { getModel } from "../../shared-tools/models.js";
import { NODE } from "../state.js";
import { withLogging } from "../with-logging.js";

import type { UpsertContextStateType } from "../state.js";

const extractionModel = getModel("extraction").withStructuredOutput(
  withReasoning(extractableContextSchema, "Explain what career context you extracted and why"),
);

export const extractContextNode = withLogging<UpsertContextStateType>(
  NODE.extract_context,
  async (state, _config, { dictionariesService }) => {
    const { messages, userResponse } = state;
    const inputText = messages.length === 0 ? userResponse : messages.map((m) => m.content).join("\n");

    const hints = await dictionariesService.buildHints([
      "role",
      "position",
      "domain",
      "skill",
      "industry",
      "education_level",
    ]);
    const prompt = buildContextExtractionPrompt(hints);

    const { reasoning, ...extracted } = await extractionModel.invoke([
      { role: "system", content: prompt },
      { role: "user", content: inputText },
    ]);
    logger.info({ reasoning }, "upsert context extraction reasoning");

    return {
      extractedContext: extracted,
      messages: messages.length === 0 ? [new HumanMessage(userResponse)] : messages,
    };
  },
);
