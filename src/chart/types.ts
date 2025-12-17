import type { ScoredMatchedCandidate, UserContext } from "../shared/schemas.js";

// ==========================================
// === CHARTABLE FIELDS ===
// ==========================================

/**
 * Chartable fields - compile-time validated against UserContext.
 * Only fields that make sense for visual trajectory comparison.
 */
const CHARTABLE_FIELDS = [
  "position", // → extract grade (junior/middle/senior/lead)
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
  width: number; // candidateType priority (3/2/1.5)
  candidateType: "pathfinder" | "waymate" | null;
  matchedContextIndex?: number; // index of matched context in points[]
  timeSinceMatchedMonths?: number; // for pathfinder legend
  points: TrajectoryPoint[];
};

export type OverlapPeriod = {
  candidateId: string;
  field: ChartableField;
  startTime: number;
  endTime: number;
  value: string | number;
};

export type SimilarityMetrics = {
  candidateId: string;
  candidateType: "pathfinder" | "waymate" | null;
  perField: Partial<Record<ChartableField, number>>;
  overall: number;
};

// ==========================================
// === SERVICE INPUT/OUTPUT ===
// ==========================================

export type Locale = "ru" | "en";

export type GenerateChartInput = {
  userTrajectory: UserContext[];
  candidates: ScoredMatchedCandidate[];
  selectedFields?: ChartableField[];
  maxCandidates?: number;
  maxFields?: number;
  locale?: Locale;
  existingGoal?: boolean; // for pathfinder star visualization
};

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
