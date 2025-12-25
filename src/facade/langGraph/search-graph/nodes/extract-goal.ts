import { HumanMessage } from "@langchain/core/messages";

import { targetContextSchema } from "../../../../shared/schemas.js";
import { getModel } from "../../shared-tools/models.js";
import { buildGoalExtractionPrompt } from "../prompts.js";
import { NODE, PHASE } from "../state.js";
import { withLogging } from "../with-logging.js";

import type { SearchStateType } from "../state.js";

const extractionModel = getModel("extraction").withStructuredOutput(targetContextSchema);

export const extractGoalNode = withLogging<SearchStateType>(
  NODE.extract_goal,
  async (state, _config, { dictionariesService }) => {
    const { messages, userResponse, clarificationText } = state;

    // Use clarificationText if userResponse is empty (clarify intent case)
    const textToExtract = userResponse || clarificationText || "";

    const hints = await dictionariesService.buildHints(["role", "position", "domain", "skill", "industry"]);
    const prompt = buildGoalExtractionPrompt(hints);

    const extracted = await extractionModel.invoke([
      { role: "system", content: prompt },
      { role: "user", content: textToExtract },
    ]);

    const extractedGoal = extracted ? targetContextSchema.parse(extracted) : null;

    return {
      extractedGoal,
      userResponse: "",
      phase: PHASE.showing_goal,
      messages: messages.length === 0 ? [new HumanMessage(userResponse)] : messages,
    };
  },
);
