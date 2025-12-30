import { HumanMessage } from "@langchain/core/messages";

import { logger } from "../../../logger.js";
import { withReasoning } from "../../../utils/llm-schemas.js";
import { extractableTrailSchema } from "../../shared-tools/extraction-models.js";
import { getModel } from "../../shared-tools/models.js";
import { buildTrailExtractionPrompt } from "../prompts.js";
import { NODE } from "../state.js";
import { withLogging } from "../with-logging.js";

import type { UpsertTrailStateType } from "../state.js";

const extractionModel = getModel("extraction").withStructuredOutput(
  withReasoning(extractableTrailSchema, "Explain what trail/certification you extracted and why")
);

export const extractTrailNode = withLogging<UpsertTrailStateType>(
  NODE.extract_trail,
  async (state, _config, { dictionariesService }) => {
    const { messages, userResponse } = state;
    const inputText = messages.length === 0 ? userResponse : messages.map((m) => m.content).join("\n");

    const hints = await dictionariesService.buildHints(["skill"]);
    const prompt = buildTrailExtractionPrompt(hints);

    const { reasoning, ...extracted } = await extractionModel.invoke([
      { role: "system", content: prompt },
      { role: "user", content: inputText },
    ]);
    logger.info({ reasoning }, "upsert trail extraction reasoning");

    return {
      extractedTrail: extracted,
      messages: messages.length === 0 ? [new HumanMessage(userResponse)] : messages,
    };
  },
);
