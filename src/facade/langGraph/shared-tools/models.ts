import { config } from "../../env.js";

import { RateLimitedChatOpenAI } from "./rate-limit.js";

export type ModelPurpose = "deterministic" | "extraction" | "planning" | "agent";

const temperatureMap: Record<ModelPurpose, number> = {
  deterministic: config.LANGCHAIN_TEMP_DETERMINISTIC,
  extraction: config.LANGCHAIN_TEMP_EXTRACTION,
  planning: config.LANGCHAIN_TEMP_PLANNING,
  agent: config.LANGCHAIN_TEMP_AGENT,
};

const instances = new Map<ModelPurpose, RateLimitedChatOpenAI>();

export function getModel(purpose: ModelPurpose): RateLimitedChatOpenAI {
  let model = instances.get(purpose);
  if (!model) {
    model = new RateLimitedChatOpenAI({
      model: config.LANGCHAIN_MODEL_NAME,
      apiKey: config.OPENAI_API_KEY,
      temperature: temperatureMap[purpose],
      timeout: config.LANGCHAIN_TIMEOUT_MS,
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
