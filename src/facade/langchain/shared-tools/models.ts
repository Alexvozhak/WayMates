import { ChatOpenAI } from "@langchain/openai";
import { createMiddleware } from "langchain";

import { config } from "../../env.js";

import type { AIMessage } from "@langchain/core/messages";
import type { AgentMiddleware } from "langchain";

export type ModelPurpose = "deterministic" | "extraction" | "planning" | "agent";

const temperatureMap: Record<ModelPurpose, number> = {
  deterministic: config.LANGCHAIN_TEMP_DETERMINISTIC,
  extraction: config.LANGCHAIN_TEMP_EXTRACTION,
  planning: config.LANGCHAIN_TEMP_PLANNING,
  agent: config.LANGCHAIN_TEMP_AGENT,
};

const instances = new Map<ModelPurpose, ChatOpenAI>();

export function getModel(purpose: ModelPurpose): ChatOpenAI {
  let model = instances.get(purpose);
  if (!model) {
    model = new ChatOpenAI({
      model: config.LANGCHAIN_MODEL_NAME,
      apiKey: config.OPENAI_API_KEY,
      temperature: temperatureMap[purpose],
      configuration: {
        baseURL: config.OPENAI_API_BASE,
      },
    });
    instances.set(purpose, model);
  }
  return model;
}

/* eslint-disable @typescript-eslint/naming-convention -- OpenAI API parameter */
export const sequentialToolCallsMiddleware: AgentMiddleware = createMiddleware({
  name: "sequential-tool-calls",
  wrapModelCall: async (request, handler): Promise<AIMessage> => {
    return handler({
      ...request,
      modelSettings: {
        ...request.modelSettings,
        parallel_tool_calls: false,
      },
    });
  },
});
/* eslint-enable @typescript-eslint/naming-convention */

export function clearModelInstances(): void {
  instances.clear();
}
