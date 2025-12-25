import { HumanMessage } from "@langchain/core/messages";

import { extractableTrailSchema } from "../../shared-tools/extraction-models.js";
import { getModel } from "../../shared-tools/models.js";
import { buildTrailExtractionPrompt } from "../prompts.js";
import { NODE } from "../state.js";
import { withLogging } from "../with-logging.js";

import type { UpsertTrailStateType } from "../state.js";

const extractionModel = getModel("extraction").withStructuredOutput(extractableTrailSchema);

export const extractTrailNode = withLogging<UpsertTrailStateType>(
  NODE.extract_trail,
  async (state, _config, { dictionariesService }) => {
    const { messages, userResponse } = state;
    const inputText = messages.length === 0 ? userResponse : messages.map((m) => m.content).join("\n");

    const hints = await dictionariesService.buildHints(["skill"]);
    const prompt = buildTrailExtractionPrompt(hints);

    const extracted = await extractionModel.invoke([
      { role: "system", content: prompt },
      { role: "user", content: inputText },
    ]);

    return {
      extractedTrail: extracted,
      messages: messages.length === 0 ? [new HumanMessage(userResponse)] : messages,
    };
  },
);
