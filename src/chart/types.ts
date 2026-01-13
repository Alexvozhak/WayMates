import type { AdhocContextBase, DTWMetrics, Locale, Trail, UserContext } from "../../private/schemas.js";

/**
 * Chart supports only ru/en labels. Other locales fallback to en.
 */
export type ChartLocale = "en" | "ru";

export function toChartLocale(locale: Locale): ChartLocale {
  return locale === "ru" ? "ru" : "en";
}

const CHARTABLE_FIELDS = [
  "position",
  "role",
  "domains",
  "countryCode",
  "cityName",
  "industry",
  "salaryExact",
] as const satisfies readonly (keyof UserContext)[];

export type ChartableField = (typeof CHARTABLE_FIELDS)[number];
export { CHARTABLE_FIELDS };

/** Candidate type for chart visualization — semantic role, not business logic */
export type CandidateType = "pathfinder" | "waymate" | "similar";

/** Badge text for candidate type in chart legend */
export const CANDIDATE_BADGE: Record<CandidateType, string> = {
  pathfinder: " (Pathfinder)",
  waymate: " (Waymate)",
  similar: "",
};

/** Label for candidate type in metrics table */
export const CANDIDATE_LABEL: Record<CandidateType, string> = {
  pathfinder: "Pathfinder",
  waymate: "Waymate",
  similar: "Similar",
};

/**
 * Chart-specific candidate type. Decoupled from business types (WaymateCandidate/PathfinderCandidate).
 * Chart doesn't care about business logic — only about visualization.
 */
export type ChartCandidate = {
  userId: string;
  matchedContext: UserContext;
  path?: UserContext[];
  trails?: Trail[];
  timeSinceMatchedMonths?: number;
  dtwMetrics?: DTWMetrics;
  dtwTotal?: number;
  /** Semantic type for chart styling (line width, badge) */
  candidateType: CandidateType;
};

export type FieldConfig = {
  field: ChartableField;
  labels: { ru: string; en: string };
  extractValue: (ctx: UserContext, goalValues?: GoalValues) => string | number | null;
  getLevels: () => string[];
};

// Re-export from constants for backward compatibility
export { ARRAY_OVERLAP_FIELDS } from "./config/constants.js";

export type TrajectoryPoint = {
  timestamp: number;
  values: Partial<Record<ChartableField, string | number | null>>;
  /** Raw arrays for fields that need intersection-based overlap (e.g., domains) */
  rawArrays?: Partial<Record<ChartableField, string[]>>;
};

export type ProcessedTrajectory = {
  id: string;
  label: string;
  color: string;
  width: number;
  /** null for user trajectory, "pathfinder" or "waymate" for candidates */
  candidateType: CandidateType | null;
  matchedContextIndex?: number;
  timeSinceMatchedMonths?: number;
  points: TrajectoryPoint[];
};

export type OverlapPeriod = {
  candidateId: string;
  field: ChartableField;
  start: number;
  end: number;
  value: string | number;
};

/** Full overlap period — when ALL selected fields match between user and candidate. */
export type FullOverlapPeriod = {
  start: number;
  end: number;
};

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
  candidateType: CandidateType;
  perField: Partial<Record<ChartableField, number>>;
  overall: number;
};

export type GoalValues = Partial<Record<ChartableField, string | number | null>>;

export type DynamicLevels = Partial<Record<ChartableField, string[]>>;

type BaseChartInput = {
  candidates: ChartCandidate[];
  maxCandidates: number;
  positionOrder: string[];
  locale: ChartLocale;
  selectedFields?: ChartableField[];
  goalValues?: GoalValues;
  /** Fields excluded from search — also excluded from Overlap calculation */
  excludedOverlapFields?: ChartableField[];
};

export type FullModeInput = BaseChartInput & {
  mode: "full";
  userTrajectory: UserContext[];
};

export type CandidatesOnlyInput = BaseChartInput & {
  mode: "candidates-only";
  adhocContext: AdhocContextBase;
};

export type GoalOnlyInput = BaseChartInput & {
  mode: "goal-only";
  goalValues: GoalValues;
};

export type GenerateChartInput = FullModeInput | CandidatesOnlyInput | GoalOnlyInput;

export type ChartMode = GenerateChartInput["mode"];

export type GenerateChartOutput = {
  chartUrl: string;
  expiresAt: string;
  candidateCount: number;
  fieldCount: number;
};

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl: string;
  ttlDays: number;
};

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
