import { z } from "zod";

import { contextFieldSchema, newContextReasonSchema, targetSearchParamsBaseSchema } from "../../../shared/schemas.js";

import type { CurrentSearchParamsBase } from "../../../shared/schemas.js";

export const targetSearchParamsWithFeedbackSchema = targetSearchParamsBaseSchema.extend({
  rejectedReasons: z.array(z.string()),
});

export type TargetSearchParamsWithFeedback = z.infer<typeof targetSearchParamsWithFeedbackSchema>;

export type CurrentSearchParamsWithFeedback = CurrentSearchParamsBase & {
  rejectedFields: string[];
};

export const targetSearchParamsModificationSchema = z.object({
  excludedCreationReasons: z.array(newContextReasonSchema).nullable(),
  recencyThresholdMonths: z.number().nullable(),
  limit: z.number().nullable(),
});

export type TargetSearchParamsModification = z.infer<typeof targetSearchParamsModificationSchema>;

export const currentSearchParamsModificationSchema = z.object({
  excludedContextFields: z.array(contextFieldSchema).nullable(),
  excludedCreationReasons: z.array(newContextReasonSchema).nullable(),
  recencyThresholdMonths: z.number().nullable(),
  limit: z.number().nullable(),
  pathLimit: z.number().nullable(),
});

export type CurrentSearchParamsModification = z.infer<typeof currentSearchParamsModificationSchema>;

// Search params validation constants (match shared/schemas.ts business rules)
export const MIN_LIMIT = 1;
export const MAX_LIMIT = 100;
export const DEFAULT_LIMIT = 20;
export const MIN_RECENCY_THRESHOLD_MONTHS = 1;
export const DEFAULT_RECENCY_THRESHOLD_MONTHS = null; // No filter by default (explore-first)

export type { SearchGraphResponse } from "../../../shared/schemas.js";
