import { HumanMessage } from "@langchain/core/messages";

import { AgentInvariantError } from "../../../errors.js";
import { hasConfigDeps } from "../../shared/types.js";
import { extractableContextSchema } from "../../shared-tools/extraction-models.js";
import { getModel } from "../../shared-tools/models.js";
import { buildContextExtractionPrompt } from "../prompts.js";
import { NODE } from "../state.js";

import type { UpsertContextStateType } from "../state.js";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

const extractionModel = getModel("extraction").withStructuredOutput(extractableContextSchema);

export async function extractContextNode(
  state: UpsertContextStateType,
  config: LangGraphRunnableConfig,
): Promise<Partial<UpsertContextStateType>> {
  if (!hasConfigDeps(config)) {
    throw new AgentInvariantError(NODE.extract_context, "Config deps required");
  }
  const { cache } = config.configurable;

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
}
