import { ChatOpenAI } from "@langchain/openai";

import { config } from "../../env.js";

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

export function clearModelInstances(): void {
  instances.clear();
}
