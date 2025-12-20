import { HumanMessage } from "@langchain/core/messages";

import { targetContextSchema } from "../../../../shared/schemas.js";
import { AgentInvariantError } from "../../../errors.js";
import { hasConfigDeps } from "../../shared/types.js";
import { getModel } from "../../shared-tools/models.js";
import { buildGoalExtractionPrompt } from "../prompts.js";
import { NODE, PHASE } from "../state.js";

import type { SearchStateType } from "../state.js";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

const extractionModel = getModel("extraction").withStructuredOutput(targetContextSchema);

export async function extractGoalNode(
  state: SearchStateType,
  config: LangGraphRunnableConfig,
): Promise<Partial<SearchStateType>> {
  const { messages, userResponse } = state;

  if (!hasConfigDeps(config)) {
    throw new AgentInvariantError(NODE.extract_goal, "Missing cache dependency");
  }
  const { cache } = config.configurable;

  const [roles, positions, domains, skills, industries] = await Promise.all([
    cache.getSimple("role"),
    cache.getSimple("position"),
    cache.getSimple("domain"),
    cache.getSimple("skill"),
    cache.getSimple("industry"),
  ]);

  const prompt = buildGoalExtractionPrompt({
    roles: [...roles.values()],
    positions: [...positions.values()],
    domains: [...domains.values()],
    skills: [...skills.values()],
    industries: [...industries.values()],
  });

  const extracted = await extractionModel.invoke([
    { role: "system", content: prompt },
    { role: "user", content: userResponse },
  ]);

  const extractedGoal = extracted ? targetContextSchema.parse(extracted) : null;

  return {
    extractedGoal,
    userResponse: "", // Clear to ensure show_goal does interrupt
    phase: PHASE.showing_goal,
    messages: messages.length === 0 ? [new HumanMessage(userResponse)] : messages,
  };
}
