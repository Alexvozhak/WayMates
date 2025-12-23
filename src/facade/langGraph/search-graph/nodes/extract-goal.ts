import { HumanMessage } from "@langchain/core/messages";

import { targetContextSchema } from "../../../../shared/schemas.js";
import { getModel } from "../../shared-tools/models.js";
import { buildGoalExtractionPrompt } from "../prompts.js";
import { NODE, PHASE } from "../state.js";
import { withLogging } from "../with-logging.js";

import type { SearchStateType } from "../state.js";

const extractionModel = getModel("extraction").withStructuredOutput(targetContextSchema);

export const extractGoalNode = withLogging<SearchStateType>(NODE.extract_goal, async (state, _config, { cache }) => {
  const { messages, userResponse } = state;

  const [roles, positions, domains, skills, industries] = await Promise.all([
    cache.getSimple("role"),
    cache.getSimple("position"),
    cache.getSimple("domain"),
    cache.getSimple("skill"),
    cache.getSimple("industry"),
  ]);

  const prompt = buildGoalExtractionPrompt({
    roles: [...roles.values()].map((e) => e.canonicalName),
    positions: [...positions.values()].map((e) => e.canonicalName),
    domains: [...domains.values()].map((e) => e.canonicalName),
    skills: [...skills.values()].map((e) => e.canonicalName),
    industries: [...industries.values()].map((e) => e.canonicalName),
  });

  const extracted = await extractionModel.invoke([
    { role: "system", content: prompt },
    { role: "user", content: userResponse },
  ]);

  const extractedGoal = extracted ? targetContextSchema.parse(extracted) : null;

  return {
    extractedGoal,
    userResponse: "",
    phase: PHASE.showing_goal,
    messages: messages.length === 0 ? [new HumanMessage(userResponse)] : messages,
  };
});
