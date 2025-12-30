import { trailSchema, userContextSchemaBase } from "../../../shared/schemas.js";
import { makeNullable, withReasoning } from "../../utils/llm-schemas.js";

import { getModel } from "./models.js";

import type { z } from "zod";

export const extractableTrailSchema = makeNullable(trailSchema);

export type ExtractableTrail = z.infer<typeof extractableTrailSchema>;

export const extractableContextSchema = makeNullable(userContextSchemaBase);

export type ExtractableContext = z.infer<typeof extractableContextSchema>;

export const contextCorrectionModel = getModel("extraction")
  .withStructuredOutput(withReasoning(extractableContextSchema, "Explain what corrections you applied"))
  .withRetry({ stopAfterAttempt: 2 });
