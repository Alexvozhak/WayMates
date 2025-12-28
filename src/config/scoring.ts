import { z } from "zod";

/**
 * Scoring configuration for complexity-based skill scoring (ADR-009)
 *
 * Formula: weight = complexity × weightMultiplier, penalty = complexity × penaltyMultiplier
 * Example: "c++" (95) → weight=19, penalty=4.75
 */

const scoringConfigSchema = z.object({
  weightMultiplier: z.number().positive(),
  penaltyMultiplier: z.number().positive(),
});

export const SCORING_CONFIG = scoringConfigSchema.parse({
  weightMultiplier: Number(process.env.WEIGHT_MULTIPLIER) || 0.2,
  penaltyMultiplier: Number(process.env.PENALTY_MULTIPLIER) || 0.05,
});

/**
 * Minimum trajectory length for DTW calculation.
 *
 * Why 3: DTW Tempo metric uses derivatives (rate of change).
 * Derivative requires 2 adjacent points → 3 contexts minimum.
 * With 2 contexts, Tempo would have only 1 derivative value = meaningless comparison.
 */
export const DTW_MIN_TRAJECTORY_LENGTH = 3;
