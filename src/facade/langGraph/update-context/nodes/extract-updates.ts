import { HumanMessage } from "@langchain/core/messages";

import { extractableContextSchema } from "../../shared-tools/extraction-models.js";
import { getModel } from "../../shared-tools/models.js";
import { buildUpdateExtractionPrompt } from "../prompts.js";
import { NODE } from "../state.js";
import { withLogging } from "../with-logging.js";

import type { UpdateContextStateType } from "../state.js";

const extractionModel = getModel("extraction").withStructuredOutput(extractableContextSchema);

export const extractUpdatesNode = withLogging<UpdateContextStateType>(
  NODE.extract_updates,
  async (state, _config, { dictionariesService }) => {
    const { messages, userResponse, currentContext } = state;

    const inputText = messages.length === 0 ? userResponse : messages.map((m) => m.content).join("\n");
    const hints = await dictionariesService.buildHints(["role", "position", "domain", "skill", "industry"]);
    const prompt = buildUpdateExtractionPrompt(hints);

    const extracted = await extractionModel.invoke([
      { role: "system", content: prompt },
      {
        role: "user",
        content: `CURRENT_CONTEXT:\n${JSON.stringify(currentContext, null, 2)}\n\nUSER_REQUEST:\n${inputText}`,
      },
    ]);

    return {
      extractedUpdates: extracted,
      messages: messages.length === 0 ? [new HumanMessage(userResponse)] : messages,
    };
  },
);
