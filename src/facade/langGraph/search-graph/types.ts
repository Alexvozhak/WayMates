import { z } from "zod";

import { currentSearchParamsBaseSchema, targetSearchParamsBaseSchema } from "../../../shared/schemas.js";
import { config } from "../../env.js";

import type { ContextField } from "../../../shared/schemas.js";

/**
 * Default excluded fields for career search (waymates, pathfinders).
 * These fields are not relevant for career trajectory matching.
 */
export const DEFAULT_EXCLUDED_CONTEXT_FIELDS: ContextField[] = [
  "cityName",
  "companySize",
  "birthYear",
  "educationLevel",
  "languages",
];

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

// Search params validation constants
export const MIN_LIMIT = 1;
export const MAX_LIMIT = 100;
export const MIN_RECENCY_THRESHOLD_MONTHS = 1;
export const DEFAULT_RECENCY_THRESHOLD_MONTHS = null; // No filter by default (explore-first)

/** Default current search params (adhoc/byUser) */
export const DEFAULT_CURRENT_SEARCH_PARAMS: CurrentSearchParamsWithFeedback = {
  excludedContextFields: [...DEFAULT_EXCLUDED_CONTEXT_FIELDS],
  excludedCreationReasons: [],
  recencyThresholdMonths: DEFAULT_RECENCY_THRESHOLD_MONTHS,
  limit: config.CANDIDATES_FETCH_LIMIT,
  pathLimit: config.CANDIDATES_DISPLAY_LIMIT,
  rejectedFields: [],
};

/** Default target search params (byTarget validation) */
export const DEFAULT_TARGET_SEARCH_PARAMS: Omit<TargetSearchParamsWithFeedback, "targetContext"> = {
  excludedCreationReasons: [],
  recencyThresholdMonths: DEFAULT_RECENCY_THRESHOLD_MONTHS,
  limit: config.CANDIDATES_FETCH_LIMIT,
  rejectedReasons: [],
};

/**
 * Applies search param defaults. Limits are fixed from config (not user-configurable).
 * Only recencyThresholdMonths can be user-specified.
 */
export function clampSearchParams(raw: { recencyThresholdMonths?: number | null }): {
  limit: number;
  pathLimit: number;
  recencyThresholdMonths: number | null;
} {
  const recency = raw.recencyThresholdMonths
    ? Math.max(raw.recencyThresholdMonths, MIN_RECENCY_THRESHOLD_MONTHS)
    : null;

  return {
    limit: config.CANDIDATES_FETCH_LIMIT,
    pathLimit: config.CANDIDATES_DISPLAY_LIMIT,
    recencyThresholdMonths: recency,
  };
}

export type { SearchGraphResponse } from "../../../shared/schemas.js";
