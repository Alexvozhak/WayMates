import { HumanMessage } from "@langchain/core/messages";

import { extractableContextSchema } from "../../shared-tools/extraction-models.js";
import { getModel } from "../../shared-tools/models.js";
import { buildContextExtractionPrompt } from "../prompts.js";
import { NODE } from "../state.js";
import { withLogging } from "../with-logging.js";

import type { UpsertContextStateType } from "../state.js";

const extractionModel = getModel("extraction").withStructuredOutput(extractableContextSchema);

export const extractContextNode = withLogging<UpsertContextStateType>(
  NODE.extract_context,
  async (state, _config, { cache }) => {
    const { messages, userResponse } = state;
    const inputText = messages.length === 0 ? userResponse : messages.map((m) => m.content).join("\n");

    const dicts = await cache.getForExtraction();
    const prompt = buildContextExtractionPrompt(dicts);

    const extracted = await extractionModel.invoke([
      { role: "system", content: prompt },
      { role: "user", content: inputText },
    ]);

    return {
      extractedContext: extracted,
      messages: messages.length === 0 ? [new HumanMessage(userResponse)] : messages,
    };
  },
);
