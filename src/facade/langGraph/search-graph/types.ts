import { z } from "zod";

import { currentSearchParamsBaseSchema, targetSearchParamsBaseSchema } from "../../../shared/schemas.js";

export const targetSearchParamsWithFeedbackSchema = targetSearchParamsBaseSchema.extend({
  rejectedReasons: z.array(z.string()),
});

export type TargetSearchParamsWithFeedback = z.infer<typeof targetSearchParamsWithFeedbackSchema>;

// Note: currentSearchParamsBaseSchema is ZodEffects (has transform), so .extend() doesn't work.
// Using .and() to combine with feedback fields.
export const currentSearchParamsWithFeedbackSchema = currentSearchParamsBaseSchema.and(
  z.object({ rejectedFields: z.array(z.string()) }),
);

export type CurrentSearchParamsWithFeedback = z.infer<typeof currentSearchParamsWithFeedbackSchema>;

// Search params validation constants (match shared/schemas.ts business rules)
export const MIN_LIMIT = 1;
export const MAX_LIMIT = 100;
export const DEFAULT_LIMIT = 20;
export const MIN_RECENCY_THRESHOLD_MONTHS = 1;
export const DEFAULT_RECENCY_THRESHOLD_MONTHS = null; // No filter by default (explore-first)

/** Default current search params (adhoc/byUser) */
export const DEFAULT_CURRENT_SEARCH_PARAMS: CurrentSearchParamsWithFeedback = {
  excludedContextFields: [],
  excludedCreationReasons: [],
  recencyThresholdMonths: DEFAULT_RECENCY_THRESHOLD_MONTHS,
  limit: DEFAULT_LIMIT,
  pathLimit: DEFAULT_LIMIT,
  rejectedFields: [],
};

/** Default target search params (byTarget validation) */
export const DEFAULT_TARGET_SEARCH_PARAMS: Omit<TargetSearchParamsWithFeedback, "targetContext"> = {
  excludedCreationReasons: [],
  recencyThresholdMonths: DEFAULT_RECENCY_THRESHOLD_MONTHS,
  limit: DEFAULT_LIMIT,
  rejectedReasons: [],
};

/**
 * Clamps and applies defaults to LLM-extracted search params.
 * Centralizes Math.min/max logic from parse-search-intent and apply-filters.
 */
export function clampSearchParams(raw: {
  limit?: number | null;
  pathLimit?: number | null;
  recencyThresholdMonths?: number | null;
}): { limit: number; pathLimit: number; recencyThresholdMonths: number | null } {
  const limit = raw.limit ? Math.min(Math.max(raw.limit, MIN_LIMIT), MAX_LIMIT) : DEFAULT_LIMIT;
  const pathLimit = raw.pathLimit ? Math.min(Math.max(raw.pathLimit, MIN_LIMIT), limit) : limit;
  const recency = raw.recencyThresholdMonths
    ? Math.max(raw.recencyThresholdMonths, MIN_RECENCY_THRESHOLD_MONTHS)
    : null;

  return { limit, pathLimit, recencyThresholdMonths: recency };
}

export type { SearchGraphResponse } from "../../../shared/schemas.js";
