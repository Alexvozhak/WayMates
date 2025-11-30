import { z } from "zod";

import { REASON_IDS } from "../../database/reasons.js";

// ==========================================
// === ID PATTERNS & BASE SCHEMAS ===
// ==========================================

export const ISO_8601_DATETIME_PATTERN = String.raw`^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$`;

export const UUID_V7_PATTERN = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
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
  .regex(new RegExp(CONTEXT_ID_PATTERN), "Context ID must be in format ctx_<UUID>")
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

/**
 * ISO 639-1 language code (2-letter lowercase)
 * Valid codes defined in database/languages.json
 */
export const languageCodeSchema = z
  .string()
  .length(2)
  .regex(/^[a-z]{2}$/, "Language code must be lowercase ISO 639-1 format")
  .describe("ISO 639-1 language code (e.g., 'en', 'de', 'ru')");

export type LanguageCode = z.infer<typeof languageCodeSchema>;

export const scheduleSchema = z.object({
  // Note: .nullable() required for OpenAI Structured Output API compatibility
  sessionsPerWeek: z.number().describe("Sessions per week").nullable().optional(),
  hoursPerSession: z.number().describe("Hours per session").nullable().optional(),
});

export const trailSchema = z.object({
  trailId: trailIdSchema.describe("Trail ID in format trl_<UUID>"),
  skill: z.string().describe("Skill being developed"),
  platform: z.string().describe("Learning platform used"),
  fromContextId: z
    .union([contextIdSchema, z.null().describe("null for trails leading to first context")])
    .describe("Source context ID - string for transition between contexts, null for first context"),
  toContextId: z
    .union([contextIdSchema, z.null().describe("null for ongoing trails")])
    .describe("Target context ID - string for completed, null for ongoing"),

  // OPTIONAL metrics (не всегда известны при extraction)
  // Note: .nullable() required for OpenAI Structured Output API compatibility
  totalDurationWeeks: z.number().describe("Total duration in weeks").nullable().optional(),
  schedule: scheduleSchema.nullable().optional(),
  costUsd: z.number().describe("Cost in USD").nullable().optional(),
  ratingCourse: z.number().min(1).max(5).describe("Course rating 1-5").nullable().optional(),
  ratingPlatform: z.number().min(1).max(5).describe("Platform rating 1-5").nullable().optional(),
  ratingSchedule: z.number().min(1).max(5).describe("Schedule rating 1-5").nullable().optional(),

  courseName: z.string().describe("Course name").nullable().optional(),
  courseLink: z.string().describe("Course URL").nullable().optional(),
  userFeedback: z.string().describe("User feedback").nullable().optional(),
});

export const userConstraintsSchema = z.object({
  maxHoursPerWeek: z.number().describe("Maximum hours per week").optional(),
  maxMonthlyBudget: z.number().describe("Maximum monthly budget in USD").optional(),
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
      "Reasons for context creation (always required, use 'started_working' for first job)",
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
  salaryExact: z
    .number()
    .min(0)
    .nullable()
    .optional()
    .describe(
      "Exact salary in USD. Use if willing to disclose precise amount. Mutually exclusive with salaryMin/salaryMax.",
    ),
  salaryMin: z
    .number()
    .min(0)
    .nullable()
    .optional()
    .describe(
      "Salary range minimum in USD. For privacy, specify range instead of exact. Use with salaryMax.",
    ),
  salaryMax: z
    .number()
    .min(0)
    .nullable()
    .optional()
    .describe(
      "Salary range maximum in USD. For privacy, specify range instead of exact. Use with salaryMin.",
    ),

  // Languages (B2+ proficiency)
  // Semantics: If language in array → B2+ level (fluent for work)
  languages: z
    .array(languageCodeSchema)
    .nullable()
    .optional()
    .describe("Languages with B2+ proficiency (if present → work-ready level)"),

  // User feedback/reflection on this career transition
  feedback: z
    .string()
    .max(200)
    .nullish()
    .describe(
      "Personal reflection on this transition: emotions, insights, lessons learned (max 200 chars)",
    ),
});

export const adhocUserContextSchema = userContextSchemaBase
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for search",
  });

export type AdhocUserContext = z.infer<typeof adhocUserContextSchema>;

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
    message:
      "Specify either exact salary OR salary range (min/max), not both. If range, min must be <= max.",
    path: ["salaryExact"],
  },
);

// Partial schema for clarification workflow (without refine - validation happens on merge)
export const userContextSchemaPartial = userContextSchemaBase.partial();

export type UserContextPartial = z.infer<typeof userContextSchemaPartial>;

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
    .array(z.string().min(1, "Value cannot be empty").trim())
    .min(1, "At least one value required")
    .max(5, "Maximum 5 values allowed"),
});
export type FieldFilter = z.infer<typeof fieldFilterSchema>;

/**
 * Target context for search criteria
 * Uses FieldFilter discriminated union pattern
 */
export const targetContextSchema = z
  .object({
    position: fieldFilterSchema.optional().describe("Target position filter"),
    countries: fieldFilterSchema.optional().describe("Target countries filter"),
    domains: fieldFilterSchema.optional().describe("Target work domains filter"),
    skills: fieldFilterSchema.optional().describe("Target skills filter"),
    languages: fieldFilterSchema.optional().describe("Target languages filter"),
  })
  .refine(
    (data) => {
      const hasAtLeastOne =
        data.position !== undefined ||
        data.countries !== undefined ||
        data.domains !== undefined ||
        data.skills !== undefined ||
        data.languages !== undefined;
      return hasAtLeastOne;
    },
    {
      message:
        "At least one target criterion is required (position, countries, domains, skills, or languages)",
    },
  );

export type TargetContext = z.infer<typeof targetContextSchema>;

// ==========================================
// === SEARCH FILTERS SCHEMAS ===
// ==========================================

/**
 * Available context field names for search configuration
 */
export const contextFieldSchema = z.enum(
  [
    "position",
    "domains",
    "skills",
    "industry",
    "countryCode",
    "cityName",
    "companySize",
    "birthYear",
    "educationLevel",
    "languages",
  ],
  {
    description: "Available field names for search configuration",
  },
);

export type ContextField = z.infer<typeof contextFieldSchema>;

// Extract field names from Zod schema to avoid duplication
export const CONTEXT_FIELD_NAMES = contextFieldSchema.options;
/**
 * Raw base schema for user/adhoc search parameters (shared fields)
 * WITHOUT pathLimit validation - for extending in derived schemas (Facade)
 * Exported for Facade to compose its own schemas
 */
export const userSearchParamsRawSchema = z.object({
  userId: userIdSchema.describe("User ID (resolves context from DB)"),
  excludedContextFields: z
    .array(contextFieldSchema)
    .default([])
    .describe(
      "Fields to exclude from comparison (inverse logic: all fields EXCEPT these are strict). " +
        "WARNING: Excluding all fields will match all users - not recommended for production use.",
    )
    .refine((fields) => !fields.includes("skills"), {
      message:
        "Cannot exclude 'skills' - skills scoring (penalties) is required for ranking candidates when no trajectory exists",
    }),
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
 * Validated base schema WITH pathLimit <= limit check
 * Exported for reuse in Facade (replace userId with sessionId)
 */
export const userSearchParamsBaseSchema = userSearchParamsRawSchema.refine(
  (data) => data.pathLimit <= data.limit,
  {
    message: "pathLimit must be <= limit (cannot return more results than fetched from DB)",
    path: ["pathLimit"],
  },
);

/**
 * User search parameters (Mode 2: search by user's current context)
 * Flat structure with inverse field filtering logic
 */
export const userSearchParamsSchema = userSearchParamsBaseSchema;

export type UserSearchParams = z.infer<typeof userSearchParamsSchema>;

export const adhocSearchParamsSchema = userSearchParamsRawSchema
  .extend({
    referenceContext: adhocUserContextSchema,
  })
  .refine((data) => data.pathLimit <= data.limit, {
    message: "pathLimit must be <= limit (cannot return more results than fetched from DB)",
    path: ["pathLimit"],
  });

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
  limit: z.number().min(1).max(100).default(20).describe("Maximum number of results to return"),
});

export type TargetSearchParams = z.infer<typeof targetSearchParamsSchema>;

// ==========================================
// === STORY & GOAL OPERATIONS ===
// ==========================================

export const storyInputSchema = z
  .object({
    userId: userIdSchema,
    contexts: z.array(userContextSchema).min(1),
    trails: z.array(trailSchema).min(0),
  })
  .superRefine((data, ctx) => {
    if (data.contexts.length === 1) {
      return;
    }

    const contextIds = new Set(data.contexts.map((c) => c.contextId));

    // Rule 1: Exactly one current context (nextContextId = null)
    const currentCount = data.contexts.filter((c) => !c.nextContextId).length;
    if (currentCount !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["contexts"],
        message: `Expected exactly 1 current context (nextContextId=null), found ${currentCount}`,
      });
    }

    // Rule 2: All references must exist (no dangling pointers)
    for (const context of data.contexts) {
      if (context.previousContextId && !contextIds.has(context.previousContextId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["contexts"],
          message: `Context ${context.contextId} references non-existent previousContextId: ${context.previousContextId}`,
        });
      }
      if (context.nextContextId && !contextIds.has(context.nextContextId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["contexts"],
          message: `Context ${context.contextId} references non-existent nextContextId: ${context.nextContextId}`,
        });
      }
    }
  });

export const upsertContextInputSchema = z.object({
  userId: userIdSchema,
  context: userContextSchema,
});

export const upsertContextResultSchema = z.object({
  success: z.boolean(),
  contextIds: z.array(contextIdSchema),
});

export const upsertSingleContextResultSchema = z.object({
  success: z.boolean(),
  contextId: contextIdSchema,
});

export const upsertTrailInputSchema = z.object({
  userId: userIdSchema,
  trail: trailSchema,
});

export const upsertTrailResultSchema = z.object({
  success: z.boolean(),
  trailIds: z.array(trailIdSchema),
});

export const upsertSingleTrailResultSchema = z.object({
  success: z.boolean(),
  trailId: trailIdSchema,
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

export const updateContextInputSchema = userContextSchemaBase
  .omit({
    contextId: true,
    previousContextId: true,
    nextContextId: true,
    createdAt: true,
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  });

export const updateContextParamsSchema = z.object({
  userId: userIdSchema,
  updates: updateContextInputSchema,
});

export type StoryInput = z.infer<typeof storyInputSchema>;
export type UpsertContextInput = z.infer<typeof upsertContextInputSchema>;
export type UpsertContextResult = z.infer<typeof upsertContextResultSchema>;
export type UpsertSingleContextResult = z.infer<typeof upsertSingleContextResultSchema>;
export type UpsertTrailInput = z.infer<typeof upsertTrailInputSchema>;
export type UpsertTrailResult = z.infer<typeof upsertTrailResultSchema>;
export type UpsertSingleTrailResult = z.infer<typeof upsertSingleTrailResultSchema>;
export type UpsertStoryResult = z.infer<typeof upsertStoryResultSchema>;
export type Goal = z.infer<typeof goalSchema>;
export type CreateGoalInput = z.infer<typeof createGoalInputSchema>;
export type UpdateContextInput = z.infer<typeof updateContextInputSchema>;
export type UpdateContextParams = z.infer<typeof updateContextParamsSchema>;

// ==========================================
// === SEARCH CANDIDATE TYPES (композиция) ===
// ==========================================

// DTW metrics schema
export const dtwMetricsSchema = z.object({
  shapeSimilarity: z.number().min(0).max(1).describe("Path shape similarity (0-1)"),
  tempoSimilarity: z.number().min(0).max(1).describe("Career speed similarity (0-1)"),
  stabilityScore: z.number().min(0).max(1).describe("Job stability metric (0-1)"),
});

export type DTWMetrics = z.infer<typeof dtwMetricsSchema>;

// ==========================================
// === COMPOSITION BLOCKS (defined once) ===
// ==========================================

// Block 1: Core fields
export const candidateCoreSchema = z.object({
  userId: userIdSchema.describe("Candidate user ID"),
  matchedContext: userContextSchema.describe("Context that matched search criteria"),
  timeSinceMatchedMonths: z.number().min(0).describe("Months since matched context was created"),
});

export type CandidateCore = z.infer<typeof candidateCoreSchema>;

// Block 2: Context scoring fields
export const contextScoringFieldsSchema = z.object({
  contextMatchScore: z
    .number()
    .min(0)
    .describe("Context match score (raw: matched weights - extra penalties, >= 0)"),
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
  dtwTotal: z.number().min(0).max(3).describe("Sum of shape + tempo + stability (0-3)"),
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
export type ScoredMatchedCandidate = z.infer<typeof scoredMatchedCandidateSchema>;

// Type 3: Core + Path
export const matchedCandidateWithPathSchema = candidateCoreSchema.merge(pathFieldsSchema);
export type MatchedCandidateWithPath = z.infer<typeof matchedCandidateWithPathSchema>;

// Type 4: Core + Path + Scoring
export const scoredMatchedCandidateWithPathSchema = candidateCoreSchema
  .merge(pathFieldsSchema)
  .merge(contextScoringFieldsSchema);
export type ScoredMatchedCandidateWithPath = z.infer<typeof scoredMatchedCandidateWithPathSchema>;

// Type 5: Core + Path + Scoring + DTW
export const scoredMatchedCandidateWithPathAndDTWSchema = candidateCoreSchema
  .merge(pathFieldsSchema)
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
    { message: "dtwTotal must equal sum of dtwMetrics" },
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

// ==========================================
// === PATH COLLECTION TYPES ===
// ==========================================

/**
 * Result of batch path collection query
 */
export const pathBatchResultSchema = z.object({
  userId: z.string().describe("User ID for which trajectory was collected"),
  path: z.array(userContextSchema).describe("Trajectory from career start to current context"),
});

export type PathBatchResult = z.infer<typeof pathBatchResultSchema>;

// ==========================================
// === DICTIONARIES ===
// ==========================================

/**
 * Dictionaries containing verified canonical terms
 * Used by LLM for normalization (user input → canonical name)
 * Keys use singular form matching SimpleDictionaryType
 */
export const dictionariesSchema = z.object({
  skill: z.array(z.string()),
  position: z.array(z.string()),
  domain: z.array(z.string()),
  city: z.array(z.string()),
  industry: z.array(z.string()),
  platform: z.array(z.string()),
  language: z.array(z.string()),
  reasons: z.array(z.string()),
});

export type Dictionaries = z.infer<typeof dictionariesSchema>;

// All dictionary keys (for cache, getVerifiedDictionaries)
export type DictionaryType = keyof Dictionaries;

// User-extensible dictionaries (excluding reasons - different node schema)
export type SimpleDictionaryType = Exclude<DictionaryType, "reasons">;

// Runtime enum for addTerm + validation
const simpleDictionaryTypes = [
  "skill",
  "position",
  "domain",
  "city",
  "industry",
  "platform",
  "language",
] as const satisfies readonly SimpleDictionaryType[];

export const simpleDictionaryTypeSchema = z.enum(simpleDictionaryTypes);

export const addTermInputSchema = z.object({
  type: simpleDictionaryTypeSchema,
  canonicalName: z.string().min(1),
  complexity: z.number().int().min(0).max(100).nullish(),
  verified: z.boolean(),
  createdBy: z.string().min(1),
});

export type AddTermInput = z.infer<typeof addTermInputSchema>;
