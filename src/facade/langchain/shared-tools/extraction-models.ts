import { trailSchema, userContextSchemaBase } from "../../../shared/schemas.js";

import { getModel } from "./models.js";

import type { z } from "zod";

export const extractableTrailSchema = trailSchema.omit({
  trailId: true,
  fromContextId: true,
  toContextId: true,
});

export type ExtractableTrail = z.infer<typeof extractableTrailSchema>;

export const extractableContextSchema = userContextSchemaBase.omit({
  contextId: true,
  previousContextId: true,
  nextContextId: true,
});

export type ExtractableContext = z.infer<typeof extractableContextSchema>;

export const contextCorrectionModel = getModel("extraction")
  .withStructuredOutput(extractableContextSchema)
  .withRetry({ stopAfterAttempt: 2 });

export const trailCorrectionModel = getModel("extraction")
  .withStructuredOutput(extractableTrailSchema)
  .withRetry({ stopAfterAttempt: 2 });
