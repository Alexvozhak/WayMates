import type { AdhocContextBase, UserContext, WaymateCandidate } from "../shared/schemas.js";

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

export type AspectConfig = {
  field: ChartableField;
  labels: { ru: string; en: string };
  extractValue: (ctx: UserContext) => string | number | null;
  getLevels: () => string[];
};

/** Fields that store arrays and should use intersection for overlap comparison */
export const ARRAY_OVERLAP_FIELDS: ChartableField[] = ["domains"];

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
  isWaymate: boolean;
  matchedContextIndex?: number;
  timeSinceMatchedMonths?: number;
  points: TrajectoryPoint[];
};

export type OverlapPeriod = {
  candidateId: string;
  field: ChartableField;
  startTime: number;
  endTime: number;
  value: string | number;
};

/** Full overlap period — when ALL selected fields match between user and candidate. */
export type FullOverlapPeriod = {
  candidateId: string;
  startTime: number;
  endTime: number;
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
  isWaymate: boolean;
  perField: Partial<Record<ChartableField, number>>;
  overall: number;
};

export type Locale = "ru" | "en";

export type GoalValues = Partial<Record<ChartableField, string | number | null>>;

export type DynamicLevels = Partial<Record<ChartableField, string[]>>;

type BaseChartInput = {
  candidates: WaymateCandidate[];
  maxCandidates: number;
  positionOrder: string[];
  locale: Locale;
  existingGoal: boolean;
  selectedFields?: ChartableField[];
  goalValues?: GoalValues;
  /** Fields excluded from search — also excluded from Overlap calculation */
  excludedOverlapFields: ChartableField[];
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
