import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

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

export const contextExtractionModel = new ChatGoogleGenerativeAI({
  model: config.LANGCHAIN_MODEL_NAME,
  temperature: config.LANGCHAIN_TEMP_EXTRACTION,
}).withStructuredOutput(extractableContextSchema);

export const trailExtractionModel = new ChatGoogleGenerativeAI({
  model: config.LANGCHAIN_MODEL_NAME,
  temperature: config.LANGCHAIN_TEMP_EXTRACTION,
}).withStructuredOutput(extractableTrailSchema);
