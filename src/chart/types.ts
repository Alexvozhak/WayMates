import type { AdhocContextBase, ScoredMatchedCandidate, UserContext } from "../shared/schemas.js";

// ==========================================
// === CHARTABLE FIELDS ===
// ==========================================

/**
 * Chartable fields - compile-time validated against UserContext.
 * Only fields that make sense for visual trajectory comparison.
 */
const CHARTABLE_FIELDS = [
  "position", // → extract grade (junior/middle/senior/lead)
  "role", // → role/function
  "domains", // → first domain
  "cityName", // → city
  "industry", // → industry
  "salaryExact", // → salary (if present)
] as const satisfies readonly (keyof UserContext)[];

export type ChartableField = (typeof CHARTABLE_FIELDS)[number];
export { CHARTABLE_FIELDS };

// ==========================================
// === ASPECT CONFIGURATION ===
// ==========================================

export type AspectConfig = {
  field: ChartableField;
  labels: { ru: string; en: string };
  extractValue: (ctx: UserContext) => string | number | null;
  getLevels: () => string[];
};

// ==========================================
// === PROCESSED DATA ===
// ==========================================

export type TrajectoryPoint = {
  timestamp: number;
  values: Partial<Record<ChartableField, string | number | null>>;
};

export type ProcessedTrajectory = {
  id: string;
  label: string;
  color: string;
  width: number; // waymate priority (2 for waymate, 1.5 for regular)
  isWaymate: boolean;
  matchedContextIndex?: number; // index of matched context in points[]
  timeSinceMatchedMonths?: number; // for legend
  points: TrajectoryPoint[];
};

export type OverlapPeriod = {
  candidateId: string;
  field: ChartableField;
  startTime: number;
  endTime: number;
  value: string | number;
};

/**
 * Full overlap period - when ALL selected fields match between user and candidate.
 * Used for Overlap Timeline visualization.
 */
export type FullOverlapPeriod = {
  candidateId: string;
  startTime: number;
  endTime: number;
};

/**
 * Summary of full overlap for a candidate.
 * Displayed in the Overlap Timeline section.
 */
export type OverlapSummary = {
  candidateId: string;
  candidateLabel: string;
  candidateColor: string;
  periods: FullOverlapPeriod[];
  totalDays: number;
  longestStreakDays: number;
};

export type SimilarityMetrics = {
  candidateId: string;
  isWaymate: boolean;
  perField: Partial<Record<ChartableField, number>>;
  overall: number;
};

// ==========================================
// === SERVICE INPUT/OUTPUT ===
// ==========================================

export type Locale = "ru" | "en";

/**
 * Goal values for horizontal goal line visualization.
 * Maps chartable fields to their target values.
 */
export type GoalValues = Partial<Record<ChartableField, string | number | null>>;

/**
 * Dynamic levels for each chartable field.
 * Collected from User + Candidates data at runtime.
 * Used for Y-axis tick labels and Goal Line positioning.
 */
export type DynamicLevels = Partial<Record<ChartableField, string[]>>;

type BaseChartInput = {
  candidates: ScoredMatchedCandidate[];
  maxCandidates: number;
  positionOrder: string[];
  selectedFields?: ChartableField[];
  locale?: Locale;
  existingGoal?: boolean;
  goalValues?: GoalValues;
};

export type FullModeInput = BaseChartInput & {
  mode: "full";
  userTrajectory: UserContext[];
};

export type CandidatesOnlyInput = BaseChartInput & {
  mode: "candidates-only";
  adhocContext: AdhocContextBase;
};

export type GenerateChartInput = FullModeInput | CandidatesOnlyInput;

export type ChartMode = GenerateChartInput["mode"];

export type GenerateChartOutput = {
  chartUrl: string;
  expiresAt: string;
  candidateCount: number;
  fieldCount: number;
};

// ==========================================
// === R2 CONFIG ===
// ==========================================

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl: string;
  ttlDays: number;
};

// ==========================================
// === ERRORS ===
// ==========================================

export type ChartErrorCode = "R2_UPLOAD_FAILED" | "INVALID_TRAJECTORY" | "CONFIG_MISSING" | "TRANSFORM_FAILED";

export class ChartGenerationError extends Error {
  public readonly code: ChartErrorCode;
  public override readonly cause?: Error;

  constructor(message: string, code: ChartErrorCode, cause?: Error) {
    super(message, { cause });
    this.name = "ChartGenerationError";
    this.code = code;
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}
