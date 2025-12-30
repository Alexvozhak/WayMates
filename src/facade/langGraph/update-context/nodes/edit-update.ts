import { HumanMessage } from "@langchain/core/messages";

import { extractableContextSchema } from "../../shared-tools/extraction-models.js";
import { getModel } from "../../shared-tools/models.js";
import { buildUpdateClarificationPrompt } from "../prompts.js";
import { NODE } from "../state.js";
import { withLogging } from "../with-logging.js";

import type { UpdateContextStateType } from "../state.js";

const editModel = getModel("extraction").withStructuredOutput(extractableContextSchema);

export const editUpdateNode = withLogging<UpdateContextStateType>(
  NODE.edit_update,
  async (state, _config, { dictionariesService }) => {
    const { mergedContext, parsedDecision, messages } = state;

    const corrections = parsedDecision?.editInstructions ?? "";
    const hints = await dictionariesService.buildHints(["role", "position", "domain", "skill", "industry"]);
    const prompt = buildUpdateClarificationPrompt(hints, JSON.stringify(mergedContext, null, 2), corrections);

    const edited = await editModel.invoke([
      { role: "system", content: prompt },
      { role: "user", content: corrections },
    ]);

    return {
      extractedUpdates: edited,
      messages: [...messages, new HumanMessage(corrections)],
    };
  },
);
