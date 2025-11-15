import { z } from "zod";

import { REASON_IDS } from "../../database/reasons.js";

// ==========================================
// === ID PATTERNS & BASE SCHEMAS ===
// ==========================================

export const ISO_8601_DATETIME_PATTERN =
  String.raw`^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$`;

export const UUID_V7_PATTERN =
  "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
export const USER_ID_PATTERN = `^usr_${UUID_V7_PATTERN}$`;
export const CONTEXT_ID_PATTERN = `^ctx_${UUID_V7_PATTERN}$`;
export const TRAIL_ID_PATTERN = `^trl_${UUID_V7_PATTERN}$`;
export const GOAL_ID_PATTERN = `^goal_${UUID_V7_PATTERN}$`;

export const userIdSchema = z
  .string()
  .regex(new RegExp(USER_ID_PATTERN), "User ID must be in format usr_<UUID>")
  .describe("User ID in format usr_<UUID>");

export const contextIdSchema = z
  .string()
  .regex(
    new RegExp(CONTEXT_ID_PATTERN),
    "Context ID must be in format ctx_<UUID>"
  )
  .describe("Context ID in format ctx_<UUID>");

export const trailIdSchema = z
  .string()
  .regex(new RegExp(TRAIL_ID_PATTERN), "Trail ID must be in format trl_<UUID>")
  .describe("Trail ID in format trl_<UUID>");

export const goalIdSchema = z
  .string()
  .regex(new RegExp(GOAL_ID_PATTERN), "Goal ID must be in format goal_<UUID>")
  .describe("Goal ID in format goal_<UUID>");

export type UserId = z.infer<typeof userIdSchema>;
export type ContextId = z.infer<typeof contextIdSchema>;
export type TrailId = z.infer<typeof trailIdSchema>;
export type GoalId = z.infer<typeof goalIdSchema>;

// ==========================================
// === DOMAIN ENTITIES ===
// ==========================================

export const newContextReasonSchema = z.enum(REASON_IDS);

export type NewContextReason = z.infer<typeof newContextReasonSchema>;

export const educationLevelSchema = z.enum([
  "NONE",
  "HIGH_SCHOOL",
  "ASSOCIATE",
  "BACHELOR",
  "MASTER",
  "DOCTORATE",
  "PROFESSIONAL",
]);

export type EducationLevel = z.infer<typeof educationLevelSchema>;

export const scheduleSchema = z.object({
  sessionsPerWeek: z.number().describe("Sessions per week"),
  hoursPerSession: z.number().describe("Hours per session"),
});

export const trailSchema = z.object({
  skill: z.string().describe("Skill being developed"),
  platform: z.string().describe("Learning platform used"),
  fromContextId: contextIdSchema,
  toContextId: z
    .union([contextIdSchema, z.null().describe("null for ongoing trails")])
    .describe("Target context ID - string for completed, null for ongoing"),
  totalDurationWeeks: z.number().describe("Total duration in weeks"),
  schedule: scheduleSchema,
  costUsd: z.number().describe("Cost in USD"),
  ratingCourse: z.number().min(1).max(5).describe("Course rating 1-5"),
  ratingPlatform: z.number().min(1).max(5).describe("Platform rating 1-5"),
  ratingSchedule: z.number().min(1).max(5).describe("Schedule rating 1-5"),
  courseName: z.string().describe("Course name").optional(),
  courseLink: z.string().describe("Course URL").optional(),
  userFeedback: z.string().describe("User feedback").optional(),
});

export const userConstraintsSchema = z.object({
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

// Base schema without refine (for .omit() and .partial() compatibility)
const userContextSchemaBase = z.object({
  contextId: z.string(),
  previousContextId: contextIdSchema.nullable().optional(),
  nextContextId: contextIdSchema.nullable().optional(),
  createdAt: z
    .string()
    .regex(new RegExp(ISO_8601_DATETIME_PATTERN), "Must be ISO 8601 format")
    .describe("When this context/event occurred (ISO 8601 format)"),
  creationReason: z
    .array(newContextReasonSchema)
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
  educationLevel: educationLevelSchema.nullable().optional().describe("Education level"),

  // Salary (EITHER exact OR range, mutually exclusive)
  salaryExact: z.number().min(0).nullable().optional()
    .describe("Exact salary in USD. Use if willing to disclose precise amount. Mutually exclusive with salaryMin/salaryMax."),
  salaryMin: z.number().min(0).nullable().optional()
    .describe("Salary range minimum in USD. For privacy, specify range instead of exact. Use with salaryMax."),
  salaryMax: z.number().min(0).nullable().optional()
    .describe("Salary range maximum in USD. For privacy, specify range instead of exact. Use with salaryMin."),
});

// Schema with salary validation
export const userContextSchema = userContextSchemaBase.refine(
  (data) => {
    const hasExact = data.salaryExact != null;
    const hasRange = data.salaryMin != null || data.salaryMax != null;

    // Cannot specify both exact and range
    if (hasExact && hasRange) {
      return false;
    }

    // If range specified, min <= max
    if (data.salaryMin != null && data.salaryMax != null) {
      return data.salaryMin <= data.salaryMax;
    }

    // If only min OR only max specified - allow (e.g., ">100k" or "<150k")
    return true;
  },
  {
    message: "Specify either exact salary OR salary range (min/max), not both. If range, min must be <= max.",
    path: ["salaryExact"],
  }
);

// Export base for internal use (.omit(), .partial())
export { userContextSchemaBase };

export type Schedule = z.infer<typeof scheduleSchema>;
export type Trail = z.infer<typeof trailSchema>;
export type UserConstraints = z.infer<typeof userConstraintsSchema>;
export type UserContext = z.infer<typeof userContextSchema>;

// ==========================================
// === TARGET SEARCH FILTER SCHEMAS ===
// ==========================================

/**
 * Filter mode for target search - discriminator for field filters
 */
export const filterModeSchema = z.enum(["desired", "undesired"]);
export type FilterMode = z.infer<typeof filterModeSchema>;

/**
 * Field filter with mode + values (discriminated union pattern)
 * Enforces mutual exclusivity between desired/undesired at type level
 */
export const fieldFilterSchema = z.object({
  mode: filterModeSchema.describe("Filter mode: desired (include) or undesired (exclude)"),
  values: z
    .array(
      z.string()
        .min(1, "Value cannot be empty")
        .trim()
    )
    .min(1, "At least one value required")
    .max(5, "Maximum 5 values allowed"),
});
export type FieldFilter = z.infer<typeof fieldFilterSchema>;

/**
 * Target context for search criteria
 * Uses FieldFilter discriminated union pattern
 */
export const targetContextSchema = z.object({
  position: fieldFilterSchema.optional().describe("Target position filter"),
  countries: fieldFilterSchema.optional().describe("Target countries filter"),
  domains: fieldFilterSchema.optional().describe("Target work domains filter"),
  skills: fieldFilterSchema.optional().describe("Target skills filter"),
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

export type TargetContext = z.infer<typeof targetContextSchema>;

// ==========================================
// === SEARCH FILTERS SCHEMAS ===
// ==========================================

/**
 * Available context field names for search configuration
 */
export const contextFieldSchema = z.enum([
  "position",
  "domains",
  "skills",
  "industry",
  "countryCode",
  "cityName",
  "companySize",
  "birthYear",
  "educationLevel",
], {
  description: "Available field names for search configuration",
});

export type ContextField = z.infer<typeof contextFieldSchema>;

/**
 * Base schema for user/adhoc search parameters (shared fields)
 * Internal only - not exported
 */
const userSearchParamsBaseSchema = z.object({
  userId: userIdSchema.describe("User ID (resolves context from DB)"),
  excludedContextFields: z
    .array(contextFieldSchema)
    .default([])
    .describe(
      "Fields to exclude from comparison (inverse logic: all fields EXCEPT these are strict). " +
      "WARNING: Excluding all fields will match all users - not recommended for production use."
    )
    .refine(
      (fields) => !fields.includes('skills'),
      {
        message: "Cannot exclude 'skills' - skills scoring (penalties) is required for ranking candidates when no trajectory exists"
      }
    ),
  excludedCreationReasons: z
    .array(newContextReasonSchema)
    .default([])
    .describe("Exclude candidates with these transition reasons (backward path filter in Cypher)"),
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
    .describe("Maximum number of results to return (pre-filter before DTW)"),
  pathLimit: z
    .number()
    .min(1)
    .max(100)
    .default(20)
    .describe("Final result limit after DTW analysis (ignored if user has no trajectory)"),
});

/**
 * User search parameters (Mode 2: search by user's current context)
 * Flat structure with inverse field filtering logic
 */
export const userSearchParamsSchema = userSearchParamsBaseSchema.refine(
  (data) => data.pathLimit <= data.limit,
  {
    message: "pathLimit must be <= limit (cannot return more results than fetched from DB)",
    path: ["pathLimit"],
  }
);

export type UserSearchParams = z.infer<typeof userSearchParamsSchema>;

/**
 * Ad-hoc search parameters with custom reference context (Mode 1)
 * Extends UserSearchParams with explicit referenceContext
 */
export const adhocSearchParamsSchema = userSearchParamsBaseSchema.extend({
  referenceContext: userContextSchema.describe("Custom reference context (extracted from user text)"),
}).refine(
  (data) => data.pathLimit <= data.limit,
  {
    message: "pathLimit must be <= limit (cannot return more results than fetched from DB)",
    path: ["pathLimit"],
  }
);

export type AdhocSearchParams = z.infer<typeof adhocSearchParamsSchema>;

/**
 * Target search parameters (Mode 4: reverse search by target criteria)
 * Flat structure with positive field filtering logic
 */
export const targetSearchParamsSchema = z.object({
  userId: userIdSchema.describe("User ID to exclude from results (avoid self-match)"),
  criteria: targetContextSchema.describe("Target context criteria (FieldFilter with mode/values)"),
  excludedCreationReasons: z
    .array(newContextReasonSchema)
    .default([])
    .describe("Exclude candidates with these transition reasons (backward path filter)"),
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

export type TargetSearchParams = z.infer<typeof targetSearchParamsSchema>;

// ==========================================
// === STORY & GOAL OPERATIONS ===
// ==========================================

export const storyInputSchema = z.object({
  userId: userIdSchema,
  contexts: z.array(userContextSchema).min(1),
  trails: z.array(trailSchema).min(0),
});

export const upsertContextResultSchema = z.object({
  success: z.boolean(),
  contextIds: z.array(contextIdSchema),
});

export const upsertTrailResultSchema = z.object({
  success: z.boolean(),
  trailIds: z.array(trailIdSchema),
});

export const upsertStoryResultSchema = z.object({
  contexts: upsertContextResultSchema,
  trails: upsertTrailResultSchema,
});

export const goalSchema = z.object({
  userId: userIdSchema,
  targetCriteria: targetContextSchema.describe("Target position criteria with FieldFilter pattern"),
  createdAt: z
    .string()
    .regex(new RegExp(ISO_8601_DATETIME_PATTERN), "Must be ISO 8601 format")
    .describe("When goal was created (ISO 8601 format)"),
});

export const createGoalInputSchema = z.object({
  userId: userIdSchema,
  targetContext: targetContextSchema.describe("Target search criteria"),
});

export type StoryInput = z.infer<typeof storyInputSchema>;
export type UpsertContextResult = z.infer<typeof upsertContextResultSchema>;
export type UpsertTrailResult = z.infer<typeof upsertTrailResultSchema>;
export type UpsertStoryResult = z.infer<typeof upsertStoryResultSchema>;
export type Goal = z.infer<typeof goalSchema>;
export type CreateGoalInput = z.infer<typeof createGoalInputSchema>;

// ==========================================
// === SEARCH CANDIDATE TYPES (композиция) ===
// ==========================================

// DTW metrics schema
export const dtwMetricsSchema = z.object({
  shapeSimilarity: z
    .number()
    .min(0)
    .max(1)
    .describe("Path shape similarity (0-1)"),
  tempoSimilarity: z
    .number()
    .min(0)
    .max(1)
    .describe("Career speed similarity (0-1)"),
  stabilityScore: z
    .number()
    .min(0)
    .max(1)
    .describe("Job stability metric (0-1)"),
});

export type DTWMetrics = z.infer<typeof dtwMetricsSchema>;

// ==========================================
// === COMPOSITION BLOCKS (defined once) ===
// ==========================================

// Block 1: Core fields
export const candidateCoreSchema = z.object({
  userId: userIdSchema.describe("Candidate user ID"),
  matchedContext: userContextSchema.describe(
    "Context that matched search criteria"
  ),
  timeSinceMatchedMonths: z
    .number()
    .min(0)
    .describe("Months since matched context was created"),
});

export type CandidateCore = z.infer<typeof candidateCoreSchema>;

// Block 2: Context scoring fields
export const contextScoringFieldsSchema = z.object({
  contextMatchScore: z
    .number()
    .min(0)
    .max(1)
    .describe(
      "Context match score (0-1, computed as 1.0 - skills_penalty in Cypher)"
    ),
  candidateType: z
    .enum(["pathfinder", "waymate"])
    .nullable()
    .describe("Pathfinder = reached goal, Waymate = same goal, null = regular"),
});

export type ContextScoringFields = z.infer<typeof contextScoringFieldsSchema>;

// Block 3: Path fields (renamed: trajectory → path)
export const pathFieldsSchema = z.object({
  path: z
    .array(userContextSchema)
    .describe("Full career path from started_working to matched_context"),
});

export type PathFields = z.infer<typeof pathFieldsSchema>;

// Block 4: DTW fields
export const dtwFieldsSchema = z.object({
  dtwMetrics: dtwMetricsSchema,
  dtwTotal: z
    .number()
    .min(0)
    .max(3)
    .describe("Sum of shape + tempo + stability (0-3)"),
});

export type DTWFields = z.infer<typeof dtwFieldsSchema>;

// ==========================================
// === FINAL TYPES (composition) ===
// ==========================================

// Type 1: Core only
export const matchedCandidateSchema = candidateCoreSchema;
export type MatchedCandidate = CandidateCore;

// Type 2: Core + Scoring + Optional Path + Optional DTW
// Unified type for both simple context search and DTW search
export const scoredMatchedCandidateSchema = candidateCoreSchema
  .merge(contextScoringFieldsSchema)
  .merge(pathFieldsSchema.partial())
  .merge(dtwFieldsSchema.partial());
export type ScoredMatchedCandidate = z.infer<
  typeof scoredMatchedCandidateSchema
>;

// Type 3: Core + Path
export const matchedCandidateWithPathSchema =
  candidateCoreSchema.merge(pathFieldsSchema);
export type MatchedCandidateWithPath = z.infer<
  typeof matchedCandidateWithPathSchema
>;

// Type 4: Core + Path + Scoring
export const scoredMatchedCandidateWithPathSchema = candidateCoreSchema.merge(
  pathFieldsSchema
).merge(contextScoringFieldsSchema);
export type ScoredMatchedCandidateWithPath = z.infer<
  typeof scoredMatchedCandidateWithPathSchema
>;

// Type 5: Core + Path + Scoring + DTW
export const scoredMatchedCandidateWithPathAndDTWSchema =
  candidateCoreSchema.merge(pathFieldsSchema)
    .merge(contextScoringFieldsSchema)
    .merge(dtwFieldsSchema)
    .refine(
      (data) => {
        const computed =
          data.dtwMetrics.shapeSimilarity +
          data.dtwMetrics.tempoSimilarity +
          data.dtwMetrics.stabilityScore;
        return Math.abs(data.dtwTotal - computed) < 0.001;
      },
      { message: "dtwTotal must equal sum of dtwMetrics" }
    );
export type ScoredMatchedCandidateWithPathAndDTW = z.infer<
  typeof scoredMatchedCandidateWithPathAndDTWSchema
>;

// ==========================================
// === DEPRECATED TYPES (для обратной совместимости) ===
// ==========================================

/**
 * @deprecated Use matchedCandidateSchema instead
 */
export const candidateMatchedSchema = candidateCoreSchema;
export type CandidateMatched = CandidateCore;

/**
 * @deprecated Use matchedCandidateWithPathSchema instead.
 * Note: field renamed from 'trajectory' to 'path'
 */
export const candidateWithPathSchema = candidateCoreSchema.extend({
  trajectory: z
    .array(userContextSchema)
    .describe("Full career path from started_working to matched_context"),
});
export type CandidateWithPath = z.infer<typeof candidateWithPathSchema>;

/**
 * @deprecated Internal type, will be removed. Use ScoredMatchedCandidate instead.
 */
export const candidatePreDTWSchema = candidateCoreSchema.omit({
  timeSinceMatchedMonths: true,
}).extend({
  skillsPenalty: z
    .number()
    .min(0)
    .max(1)
    .describe("Penalty for extra skills (0-1, normalized)"),
  candidateType: z
    .enum(["pathfinder", "waymate"])
    .nullable()
    .describe("Pathfinder = reached goal, Waymate = same goal, null = regular"),
});
export type CandidatePreDTW = z.infer<typeof candidatePreDTWSchema>;

/**
 * @deprecated Use scoredMatchedCandidateSchema instead.
 * Note: total_score removed, use explicit sorting formula
 */
export const candidateBasicSchema = candidateCoreSchema.extend({
  skillsPenalty: z
    .number()
    .min(0)
    .max(1)
    .describe("Penalty for extra skills (0-1, normalized)"),
  totalScore: z.number().describe("Combined score for ranking"),
  candidateType: z
    .enum(["pathfinder", "waymate"])
    .nullable()
    .describe("Pathfinder = reached goal, Waymate = same goal, null = regular"),
});
export type CandidateBasic = z.infer<typeof candidateBasicSchema>;

/**
 * @deprecated Use scoredMatchedCandidateWithPathAndDTWSchema instead.
 * Note: field renamed from 'trajectory' to 'path', total_score removed
 */
export const candidateWithDTWSchema = candidateWithPathSchema.extend({
  skillsPenalty: z
    .number()
    .min(0)
    .max(1)
    .describe("Penalty for extra skills (0-1, normalized)"),
  totalScore: z
    .number()
    .describe("dtw_total + (1.0 - skills_penalty) for sorting"),
  candidateType: z
    .enum(["pathfinder", "waymate"])
    .nullable()
    .describe("Pathfinder = reached goal, Waymate = same goal, null = regular"),
  dtwMetrics: dtwMetricsSchema,
  dtwTotal: z
    .number()
    .min(0)
    .max(3)
    .describe("Sum of shape + tempo + stability (0-3)"),
});
export type CandidateWithDTW = z.infer<typeof candidateWithDTWSchema>;

// ==========================================
// === PATH COLLECTION TYPES ===
// ==========================================

/**
 * Result of batch path collection query
 */
export const pathBatchResultSchema = z.object({
  userId: z.string().describe("User ID for which trajectory was collected"),
  path: z.array(userContextSchema).describe("Trajectory from career start to current context")
});

export type PathBatchResult = z.infer<typeof pathBatchResultSchema>;
