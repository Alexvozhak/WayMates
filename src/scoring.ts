import {
  DEFAULT_SCORING_WEIGHTS,
  type ScoringWeights,
} from "../config/scoring.js";

export interface ScoringInput {
  matchedSkills: number;
  coverage: number;
  domainOverlap: number;
  countryMatch: number;
  cityMatch: number;
}

export function calculateExplicitScore(
  input: ScoringInput,
  weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS
): number {
  const { matchedSkills, coverage, domainOverlap, countryMatch, cityMatch } =
    input;

  return (
    matchedSkills * weights.matchedSkills +
    coverage * weights.coverage +
    domainOverlap * weights.domainOverlap +
    countryMatch * weights.countryMatch +
    cityMatch * weights.cityMatch
  );
}
