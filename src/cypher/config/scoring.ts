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
