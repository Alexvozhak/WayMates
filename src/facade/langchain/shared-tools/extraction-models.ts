import { ChatOpenAI } from "@langchain/openai";

import { trailSchema, userContextSchemaBase } from "../../../shared/schemas.js";
import { config } from "../../env.js";

import type { z } from "zod";

// For trail extraction, omit IDs since they will be added during linking
export const extractableTrailSchema = trailSchema.omit({
  trailId: true,
  fromContextId: true,
  toContextId: true,
});

export type ExtractableTrail = z.infer<typeof extractableTrailSchema>;

// For context extraction, omit fields that are generated server-side
export const extractableContextSchema = userContextSchemaBase.omit({
  contextId: true,
  previousContextId: true,
  nextContextId: true,
  createdAt: true,
});

export type ExtractableContext = z.infer<typeof extractableContextSchema>;

// Use OpenRouter + gpt-4o-mini for reliable structured extraction
const baseModel = new ChatOpenAI({
  modelName: "openai/gpt-4o-mini",
  apiKey: process.env.OPENROUTER_API_KEY,
  temperature: config.LANGCHAIN_TEMP_EXTRACTION,
  configuration: {
    baseURL: "https://openrouter.ai/api/v1",
  },
});

export const contextExtractionModel = baseModel.withStructuredOutput(extractableContextSchema);

export const trailExtractionModel = baseModel.withStructuredOutput(extractableTrailSchema);
