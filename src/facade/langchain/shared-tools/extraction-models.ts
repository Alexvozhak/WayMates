import { trailSchema, userContextSchemaBase } from "../../../shared/schemas.js";

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
  createdAt: true,
});

export type ExtractableContext = z.infer<typeof extractableContextSchema>;
