/**
 * Centralized scoring weights configuration
 * Single source of truth for all scoring weights in the system
 */
export interface ScoringWeights {
  matchedSkills: number;
  coverage: number;
  domainOverlap: number;
  countryMatch: number;
  cityMatch: number;
}

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  matchedSkills: 0.4,
  coverage: 0.3,
  domainOverlap: 0.2,
  countryMatch: 0.15,
  cityMatch: 0.05,
};

/**
 * Pre-generated Cypher scoring formula with default weights
 */
export const CYPHER_SCORING_FORMULA = `(matchedSkills * ${DEFAULT_SCORING_WEIGHTS.matchedSkills} + coverage * ${DEFAULT_SCORING_WEIGHTS.coverage} + domainOverlap * ${DEFAULT_SCORING_WEIGHTS.domainOverlap} + countryMatch * ${DEFAULT_SCORING_WEIGHTS.countryMatch} + cityMatch * ${DEFAULT_SCORING_WEIGHTS.cityMatch})`;

export interface TrailScoringComponents {
  matchedSkills: number; // Совпадение навыков
  platformRating: number; // Рейтинг платформы
  costCompatibility: number; // Соответствие бюджету
  timelineCompatibility: number; // Соответствие времени
}

export const TRAIL_WEIGHTS = {
  matchedSkills: 0.4,
  platformRating: 0.2,
  costCompatibility: 0.2,
  timelineCompatibility: 0.2,
};
