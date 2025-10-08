// Types for Unified Search Results
// Все схемы запросов находятся в schemas.ts

import type { NewContextReason, SearchConstraints } from "./schemas-zod.js";

// Search constraints - system-level parameters
// SearchConstraints теперь импортируется из schemas-zod.js

export const DEFAULT_SEARCH_CONSTRAINTS: SearchConstraints = {
  max_timing_diff_months: 24, // релевантность не более 2 лет
  timing_diff_threshold_percent: 30, // процентный порог отсева по timing
  max_experience_diff_months: 36, // максимальная разница в стаже (3 года)
  results_limit: 50, // лимит результатов для производительности
};

// Scoring weights - система весов для ранжирования
export interface ScoringWeights {
  // Скоринг по current context (для ранжирования похожести)
  currentFlexibleSkillsMatch: number; // 0.45 (45%) - % покрытия лояльных навыков current

  // Остальные критерии совместимости
  experienceDelta: number; // 0.22 (22%) - близость по стажу
  timingRelevance: number; // 0.18 (18%) - актуальность контекста
  countryMatch: number; // 0.1 (10%) - совпадение страны
  cityMatch: number; // 0.05 (5%) - совпадение города
  companySizeMatch: number; // 0.03 (3%) - совпадение размера компании
  teamSizeMatch: number; // 0.02 (2%) - совпадение размера команды
}

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  // Нормализованные веса (сумма = 1.0)
  currentFlexibleSkillsMatch: 0.43, // 45/105 ≈ 0.43 (43%)
  experienceDelta: 0.21, // 22/105 ≈ 0.21 (21%)
  timingRelevance: 0.17, // 18/105 ≈ 0.17 (17%)
  countryMatch: 0.095, // 10/105 ≈ 0.095 (9.5%)
  cityMatch: 0.048, // 5/105 ≈ 0.048 (4.8%)
  companySizeMatch: 0.029, // 3/105 ≈ 0.029 (2.9%)
  teamSizeMatch: 0.019, // 2/105 ≈ 0.019 (1.9%)
};

export const DEFAULT_REASONS_TO_TRACK: NewContextReason[] = [
  "position_changed",
  "location_changed",
  "company_changed",
  "industry_changed",
  "domain_changed",
  "work_format_changed",
];
