/**
 * Shared constants for chart module.
 * Used in both server and browser runtime.
 */

/** Milliseconds per day */
export const MS_PER_DAY = 86_400_000;

/** Array fields — use intersection for overlap comparison */
export const ARRAY_OVERLAP_FIELDS: readonly string[] = ["domains"];

/** Jitter step for separating trajectories on chart */
export const JITTER_STEP = 0.08;
