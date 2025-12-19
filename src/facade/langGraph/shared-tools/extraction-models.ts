import { trailSchema, userContextSchemaBase } from "../../../shared/schemas.js";
import { makeNullable } from "../../utils/llm-schemas.js";

import { getModel } from "./models.js";

import type { z } from "zod";

export const extractableTrailSchema = makeNullable(trailSchema);

export type ExtractableTrail = z.infer<typeof extractableTrailSchema>;

export const extractableContextSchema = makeNullable(userContextSchemaBase);

export type ExtractableContext = z.infer<typeof extractableContextSchema>;

export const contextCorrectionModel = getModel("extraction")
  .withStructuredOutput(extractableContextSchema)
  .withRetry({ stopAfterAttempt: 2 });
