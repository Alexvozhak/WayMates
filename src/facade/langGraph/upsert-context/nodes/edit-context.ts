import { HumanMessage } from "@langchain/core/messages";

import { extractableContextSchema } from "../../shared-tools/extraction-models.js";
import { getModel } from "../../shared-tools/models.js";
import { buildContextClarificationPrompt } from "../prompts.js";
import { NODE } from "../state.js";
import { withLogging } from "../with-logging.js";

import type { UpsertContextStateType } from "../state.js";

const editModel = getModel("extraction").withStructuredOutput(extractableContextSchema);

export const editContextNode = withLogging<UpsertContextStateType>(
  NODE.edit_context,
  async (state, _config, { dictionariesService }) => {
    const { extractedContext, parsedDecision, messages } = state;

    const corrections = parsedDecision?.editInstructions ?? "";
    const hints = await dictionariesService.buildHints(["role", "position", "domain", "skill", "industry"]);
    const prompt = buildContextClarificationPrompt(hints, JSON.stringify(extractedContext, null, 2), corrections);

    const edited = await editModel.invoke([
      { role: "system", content: prompt },
      { role: "user", content: corrections },
    ]);

    return {
      extractedContext: edited,
      messages: [...messages, new HumanMessage(corrections)],
    };
  },
);
