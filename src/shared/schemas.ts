import { z } from "zod";
import { REASON_IDS } from "../../database/reasons.js";

// ==========================================
// === ID PATTERNS & BASE SCHEMAS ===
// ==========================================

export const ISO_8601_DATETIME_PATTERN =
  "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d{3})?Z$";

export const UUID_V7_PATTERN =
  "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
export const USER_ID_PATTERN = `^usr_${UUID_V7_PATTERN}$`;
export const CONTEXT_ID_PATTERN = `^ctx_${UUID_V7_PATTERN}$`;
export const TRAIL_ID_PATTERN = `^trl_${UUID_V7_PATTERN}$`;
export const GOAL_ID_PATTERN = `^goal_${UUID_V7_PATTERN}$`;

export const UserIdSchema = z
  .string()
  .regex(new RegExp(USER_ID_PATTERN), "User ID must be in format usr_<UUID>")
  .describe("User ID in format usr_<UUID>");

export const ContextIdSchema = z
  .string()
  .regex(
    new RegExp(CONTEXT_ID_PATTERN),
    "Context ID must be in format ctx_<UUID>"
  )
  .describe("Context ID in format ctx_<UUID>");

export const TrailIdSchema = z
  .string()
  .regex(new RegExp(TRAIL_ID_PATTERN), "Trail ID must be in format trl_<UUID>")
  .describe("Trail ID in format trl_<UUID>");

export const GoalIdSchema = z
  .string()
  .regex(new RegExp(GOAL_ID_PATTERN), "Goal ID must be in format goal_<UUID>")
  .describe("Goal ID in format goal_<UUID>");

export type UserId = z.infer<typeof UserIdSchema>;
export type ContextId = z.infer<typeof ContextIdSchema>;
export type TrailId = z.infer<typeof TrailIdSchema>;
export type GoalId = z.infer<typeof GoalIdSchema>;

// ==========================================
// === DOMAIN ENTITIES ===
// ==========================================

export const NewContextReasonSchema = z.enum(REASON_IDS);

export type NewContextReason = z.infer<typeof NewContextReasonSchema>;

export const ScheduleSchema = z.object({
  sessionsPerWeek: z.number().describe("Sessions per week"),
  hoursPerSession: z.number().describe("Hours per session"),
});

export const TrailSchema = z.object({
  skill: z.string().describe("Skill being developed"),
  platform: z.string().describe("Learning platform used"),
  fromContextId: ContextIdSchema,
  toContextId: z
    .union([ContextIdSchema, z.null().describe("null for ongoing trails")])
    .describe("Target context ID - string for completed, null for ongoing"),
  totalDurationWeeks: z.number().describe("Total duration in weeks"),
  schedule: ScheduleSchema,
  costUsd: z.number().describe("Cost in USD"),
  ratingCourse: z.number().min(1).max(5).describe("Course rating 1-5"),
  ratingPlatform: z.number().min(1).max(5).describe("Platform rating 1-5"),
  ratingSchedule: z.number().min(1).max(5).describe("Schedule rating 1-5"),
  courseName: z.string().describe("Course name").optional(),
  courseLink: z.string().describe("Course URL").optional(),
  userFeedback: z.string().describe("User feedback").optional(),
});

export const UserConstraintsSchema = z.object({
  maxHoursPerWeek: z.number().describe("Maximum hours per week").optional(),
  maxMonthlyBudget: z
    .number()
    .describe("Maximum monthly budget in USD")
    .optional(),
  deadlineDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Deadline date must be in YYYY-MM-DD format")
    .describe("Deadline date in YYYY-MM-DD format")
    .optional(),
});

export const UserContextSchema = z.object({
  contextId: z.string(),
  previousContextId: ContextIdSchema.nullable().optional(),
  nextContextId: ContextIdSchema.nullable().optional(),
  createdAt: z
    .string()
    .regex(new RegExp(ISO_8601_DATETIME_PATTERN), "Must be ISO 8601 format")
    .describe("When this context/event occurred (ISO 8601 format)"),
  creationReason: z
    .array(NewContextReasonSchema)
    .min(1)
    .describe(
      "Reasons for context creation (always required, use 'started_working' for first job)"
    ),
  position: z.string().min(1).describe("Position title"),
  domains: z.array(z.string()).min(1).describe("Work domains"),
  skills: z.array(z.string()).min(1).describe("Skill names"),
  industry: z.string().describe("Company industry"),
  companySize: z.string().describe("Company size"),
  countryCode: z.string().describe("Location country code"),
  cityName: z.string().describe("Location city name"),
  citizenships: z.array(z.string()),
  birthYear: z.number().min(1950).describe("Birth year"),
});

export type Schedule = z.infer<typeof ScheduleSchema>;
export type Trail = z.infer<typeof TrailSchema>;
export type UserConstraints = z.infer<typeof UserConstraintsSchema>;
export type UserContext = z.infer<typeof UserContextSchema>;

// ==========================================
// === TARGET SEARCH FILTER SCHEMAS ===
// ==========================================

/**
 * Filter mode for target search - discriminator for field filters
 */
export const FilterModeSchema = z.enum(["desired", "undesired"]);
export type FilterMode = z.infer<typeof FilterModeSchema>;

/**
 * Field filter with mode + values (discriminated union pattern)
 * Enforces mutual exclusivity between desired/undesired at type level
 */
export const FieldFilterSchema = z.object({
  mode: FilterModeSchema.describe("Filter mode: desired (include) or undesired (exclude)"),
  values: z
    .array(
      z.string()
        .min(1, "Value cannot be empty")
        .trim()
    )
    .min(1, "At least one value required")
    .max(5, "Maximum 5 values allowed"),
});
export type FieldFilter = z.infer<typeof FieldFilterSchema>;

/**
 * Target context for search criteria
 * Uses FieldFilter discriminated union pattern
 */
export const TargetContextSchema = z.object({
  position: FieldFilterSchema.optional().describe("Target position filter"),
  countries: FieldFilterSchema.optional().describe("Target countries filter"),
  domains: FieldFilterSchema.optional().describe("Target work domains filter"),
  skills: FieldFilterSchema.optional().describe("Target skills filter"),
}).refine(
  (data) => {
    const hasAtLeastOne =
      data.position !== undefined ||
      data.countries !== undefined ||
      data.domains !== undefined ||
      data.skills !== undefined;
    return hasAtLeastOne;
  },
  { message: "At least one target criterion is required (position, countries, domains, or skills)" }
);

export type TargetContext = z.infer<typeof TargetContextSchema>;

// ==========================================
// === SEARCH FILTERS SCHEMAS ===
// ==========================================

/**
 * Available context field names for search configuration
 */
export const ContextFieldSchema = z.enum([
  "position",
  "domains",
  "skills",
  "industry",
  "countryCode",
  "cityName",
  "companySize",
  "birthYear",
], {
  description: "Available field names for search configuration",
});

export type ContextField = z.infer<typeof ContextFieldSchema>;

/**
 * Base search filters for all search modes
 */
export const SearchFiltersSchema = z.object({
  excludedContextFields: z
    .array(ContextFieldSchema)
    .default([])
    .describe("Fields to exclude from comparison (inverse logic: all fields EXCEPT these are strict)"),
  excludedCreationReasons: z
    .array(NewContextReasonSchema)
    .default([])
    .describe("Exclude candidates with these transition reasons"),
  recencyThresholdMonths: z
    .number()
    .min(1)
    .optional()
    .describe("Filter by recency (months since last update)"),
  limit: z
    .number()
    .min(1)
    .max(100)
    .default(20)
    .describe("Maximum number of results to return"),
});

export type SearchFilters = z.infer<typeof SearchFiltersSchema>;

/**
 * Ad-hoc search parameters with custom reference context
 */
export const SearchByContextParamsSchema = z.object({
  userId: UserIdSchema.describe("User ID for Goal filter"),
  referenceContext: UserContextSchema.describe("Custom reference context (extracted from user text)"),
  filters: SearchFiltersSchema,
});

export type SearchByContextParams = z.infer<typeof SearchByContextParamsSchema>;

// ==========================================
// === STORY & GOAL OPERATIONS ===
// ==========================================

export const StoryInputSchema = z.object({
  userId: UserIdSchema,
  contexts: z.array(UserContextSchema).min(1),
  trails: z.array(TrailSchema).min(0),
});

export const UpsertContextResultSchema = z.object({
  success: z.boolean(),
  contextIds: z.array(ContextIdSchema),
});

export const UpsertTrailResultSchema = z.object({
  success: z.boolean(),
  trailIds: z.array(TrailIdSchema),
});

export const UpsertStoryResultSchema = z.object({
  contexts: UpsertContextResultSchema,
  trails: UpsertTrailResultSchema,
});

export const GoalSchema = z.object({
  userId: UserIdSchema,
  targetCriteria: TargetContextSchema.describe("Target position criteria with FieldFilter pattern"),
  createdAt: z
    .string()
    .regex(new RegExp(ISO_8601_DATETIME_PATTERN), "Must be ISO 8601 format")
    .describe("When goal was created (ISO 8601 format)"),
});

export const CreateGoalInputSchema = z.object({
  userId: UserIdSchema,
  targetContext: TargetContextSchema.describe("Target search criteria"),
});

export type StoryInput = z.infer<typeof StoryInputSchema>;
export type UpsertContextResult = z.infer<typeof UpsertContextResultSchema>;
export type UpsertTrailResult = z.infer<typeof UpsertTrailResultSchema>;
export type UpsertStoryResult = z.infer<typeof UpsertStoryResultSchema>;
export type Goal = z.infer<typeof GoalSchema>;
export type CreateGoalInput = z.infer<typeof CreateGoalInputSchema>;

// ==========================================
// === SEARCH CANDIDATE TYPES (композиция) ===
// ==========================================

// DTW metrics schema
export const DTWMetricsSchema = z.object({
  shape_similarity: z
    .number()
    .min(0)
    .max(1)
    .describe("Path shape similarity (0-1)"),
  tempo_similarity: z
    .number()
    .min(0)
    .max(1)
    .describe("Career speed similarity (0-1)"),
  stability_score: z
    .number()
    .min(0)
    .max(1)
    .describe("Job stability metric (0-1)"),
});

export type DTWMetrics = z.infer<typeof DTWMetricsSchema>;

// ==========================================
// === COMPOSITION BLOCKS (defined once) ===
// ==========================================

// Block 1: Core fields
export const CandidateCoreSchema = z.object({
  user_id: UserIdSchema.describe("Candidate user ID"),
  matched_context: UserContextSchema.describe(
    "Context that matched search criteria"
  ),
  time_since_matched_months: z
    .number()
    .min(0)
    .describe("Months since matched context was created"),
});

export type CandidateCore = z.infer<typeof CandidateCoreSchema>;

// Block 2: Context scoring fields
export const ContextScoringFieldsSchema = z.object({
  context_match_score: z
    .number()
    .min(0)
    .max(1)
    .describe(
      "Context match score (0-1, computed as 1.0 - skills_penalty in Cypher)"
    ),
  candidate_type: z
    .enum(["pathfinder", "waymate"])
    .nullable()
    .describe("Pathfinder = reached goal, Waymate = same goal, null = regular"),
});

export type ContextScoringFields = z.infer<typeof ContextScoringFieldsSchema>;

// Block 3: Path fields (renamed: trajectory → path)
export const PathFieldsSchema = z.object({
  path: z
    .array(UserContextSchema)
    .describe("Full career path from started_working to matched_context"),
});

export type PathFields = z.infer<typeof PathFieldsSchema>;

// Block 4: DTW fields
export const DTWFieldsSchema = z.object({
  dtw_metrics: DTWMetricsSchema,
  dtw_total: z
    .number()
    .min(0)
    .max(3)
    .describe("Sum of shape + tempo + stability (0-3)"),
});

export type DTWFields = z.infer<typeof DTWFieldsSchema>;

// ==========================================
// === FINAL TYPES (composition) ===
// ==========================================

// Type 1: Core only
export const MatchedCandidateSchema = CandidateCoreSchema;
export type MatchedCandidate = CandidateCore;

// Type 2: Core + Scoring + Optional Path + Optional DTW
// Unified type for both simple context search and DTW search
export const ScoredMatchedCandidateSchema = CandidateCoreSchema
  .merge(ContextScoringFieldsSchema)
  .merge(PathFieldsSchema.partial())
  .merge(DTWFieldsSchema.partial());
export type ScoredMatchedCandidate = z.infer<
  typeof ScoredMatchedCandidateSchema
>;

// Type 3: Core + Path
export const MatchedCandidateWithPathSchema =
  CandidateCoreSchema.merge(PathFieldsSchema);
export type MatchedCandidateWithPath = z.infer<
  typeof MatchedCandidateWithPathSchema
>;

// Type 4: Core + Path + Scoring
export const ScoredMatchedCandidateWithPathSchema = CandidateCoreSchema.merge(
  PathFieldsSchema
).merge(ContextScoringFieldsSchema);
export type ScoredMatchedCandidateWithPath = z.infer<
  typeof ScoredMatchedCandidateWithPathSchema
>;

// Type 5: Core + Path + Scoring + DTW
export const ScoredMatchedCandidateWithPathAndDTWSchema =
  CandidateCoreSchema.merge(PathFieldsSchema)
    .merge(ContextScoringFieldsSchema)
    .merge(DTWFieldsSchema)
    .refine(
      (data) => {
        const computed =
          data.dtw_metrics.shape_similarity +
          data.dtw_metrics.tempo_similarity +
          data.dtw_metrics.stability_score;
        return Math.abs(data.dtw_total - computed) < 0.001;
      },
      { message: "dtw_total must equal sum of dtw_metrics" }
    );
export type ScoredMatchedCandidateWithPathAndDTW = z.infer<
  typeof ScoredMatchedCandidateWithPathAndDTWSchema
>;

// ==========================================
// === DEPRECATED TYPES (для обратной совместимости) ===
// ==========================================

/**
 * @deprecated Use MatchedCandidateSchema instead
 */
export const CandidateMatchedSchema = CandidateCoreSchema;
export type CandidateMatched = CandidateCore;

/**
 * @deprecated Use MatchedCandidateWithPathSchema instead.
 * Note: field renamed from 'trajectory' to 'path'
 */
export const CandidateWithPathSchema = CandidateCoreSchema.extend({
  trajectory: z
    .array(UserContextSchema)
    .describe("Full career path from started_working to matched_context"),
});
export type CandidateWithPath = z.infer<typeof CandidateWithPathSchema>;

/**
 * @deprecated Internal type, will be removed. Use ScoredMatchedCandidate instead.
 */
export const CandidatePreDTWSchema = CandidateCoreSchema.omit({
  time_since_matched_months: true,
}).extend({
  skills_penalty: z
    .number()
    .min(0)
    .max(1)
    .describe("Penalty for extra skills (0-1, normalized)"),
  candidate_type: z
    .enum(["pathfinder", "waymate"])
    .nullable()
    .describe("Pathfinder = reached goal, Waymate = same goal, null = regular"),
});
export type CandidatePreDTW = z.infer<typeof CandidatePreDTWSchema>;

/**
 * @deprecated Use ScoredMatchedCandidateSchema instead.
 * Note: total_score removed, use explicit sorting formula
 */
export const CandidateBasicSchema = CandidateCoreSchema.extend({
  skills_penalty: z
    .number()
    .min(0)
    .max(1)
    .describe("Penalty for extra skills (0-1, normalized)"),
  total_score: z.number().describe("Combined score for ranking"),
  candidate_type: z
    .enum(["pathfinder", "waymate"])
    .nullable()
    .describe("Pathfinder = reached goal, Waymate = same goal, null = regular"),
});
export type CandidateBasic = z.infer<typeof CandidateBasicSchema>;

/**
 * @deprecated Use ScoredMatchedCandidateWithPathAndDTWSchema instead.
 * Note: field renamed from 'trajectory' to 'path', total_score removed
 */
export const CandidateWithDTWSchema = CandidateWithPathSchema.extend({
  skills_penalty: z
    .number()
    .min(0)
    .max(1)
    .describe("Penalty for extra skills (0-1, normalized)"),
  total_score: z
    .number()
    .describe("dtw_total + (1.0 - skills_penalty) for sorting"),
  candidate_type: z
    .enum(["pathfinder", "waymate"])
    .nullable()
    .describe("Pathfinder = reached goal, Waymate = same goal, null = regular"),
  dtw_metrics: DTWMetricsSchema,
  dtw_total: z
    .number()
    .min(0)
    .max(3)
    .describe("Sum of shape + tempo + stability (0-3)"),
});
export type CandidateWithDTW = z.infer<typeof CandidateWithDTWSchema>;

// ==========================================
// === PATH COLLECTION TYPES ===
// ==========================================

/**
 * Result of batch path collection query
 */
export const PathBatchResultSchema = z.object({
  userId: z.string().describe("User ID for which trajectory was collected"),
  path: z.array(UserContextSchema).describe("Trajectory from career start to current context")
});

export type PathBatchResult = z.infer<typeof PathBatchResultSchema>;
